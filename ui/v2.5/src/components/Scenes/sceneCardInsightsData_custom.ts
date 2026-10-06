import type { IUIConfig } from "src/core/config";
import {
  getPerformerOnlyTimeRoleAction,
  getPerformerRareRoleAction,
} from "../Performers/performerRolePartnerLabels_custom";
import { markerStats, percentOfScene } from "./sceneCardInsightFacts_custom";
import { selectSceneCardInsights } from "./sceneCardInsightSelection_custom";
import type {
  SceneCardInsightCandidate,
  SceneCardInsightEvent,
  SceneCardInsightMarker,
  SceneCardInsightPerformer,
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightScene,
  SceneCardInsightTag,
  SceneCardInsightThresholdKey,
  SceneCardInsightThresholds,
} from "./sceneCardInsightTypes_custom";

export type {
  ISceneCardInsight,
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightScene,
  SceneCardInsightTag,
  SceneCardInsightThresholdKey,
} from "./sceneCardInsightTypes_custom";

const defaultSceneCardInsightThresholds: SceneCardInsightThresholds = {
  visibleInsightLimit: 7,
  rareRoleMaximumPercent: 20,
};

const sceneCardInsightThresholdBounds: Record<
  SceneCardInsightThresholdKey,
  { min: number; max: number }
> = {
  visibleInsightLimit: { min: 1, max: 20 },
  rareRoleMaximumPercent: { min: 0, max: 100 },
};

function boundedThreshold(
  value: IUIConfig["sceneCardInsightThresholds"],
  key: SceneCardInsightThresholdKey
) {
  const { min, max } = sceneCardInsightThresholdBounds[key];
  const setting = value?.[key];
  if (setting === undefined || !Number.isFinite(setting))
    return defaultSceneCardInsightThresholds[key];
  return Math.min(max, Math.max(min, Math.round(setting)));
}

export function normalizeSceneCardInsightThresholds(
  value?: IUIConfig["sceneCardInsightThresholds"]
): SceneCardInsightThresholds {
  return {
    visibleInsightLimit: boundedThreshold(value, "visibleInsightLimit"),
    rareRoleMaximumPercent: boundedThreshold(value, "rareRoleMaximumPercent"),
  };
}

type EventCategory = "orgasm" | "facial";

function allMarkerTags(marker: SceneCardInsightMarker) {
  return [marker.primary_tag, ...marker.tags];
}

function withSceneTagAncestors(
  scene: SceneCardInsightScene
): SceneCardInsightScene {
  if (!scene.scene_marker_tag_ancestors?.length) return scene;

  const ancestorsByTagID = new Map(
    scene.scene_marker_tag_ancestors.map(({ tag_id, ancestor_ids }) => [
      tag_id,
      ancestor_ids,
    ])
  );
  const withAncestors = (tag: SceneCardInsightTag) => {
    const ancestor_ids = ancestorsByTagID.get(tag.id);
    return ancestor_ids ? { ...tag, ancestor_ids } : tag;
  };

  return {
    ...scene,
    scene_markers: scene.scene_markers.map((marker) => ({
      ...marker,
      primary_tag: withAncestors(marker.primary_tag),
      tags: marker.tags.map(withAncestors),
    })),
  };
}

function joinInsightNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function tagMatchesConfiguredTag(
  tag: SceneCardInsightTag,
  configuredTagID?: string,
  visited = new Set<string>()
): boolean {
  if (!configuredTagID || tag.id === configuredTagID) return !!configuredTagID;
  if (tag.ancestor_ids?.includes(configuredTagID)) return true;
  if (visited.has(tag.id)) return false;
  visited.add(tag.id);
  return !!tag.parents?.some((parent) =>
    tagMatchesConfiguredTag(
      parent as SceneCardInsightTag,
      configuredTagID,
      visited
    )
  );
}

