import type { IUIConfig } from "src/core/config";
import {
  getActivityTypeTagIds,
  isActivityTypeSceneMarker,
} from "../Scenes/SceneDetails/sceneMarkerActivityType_custom";
import { getSceneCardInsightSets } from "../Scenes/sceneCardInsightsData_custom";
import type {
  SceneCardInsightCandidate,
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightScene,
  SceneCardInsightThresholds,
} from "../Scenes/sceneCardInsightTypes_custom";
import { insightStatsCatalog } from "./insightStatsCatalog_custom";

export type InsightStatsConfig = Pick<
  IUIConfig,
  | "roleTagIds"
  | "sceneCardInsightThresholds"
  | "ratingCardOverrideTagIds"
  | "ratingCardThresholds"
>;
export type InsightStatsScene = SceneCardInsightScene & {
  title?: string | null;
};
export type InsightStatsMode = "all" | "visible";
export type InsightStatsCount = { all: number; visible: number };
export type InsightStatsVariant = InsightStatsCount & {
  label: string;
  sceneIds: { all: string[]; visible: string[] };
  examples: Array<{ id: string; title: string; label: string }>;
};
export type InsightStatsRow = InsightStatsCount & {
  sceneIds: { all: string[]; visible: string[] };
  variants: Map<string, InsightStatsVariant>;
  parts: Map<string, InsightStatsVariant>;
};
export type InsightStatsResult = {
  scanned: number;
  total: number;
  withoutChips: number;
  excludedWithoutMarkers: number;
  excludedWithoutEndTime: number;
  withoutDuration: number;
  rows: Map<string, InsightStatsRow>;
};

export function createInsightStatsResult(): InsightStatsResult {
  return {
    scanned: 0,
    total: 0,
    withoutChips: 0,
    excludedWithoutMarkers: 0,
    excludedWithoutEndTime: 0,
    withoutDuration: 0,
    rows: new Map(
      insightStatsCatalog.map(({ id }) => [
        id,
        {
          all: 0,
          visible: 0,
          sceneIds: { all: [], visible: [] },
          variants: new Map(),
          parts: new Map(),
        },
      ])
    ),
  };
}

export function isInsightStatsEligibleScene(
  scene: InsightStatsScene,
  roleTagIds?: IUIConfig["roleTagIds"]
) {
  const activityTypeTagIds = getActivityTypeTagIds(roleTagIds);
  return scene.scene_markers.some(
    (marker) =>
      isActivityTypeSceneMarker(marker, activityTypeTagIds) &&
      marker.end_seconds !== null &&
      marker.end_seconds !== undefined
  );
}

// Count scenes, not marker/performer occurrences. A family and a combination
// each contribute at most once per scene, even with several GOAT performers.
export function countInsightStatsScene(
  result: InsightStatsResult,
  scene: InsightStatsScene,
  candidates: SceneCardInsightCandidate[],
  visibleKeys: ReadonlySet<string>
) {
  result.total += 1;
  if (!candidates.length) result.withoutChips += 1;
  if (!(scene.files[0]?.duration > 0)) result.withoutDuration += 1;
  insightStatsCatalog.forEach((definition) => {
    const matches = candidates.filter(definition.matches);
    if (!matches.length) return;
    const row = result.rows.get(definition.id)!;
    row.all += 1;
    row.sceneIds.all.push(scene.id);
    if (matches.some(({ key }) => visibleKeys.has(key)))
      row.sceneIds.visible.push(scene.id);
    if (matches.some(({ key }) => visibleKeys.has(key))) row.visible += 1;
    const variants = new Map<string, SceneCardInsightCandidate[]>();
    const parts = new Map<string, SceneCardInsightCandidate[]>();
    matches.forEach((candidate) => {
      const label = candidate.statsLabel ?? candidate.label;
      const group = variants.get(label) ?? [];
      group.push(candidate);
      variants.set(label, group);
      const labels =
        candidate.statsParts ??
        (candidate.kind === "activity-quality"
          ? candidate.label.split(" and ")
          : [label]);
      for (const part of labels) {
        const partGroup = parts.get(part) ?? [];
        partGroup.push(candidate);
        parts.set(part, partGroup);
      }
    });
    const countVariants = (
      groups: Map<string, SceneCardInsightCandidate[]>,
      target: Map<string, InsightStatsVariant>
    ) =>
      groups.forEach((group, label) => {
        const variant = target.get(label) ?? {
          label,
          all: 0,
          visible: 0,
          examples: [],
          sceneIds: { all: [], visible: [] },
        };
        variant.all += 1;
        variant.sceneIds.all.push(scene.id);
        if (group.some(({ key }) => visibleKeys.has(key)))
          variant.sceneIds.visible.push(scene.id);
        if (group.some(({ key }) => visibleKeys.has(key))) variant.visible += 1;
        if (variant.examples.length < 3)
          variant.examples.push({
            id: scene.id,
            title: scene.title?.trim() || `Scene ${scene.id}`,
            label: group[0].label,
          });
        target.set(label, variant);
      });
    countVariants(variants, row.variants);
    countVariants(parts, row.parts);
  });
}

export async function calculateInsightStats(
  scenes: InsightStatsScene[],
  config: InsightStatsConfig,
  thresholds: SceneCardInsightThresholds,
  roleStats: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>,
  isCancelled: () => boolean = () => false
): Promise<InsightStatsResult | undefined> {
  const result = createInsightStatsResult();
  result.scanned = scenes.length;
  for (let index = 0; index < scenes.length; index += 1) {
    if (index % 25 === 0) {
      // Let newer slider changes cancel obsolete work, even inside the worker.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      if (isCancelled()) return undefined;
    }
    const scene = scenes[index];
    if (!scene.scene_markers.length) {
      result.excludedWithoutMarkers += 1;
      continue;
    }
    if (!isInsightStatsEligibleScene(scene, config.roleTagIds)) {
      result.excludedWithoutEndTime += 1;
      continue;
    }
    const sets = getSceneCardInsightSets(
      scene,
      config.roleTagIds,
      thresholds,
      {
        overrideTagIds: config.ratingCardOverrideTagIds,
        thresholds: config.ratingCardThresholds,
      },
      roleStats,
      false
    );
    countInsightStatsScene(
      result,
      scene,
      sets.candidates,
      new Set(sets.visible.map(({ key }) => key))
    );
  }
  return isCancelled() ? undefined : result;
}

export function insightStatsPercentage(count: number, total: number) {
  return total > 0 ? (100 * count) / total : 0;
}

export function compareInsightStatsVariants(
  current: InsightStatsRow,
  preview: InsightStatsRow,
  mode: InsightStatsMode,
  search: string,
  splitTags = false
) {
  const currentVariants = splitTags ? current.parts : current.variants;
  const previewVariants = splitTags ? preview.parts : preview.variants;
  const labels = new Set([
    ...currentVariants.keys(),
    ...previewVariants.keys(),
  ]);
  const query = search.trim().toLocaleLowerCase();
  return [...labels]
    .filter((label) => label.toLocaleLowerCase().includes(query))
    .map((label) => ({
      label,
      current: currentVariants.get(label)?.[mode] ?? 0,
      preview: previewVariants.get(label)?.[mode] ?? 0,
      currentIds: currentVariants.get(label)?.sceneIds[mode] ?? [],
      previewIds: previewVariants.get(label)?.sceneIds[mode] ?? [],
      examples: (previewVariants.get(label) ?? currentVariants.get(label))!
        .examples,
    }))
    .sort(
      (a, b) =>
        b.preview - a.preview ||
        b.current - a.current ||
        a.label.localeCompare(b.label)
    );
}
