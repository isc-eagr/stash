import type { IUIConfig } from "src/core/config";
import {
  getPerformerOnlyTimeRoleAction,
  getPerformerRareRoleAction,
} from "../Performers/performerRolePartnerLabels_custom";
import {
  hasMinimumRuleEvidence,
  intervalDuration,
  markerCoverageDetail,
  markerInterval,
  markerStats,
  overlapSeconds,
  percentOfScene,
  type InsightInterval,
  type MarkerStats,
} from "./sceneCardInsightFacts_custom";
import {
  getPerformerLineupCandidates,
  getPerformerOnlySceneCandidates,
} from "./sceneCardInsightPerformerRules_custom";
import {
  compareSceneCardInsightCandidates,
  selectAllSceneCardInsights,
  selectSceneCardInsights,
} from "./sceneCardInsightSelection_custom";
import type {
  SceneCardInsightCandidate,
  SceneCardInsightEvent,
  SceneCardInsightMarker,
  SceneCardInsightPerformer,
  SceneCardInsightPerformerRoleStats,
  SceneCardInsightRatingConfig,
  SceneCardInsightScene,
  SceneCardInsightTag,
  SceneCardInsightThresholdKey,
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
  visibleInsightLimit: 7,
  rareRoleMaximumPercent: 20,
  tagGoodAmountMinPercent: 10,
  tagLotsMinPercent: 25,
  tagEyeCanSeeMinPercent: 50,
  shortOutstandingMaxSeconds: 12,
  shortOutstandingMinPercent: 65,
  shortOutstandingMinMarkers: 3,
};

// CUSTOM: Shared input bounds for Settings, Playground, and normalization.
export const sceneCardInsightThresholdBounds: Record<
  SceneCardInsightThresholdKey,
  { min: number; max: number }
> = {
  visibleInsightLimit: { min: 1, max: 20 },
  rareRoleMaximumPercent: { min: 0, max: 100 },
  tagGoodAmountMinPercent: { min: 0, max: 100 },
  tagLotsMinPercent: { min: 0, max: 100 },
  tagEyeCanSeeMinPercent: { min: 0, max: 100 },
  shortOutstandingMaxSeconds: { min: 1, max: 600 },
  shortOutstandingMinPercent: { min: 1, max: 100 },
  shortOutstandingMinMarkers: { min: 1, max: 100 },
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

function boundedThreshold(
  value: IUIConfig["sceneCardInsightThresholds"],
  key: SceneCardInsightThresholdKey
) {
  const { min, max } = sceneCardInsightThresholdBounds[key];
  return finiteInteger(
    value?.[key],
    defaultSceneCardInsightThresholds[key],
    min,
    max
  );
}

export function normalizeSceneCardInsightThresholds(
  value?: IUIConfig["sceneCardInsightThresholds"]
): SceneCardInsightThresholds {
  const tagGoodAmountMinPercent = boundedThreshold(
    value,
    "tagGoodAmountMinPercent"
  );
  const tagLotsMinPercent = Math.max(
    tagGoodAmountMinPercent,
    boundedThreshold(value, "tagLotsMinPercent")
  );
  const tagEyeCanSeeMinPercent = Math.max(
    tagLotsMinPercent,
    boundedThreshold(value, "tagEyeCanSeeMinPercent")
  );
  return {
    visibleInsightLimit: boundedThreshold(value, "visibleInsightLimit"),
    rareRoleMaximumPercent: boundedThreshold(value, "rareRoleMaximumPercent"),
    tagGoodAmountMinPercent,
    tagLotsMinPercent,
    tagEyeCanSeeMinPercent,
    shortOutstandingMaxSeconds: boundedThreshold(
      value,
      "shortOutstandingMaxSeconds"
    ),
    shortOutstandingMinPercent: boundedThreshold(
      value,
      "shortOutstandingMinPercent"
    ),
    shortOutstandingMinMarkers: boundedThreshold(
      value,
      "shortOutstandingMinMarkers"
    ),
  };
}

type ActivityCategory = "sex" | "oral" | "solo";
type EventCategory = "orgasm" | "facial";
type InsightCandidate = SceneCardInsightCandidate;

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
  // Activity ranges are explicit authoring, not a family inference. A Sex,
  // Oral, or Solo descendant is its own outstanding activity and must not
  // establish a broad activity-type range.
  if (marker.primary_tag.id === roleTagIds?.sexTagId) {
    return "sex";
  }
  if (marker.primary_tag.id === roleTagIds?.oralTagId) {
    return "oral";
  }
  if (marker.primary_tag.id === roleTagIds?.soloTagId) {
    return "solo";
  }
  return undefined;
}