function markerHasConfiguredTag(
  marker: SceneCardInsightMarker,
  configuredTagID?: string
) {
  return allMarkerTags(marker).some((tag) =>
    tagMatchesConfiguredTag(tag, configuredTagID)
  );
}

function tagIsActivity(
  tag: SceneCardInsightTag,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  return [
    roleTagIds?.sexTagId,
    roleTagIds?.oralTagId,
    roleTagIds?.soloTagId,
  ].some((tagID) => tag.id === tagID);
}

function tagIsQualifier(
  tag: SceneCardInsightTag,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  return (
    tagMatchesConfiguredTag(tag, roleTagIds?.goatTagId) ||
    tagMatchesConfiguredTag(tag, roleTagIds?.reallyHotTagId) ||
    tagMatchesConfiguredTag(tag, roleTagIds?.secondCameraTagId)
  );
}

function displayTagName(tag: SceneCardInsightTag) {
  // Tag-derived labels preserve the tag's own spelling and casing.
  return tag.name.trim() || `Tag ${tag.id}`;
}

function eventCategoryForTag(
  tag: SceneCardInsightTag,
  roleTagIds: IUIConfig["roleTagIds"]
): EventCategory | undefined {
  if (tagMatchesConfiguredTag(tag, roleTagIds?.facialTagId)) return "facial";
  if (tagMatchesConfiguredTag(tag, roleTagIds?.orgasmTagId)) return "orgasm";
  return undefined;
}

export interface IOutstandingActivityCell {
  duration: number;
  markerCount: number;
  goat?: IOutstandingActivityMeasure;
  outstanding?: IOutstandingActivityMeasure;
}

export interface IOutstandingActivityMeasure {
  duration: number;
  markerCount: number;
}

export interface IOutstandingActivityColumn {
  id: string;
  name: string;
  imagePath?: string | null;
  sceneWide?: boolean;
}

export interface IOutstandingActivityRow extends IOutstandingActivityCell {
  cells: Record<string, IOutstandingActivityCell>;
  parentTagIds?: string[];
  percent: number;
  tag: SceneCardInsightTag;
}

export interface IOutstandingActivityMatrix {
  columns: IOutstandingActivityColumn[];
  rows: IOutstandingActivityRow[];
}

export function shouldShowOutstandingActivityTotalColumn(
  matrix: IOutstandingActivityMatrix
) {
  return matrix.columns.filter((column) => !column.sceneWide).length !== 1;
}

const outstandingActivitySceneWideColumnID = "scene-wide";

function outstandingActivityCell(
  markers: Iterable<SceneCardInsightMarker>,
  sceneDuration: number,
  roleTagIds: IUIConfig["roleTagIds"]
): IOutstandingActivityCell {
  const allMarkers = Array.from(markers);
  const goatMarkers = allMarkers.filter((marker) =>
    markerHasConfiguredTag(marker, roleTagIds?.goatTagId)
  );
  const ordinaryMarkers = allMarkers.filter(
    (marker) => !markerHasConfiguredTag(marker, roleTagIds?.goatTagId)
  );
  const total = markerStats(allMarkers, sceneDuration);
  const measure = (subset: SceneCardInsightMarker[]) => {
    const stats = markerStats(subset, sceneDuration);
    return { duration: stats.duration, markerCount: stats.markerCount };
  };

  return {
    duration: total.duration,
    markerCount: total.markerCount,
    ...(goatMarkers.length > 0 ? { goat: measure(goatMarkers) } : {}),
    ...(ordinaryMarkers.length > 0
      ? { outstanding: measure(ordinaryMarkers) }
      : {}),
  };
}

function allMarkerPerformers(marker: SceneCardInsightMarker) {
  const performers = new Map<string, SceneCardInsightPerformer>();
  [
    ...(marker.top_performers ?? []),
    ...(marker.bottom_performers ?? []),
  ].forEach((performer) => performers.set(performer.id, performer));
  return Array.from(performers.values());
}

