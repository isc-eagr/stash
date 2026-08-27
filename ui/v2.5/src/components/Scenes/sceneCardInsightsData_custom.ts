import type { IUIConfig } from "src/core/config";
import { getPerformerRareRoleAction } from "../Performers/performerRolePartnerLabels_custom";
import {
  formatDuration,
  hasMinimumRuleEvidence,
  intervalDuration,
  markerCoverageDetail,
  markerInterval,
  markerStats,
  mergeIntervals,
  overlapSeconds,
  percentOfScene,
  type InsightInterval,
  type MarkerStats,
} from "./sceneCardInsightFacts_custom";
import { getPerformerLineupCandidates } from "./sceneCardInsightPerformerRules_custom";
import {
  compareSceneCardInsightCandidates,
  selectAllSceneCardInsights,
  selectSceneCardInsights,
} from "./sceneCardInsightSelection_custom";
import type {
  ISceneCardInsight,
  SceneCardInsightCandidate,
  SceneCardInsightMarker,
  SceneCardInsightPerformer,
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightRatingConfig,
  SceneCardInsightScene,
  SceneCardInsightTag,
  SceneCardInsightThresholds,
} from "./sceneCardInsightTypes_custom";

export type {
  ISceneCardInsight,
  SceneCardInsightRatingConfig,
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightScene,
  SceneCardInsightTag,
  SceneCardInsightThresholdKey,
  SceneCardInsightThresholds,
} from "./sceneCardInsightTypes_custom";

export const defaultSceneCardInsightThresholds: SceneCardInsightThresholds = {
  goodOutstandingPercent: 20,
  greatOutstandingPercent: 40,
  amazingOutstandingPercent: 60,
  nearPerfectOutstandingPercent: 80,
  rareRoleMaximumPercent: 20,
  fewHighlightsMaxEpisodes: 1,
  fewHighlightsMaxPercent: 5,
  fillerTotalPercent: 20,
  lacklusterNegativePercent: 30,
  lacklusterOutstandingSuppressPercent: 35,
  lacklusterNonOutstandingPercent: 85,
  tagGoodAmountMinPercent: 10,
  tagLotsMinPercent: 25,
  tagEyeCanSeeMinPercent: 50,
  leaningBalanceTolerancePercent: 10,
  leaningMinoritySomePercent: 10,
  leaningMinorityGoodAmountPercent: 25,
  leaningMinorityALotPercent: 40,
};

function finiteInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value!)));
}

export function normalizeSceneCardInsightThresholds(
  value?: IUIConfig["sceneCardInsightThresholds"]
): SceneCardInsightThresholds {
  const goodOutstandingPercent = finiteInteger(
    value?.goodOutstandingPercent,
    defaultSceneCardInsightThresholds.goodOutstandingPercent,
    0,
    100
  );
  const greatOutstandingPercent = Math.max(
    goodOutstandingPercent,
    finiteInteger(
      value?.greatOutstandingPercent,
      defaultSceneCardInsightThresholds.greatOutstandingPercent,
      0,
      100
    )
  );
  const amazingOutstandingPercent = Math.max(
    greatOutstandingPercent,
    finiteInteger(
      value?.amazingOutstandingPercent,
      defaultSceneCardInsightThresholds.amazingOutstandingPercent,
      0,
      100
    )
  );
  const nearPerfectOutstandingPercent = Math.max(
    amazingOutstandingPercent,
    finiteInteger(
      value?.nearPerfectOutstandingPercent,
      defaultSceneCardInsightThresholds.nearPerfectOutstandingPercent,
      0,
      100
    )
  );
  const tagGoodAmountMinPercent = finiteInteger(
    value?.tagGoodAmountMinPercent,
    defaultSceneCardInsightThresholds.tagGoodAmountMinPercent,
    0,
    100
  );
  const tagLotsMinPercent = Math.max(
    tagGoodAmountMinPercent,
    finiteInteger(
      value?.tagLotsMinPercent,
      defaultSceneCardInsightThresholds.tagLotsMinPercent,
      0,
      100
    )
  );
  const tagEyeCanSeeMinPercent = Math.max(
    tagLotsMinPercent,
    finiteInteger(
      value?.tagEyeCanSeeMinPercent,
      defaultSceneCardInsightThresholds.tagEyeCanSeeMinPercent,
      0,
      100
    )
  );
  const leaningMinoritySomePercent = finiteInteger(
    value?.leaningMinoritySomePercent,
    defaultSceneCardInsightThresholds.leaningMinoritySomePercent,
    0,
    100
  );
  const leaningMinorityGoodAmountPercent = Math.max(
    leaningMinoritySomePercent,
    finiteInteger(
      value?.leaningMinorityGoodAmountPercent,
      defaultSceneCardInsightThresholds.leaningMinorityGoodAmountPercent,
      0,
      100
    )
  );
  const leaningMinorityALotPercent = Math.max(
    leaningMinorityGoodAmountPercent,
    finiteInteger(
      value?.leaningMinorityALotPercent,
      defaultSceneCardInsightThresholds.leaningMinorityALotPercent,
      0,
      100
    )
  );

  return {
    goodOutstandingPercent,
    greatOutstandingPercent,
    amazingOutstandingPercent,
    nearPerfectOutstandingPercent,
    rareRoleMaximumPercent: finiteInteger(
      value?.rareRoleMaximumPercent,
      defaultSceneCardInsightThresholds.rareRoleMaximumPercent,
      0,
      100
    ),
    fewHighlightsMaxEpisodes: finiteInteger(
      value?.fewHighlightsMaxEpisodes,
      defaultSceneCardInsightThresholds.fewHighlightsMaxEpisodes,
      0,
      100
    ),
    fewHighlightsMaxPercent: finiteInteger(
      value?.fewHighlightsMaxPercent,
      defaultSceneCardInsightThresholds.fewHighlightsMaxPercent,
      0,
      100
    ),
    fillerTotalPercent: finiteInteger(
      value?.fillerTotalPercent,
      defaultSceneCardInsightThresholds.fillerTotalPercent,
      0,
      100
    ),
    lacklusterNegativePercent: finiteInteger(
      value?.lacklusterNegativePercent,
      defaultSceneCardInsightThresholds.lacklusterNegativePercent,
      0,
      100
    ),
    lacklusterOutstandingSuppressPercent: finiteInteger(
      value?.lacklusterOutstandingSuppressPercent,
      defaultSceneCardInsightThresholds.lacklusterOutstandingSuppressPercent,
      0,
      100
    ),
    lacklusterNonOutstandingPercent: finiteInteger(
      value?.lacklusterNonOutstandingPercent,
      defaultSceneCardInsightThresholds.lacklusterNonOutstandingPercent,
      0,
      100
    ),
    tagGoodAmountMinPercent,
    tagLotsMinPercent,
    tagEyeCanSeeMinPercent,
    leaningBalanceTolerancePercent: finiteInteger(
      value?.leaningBalanceTolerancePercent,
      defaultSceneCardInsightThresholds.leaningBalanceTolerancePercent,
      0,
      100
    ),
    leaningMinoritySomePercent,
    leaningMinorityGoodAmountPercent,
    leaningMinorityALotPercent,
  };
}

