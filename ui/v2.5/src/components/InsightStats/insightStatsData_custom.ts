import type { IUIConfig } from "src/core/config";
// CUSTOM: Relative runtime imports also resolve inside the standalone stats worker.
import {
  getRatingCardThresholdsForEntity,
  hasRoyalSapphireSceneBonus,
  hasRoyalSapphireSceneMarker,
} from "../../utils/ratingCardStyles_custom";
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
export type InsightStatsRatingTier =
  | "bronze"
  | "silver"
  | "gold"
  | "royalSapphire"
  | "none";
export type InsightStatsRatingTierSource =
  | "threshold"
  | "goatMarker"
  | "tagOverride"
  | "ratingAdvisor";
export type InsightStatsRatingTierEntityCount = {
  total: number;
  ratedTotal: number;
  ids: string[];
  ratedIds: string[];
  sources: Record<InsightStatsRatingTierSource, number>;
  sourceIds: Record<InsightStatsRatingTierSource, string[]>;
};
export type InsightStatsRatingTierCount = {
  scenes: InsightStatsRatingTierEntityCount;
  vatos: InsightStatsRatingTierEntityCount;
};
export type InsightStatsRatingTierCounts = Record<
  InsightStatsRatingTier,
  InsightStatsRatingTierCount
>;
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
  ratingTiers: InsightStatsRatingTierCounts;
  ratingTierPopulation: { scenes: number; vatos: number };
  rows: Map<string, InsightStatsRow>;
};

function createInsightStatsRatingTierCounts(): InsightStatsRatingTierCounts {
  const entityCount = (): InsightStatsRatingTierEntityCount => ({
    total: 0,
    ratedTotal: 0,
    ids: [],
    ratedIds: [],
    sources: {
      threshold: 0,
      goatMarker: 0,
      tagOverride: 0,
      ratingAdvisor: 0,
    },
    sourceIds: {
      threshold: [],
      goatMarker: [],
      tagOverride: [],
      ratingAdvisor: [],
    },
  });
  return {
    bronze: { scenes: entityCount(), vatos: entityCount() },
    silver: { scenes: entityCount(), vatos: entityCount() },
    gold: { scenes: entityCount(), vatos: entityCount() },
    royalSapphire: { scenes: entityCount(), vatos: entityCount() },
    none: { scenes: entityCount(), vatos: entityCount() },
  };
}