// Outstanding activity: every marker tag other than Sex/Oral/Solo, the
// GOAT/Really Hot/2nd Camera qualifiers, and the Orgasm/Facial families.
export function getOutstandingActivityMatrix(
  sourceScene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  includePerformers = true // CUSTOM: the caption needs totals only.
): IOutstandingActivityMatrix {
  const scene = withSceneTagAncestors(sourceScene);
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const groups = new Map<
    string,
    { tag: SceneCardInsightTag; markers: Map<string, SceneCardInsightMarker> }
  >();

  scene.scene_markers
    .filter(
      (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) => {
      allMarkerTags(marker).forEach((tag) => {
        const feetTag = tagMatchesConfiguredTag(tag, roleTagIds?.feetTagId);
        if (
          !feetTag &&
          (tagIsActivity(tag, roleTagIds) ||
            tagIsQualifier(tag, roleTagIds) ||
            eventCategoryForTag(tag, roleTagIds))
        ) {
          return;
        }
        const group = groups.get(tag.id) ?? { tag, markers: new Map() };
        group.markers.set(marker.id, marker);
        groups.set(tag.id, group);
      });
    });

  const performers = new Map(
    (includePerformers ? scene.performers : []).map((performer) => [
      performer.id,
      performer,
    ])
  );
  let hasSceneWideActivity = false;

  const rows = Array.from(groups.values()).map(({ tag, markers }) => {
    const cellMarkers = new Map<string, Map<string, SceneCardInsightMarker>>();
    markers.forEach((marker) => {
      if (!includePerformers) return;
      const creditedPerformers = allMarkerPerformers(marker);
      if (creditedPerformers.length === 0) {
        hasSceneWideActivity = true;
        const unassigned =
          cellMarkers.get(outstandingActivitySceneWideColumnID) ?? new Map();
        unassigned.set(marker.id, marker);
        cellMarkers.set(outstandingActivitySceneWideColumnID, unassigned);
        return;
      }
      creditedPerformers.forEach((performer) => {
        performers.set(performer.id, performer);
        const performerMarkers = cellMarkers.get(performer.id) ?? new Map();
        performerMarkers.set(marker.id, marker);
        cellMarkers.set(performer.id, performerMarkers);
      });
    });

    const stats = outstandingActivityCell(
      markers.values(),
      sceneDuration,
      roleTagIds
    );
    return {
      cells: Object.fromEntries(
        Array.from(cellMarkers.entries()).map(([columnID, cellGroup]) => [
          columnID,
          outstandingActivityCell(
            cellGroup.values(),
            sceneDuration,
            roleTagIds
          ),
        ])
      ),
      ...stats,
      percent: percentOfScene(stats.duration, sceneDuration),
      tag,
    };
  });

  rows.sort(
    (a, b) =>
      b.duration - a.duration ||
      b.markerCount - a.markerCount ||
      displayTagName(a.tag).localeCompare(displayTagName(b.tag)) ||
      a.tag.id.localeCompare(b.tag.id)
  );

  const columns: IOutstandingActivityColumn[] = Array.from(performers.values())
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((performer) => ({
      id: performer.id,
      imagePath: performer.image_path,
      name: performer.name,
    }));
  if (hasSceneWideActivity) {
    columns.push({
      id: outstandingActivitySceneWideColumnID,
      name: "Scene-wide",
      sceneWide: true,
    });
  }

  return { columns, rows };
}

// CUSTOM: thumbnail caption rows. Orgasm and Facial subtags come first
// (not the Orgasm and Facial tags themselves or qualifiers such as Really
// Hot), then the matrix's outstanding activity; each group is longest first.
// Hidden tags drop out only on an exact match, so their subtags still show.
export interface ISceneOutstandingCaptionItemCustom {
  id: string;
  name: string;
  duration: number;
  markerCount: number;
}