function hasCompletedActivityMarker(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  sceneDuration: number
) {
  return scene.scene_markers.some(
    (marker) =>
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
      activityCategoryForMarker(marker, roleTagIds) !== undefined &&
      markerInterval(marker, sceneDuration) !== undefined
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

function markerIsHighlight(
  marker: SceneCardInsightMarker,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  // CUSTOM: non-role markers make overlapping activity Outstanding.
  if (!activityCategoryForMarker(marker, roleTagIds)) return true;

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

function eventReportLabel(events: SceneCardInsightEvent[]) {
  const categoryEvents = (category: EventCategory) =>
    events.filter((event) => event.category === category);
  // CUSTOM: A single category already is the total, so only mixed reports
  // repeat the total and call ordinary orgasms "regular".
  const mixed =
    categoryEvents("facial").length > 0 && categoryEvents("orgasm").length > 0;
  const plural = (count: number, singular: string, pluralName: string) =>
    `${count} ${count === 1 ? singular : pluralName}`;
  const sections = (["facial", "orgasm"] as const).flatMap((category) => {
    const matching = categoryEvents(category);
    if (matching.length === 0) return [];

    const qualifierSummary = (["GOAT", "Really Hot"] as const)
      .map(
        (quality) =>
          [
            quality,
            matching.filter((event) => event.quality === quality).length,
          ] as const
      )
      .filter(([, count]) => count > 0)
      .map(([quality, count]) => `${count} ${quality}`)
      .join(", ");
    const name =
      category === "facial"
        ? plural(matching.length, "facial", "facials")
        : mixed
        ? `${matching.length} regular`
        : plural(matching.length, "orgasm", "orgasms");
    return [`${name}${qualifierSummary ? ` (${qualifierSummary})` : ""}`];
  });

  return mixed
    ? `${plural(events.length, "orgasm", "orgasms")} · ${sections.join(" · ")}`
    : sections[0];
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

type TagPresenceRow = Pick<
  IOutstandingActivityRow,
  "tag" | "duration" | "markerCount" | "percent"
>;

// CUSTOM: markers without an end time have no coverage, so report their count.
function isUntimedRow(row: Pick<TagPresenceRow, "duration">) {
  return row.duration <= 0;
}

function tagRowAmountLabel(
  row: Pick<IOutstandingActivityRow, "tag" | "duration" | "markerCount"> & {
    amountLevel: OutstandingActivityAmountLevel;
  }
) {
  const name = displayTagName(row.tag);
  return isUntimedRow(row)
    ? `${name} ×${row.markerCount}`
    : tagAmountLabel(row.amountLevel, name);
}

function tagRowStatsPart(row: Parameters<typeof tagRowAmountLabel>[0]): string {
  return isUntimedRow(row)
    ? `${displayTagName(row.tag)} (no end time)`
    : tagRowAmountLabel(row);
}

function tagCoverageDetail(row: TagPresenceRow) {
  if (isUntimedRow(row)) {
    return `${row.markerCount} ${
      row.markerCount === 1 ? "marker" : "markers"
    } without an end time`;
  }
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
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"],
  includePerformers = true // CUSTOM: Stats needs totals only.
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
    (includePerformers ? scene.performers : []).map((performer) => [
      performer.id,
      performer,
    ]) // CUSTOM
  );
  let hasSceneWideActivity = false;

  const rows = Array.from(groups.values()).map(({ tag, markers }) => {
    const cellMarkers = new Map<string, Map<string, SceneCardInsightMarker>>();
    markers.forEach((marker) => {
      if (!includePerformers) return; // CUSTOM
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
  if (
    rows.length === 2 &&
    rows[0].amountLevel === rows[1].amountLevel &&
    !rows.some(isUntimedRow)
  ) {
    return tagAmountLabel(
      rows[0].amountLevel,
      joinInsightNames(rows.map((row) => displayTagName(row.tag)))
    );
  }

  return rows.map(tagRowAmountLabel).join(" · ");
}

function percentageRange(percent: number, bucketSize: number) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const minimum =
    value <= bucketSize
      ? 0
      : Math.floor((value - 1) / bucketSize) * bucketSize + 1;
  const maximum = Math.min(
    100,
    minimum === 0 ? bucketSize : minimum + bucketSize - 1
  );
  return `${minimum}-${maximum}%`;
}

function getActivityCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
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
  const candidates: InsightCandidate[] = [];

  const sexDuration = activityStatsByCategory.sex.duration;
  const oralDuration = activityStatsByCategory.oral.duration;
  const sexOutstandingPercent =
    sexDuration > 0 ? (outstandingDurations.sex / sexDuration) * 100 : 0;
  const oralOutstandingPercent =
    oralDuration > 0 ? (outstandingDurations.oral / oralDuration) * 100 : 0;
  if (sexDuration > 0 && oralDuration > 0) {
    const qualityLabel = `${percentageRange(
      sexOutstandingPercent,
      20
    )} outstanding sex, ${percentageRange(
      oralOutstandingPercent,
      20
    )} outstanding oral`;
    candidates.push({
      key: "activity-quality-stats",
      label: qualityLabel,
      detail: qualityLabel,
      tone: "activity",
      kind: "activity-quality",
      score: sexDuration + oralDuration,
      statsOnly: true,
      statsLabel: qualityLabel,
      statsParts: [qualityLabel],
    });
  }

  const activityMarkersFor = (category: ActivityCategory) =>
    activityMarkers[category];
  if (
    sexDuration > 0 &&
    oralDuration > 0 &&
    hasMinimumRuleEvidence(
      [...activityMarkersFor("sex"), ...activityMarkersFor("oral")],
      sceneDuration
    )
  ) {
    const combinedDuration = sexDuration + oralDuration;
    const sexPercent = (sexDuration / combinedDuration) * 100;
    const oralPercent = (oralDuration / combinedDuration) * 100;
    const leaningLabel = `${percentageRange(
      sexPercent,
      10
    )} fucking, ${percentageRange(oralPercent, 10)} eating pito`;
    candidates.push({
      key: "activity-split-stats",
      label: leaningLabel,
      detail: leaningLabel,
      tone: "activity",
      kind: "leaning",
      score: combinedDuration,
      statsOnly: true,
      statsLabel: leaningLabel,
      statsParts: [leaningLabel],
    });
  }

  return candidates;
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
      statsLabel: "Repeated orgasms", // CUSTOM: group performer instances.
      detail: `${markers.size} orgasm markers as top, excluding 2nd camera`,
      tone: "event",
      performerPreviews: [performer], // CUSTOM: show the vato tied to the repeated-orgasm chip.
      kind: "orgasm-event",
      score: 1_000_000 + markers.size,
    });
  });

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
  // CUSTOM: Facial markers belong to their own section, even when the Facial
  // family is a descendant of the configured Orgasm family.
  const markers = countableMarkers
    .filter(
      (marker) =>
        markerHasConfiguredTag(marker, roleTagIds?.facialTagId) ||
        markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId)
    )
    .sort((a, b) => a.seconds - b.seconds || a.id.localeCompare(b.id));
  if (markers.length === 0) return [];

  const events: SceneCardInsightEvent[] = markers.flatMap((marker) => {
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
  const stats = markerStats(markers, sceneDuration);
  const label = eventReportLabel(events);
  const regularEvents = events.filter((event) => event.category === "orgasm");
  const facialEvents = events.filter((event) => event.category === "facial");
  const goatEvents = events.filter((event) => event.quality === "GOAT");
  const reallyHotEvents = events.filter(
    (event) => event.quality === "Really Hot"
  );
  const statParts = [
    {
      group: 0,
      matchingEvents: events,
      singular: "total orgasm",
      plural: "total orgasms",
    },
    {
      group: 1,
      matchingEvents: regularEvents,
      singular: "regular orgasm",
      plural: "regular orgasms",
    },
    {
      group: 2,
      matchingEvents: facialEvents,
      singular: "facial",
      plural: "facials",
    },
    {
      group: 3,
      matchingEvents: goatEvents,
      singular: "GOAT event",
      plural: "GOAT events",
    },
    {
      group: 4,
      matchingEvents: regularEvents.filter((event) => event.quality === "GOAT"),
      singular: "GOAT regular orgasm",
      plural: "GOAT regular orgasms",
    },
    {
      group: 5,
      matchingEvents: facialEvents.filter((event) => event.quality === "GOAT"),
      singular: "GOAT facial",
      plural: "GOAT facials",
    },
    {
      group: 6,
      matchingEvents: reallyHotEvents,
      singular: "Really Hot event",
      plural: "Really Hot events",
    },
    {
      group: 7,
      matchingEvents: regularEvents.filter(
        (event) => event.quality === "Really Hot"
      ),
      singular: "Really Hot regular orgasm",
      plural: "Really Hot regular orgasms",
    },
    {
      group: 8,
      matchingEvents: facialEvents.filter(
        (event) => event.quality === "Really Hot"
      ),
      singular: "Really Hot facial",
      plural: "Really Hot facials",
    },
  ].filter(({ matchingEvents }) => matchingEvents.length > 0);
  const statsParts = statParts.map(({ matchingEvents, ...part }) => {
    const count = matchingEvents.length;
    const text = `${count} ${count === 1 ? part.singular : part.plural}`;
    return { text, group: part.group, value: count };
  });
  const statsPartOrder = Object.fromEntries(
    statsParts.map(({ text, group, value }) => [text, { group, value }])
  );

  return [
    {
      key: "orgasm-facial-report",
      label,
      detail: markerCoverageDetail(stats),
      tone: "event",
      kind: "event-report",
      score: stats.duration * 100 + events.length,
      statsParts: statsParts.map(({ text }) => text),
      statsPartOrder,
      orgasmFacialEvents: events,
      ...(goatEvents.length > 0 ? { hasGoatEvent: true } : {}),
    },
  ];
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
      statsLabel: `GOAT ${joinInsightNames(descriptors)}`, // CUSTOM
      statsParts: descriptors.map((name) => `GOAT ${name}`), // CUSTOM
      detail: markerCoverageDetail(stats),
      tone: "goat",
      kind: "goat",
      matrixTagIds: parts.map((part) => part.tagID),
      score: stats.duration * 100 + stats.episodes,
    };
  });

  goatMomentGroups.forEach(({ markers, performer }, groupKey) => {
    const stats = markerStats(markers.values(), sceneDuration);
    const performerSuffix = performer ? ` from ${performer.label}` : "";
    goatCandidates.push({
      key: `goat-moment:${groupKey}`,
      statsLabel: "GOAT moment", // CUSTOM
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

function getEventSubtagPresenceRows(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): TagPresenceRow[] {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const groups = new Map<string, TagMarkerGroup>();

  scene.scene_markers
    .filter(
      (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) =>
      allMarkerTags(marker).forEach((tag) => {
        // CUSTOM: Event descendants remain present even when their marker also
        // contributes to the GOAT or Orgasm/Facial reports.
        if (
          tag.id !== roleTagIds?.orgasmTagId &&
          tag.id !== roleTagIds?.facialTagId &&
          tag.id !== roleTagIds?.reallyHotTagId &&
          tag.id !== roleTagIds?.goatTagId &&
          eventCategoryForTag(tag, roleTagIds)
        ) {
          addTagMarker(groups, tag, marker);
        }
      })
    );

  return Array.from(groups.values()).map(({ tag, markers }) => {
    const stats = markerStats(markers.values(), sceneDuration);
    return {
      tag,
      duration: stats.duration,
      markerCount: stats.markerCount,
      percent: percentOfScene(stats.duration, sceneDuration),
    };
  });
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
  const eventSubtagRows = getEventSubtagPresenceRows(scene, roleTagIds);
  if (activityMatrix.rows.length === 0 && eventSubtagRows.length === 0)
    return [];

  const goatInsightTagIDs = getGoatInsightTagIDs(scene, roleTagIds);
  const chipRows = activityMatrix.rows.filter(
    (row) =>
      !goatInsightTagIDs.has(row.tag.id) &&
      !eventCategoryForTag(row.tag, roleTagIds)
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
  const uncommonRows: TagPresenceRow[] =
    commonTagIDs.length > 0
      ? chipRows.filter(
          (row) =>
            !commonTagIDs.some((tagID) =>
              tagMatchesConfiguredTag(row.tag, tagID)
            )
        )
      : [];
  // CUSTOM: Event subtags always use presence wording, independently of the
  // common-tag configuration and GOAT suppression for ordinary activity.
  uncommonRows.push(...eventSubtagRows);
  uncommonRows.sort(
    (a, b) =>
      b.duration - a.duration ||
      b.markerCount - a.markerCount ||
      displayTagName(a.tag).localeCompare(displayTagName(b.tag)) ||
      a.tag.id.localeCompare(b.tag.id)
  );
  const candidates: InsightCandidate[] = [];

  if (commonRows.length > 0) {
    const topRows = commonRows.slice(0, 2);
    candidates.push({
      key: "outstanding-activity",
      statsParts: topRows.map(tagRowStatsPart), // CUSTOM
      label: getOutstandingActivityChipLabel({
        ...activityMatrix,
        rows: commonRows,
      }),
      detail: topRows
        .map((row) => `${displayTagName(row.tag)}: ${tagCoverageDetail(row)}`)
        .join(" · "),
      tone: "tag",
      kind: "outstanding-activity",
      matrixTagIds: topRows.map((row) => row.tag.id),
      score:
        topRows[0].duration * 10_000 +
        topRows.reduce((total, row) => total + row.markerCount, 0),
    });
  }

  if (uncommonRows.length > 0) {
    candidates.push({
      key: "outstanding-activity-presence",
      statsParts: uncommonRows.map(
        (row) => `Scene contains ${displayTagName(row.tag)}`
      ), // CUSTOM
      label: `Scene contains ${joinInsightNames(
        uncommonRows.map((row) => displayTagName(row.tag))
      )}`,
      detail: uncommonRows
        .map((row) => `${displayTagName(row.tag)}: ${tagCoverageDetail(row)}`)
        .join(" · "),
      tone: "tag",
      kind: "outstanding-activity-presence",
      matrixTagIds: uncommonRows.map((row) => row.tag.id),
      score: uncommonRows.reduce(
        (total, row) => total + row.duration * 100 + row.markerCount,
        0
      ),
    });
  }

  return candidates;
}

type InteractionCategory = "sex" | "oral";
type InteractionRole = "top" | "bottom";

type InteractionGraph = {
  cast: SceneCardInsightPerformer[];
  sidelined: SceneCardInsightPerformer[];
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

// CUSTOM: A direction needs the minimum share of the runtime, so a brief
// flip cannot establish a whole-scene pattern. Untimed markers and scenes
// without a duration cannot be measured and count by presence.
function interactionDirectionHasEvidence(
  markers: Map<string, SceneCardInsightMarker>,
  sceneDuration: number
) {
  if (sceneDuration <= 0) return markers.size > 0;
  const untimed = [...markers.values()].some(
    (marker) => !markerInterval(marker, sceneDuration)
  );
  return untimed || hasMinimumRuleEvidence(markers.values(), sceneDuration);
}

function buildInteractionGraph(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InteractionGraph {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const scenePerformers = [
    ...new Map(
      scene.performers.map((performer) => [performer.id, performer])
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const castIDs = new Set(scenePerformers.map((performer) => performer.id));
  const candidateDirections = new Map<
    string,
    {
      category: InteractionCategory;
      topID: string;
      bottomID: string;
      markers: Map<string, SceneCardInsightMarker>;
    }
  >();

  scene.scene_markers
    .filter(
      (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) => {
      const categories = interactionCategoriesForMarker(marker, roleTagIds);
      if (categories.length === 0) return;
      const castIDsFor = (performers?: SceneCardInsightPerformer[]) => [
        ...new Set(
          (performers ?? [])
            .map((performer) => performer.id)
            .filter((id) => castIDs.has(id))
        ),
      ];
      const tops = castIDsFor(marker.top_performers);
      const bottoms = castIDsFor(marker.bottom_performers);

      categories.forEach((category) =>
        tops.forEach((topID) =>
          bottoms.forEach((bottomID) => {
            if (topID === bottomID) return;
            const key = interactionDirectedKey(category, topID, bottomID);
            const direction = candidateDirections.get(key) ?? {
              category,
              topID,
              bottomID,
              markers: new Map<string, SceneCardInsightMarker>(),
            };
            direction.markers.set(marker.id, marker);
            candidateDirections.set(key, direction);
          })
        )
      );
    });

  const directedMarkers = new Map<
    string,
    Map<string, SceneCardInsightMarker>
  >();
  const pairMarkers = new Map<string, Map<string, SceneCardInsightMarker>>();
  const roleMarkers = new Map<string, Map<string, SceneCardInsightMarker>>();
  candidateDirections.forEach(({ category, topID, bottomID, markers }, key) => {
    if (!interactionDirectionHasEvidence(markers, sceneDuration)) return;
    markers.forEach((marker) => {
      addInteractionMarker(directedMarkers, key, marker);
      addInteractionMarker(
        pairMarkers,
        interactionPairKey(topID, bottomID),
        marker
      );
      addInteractionMarker(
        roleMarkers,
        interactionRoleKey(category, "top", topID),
        marker
      );
      addInteractionMarker(
        roleMarkers,
        interactionRoleKey(category, "bottom", bottomID),
        marker
      );
    });
  });

  // CUSTOM: Patterns describe the vatos in the sex/oral action; listed cast
  // members without a qualifying interaction are reported separately.
  const participantIDs = new Set(
    [...pairMarkers.keys()].flatMap((key) => key.split("::"))
  );
  return {
    cast: scenePerformers.filter((performer) =>
      participantIDs.has(performer.id)
    ),
    sidelined: scenePerformers.filter(
      (performer) => !participantIDs.has(performer.id)
    ),
    directedMarkers,
    pairMarkers,
    roleMarkers,
  };
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

  const sidelinedNote =
    graph.sidelined.length > 0
      ? `${joinInsightNames(
          graph.sidelined.map((performer) => performer.name)
        )} not in the sex/oral action`
      : "";
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
      statsLabel: label, // CUSTOM: group performer-specific details.
      detail: sidelinedNote ? `${detail} · ${sidelinedNote}` : detail,
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

  // CUSTOM: Match the role history, which counts Sex/Oral subtags and
  // secondary tags, so a role in a descendant marker is still current.
  const activeRoles = new Set<string>();
  scene.scene_markers.forEach((marker) => {
    if (markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)) return;

    interactionCategoriesForMarker(marker, roleTagIds).forEach((category) => {
      (marker.top_performers ?? []).forEach((performer) =>
        activeRoles.add(`${category}:top:${performer.id}`)
      );
      (marker.bottom_performers ?? []).forEach((performer) =>
        activeRoles.add(`${category}:bottom:${performer.id}`)
      );
    });
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
        // CUSTOM: The only scene with a role is notable at any threshold.
        const onlyTime = count === 1;
        if (
          count <= 0 ||
          (!onlyTime && percent > thresholds.rareRoleMaximumPercent)
        ) {
          return;
        }

        const usualRole: InteractionRole = role === "top" ? "bottom" : "top";
        candidates.push({
          key: `rare-${category}-${role}-${performer.id}`,
          label: onlyTime
            ? `Only time ${performer.name} ${getPerformerOnlyTimeRoleAction(
                category,
                role
              )}`
            : `Rare instance of ${performer.name} ${getPerformerRareRoleAction(
                category,
                role
              )}`,
          // CUSTOM: group performer instances.
          statsLabel: `${onlyTime ? "Only-time" : "Rare"} ${category} ${role}`,
          // Versatile scenes count once per role, so report both role counts.
          detail: `${topCount} top · ${bottomCount} bottom ${category} scenes (${Math.round(
            percent
          )}% ${role}) · usually ${getPerformerRareRoleAction(
            category,
            usualRole
          )}`,
          tone: "rare",
          performerPreviews: [performer], // CUSTOM: show the vato tied to the rare-role chip.
          kind: "rare-role",
          score:
            (onlyTime ? 100_000 : 0) +
            (thresholds.rareRoleMaximumPercent - percent) * 1000 +
            total,
        });
      });
    });
  });

  return candidates.sort(compareSceneCardInsightCandidates);
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

// CUSTOM: Outstanding moments are better when they last, so flag scenes whose
// timed Outstanding markers are mostly very short. Orgasm/Facial events are
// short by nature and 2nd Camera markers repeat footage, so both are skipped.
function getShortOutstandingCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds,
  sceneDuration: number
): InsightCandidate[] {
  const durations = scene.scene_markers.flatMap((marker) => {
    if (
      !markerIsHighlight(marker, roleTagIds) ||
      markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) ||
      markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId) ||
      markerHasConfiguredTag(marker, roleTagIds?.facialTagId)
    ) {
      return [];
    }
    const interval = markerInterval(marker, sceneDuration);
    return interval ? [interval.end - interval.start] : [];
  });
  if (durations.length < thresholds.shortOutstandingMinMarkers) return [];

  const shortCount = durations.filter(
    (duration) => duration <= thresholds.shortOutstandingMaxSeconds
  ).length;
  const percent = (shortCount / durations.length) * 100;
  if (percent < thresholds.shortOutstandingMinPercent) return [];

  return [
    {
      key: "short-outstanding",
      label: "Short Outstanding",
      detail: `${shortCount} of ${durations.length} Outstanding markers last ${
        thresholds.shortOutstandingMaxSeconds
      }s or less (${Math.round(percent)}%)`,
      tone: "negative",
      kind: "short-outstanding",
      score: percent,
    },
  ];
}

function getNegativeCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  // CUSTOM: No-orgasm is only meaningful after a completed primary activity
  // range proves that the scene has been processed.
  const hasCompletedActivity = hasCompletedActivityMarker(
    scene,
    roleTagIds,
    sceneDuration
  );
  const candidates = [
    ...getAttractivenessNegativeCandidates(scene),
    ...getShortOutstandingCandidates(
      scene,
      roleTagIds,
      thresholds,
      sceneDuration
    ),
  ];

  if (
    hasCompletedActivity &&
    (roleTagIds?.orgasmTagId || roleTagIds?.facialTagId)
  ) {
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
  return [
    ...automaticCandidates,
    ...getActivityCandidates(scene, roleTagIds),
    ...getInteractionCandidate(scene, roleTagIds),
    ...getPerformerOnlySceneCandidates(scene, roleStatsByPerformer),
    ...getRareRoleCandidates(
      scene,
      roleTagIds,
      thresholds,
      roleStatsByPerformer
    ),
    ...getNegativeCandidates(scene, roleTagIds, thresholds),
    ...getPerformerLineupCandidates(scene, ratingConfig),
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
  roleStatsByPerformer?: ReadonlyMap<
    string,
    SceneCardInsightPerformerRoleStats
  >,
  includePerformerMatrix = true // CUSTOM
) {
  const thresholds = normalizeSceneCardInsightThresholds(configuredThresholds);
  const outstandingActivityMatrix = getOutstandingActivityMatrix(
    scene,
    roleTagIds,
    configuredThresholds,
    includePerformerMatrix // CUSTOM
  );
  const matrixTagIDs = new Set(
    outstandingActivityMatrix.rows.map((row) => row.tag.id)
  );
  // CUSTOM: A chip opens the matrix only when the matrix shows one of its tags.
  const candidates = getSceneCardInsightCandidates(
    scene,
    roleTagIds,
    configuredThresholds,
    ratingConfig,
    roleStatsByPerformer,
    outstandingActivityMatrix
  ).map((candidate) =>
    candidate.matrixTagIds?.some((tagID) => matrixTagIDs.has(tagID))
      ? { ...candidate, opensActivityMatrix: true }
      : candidate
  );
  return {
    visible: selectSceneCardInsights(
      candidates,
      thresholds.visibleInsightLimit
    ),
    all: selectAllSceneCardInsights(candidates),
    candidates, // CUSTOM: Stats uses the same candidates and selection as cards.
    outstandingActivityMatrix,
  };
}