type ActivityCategory = "sex" | "oral" | "solo";
type EventCategory = "orgasm" | "facial";
type InsightCandidate = SceneCardInsightCandidate;

const activityLabels: Record<ActivityCategory, string> = {
  sex: "sex",
  oral: "oral",
  solo: "solo",
};

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

function markerPerformers(marker: SceneCardInsightMarker) {
  const performers = new Map<string, SceneCardInsightPerformer>();
  (marker.top_performers ?? []).forEach((performer) =>
    performers.set(performer.id, performer)
  );
  return Array.from(performers.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
}

function performerScope(performers: SceneCardInsightPerformer[]) {
  return {
    key: performers.map((performer) => performer.id).join("|"),
    label: performers.map((performer) => performer.name).join(" & "),
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

function activityCategoryForMarker(
  marker: SceneCardInsightMarker,
  roleTagIds: IUIConfig["roleTagIds"]
): ActivityCategory | undefined {
  if (tagMatchesConfiguredTag(marker.primary_tag, roleTagIds?.sexTagId)) {
    return "sex";
  }
  if (tagMatchesConfiguredTag(marker.primary_tag, roleTagIds?.oralTagId)) {
    return "oral";
  }
  if (tagMatchesConfiguredTag(marker.primary_tag, roleTagIds?.soloTagId)) {
    return "solo";
  }
  return undefined;
}

function tagIsActivity(
  tag: SceneCardInsightTag,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  return [
    roleTagIds?.sexTagId,
    roleTagIds?.oralTagId,
    roleTagIds?.soloTagId,
  ].some((tagID) => tagMatchesConfiguredTag(tag, tagID));
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

function markerIsHighlight(
  marker: SceneCardInsightMarker,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  // CUSTOM: An orgasm (including Facial descendants) is not Outstanding by
  // itself. It needs an explicit quality qualifier; GOAT remains exceptional.
  if (markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId)) {
    return (
      markerHasConfiguredTag(marker, roleTagIds?.goatTagId) ||
      markerHasConfiguredTag(marker, roleTagIds?.reallyHotTagId)
    );
  }
  return (
    markerHasConfiguredTag(marker, roleTagIds?.goatTagId) ||
    markerHasConfiguredTag(marker, roleTagIds?.reallyHotTagId) ||
    allMarkerTags(marker).some(
      (tag) =>
        !tagIsActivity(tag, roleTagIds) && !tagIsQualifier(tag, roleTagIds)
    )
  );
}

function displayTagName(tag: SceneCardInsightTag) {
  // Tag-derived insights should preserve the tag's own spelling and casing.
  // Activity/event families still use their explicit labels elsewhere.
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

function eventReportLabel(
  category: EventCategory,
  count: number,
  goatCount: number,
  reallyHotCount: number
) {
  const eventName =
    category === "orgasm"
      ? count === 1
        ? "orgasm"
        : "orgasms"
      : count === 1
      ? "facial"
      : "facials";
  const highlights: string[] = [];
  if (goatCount > 0) highlights.push(`${goatCount} GOAT`);
  if (reallyHotCount > 0) highlights.push(`${reallyHotCount} Really Hot`);
  return `${count} ${eventName}${
    highlights.length > 0 ? `: ${highlights.join(", ")}` : ""
  }`;
}

export type OutstandingActivityAmountLevel =
  | "some"
  | "good-amount"
  | "lots"
  | "eye-can-see";

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
  amountLevel: OutstandingActivityAmountLevel;
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

function tagAmountLevel(
  percent: number,
  thresholds: SceneCardInsightThresholds
): OutstandingActivityAmountLevel {
  if (percent >= thresholds.tagEyeCanSeeMinPercent) return "eye-can-see";
  if (percent >= thresholds.tagLotsMinPercent) return "lots";
  if (percent >= thresholds.tagGoodAmountMinPercent) return "good-amount";
  return "some";
}

function tagAmountLabel(level: OutstandingActivityAmountLevel, name: string) {
  if (level === "eye-can-see") return `${name} as far as the eye can see`;
  if (level === "lots") return `Lots of ${name}`;
  if (level === "good-amount") return `Good amount of ${name}`;
  return `Some ${name}`;
}

function tagCoverageDetail(row: IOutstandingActivityRow) {
  return `${Math.round(row.percent)}% of scene · ${markerCoverageDetail({
    duration: row.duration,
    episodes: row.markerCount,
    markerCount: row.markerCount,
  })}`;
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

export function getOutstandingActivityMatrix(
  sourceScene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"]
): IOutstandingActivityMatrix {
  const scene = withSceneTagAncestors(sourceScene);
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const thresholds = normalizeSceneCardInsightThresholds(configuredThresholds);
  const groups = new Map<string, TagMarkerGroup>();

  scene.scene_markers
    .filter(
      (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) => {
      const seenTagIDs = new Set<string>();
      allMarkerTags(marker).forEach((tag) => {
        const feetTag = tagMatchesConfiguredTag(tag, roleTagIds?.feetTagId);
        if (
          seenTagIDs.has(tag.id) ||
          (!feetTag &&
            (tagIsActivity(tag, roleTagIds) ||
              tagIsQualifier(tag, roleTagIds) ||
              eventCategoryForTag(tag, roleTagIds)))
        ) {
          return;
        }
        seenTagIDs.add(tag.id);
        addTagMarker(groups, tag, marker);
      });
    });

  const performers = new Map(
    scene.performers.map((performer) => [performer.id, performer])
  );
  let hasSceneWideActivity = false;

  const rows = Array.from(groups.values()).map(({ tag, markers }) => {
    const cellMarkers = new Map<string, Map<string, SceneCardInsightMarker>>();
    markers.forEach((marker) => {
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
    const percent = percentOfScene(stats.duration, sceneDuration);
    return {
      amountLevel: tagAmountLevel(percent, thresholds),
      cells: Object.fromEntries(
        Array.from(cellMarkers.entries()).map(([columnID, cellGroup]) => {
          return [
            columnID,
            outstandingActivityCell(
              cellGroup.values(),
              sceneDuration,
              roleTagIds
            ),
          ];
        })
      ),
      ...stats,
      percent,
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

export function getOutstandingActivityChipLabel(
  matrix: IOutstandingActivityMatrix
) {
  const rows = matrix.rows.slice(0, 2);
  if (rows.length === 2 && rows[0].amountLevel === rows[1].amountLevel) {
    return tagAmountLabel(
      rows[0].amountLevel,
      joinInsightNames(rows.map((row) => displayTagName(row.tag)))
    );
  }

  return rows
    .map((row) => tagAmountLabel(row.amountLevel, displayTagName(row.tag)))
    .join(" · ");
}

function activityQualityLevel(
  percent: number,
  thresholds: SceneCardInsightThresholds
) {
  if (percent >= thresholds.nearPerfectOutstandingPercent) {
    return { label: "Near-perfect", rank: 4 };
  }
  if (percent >= thresholds.amazingOutstandingPercent) {
    return { label: "Amazing", rank: 3 };
  }
  if (percent >= thresholds.greatOutstandingPercent) {
    return { label: "Great", rank: 2 };
  }
  if (percent >= thresholds.goodOutstandingPercent) {
    return { label: "Good", rank: 1 };
  }
  return undefined;
}

function getActivityCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds
): InsightCandidate[] {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const activityMarkers: Record<ActivityCategory, SceneCardInsightMarker[]> = {
    sex: [],
    oral: [],
    solo: [],
  };
  scene.scene_markers.forEach((marker) => {
    const category = activityCategoryForMarker(marker, roleTagIds);
    if (category) activityMarkers[category].push(marker);
  });

  const outstandingMarkers = scene.scene_markers.filter((marker) =>
    markerIsHighlight(marker, roleTagIds)
  );
  const outstandingWithinActivityIntervals: Record<
    ActivityCategory,
    InsightInterval[]
  > = {
    sex: [],
    oral: [],
    solo: [],
  };
  outstandingMarkers.forEach((outstandingMarker) => {
    const outstandingInterval = markerInterval(
      outstandingMarker,
      sceneDuration
    );
    if (!outstandingInterval) return;

    const ownCategory = activityCategoryForMarker(
      outstandingMarker,
      roleTagIds
    );
    if (ownCategory) {
      outstandingWithinActivityIntervals[ownCategory].push(outstandingInterval);
    }

    (Object.keys(activityMarkers) as ActivityCategory[]).forEach((category) => {
      activityMarkers[category].forEach((activityMarker) => {
        if (activityMarker.id === outstandingMarker.id) return;
        const activityInterval = markerInterval(activityMarker, sceneDuration);
        if (!activityInterval) return;

        const overlap = overlapSeconds(outstandingInterval, activityInterval);
        if (overlap <= 0) return;
        outstandingWithinActivityIntervals[category].push({
          start: Math.max(outstandingInterval.start, activityInterval.start),
          end: Math.min(outstandingInterval.end, activityInterval.end),
        });
      });
    });
  });

  const outstandingDurations = {
    sex: intervalDuration(outstandingWithinActivityIntervals.sex),
    oral: intervalDuration(outstandingWithinActivityIntervals.oral),
    solo: intervalDuration(outstandingWithinActivityIntervals.solo),
  };
  const activityStatsByCategory: Record<ActivityCategory, MarkerStats> = {
    sex: markerStats(activityMarkers.sex, sceneDuration),
    oral: markerStats(activityMarkers.oral, sceneDuration),
    solo: markerStats(activityMarkers.solo, sceneDuration),
  };
  const qualityParts = (
    Object.keys(activityMarkers) as ActivityCategory[]
  ).flatMap((category) => {
    const activityStats = activityStatsByCategory[category];
    if (!hasMinimumRuleEvidence(activityMarkers[category], sceneDuration)) {
      return [];
    }
    const outstandingDuration = outstandingDurations[category];
    if (outstandingDuration <= 0) return [];
    const activityOutstandingPercent =
      activityStats.duration > 0
        ? Math.min(100, (outstandingDuration / activityStats.duration) * 100)
        : 0;
    const level = activityQualityLevel(activityOutstandingPercent, thresholds);
    if (!level) return [];

    const activityName = activityLabels[category];
    const detail = `${Math.round(
      activityOutstandingPercent
    )}% of ${activityName} is Outstanding (${formatDuration(
      outstandingDuration
    )})`;
    return {
      category,
      label: `${level.label} ${activityName}`,
      detail,
      score:
        level.rank * 1_000_000 +
        activityOutstandingPercent * 1_000 +
        outstandingDuration,
    };
  });

  if (qualityParts.length === 0) return [];

  // CUSTOM: Present the scene's Sex/Oral/Solo quality as one readable report.
  // Sorting by quality keeps “Near-perfect oral and amazing sex” natural.
  const sortedParts = [...qualityParts].sort(
    (a, b) => b.score - a.score || a.label.localeCompare(b.label)
  );
  return [
    {
      key: `activity-quality-${sortedParts
        .map((part) => part.category)
        .join("-")}`,
      label: sortedParts.map((part) => part.label).join(" and "),
      detail: sortedParts.map((part) => part.detail).join(" · "),
      tone: "activity",
      kind: "activity-quality",
      score: Math.max(...sortedParts.map((part) => part.score)),
    },
  ];
}

function getLacklusterActivityCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds
): InsightCandidate[] {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  if (sceneDuration <= 0) return [];

  const negativeIntervals = (scene.negative_markers ?? []).flatMap((marker) => {
    const start = Math.max(0, Math.min(marker.start_seconds, sceneDuration));
    const end = Math.max(0, Math.min(marker.end_seconds, sceneDuration));
    return end > start ? [{ start, end }] : [];
  });
  const highlightMarkers = scene.scene_markers.filter(
    (marker) =>
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
      markerIsHighlight(marker, roleTagIds)
  );
  const goatMarkers = scene.scene_markers.filter(
    (marker) =>
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
      markerHasConfiguredTag(marker, roleTagIds?.goatTagId)
  );

  return (["sex", "oral"] as ActivityCategory[]).flatMap((category) => {
    const activityIntervals = scene.scene_markers
      .filter(
        (marker) =>
          !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
          activityCategoryForMarker(marker, roleTagIds) === category
      )
      .flatMap((marker) => {
        const interval = markerInterval(marker, sceneDuration);
        return interval ? [interval] : [];
      });
    const activityDuration = intervalDuration(activityIntervals);
    if (activityDuration <= 0) return [];

    const overlapsActivity = (intervals: InsightInterval[]) =>
      intervalDuration(
        intervals.flatMap((interval) =>
          activityIntervals.flatMap((activityInterval) => {
            const start = Math.max(interval.start, activityInterval.start);
            const end = Math.min(interval.end, activityInterval.end);
            return end > start ? [{ start, end }] : [];
          })
        )
      );
    const outstandingDuration = overlapsActivity(
      highlightMarkers.flatMap((marker) => {
        const interval = markerInterval(marker, sceneDuration);
        return interval ? [interval] : [];
      })
    );
    const negativeDuration = overlapsActivity(negativeIntervals);
    const outstandingPercent = (outstandingDuration / activityDuration) * 100;
    const negativePercent = (negativeDuration / activityDuration) * 100;
    const nonOutstandingPercent = Math.max(0, 100 - outstandingPercent);
    const hasGoat =
      overlapsActivity(
        goatMarkers.flatMap((marker) => {
          const interval = markerInterval(marker, sceneDuration);
          return interval ? [interval] : [];
        })
      ) > 0;
    if (hasGoat) return [];

    const negativeRule =
      negativePercent > thresholds.lacklusterNegativePercent &&
      outstandingPercent < thresholds.lacklusterOutstandingSuppressPercent;
    const nonOutstandingRule =
      nonOutstandingPercent >= thresholds.lacklusterNonOutstandingPercent;
    if (!negativeRule && !nonOutstandingRule) return [];

    return [
      {
        key: `lackluster-${category}`,
        label: `Lackluster ${activityLabels[category]}`,
        detail: `${Math.round(negativePercent)}% negative · ${Math.round(
          nonOutstandingPercent
        )}% non-Outstanding`,
        tone: "negative",
        kind: "lackluster",
        score: Math.max(negativePercent, nonOutstandingPercent),
      },
    ];
  });
}

function minorityActivityPhrase(
  activity: "sex" | "oral",
  percent: number,
  thresholds: SceneCardInsightThresholds
) {
  if (percent <= 0) return `no ${activity}`;
  if (percent < thresholds.leaningMinoritySomePercent) {
    return `minimal ${activity}`;
  }
  if (percent < thresholds.leaningMinorityGoodAmountPercent) {
    return `some ${activity}`;
  }
  if (percent < thresholds.leaningMinorityALotPercent) {
    return `a good amount of ${activity}`;
  }
  return `a lot of ${activity}`;
}

function getLeaningCandidate(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds
): InsightCandidate[] {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const activityMarkersFor = (category: ActivityCategory) =>
    scene.scene_markers.filter(
      (marker) => activityCategoryForMarker(marker, roleTagIds) === category
    );
  const activityDurations = (
    Object.keys(activityLabels) as ActivityCategory[]
  ).map((category) => ({
    category,
    duration: markerStats(activityMarkersFor(category), sceneDuration).duration,
  }));
  if (activityDurations.filter(({ duration }) => duration > 0).length <= 1) {
    return [];
  }

  const sexDuration =
    activityDurations.find(({ category }) => category === "sex")?.duration ?? 0;
  const oralDuration =
    activityDurations.find(({ category }) => category === "oral")?.duration ??
    0;
  if (
    sexDuration <= 0 ||
    oralDuration <= 0 ||
    !hasMinimumRuleEvidence(activityMarkersFor("sex"), sceneDuration) ||
    !hasMinimumRuleEvidence(activityMarkersFor("oral"), sceneDuration)
  ) {
    return [];
  }
  const combinedDuration = sexDuration + oralDuration;
  const sexPercent = (sexDuration / combinedDuration) * 100;
  const oralPercent = (oralDuration / combinedDuration) * 100;
  const difference = Math.abs(sexPercent - oralPercent);
  const balanced = difference <= thresholds.leaningBalanceTolerancePercent;
  const sexLeaning = sexPercent > oralPercent;
  const label = balanced
    ? "Balanced Scene"
    : `${sexLeaning ? "Sex" : "Oral"} Leaning Scene with ${
        sexLeaning
          ? minorityActivityPhrase("oral", oralPercent, thresholds)
          : minorityActivityPhrase("sex", sexPercent, thresholds)
      }`;

  return [
    {
      key: "activity-leaning",
      label,
      detail: `${Math.round(sexPercent)}% sex (${formatDuration(
        sexDuration
      )}) - ${Math.round(oralPercent)}% oral (${formatDuration(oralDuration)})`,
      tone: "activity",
      kind: "leaning",
      score: combinedDuration,
    },
  ];
}

type TagMarkerGroup = {
  tag: SceneCardInsightTag;
  markers: Map<string, SceneCardInsightMarker>;
};

type PerformerMarkerGroup = {
  markers: Map<string, SceneCardInsightMarker>;
  performer?: ReturnType<typeof performerScope>;
};

type GoatTagMarkerGroup = TagMarkerGroup & {
  scopeKey: string;
  performer?: ReturnType<typeof performerScope>;
};

function addTagMarker(
  groups: Map<string, TagMarkerGroup>,
  tag: SceneCardInsightTag,
  marker: SceneCardInsightMarker
) {
  const group = groups.get(tag.id) ?? { tag, markers: new Map() };
  group.markers.set(marker.id, marker);
  groups.set(tag.id, group);
}

function addPerformerMarker(
  groups: Map<string, PerformerMarkerGroup>,
  marker: SceneCardInsightMarker
) {
  const performers = markerPerformers(marker);
  const performer =
    performers.length > 0 ? performerScope(performers) : undefined;
  const key = performer ? `performer:${performer.key}` : `marker:${marker.id}`;
  const group = groups.get(key) ?? {
    markers: new Map<string, SceneCardInsightMarker>(),
    performer,
  };
  group.markers.set(marker.id, marker);
  groups.set(key, group);
}

function addGoatTagMarker(
  groups: Map<string, GoatTagMarkerGroup>,
  tag: SceneCardInsightTag,
  marker: SceneCardInsightMarker
) {
  const performers = markerPerformers(marker);
  const performer =
    performers.length > 0 ? performerScope(performers) : undefined;
  const scopeKey = performer
    ? `performer:${performer.key}`
    : `marker:${marker.id}:tag:${tag.id}`;
  const key = `${scopeKey}:tag:${tag.id}`;
  const group = groups.get(key) ?? {
    tag,
    markers: new Map<string, SceneCardInsightMarker>(),
    scopeKey,
    performer,
  };
  group.markers.set(marker.id, marker);
  groups.set(key, group);
}

function orgasmRepeatPhrase(count: number) {
  return count === 2 ? "nuts twice" : `nuts ${count} times`;
}

function getOrgasmAutomaticCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InsightCandidate[] {
  const orgasmMarkers = scene.scene_markers.filter(
    (marker) =>
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
      markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId)
  );
  const candidates: InsightCandidate[] = [];

  const simultaneousCounts = orgasmMarkers.map((marker) => {
    const topPerformers = new Map(
      (marker.top_performers ?? []).map((performer) => [
        performer.id,
        performer,
      ])
    );
    return topPerformers.size;
  });
  const simultaneousCount = Math.max(0, ...simultaneousCounts);
  if (simultaneousCount >= 2) {
    candidates.push({
      key: "orgasm-simultaneous",
      label: `${simultaneousCount} vatos nut at the same time`,
      detail: "One orgasm marker has this many top performers",
      tone: "event",
      kind: "orgasm-event",
      score: 2_000_000 + simultaneousCount,
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
      kind: "orgasm-event",
      score: 1_000_000 + markers.size,
    });
  });

  /* CUSTOM: begin - Everybody Nuts is intentionally disabled for now.
  const completionMarkers = scene.scene_markers.filter(
    (marker) =>
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
      (markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId) ||
        markerHasConfiguredTag(marker, roleTagIds?.facialTagId))
  );
  const castIDs = new Set(scene.performers.map((performer) => performer.id));
  const finishingPerformerIDs = new Set(
    completionMarkers.flatMap((marker) =>
      (marker.top_performers ?? []).map((performer) => performer.id)
    )
  );
  if (
    castIDs.size >= 2 &&
    [...castIDs].every((performerID) => finishingPerformerIDs.has(performerID))
  ) {
    candidates.push({
      key: "orgasm-everybody-nuts",
      label: "Everybody Nuts",
      detail: `All ${castIDs.size} vatos have an orgasm marker as top`,
      tone: "event",
      kind: "everybody-nuts",
      score: 30_000 + castIDs.size,
    });
  }
  CUSTOM: end */

  return candidates.sort(compareSceneCardInsightCandidates);
}

function getEventReportCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InsightCandidate[] {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const countableMarkers = scene.scene_markers.filter(
    (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
  );
  const facialMarkers = countableMarkers.filter((marker) =>
    markerHasConfiguredTag(marker, roleTagIds?.facialTagId)
  );
  // CUSTOM: Facial markers belong exclusively to the Facial report, even
  // when the Facial family is a descendant of the configured Orgasm family.
  const orgasmMarkers = countableMarkers.filter(
    (marker) =>
      markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId) &&
      !markerHasConfiguredTag(marker, roleTagIds?.facialTagId)
  );
  const reports: Array<{
    category: EventCategory;
    markers: SceneCardInsightMarker[];
  }> = [
    { category: "orgasm", markers: orgasmMarkers },
    { category: "facial", markers: facialMarkers },
  ];

  return reports.flatMap(({ category, markers }) => {
    if (markers.length === 0) return [];
    const stats = markerStats(markers, sceneDuration);
    const goatCount = markers.filter((marker) =>
      markerHasConfiguredTag(marker, roleTagIds?.goatTagId)
    ).length;
    const reallyHotCount = markers.filter(
      (marker) =>
        !markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
        markerHasConfiguredTag(marker, roleTagIds?.reallyHotTagId)
    ).length;
    return [
      {
        key: `${category}-report`,
        label: eventReportLabel(
          category,
          stats.markerCount,
          goatCount,
          reallyHotCount
        ),
        detail: markerCoverageDetail(stats),
        tone: "event" as const,
        kind: "event-report" as const,
        score: stats.duration * 100 + stats.markerCount,
      },
    ];
  });
}

function getAutomaticCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const goatTagGroups = new Map<string, GoatTagMarkerGroup>();
  const goatMomentGroups = new Map<string, PerformerMarkerGroup>();

  scene.scene_markers
    .filter(
      (marker) =>
        markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) => {
      const insightTags = allMarkerTags(marker).filter(
        (tag) => !tagIsQualifier(tag, roleTagIds)
      );
      if (insightTags.length === 0) {
        addPerformerMarker(goatMomentGroups, marker);
      }
      insightTags.forEach((tag) => {
        // CUSTOM: Event tags are represented only by the aggregate reports.
        if (eventCategoryForTag(tag, roleTagIds)) return;
        addGoatTagMarker(goatTagGroups, tag, marker);
      });
    });

  const goatPerformerGroups = new Map<
    string,
    {
      markers: Map<string, SceneCardInsightMarker>;
      parts: Array<{
        name: string;
        tagID: string;
      }>;
      performer?: ReturnType<typeof performerScope>;
    }
  >();
  goatTagGroups.forEach(({ tag, markers, scopeKey, performer }) => {
    const groupKey = scopeKey;
    const group = goatPerformerGroups.get(groupKey) ?? {
      markers: new Map<string, SceneCardInsightMarker>(),
      parts: [],
      performer,
    };
    markers.forEach((marker) => group.markers.set(marker.id, marker));
    group.parts.push({
      name: displayTagName(tag),
      tagID: tag.id,
    });
    goatPerformerGroups.set(groupKey, group);
  });

  const goatCandidates: InsightCandidate[] = Array.from(
    goatPerformerGroups.entries()
  ).map(([groupKey, group]) => {
    const stats = markerStats(group.markers.values(), sceneDuration);
    const parts = [...group.parts].sort(
      (a, b) => a.name.localeCompare(b.name) || a.tagID.localeCompare(b.tagID)
    );
    const descriptors = parts.map((part) => part.name);
    const performerSuffix = group.performer
      ? ` from ${group.performer.label}`
      : "";
    return {
      key: `goat-${groupKey}`,
      label: `GOAT ${joinInsightNames(descriptors)}${performerSuffix}`,
      detail: markerCoverageDetail(stats),
      tone: "goat",
      kind: "goat",
      score: stats.duration * 100 + stats.episodes,
    };
  });

  goatMomentGroups.forEach(({ markers, performer }, groupKey) => {
    const stats = markerStats(markers.values(), sceneDuration);
    const performerSuffix = performer ? ` from ${performer.label}` : "";
    goatCandidates.push({
      key: `goat-moment:${groupKey}`,
      label:
        stats.markerCount === 1
          ? `GOAT moment${performerSuffix}`
          : `GOAT moments ×${stats.markerCount}${performerSuffix}`,
      detail: markerCoverageDetail(stats),
      tone: "goat",
      kind: "goat",
      score: stats.duration * 100 + stats.episodes,
    });
  });

  return [
    ...goatCandidates,
    ...getEventReportCandidates(scene, roleTagIds),
    ...getOrgasmAutomaticCandidates(scene, roleTagIds),
  ].sort(compareSceneCardInsightCandidates);
}

function getGoatInsightTagIDs(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  const tagIDs = new Set<string>();
  scene.scene_markers
    .filter(
      (marker) =>
        markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) =>
      allMarkerTags(marker).forEach((tag) => {
        if (
          !tagIsQualifier(tag, roleTagIds) &&
          !eventCategoryForTag(tag, roleTagIds)
        ) {
          tagIDs.add(tag.id);
        }
      })
    );
  return tagIDs;
}

function getTagCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds,
  outstandingActivityMatrix?: IOutstandingActivityMatrix
): InsightCandidate[] {
  const activityMatrix =
    outstandingActivityMatrix ??
    getOutstandingActivityMatrix(scene, roleTagIds, thresholds);
  if (activityMatrix.rows.length === 0) return [];

  const goatInsightTagIDs = getGoatInsightTagIDs(scene, roleTagIds);
  const chipRows = activityMatrix.rows.filter(
    (row) => !goatInsightTagIDs.has(row.tag.id)
  );

  const commonTagIDs =
    roleTagIds?.outstandingActivityCommonTagIds?.filter(Boolean) ?? [];
  // CUSTOM: Preserve the original consolidated chip until a common-tag set
  // has been configured, so existing installations do not change silently.
  const commonRows =
    commonTagIDs.length > 0
      ? chipRows.filter((row) =>
          commonTagIDs.some((tagID) => tagMatchesConfiguredTag(row.tag, tagID))
        )
      : chipRows;
  const uncommonRows =
    commonTagIDs.length > 0
      ? chipRows.filter(
          (row) =>
            !commonTagIDs.some((tagID) =>
              tagMatchesConfiguredTag(row.tag, tagID)
            )
        )
      : [];
  const candidates: InsightCandidate[] = [];

  if (commonRows.length > 0) {
    const topRows = commonRows.slice(0, 2);
    candidates.push({
      key: "outstanding-activity",
      label: getOutstandingActivityChipLabel({
        ...activityMatrix,
        rows: commonRows,
      }),
      detail: topRows
        .map((row) => `${displayTagName(row.tag)}: ${tagCoverageDetail(row)}`)
        .join(" · "),
      tone: "tag",
      kind: "outstanding-activity",
      score:
        topRows[0].duration * 10_000 +
        topRows.reduce((total, row) => total + row.markerCount, 0),
    });
  }

  if (uncommonRows.length > 0) {
    candidates.push({
      key: "outstanding-activity-presence",
      label: `Scene contains ${joinInsightNames(
        uncommonRows.map((row) => displayTagName(row.tag))
      )}`,
      detail: uncommonRows
        .map((row) => `${displayTagName(row.tag)}: ${tagCoverageDetail(row)}`)
        .join(" · "),
      tone: "tag",
      kind: "outstanding-activity-presence",
      score: uncommonRows.reduce(
        (total, row) => total + row.duration * 100 + row.markerCount,
        0
      ),
    });
  }

  return candidates;
}

function getFeetCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InsightCandidate[] {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const markers = scene.scene_markers.filter(
    (marker) =>
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
      markerHasConfiguredTag(marker, roleTagIds?.feetTagId)
  );
  if (markers.length === 0) return [];

  // CUSTOM: Feet is a single, low-priority presence note rather than an
  // amount/coverage tier. Collect the whole cast touched by Feet markers.
  const performers = new Map<string, SceneCardInsightPerformer>();
  markers.forEach((marker) =>
    [
      ...(marker.top_performers ?? []),
      ...(marker.bottom_performers ?? []),
    ].forEach((performer) => performers.set(performer.id, performer))
  );
  const names = Array.from(performers.values())
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((performer) => performer.name);
  const stats = markerStats(markers, sceneDuration);
  return [
    {
      key: "feet",
      label: names.length > 0 ? `Feet from ${joinInsightNames(names)}` : "Feet",
      detail: markerCoverageDetail(stats),
      tone: "tag",
      kind: "feet",
      score: stats.duration + stats.episodes,
    },
  ];
}

type InteractionCategory = "sex" | "oral";
type InteractionRole = "top" | "bottom";

type InteractionGraph = {
  cast: SceneCardInsightPerformer[];
  directedMarkers: Map<string, Map<string, SceneCardInsightMarker>>;
  pairMarkers: Map<string, Map<string, SceneCardInsightMarker>>;
  roleMarkers: Map<string, Map<string, SceneCardInsightMarker>>;
};

function interactionPairKey(firstID: string, secondID: string) {
  return [firstID, secondID].sort().join("::");
}

function interactionDirectedKey(
  category: InteractionCategory,
  topID: string,
  bottomID: string
) {
  return `${category}:${topID}::${bottomID}`;
}

function interactionRoleKey(
  category: InteractionCategory,
  role: InteractionRole,
  performerID: string
) {
  return `${category}:${role}:${performerID}`;
}

function interactionCategoriesForMarker(
  marker: SceneCardInsightMarker,
  roleTagIds: IUIConfig["roleTagIds"]
): InteractionCategory[] {
  const categories: InteractionCategory[] = [];
  if (markerHasConfiguredTag(marker, roleTagIds?.sexTagId)) {
    categories.push("sex");
  }
  if (markerHasConfiguredTag(marker, roleTagIds?.oralTagId)) {
    categories.push("oral");
  }
  return categories;
}

function addInteractionMarker(
  groups: Map<string, Map<string, SceneCardInsightMarker>>,
  key: string,
  marker: SceneCardInsightMarker
) {
  const markers = groups.get(key) ?? new Map();
  markers.set(marker.id, marker);
  groups.set(key, markers);
}

function buildInteractionGraph(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InteractionGraph {
  const cast = [
    ...new Map(
      scene.performers.map((performer) => [performer.id, performer])
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const castIDs = new Set(cast.map((performer) => performer.id));
  const directedMarkers = new Map<
    string,
    Map<string, SceneCardInsightMarker>
  >();
  const pairMarkers = new Map<string, Map<string, SceneCardInsightMarker>>();
  const roleMarkers = new Map<string, Map<string, SceneCardInsightMarker>>();

  scene.scene_markers.forEach((marker) => {
    const categories = interactionCategoriesForMarker(marker, roleTagIds);
    if (categories.length === 0) return;
    const tops = [
      ...new Map(
        (marker.top_performers ?? [])
          .filter((performer) => castIDs.has(performer.id))
          .map((performer) => [performer.id, performer])
      ).values(),
    ];
    const bottoms = [
      ...new Map(
        (marker.bottom_performers ?? [])
          .filter((performer) => castIDs.has(performer.id))
          .map((performer) => [performer.id, performer])
      ).values(),
    ];

    categories.forEach((category) => {
      tops.forEach((top) => {
        bottoms.forEach((bottom) => {
          if (top.id === bottom.id) return;
          addInteractionMarker(
            directedMarkers,
            interactionDirectedKey(category, top.id, bottom.id),
            marker
          );
          addInteractionMarker(
            pairMarkers,
            interactionPairKey(top.id, bottom.id),
            marker
          );
          addInteractionMarker(
            roleMarkers,
            interactionRoleKey(category, "top", top.id),
            marker
          );
          addInteractionMarker(
            roleMarkers,
            interactionRoleKey(category, "bottom", bottom.id),
            marker
          );
        });
      });
    });
  });

  return { cast, directedMarkers, pairMarkers, roleMarkers };
}

function combinedInteractionMarkers(
  graph: InteractionGraph,
  performerID: string,
  role: InteractionRole
) {
  const markers = new Map<string, SceneCardInsightMarker>();
  (["sex", "oral"] as InteractionCategory[]).forEach((category) =>
    graph.roleMarkers
      .get(interactionRoleKey(category, role, performerID))
      ?.forEach((marker) => markers.set(marker.id, marker))
  );
  return markers;
}

function getInteractionCandidate(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InsightCandidate[] {
  const graph = buildInteractionGraph(scene, roleTagIds);
  if (graph.cast.length < 2) return [];
  const hasEvidence = (markers?: Map<string, SceneCardInsightMarker>) =>
    !!markers && markers.size > 0;
  const directed = (
    category: InteractionCategory,
    topID: string,
    bottomID: string
  ) =>
    hasEvidence(
      graph.directedMarkers.get(
        interactionDirectedKey(category, topID, bottomID)
      )
    );
  const hasRole = (
    performerID: string,
    role: InteractionRole,
    category?: InteractionCategory
  ) =>
    category
      ? hasEvidence(
          graph.roleMarkers.get(interactionRoleKey(category, role, performerID))
        )
      : hasEvidence(combinedInteractionMarkers(graph, performerID, role));

  const partners = new Map<string, Set<string>>(
    graph.cast.map((performer) => [performer.id, new Set<string>()])
  );
  graph.pairMarkers.forEach((markers, key) => {
    if (!hasEvidence(markers)) return;
    const [firstID, secondID] = key.split("::");
    partners.get(firstID)?.add(secondID);
    partners.get(secondID)?.add(firstID);
  });
  if (graph.cast.some((performer) => partners.get(performer.id)?.size === 0)) {
    return [];
  }

  const count = graph.cast.length;
  const possiblePairs = (count * (count - 1)) / 2;
  const meaningfulPairCount = [...graph.pairMarkers.values()].filter(
    (markers) => hasEvidence(markers)
  ).length;
  const candidate = (
    key: string,
    label: string,
    detail: string,
    priority: number
  ): InsightCandidate[] => [
    {
      key: `interaction-${key}`,
      label,
      detail,
      tone: "interaction",
      kind: "interaction",
      score: priority,
    },
  ];

  const twoVatoSexVersatile =
    count === 2 &&
    directed("sex", graph.cast[0].id, graph.cast[1].id) &&
    directed("sex", graph.cast[1].id, graph.cast[0].id);
  const twoVatoOralVersatile =
    count === 2 &&
    directed("oral", graph.cast[0].id, graph.cast[1].id) &&
    directed("oral", graph.cast[1].id, graph.cast[0].id);

  if (twoVatoSexVersatile && twoVatoOralVersatile) {
    return candidate(
      "fully-versatile",
      "Fully Versatile Scene",
      "Both vatos top and bottom each other in sex and oral",
      10
    );
  }

  if (twoVatoSexVersatile && !twoVatoOralVersatile) {
    return candidate(
      "sexually-versatile",
      "Sexually Versatile",
      "Both vatos top and bottom each other in sex, but not oral",
      9
    );
  }

  if (twoVatoOralVersatile && !twoVatoSexVersatile) {
    return candidate(
      "orally-versatile",
      "Orally Versatile",
      "Both vatos top and bottom each other in oral, but not sex",
      9
    );
  }

  if (count >= 4 && meaningfulPairCount === possiblePairs) {
    return candidate(
      "round-robin",
      "Round-Robin Scene",
      `All ${possiblePairs} vato pairings interact`,
      9
    );
  }

  if (
    count >= 3 &&
    graph.cast.every(
      (performer) =>
        hasRole(performer.id, "top", "oral") &&
        hasRole(performer.id, "bottom", "oral")
    )
  ) {
    return candidate(
      "oral-circle",
      "Oral Circle",
      "Every vato gives and receives oral",
      8
    );
  }

  if (
    count >= 3 &&
    graph.cast.every(
      (performer) =>
        hasRole(performer.id, "top") && hasRole(performer.id, "bottom")
    )
  ) {
    return candidate(
      "versatile-group",
      "Versatile Group",
      "Every vato tops and bottoms",
      7
    );
  }

  const balancedPartnerMinimum = Math.ceil((count - 1) / 2);
  if (
    count >= 4 &&
    graph.cast.every(
      (performer) =>
        (partners.get(performer.id)?.size ?? 0) >= balancedPartnerMinimum
    )
  ) {
    return candidate(
      "balanced-orgy",
      "Balanced Orgy",
      `Every vato interacts with at least ${balancedPartnerMinimum} of ${
        count - 1
      } possible partners`,
      6
    );
  }

  if (
    count === 3 &&
    graph.cast.every((performer) => partners.get(performer.id)?.size === 2)
  ) {
    return candidate(
      "balanced-threesome",
      "Balanced Threesome",
      "All three vatos interact with both partners",
      5
    );
  }

  const sexBottomOnly = graph.cast.filter(
    (performer) =>
      hasRole(performer.id, "bottom", "sex") &&
      !hasRole(performer.id, "top", "sex")
  );
  const sexTopOnly = graph.cast.filter(
    (performer) =>
      hasRole(performer.id, "top", "sex") &&
      !hasRole(performer.id, "bottom", "sex")
  );
  if (
    sexBottomOnly.length === 1 &&
    sexTopOnly.length === count - 1 &&
    sexTopOnly.every((performer) =>
      directed("sex", performer.id, sexBottomOnly[0].id)
    ) &&
    !hasRole(sexBottomOnly[0].id, "top", "oral") &&
    sexTopOnly.every((performer) => !hasRole(performer.id, "bottom", "oral"))
  ) {
    return candidate(
      "traditional",
      "Traditional Scene",
      `One consistent bottom with ${sexTopOnly.length} consistent ${
        sexTopOnly.length === 1 ? "top" : "tops"
      } across sex/oral`,
      2
    );
  }

  if (count >= 3) {
    const centerPerformers = graph.cast.filter(
      (performer) => partners.get(performer.id)?.size === count - 1
    );
    if (
      centerPerformers.length === 1 &&
      graph.cast.every(
        (performer) =>
          performer.id === centerPerformers[0].id ||
          partners.get(performer.id)?.size === 1
      )
    ) {
      return candidate(
        "center-stage",
        "One Vato Center Stage",
        `${centerPerformers[0].name} interacts with every other vato`,
        1
      );
    }
  }

  return [];
}

const rareRoleMinimumScenes = 5;

function getRareRoleCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds,
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
): InsightCandidate[] {
  if (!roleStatsByPerformer) return [];

  const activeRoles = new Set<string>();
  scene.scene_markers.forEach((marker) => {
    if (markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)) return;

    const category = activityCategoryForMarker(marker, roleTagIds);
    if (category === "sex" || category === "oral") {
      (marker.top_performers ?? []).forEach((performer) =>
        activeRoles.add(`${category}:top:${performer.id}`)
      );
      (marker.bottom_performers ?? []).forEach((performer) =>
        activeRoles.add(`${category}:bottom:${performer.id}`)
      );
    }
  });

  const candidates: InsightCandidate[] = [];
  scene.performers.forEach((performer) => {
    const stats = roleStatsByPerformer.get(performer.id);
    if (!stats) return;

    (["sex", "oral"] as InteractionCategory[]).forEach((category) => {
      const topCount =
        category === "sex"
          ? stats.sex_top_count
          : stats.oral_role_top_count ?? 0;
      const bottomCount =
        category === "sex"
          ? stats.sex_bottom_count
          : stats.oral_role_bottom_count ?? 0;
      const total = topCount + bottomCount;
      if (total < rareRoleMinimumScenes) return;

      (["top", "bottom"] as InteractionRole[]).forEach((role) => {
        if (!activeRoles.has(`${category}:${role}:${performer.id}`)) return;
        const count = role === "top" ? topCount : bottomCount;
        const percent = (count / total) * 100;
        if (count <= 0 || percent > thresholds.rareRoleMaximumPercent) {
          return;
        }

        const action = getPerformerRareRoleAction(category, role);
        const usualRole: InteractionRole = role === "top" ? "bottom" : "top";
        candidates.push({
          key: `rare-${category}-${role}-${performer.id}`,
          label: `Rare instance of ${performer.name} ${action}`,
          detail: `${count} of ${total} ${category}-role scenes (${Math.round(
            percent
          )}%) · usually ${getPerformerRareRoleAction(category, usualRole)}`,
          tone: "rare",
          kind: "rare-role",
          score: (thresholds.rareRoleMaximumPercent - percent) * 1000 + total,
        });
      });
    });
  });

  return candidates.sort(compareSceneCardInsightCandidates);
}

function complementIntervals(
  intervals: InsightInterval[],
  sceneDuration: number
) {
  const gaps: InsightInterval[] = [];
  let cursor = 0;
  mergeIntervals(intervals).forEach((interval) => {
    if (interval.start > cursor)
      gaps.push({ start: cursor, end: interval.start });
    cursor = Math.max(cursor, interval.end);
  });
  if (cursor < sceneDuration) gaps.push({ start: cursor, end: sceneDuration });
  return gaps;
}

function getAttractivenessNegativeCandidates(
  scene: SceneCardInsightScene
): InsightCandidate[] {
  const criterionValue = (key: string) =>
    scene.rating_scores?.find(
      (score) => score.section === "criterion" && score.key === key
    )?.raw_value;
  const candidates: InsightCandidate[] = [];
  const performerCount = scene.performers.length;

  if (performerCount >= 2 && performerCount <= 3) {
    if (criterionValue("topAttractiveness") === 0) {
      candidates.push({
        key: "ugly-top",
        label: "Ugly Top",
        detail: "Scene Rating Advisor · Top Attractiveness: 0",
        tone: "negative",
        kind: "negative-rating",
        score: 2,
      });
    }
    if (criterionValue("bottomAttractiveness") === 0) {
      candidates.push({
        key: "ugly-bottom",
        label: "Ugly Bottom",
        detail: "Scene Rating Advisor · Bottom Attractiveness: 0",
        tone: "negative",
        kind: "negative-rating",
        score: 1,
      });
    }
  } else if (performerCount >= 4) {
    const topLineup = criterionValue("groupTopAttractiveness");
    if (topLineup === 0 || topLineup === 1) {
      candidates.push({
        key: "ugly-tops",
        label: "Ugly Tops",
        detail: `Scene Rating Advisor · Top Lineup: ${topLineup}`,
        tone: "negative",
        kind: "negative-rating",
        score: 2,
      });
    }
  }

  return candidates;
}

function getNegativeCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds,
  hasLacklusterActivity: boolean
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const highlightStats = markerStats(
    scene.scene_markers.filter(
      (marker) =>
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
        markerIsHighlight(marker, roleTagIds)
    ),
    sceneDuration
  );
  const candidates = getAttractivenessNegativeCandidates(scene);
  const highlightPercent = percentOfScene(
    highlightStats.duration,
    sceneDuration
  );

  if (roleTagIds?.orgasmTagId || roleTagIds?.facialTagId) {
    const hasOrgasm = scene.scene_markers.some(
      (marker) =>
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
        (markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId) ||
          markerHasConfiguredTag(marker, roleTagIds?.facialTagId))
    );
    if (!hasOrgasm) {
      candidates.push({
        key: "no-orgasm",
        label: "No Orgasm",
        detail: "No Orgasm or Facial markers, excluding 2nd camera",
        tone: "negative",
        kind: "no-orgasm",
        score: 1,
      });
    }
  }

  if (
    highlightStats.episodes <= thresholds.fewHighlightsMaxEpisodes &&
    highlightPercent <= thresholds.fewHighlightsMaxPercent
  ) {
    candidates.push({
      key: "few-highlights",
      label: "Few highlights",
      detail: `${Math.round(
        highlightPercent
      )}% highlights · ${markerCoverageDetail(highlightStats)}`,
      tone: "negative",
      kind: "few-highlights",
      score: 100 - highlightPercent,
    });
  }

  if (sceneDuration > 0 && !hasLacklusterActivity) {
    const markedIntervals = scene.scene_markers.flatMap((marker) => {
      const interval = markerInterval(marker, sceneDuration);
      return interval ? [interval] : [];
    });
    const fillerIntervals = complementIntervals(markedIntervals, sceneDuration);
    const negativeIntervals = (scene.negative_markers ?? []).flatMap(
      (marker) => {
        const start = Math.max(
          0,
          Math.min(marker.start_seconds, sceneDuration)
        );
        const end = Math.max(0, Math.min(marker.end_seconds, sceneDuration));
        return end > start ? [{ start, end }] : [];
      }
    );
    const totalFillerDuration = intervalDuration([
      ...fillerIntervals,
      ...negativeIntervals,
    ]);
    const fillerPercent = (totalFillerDuration / sceneDuration) * 100;
    if (fillerPercent > thresholds.fillerTotalPercent) {
      candidates.push({
        key: "lots-of-filler",
        label: "Lots of filler",
        detail: `${Math.round(fillerPercent)}% filler (${formatDuration(
          totalFillerDuration
        )})`,
        tone: "negative",
        kind: "filler",
        score: totalFillerDuration,
      });
    }
  }

  return candidates.sort(compareSceneCardInsightCandidates);
}

function getSceneCardInsightCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"],
  ratingConfig?: SceneCardInsightRatingConfig,
  roleStatsByPerformer?: ReadonlyMap<
    string,
    SceneCardInsightPerformerRoleStats
  >,
  outstandingActivityMatrix?: IOutstandingActivityMatrix
) {
  scene = withSceneTagAncestors(scene);
  const thresholds = normalizeSceneCardInsightThresholds(configuredThresholds);
  const automaticCandidates = getAutomaticCandidates(scene, roleTagIds);
  const lacklusterCandidates = getLacklusterActivityCandidates(
    scene,
    roleTagIds,
    thresholds
  );
  return [
    ...automaticCandidates,
    ...getActivityCandidates(scene, roleTagIds, thresholds),
    ...getLeaningCandidate(scene, roleTagIds, thresholds),
    ...getInteractionCandidate(scene, roleTagIds),
    ...getRareRoleCandidates(
      scene,
      roleTagIds,
      thresholds,
      roleStatsByPerformer
    ),
    ...lacklusterCandidates,
    ...getNegativeCandidates(
      scene,
      roleTagIds,
      thresholds,
      lacklusterCandidates.length > 0
    ),
    ...getPerformerLineupCandidates(scene, ratingConfig),
    // CUSTOM: the configured uncommon-tag chip already reports Feet presence.
    ...(roleTagIds?.outstandingActivityCommonTagIds?.length
      ? []
      : getFeetCandidates(scene, roleTagIds)),
    ...getTagCandidates(
      scene,
      roleTagIds,
      thresholds,
      outstandingActivityMatrix
    ),
  ];
}

export function getSceneCardInsightSets(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"],
  ratingConfig?: SceneCardInsightRatingConfig,
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
) {
  const outstandingActivityMatrix = getOutstandingActivityMatrix(
    scene,
    roleTagIds,
    configuredThresholds
  );
  const candidates = getSceneCardInsightCandidates(
    scene,
    roleTagIds,
    configuredThresholds,
    ratingConfig,
    roleStatsByPerformer,
    outstandingActivityMatrix
  );
  const goatOpensActivityMatrix =
    outstandingActivityMatrix.rows.length > 0 &&
    candidates.some((candidate) => candidate.kind === "goat") &&
    !candidates.some(
      (candidate) =>
        candidate.kind === "outstanding-activity" ||
        candidate.kind === "outstanding-activity-presence"
    );
  return {
    visible: selectSceneCardInsights(candidates),
    all: selectAllSceneCardInsights(candidates),
    goatOpensActivityMatrix,
    outstandingActivityMatrix,
  };
}

export function getSceneCardInsights(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"],
  ratingConfig?: SceneCardInsightRatingConfig,
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
): ISceneCardInsight[] {
  return getSceneCardInsightSets(
    scene,
    roleTagIds,
    configuredThresholds,
    ratingConfig,
    roleStatsByPerformer
  ).visible;
}