function compareCaptionItems(
  a: ISceneOutstandingCaptionItemCustom,
  b: ISceneOutstandingCaptionItemCustom
) {
  return (
    b.duration - a.duration ||
    b.markerCount - a.markerCount ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

export function getSceneOutstandingCaptionCustom(
  sourceScene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): ISceneOutstandingCaptionItemCustom[] {
  const hiddenTagIDs = new Set(
    roleTagIds?.outstandingActivityCommonTagIds?.filter(Boolean)
  );
  const scene = withSceneTagAncestors(sourceScene);
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const eventGroups = new Map<
    string,
    { tag: SceneCardInsightTag; markers: Map<string, SceneCardInsightMarker> }
  >();
  scene.scene_markers
    .filter(
      (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) =>
      allMarkerTags(marker).forEach((tag) => {
        if (
          tag.id === roleTagIds?.orgasmTagId ||
          tag.id === roleTagIds?.facialTagId ||
          tagIsQualifier(tag, roleTagIds) ||
          !eventCategoryForTag(tag, roleTagIds)
        )
          return;
        const group = eventGroups.get(tag.id) ?? { tag, markers: new Map() };
        group.markers.set(marker.id, marker);
        eventGroups.set(tag.id, group);
      })
    );

  const eventItems = Array.from(eventGroups.values()).map(
    ({ tag, markers }) => ({
      id: tag.id,
      name: displayTagName(tag),
      ...markerStats(markers.values(), sceneDuration),
    })
  );
  const activityItems = getOutstandingActivityMatrix(
    scene,
    roleTagIds,
    false
  ).rows.map(({ tag, duration, markerCount }) => ({
    id: tag.id,
    name: displayTagName(tag),
    duration,
    markerCount,
  }));
  return [
    ...eventItems.sort(compareCaptionItems),
    ...activityItems.sort(compareCaptionItems),
  ].filter((item) => !hiddenTagIDs.has(item.id));
}

function orgasmRepeatPhrase(count: number) {
  return count === 2 ? "nuts twice" : `nuts ${count} times`;
}

// CUSTOM: Separate markers for the same moment still count as simultaneous.
const simultaneousOrgasmWindowSeconds = 5;

function largestSimultaneousOrgasmGroup(markers: SceneCardInsightMarker[]) {
  let largest: SceneCardInsightPerformer[] = [];
  let cluster = new Map<string, SceneCardInsightPerformer>();
  let clusterEnd = Number.NEGATIVE_INFINITY;
  const closeCluster = () => {
    if (cluster.size > largest.length) largest = Array.from(cluster.values());
  };

  [...markers]
    .sort((a, b) => a.seconds - b.seconds || a.id.localeCompare(b.id))
    .forEach((marker) => {
      if (marker.seconds > clusterEnd + simultaneousOrgasmWindowSeconds) {
        closeCluster();
        cluster = new Map();
        clusterEnd = Number.NEGATIVE_INFINITY;
      }
      (marker.top_performers ?? []).forEach((performer) =>
        cluster.set(performer.id, performer)
      );
      clusterEnd = Math.max(
        clusterEnd,
        marker.seconds,
        marker.end_seconds ?? marker.seconds
      );
    });
  closeCluster();
  return largest;
}

function getOrgasmCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): SceneCardInsightCandidate[] {
  const orgasmMarkers = scene.scene_markers.filter(
    (marker) =>
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
      markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId)
  );
  const candidates: SceneCardInsightCandidate[] = [];

  const simultaneousPerformers = largestSimultaneousOrgasmGroup(orgasmMarkers);
  const simultaneousCount = simultaneousPerformers.length;
  if (simultaneousCount >= 2) {
    candidates.push({
      key: "orgasm-simultaneous",
      label: `${simultaneousCount} vatos nut at the same time`,
      detail: `Top vatos on one Orgasm marker, or on Orgasm markers that overlap or start within ${simultaneousOrgasmWindowSeconds}s`,
      tone: "event",
      kind: "orgasm-event",
      score: 2_000_000 + simultaneousCount,
      performerPreviews: simultaneousPerformers,
    });
  }

  const performerMarkers = new Map<
    string,
    {
      markers: Map<string, SceneCardInsightMarker>;
      performer: SceneCardInsightPerformer;
    }
  >();
  orgasmMarkers.forEach((marker) => {
    (marker.top_performers ?? []).forEach((performer) => {
      const group = performerMarkers.get(performer.id) ?? {
        markers: new Map<string, SceneCardInsightMarker>(),
        performer,
      };
      group.markers.set(marker.id, marker);
      performerMarkers.set(performer.id, group);
    });
  });

  performerMarkers.forEach(({ markers, performer }) => {
    if (markers.size < 2) return;
    candidates.push({
      key: `orgasm-repeat-${performer.id}`,
      label: `${performer.name} ${orgasmRepeatPhrase(markers.size)}`,
      detail: `${markers.size} orgasm markers as top, excluding 2nd camera`,
      tone: "event",
      performerPreviews: [performer],
      kind: "orgasm-event",
      score: 1_000_000 + markers.size,
    });
  });

  return candidates;
}