export function createInsightStatsResult(): InsightStatsResult {
  return {
    scanned: 0,
    total: 0,
    withoutChips: 0,
    excludedWithoutMarkers: 0,
    excludedWithoutEndTime: 0,
    withoutDuration: 0,
    ratingTiers: createInsightStatsRatingTierCounts(),
    ratingTierPopulation: { scenes: 0, vatos: 0 },
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

export function insightStatsRatingTier(
  rating: number | null | undefined,
  config: InsightStatsConfig["ratingCardThresholds"],
  entityType: "scene" | "performer"
): InsightStatsRatingTier | undefined {
  if (rating === null || rating === undefined) return undefined;
  const thresholds = getRatingCardThresholdsForEntity(config, entityType);
  if (rating >= thresholds.royalSapphire) return "royalSapphire";
  if (rating >= thresholds.gold) return "gold";
  if (rating >= thresholds.silver) return "silver";
  if (rating >= thresholds.bronze) return "bronze";
  return undefined;
}

type InsightStatsRatingEntity = {
  rating100?: number | null;
  rating_tier_tags?: Array<{ id: string }>;
};

type InsightStatsRatingOutcome = {
  tier: InsightStatsRatingTier;
  source: InsightStatsRatingTierSource;
};

function configuredRatingOverrideTier(
  tags: InsightStatsRatingEntity["rating_tier_tags"],
  config: InsightStatsConfig
): InsightStatsRatingTier | undefined {
  const hasTag = (id?: string | null) =>
    !!id && !!tags?.some((tag) => tag.id === id);
  if (
    hasTag(config.ratingCardOverrideTagIds?.royalSapphireTagId) ||
    hasTag(config.roleTagIds?.goatTagId)
  ) {
    return "royalSapphire";
  }
  if (hasTag(config.ratingCardOverrideTagIds?.goldTagId)) return "gold";
  if (hasTag(config.ratingCardOverrideTagIds?.silverTagId)) return "silver";
  if (hasTag(config.ratingCardOverrideTagIds?.bronzeTagId)) return "bronze";
  return undefined;
}

// CUSTOM: Attribute one final, mutually exclusive tier using the same
// precedence as cards and the metallic filter. Source priority is deterministic
// when multiple Royal Sapphire promotions apply.
export function insightStatsFinalRatingTier(
  entity: InsightStatsRatingEntity,
  config: InsightStatsConfig,
  entityType: "scene" | "performer",
  scene?: InsightStatsScene
): InsightStatsRatingOutcome | undefined {
  if (
    entityType === "scene" &&
    hasRoyalSapphireSceneBonus(scene?.rating_scores)
  ) {
    return { tier: "royalSapphire", source: "ratingAdvisor" };
  }
  if (
    entityType === "scene" &&
    hasRoyalSapphireSceneMarker(
      scene?.scene_markers,
      config.roleTagIds?.goatTagId,
      scene?.scene_marker_tag_ancestors
    )
  ) {
    return { tier: "royalSapphire", source: "goatMarker" };
  }
  const overrideTier = configuredRatingOverrideTier(
    entity.rating_tier_tags,
    config
  );
  if (overrideTier) return { tier: overrideTier, source: "tagOverride" };
  const thresholdTier = insightStatsRatingTier(
    entity.rating100,
    config.ratingCardThresholds,
    entityType
  );
  return thresholdTier
    ? { tier: thresholdTier, source: "threshold" }
    : undefined;
}

function addRatingTierOutcome(
  counts: InsightStatsRatingTierCounts,
  outcome: InsightStatsRatingOutcome | undefined,
  entity: "scenes" | "vatos",
  rated: boolean,
  id: string
) {
  const finalOutcome =
    outcome ??
    (rated ? ({ tier: "none", source: "threshold" } as const) : undefined);
  if (!finalOutcome) return;
  const tierCount = counts[finalOutcome.tier][entity];
  tierCount.total += 1;
  tierCount.ids.push(id);
  if (rated) {
    tierCount.ratedTotal += 1;
    tierCount.ratedIds.push(id);
  }
  tierCount.sources[finalOutcome.source] += 1;
  tierCount.sourceIds[finalOutcome.source].push(id);
}

export function calculateInsightStatsRatingTiers(
  scenes: readonly InsightStatsScene[],
  config: InsightStatsConfig
): InsightStatsRatingTierCounts {
  const counts = createInsightStatsRatingTierCounts();
  const performers = new Map<string, InsightStatsScene["performers"][number]>();
  scenes.forEach((scene) => {
    addRatingTierOutcome(
      counts,
      insightStatsFinalRatingTier(scene, config, "scene", scene),
      "scenes",
      scene.rating100 !== null && scene.rating100 !== undefined,
      scene.id
    );
    scene.performers.forEach((performer) => {
      if (!performers.has(performer.id))
        performers.set(performer.id, performer);
    });
  });
  performers.forEach((performer) => {
    addRatingTierOutcome(
      counts,
      insightStatsFinalRatingTier(performer, config, "performer"),
      "vatos",
      performer.rating100 !== null && performer.rating100 !== undefined,
      performer.id
    );
  });
  return counts;
}

export function calculateInsightStatsRatingTierPopulation(
  scenes: readonly InsightStatsScene[]
) {
  return {
    scenes: scenes.filter(
      (scene) => scene.rating100 !== null && scene.rating100 !== undefined
    ).length,
    vatos: new Set(
      scenes.flatMap((scene) =>
        scene.performers
          .filter(
            (performer) =>
              performer.rating100 !== null && performer.rating100 !== undefined
          )
          .map((performer) => performer.id)
      )
    ).size,
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
  result.ratingTiers = calculateInsightStatsRatingTiers(scenes, config);
  result.ratingTierPopulation =
    calculateInsightStatsRatingTierPopulation(scenes);
  for (let index = 0; index < scenes.length; index += 1) {
    if (index % 25 === 0) {
      // Let newer threshold changes cancel obsolete work, even inside the worker.
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