function getOnlySceneCandidates(
  scene: SceneCardInsightScene,
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
): SceneCardInsightCandidate[] {
  const uniquePerformers = new Map(
    scene.performers.map((performer) => [performer.id, performer])
  );
  return [...uniquePerformers.values()]
    .filter(
      (performer) => roleStatsByPerformer?.get(performer.id)?.scene_count === 1
    )
    .map((performer) => ({
      key: `only-scene-${performer.id}`,
      label: `Only scene with ${performer.name}`,
      detail: `${performer.name} appears in only this scene in your library`,
      tone: "rare",
      kind: "only-scene",
      score: 1,
      performerPreviews: [performer],
    }));
}

const rareRoleMinimumScenes = 5;

// A vato who usually bottoms in oral tops in this scene.
function getRareOralTopCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds,
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
): SceneCardInsightCandidate[] {
  if (!roleStatsByPerformer) return [];

  // CUSTOM: Match the role history, which counts Oral subtags and secondary
  // tags, so a role in a descendant marker is still current.
  const oralTops = new Set<string>();
  scene.scene_markers.forEach((marker) => {
    if (
      markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) ||
      !markerHasConfiguredTag(marker, roleTagIds?.oralTagId)
    )
      return;
    (marker.top_performers ?? []).forEach((performer) =>
      oralTops.add(performer.id)
    );
  });

  return scene.performers.flatMap((performer): SceneCardInsightCandidate[] => {
    const stats = roleStatsByPerformer.get(performer.id);
    if (!stats || !oralTops.has(performer.id)) return [];
    const topCount = stats.oral_role_top_count ?? 0;
    const bottomCount = stats.oral_role_bottom_count ?? 0;
    const total = topCount + bottomCount;
    const percent = total > 0 ? (topCount / total) * 100 : 0;
    // CUSTOM: The only scene with a role is notable at any threshold.
    const onlyTime = topCount === 1;
    if (
      total < rareRoleMinimumScenes ||
      topCount <= 0 ||
      (!onlyTime && percent > thresholds.rareRoleMaximumPercent)
    ) {
      return [];
    }

    return [
      {
        key: `rare-oral-top-${performer.id}`,
        label: onlyTime
          ? `Only time ${performer.name} ${getPerformerOnlyTimeRoleAction(
              "oral",
              "top"
            )}`
          : `Rare instance of ${performer.name} ${getPerformerRareRoleAction(
              "oral",
              "top"
            )}`,
        // Versatile scenes count once per role, so report both role counts.
        detail: `${topCount} top · ${bottomCount} bottom oral scenes (${Math.round(
          percent
        )}% top) · usually ${getPerformerRareRoleAction("oral", "bottom")}`,
        tone: "rare",
        performerPreviews: [performer],
        kind: "rare-role",
        score:
          (onlyTime ? 100_000 : 0) +
          (thresholds.rareRoleMaximumPercent - percent) * 1000 +
          total,
      },
    ];
  });
}

// CUSTOM: the chips on scene cards and scene details.
export function getSceneCardChipInsightSets(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"],
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
) {
  const thresholds = normalizeSceneCardInsightThresholds(configuredThresholds);
  const sceneWithAncestors = withSceneTagAncestors(scene);
  const candidates = [
    ...getOrgasmCandidates(sceneWithAncestors, roleTagIds),
    ...getOnlySceneCandidates(scene, roleStatsByPerformer),
    ...getRareOralTopCandidates(
      sceneWithAncestors,
      roleTagIds,
      thresholds,
      roleStatsByPerformer
    ),
  ];
  return {
    visible: selectSceneCardInsights(
      candidates,
      thresholds.visibleInsightLimit
    ),
    all: selectSceneCardInsights(candidates),
  };
}

// CUSTOM: one event per top performer on each Orgasm or Facial marker
// (including subtags), for the orgasm report on cards and scene details.
// Facial markers stay facials even when Facial descends from Orgasm.
export function getSceneOrgasmFacialEvents(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): SceneCardInsightEvent[] {
  return withSceneTagAncestors(scene)
    .scene_markers.filter(
      (marker) =>
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
        (markerHasConfiguredTag(marker, roleTagIds?.facialTagId) ||
          markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId))
    )
    .sort((a, b) => a.seconds - b.seconds || a.id.localeCompare(b.id))
    .flatMap((marker) => {
      const category: EventCategory = markerHasConfiguredTag(
        marker,
        roleTagIds?.facialTagId
      )
        ? "facial"
        : "orgasm";
      const topPerformers = marker.top_performers ?? [];
      const eventCount = Math.max(topPerformers.length, 1);
      const quality = markerHasConfiguredTag(marker, roleTagIds?.goatTagId)
        ? "GOAT"
        : markerHasConfiguredTag(marker, roleTagIds?.reallyHotTagId)
        ? "Really Hot"
        : undefined;

      return Array.from({ length: eventCount }, (_, index) => ({
        id: `${marker.id}-${index}`,
        category,
        topPerformers: topPerformers[index] ? [topPerformers[index]] : [],
        bottomPerformers:
          category === "facial" ? marker.bottom_performers ?? [] : [],
        ...(quality ? { quality } : {}),
      }));
    });
}

export interface ISceneGoatMomentCustom {
  id: string;
  label: string;
  seconds: number;
  endSeconds?: number;
  topPerformers: SceneCardInsightPerformer[];
  bottomPerformers: SceneCardInsightPerformer[];
}

// CUSTOM: GOAT markers other than orgasms and facials (the orgasm report
// already shows those), excluding 2nd camera, and their combined time.
export function getSceneGoatMomentsCustom(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  const sceneWithAncestors = withSceneTagAncestors(scene);
  const markers = sceneWithAncestors.scene_markers
    .filter(
      (marker) =>
        markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
        !allMarkerTags(marker).some((tag) =>
          eventCategoryForTag(tag, roleTagIds)
        )
    )
    .sort((a, b) => a.seconds - b.seconds || a.id.localeCompare(b.id));
  const moments: ISceneGoatMomentCustom[] = markers.map((marker) => {
    const names = Array.from(
      new Set(
        allMarkerTags(marker)
          .filter((tag) => !tagIsQualifier(tag, roleTagIds))
          .map(displayTagName)
      )
    );
    return {
      id: marker.id,
      label: joinInsightNames(names) || "GOAT moment",
      seconds: marker.seconds,
      endSeconds: marker.end_seconds ?? undefined,
      topPerformers: marker.top_performers ?? [],
      bottomPerformers: marker.bottom_performers ?? [],
    };
  });
  return {
    duration: markerStats(markers, scene.files[0]?.duration ?? 0).duration,
    moments,
  };
}
