import type { IUIConfig } from "src/core/config";
import { getPerformerRareRoleAction } from "../Performers/performerRolePartnerLabels_custom";
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
import { getPerformerLineupCandidates } from "./sceneCardInsightPerformerRules_custom";
import {
  compareSceneCardInsightCandidates,
  selectAllSceneCardInsights,
  selectSceneCardInsights,
} from "./sceneCardInsightSelection_custom";
import type {
  ISceneCardInsight,
  SceneCardInsightCandidate,
  SceneCardInsightEvent,
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
  visibleInsightLimit: 7,
  rareRoleMaximumPercent: 20,
  tagGoodAmountMinPercent: 10,
  tagLotsMinPercent: 25,
  tagEyeCanSeeMinPercent: 50,
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
  const visibleInsightLimit = finiteInteger(
    value?.visibleInsightLimit,
    defaultSceneCardInsightThresholds.visibleInsightLimit,
    1,
    20
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
  return {
    visibleInsightLimit,
    rareRoleMaximumPercent: finiteInteger(
      value?.rareRoleMaximumPercent,
      defaultSceneCardInsightThresholds.rareRoleMaximumPercent,
      0,
      100
    ),
    tagGoodAmountMinPercent,
    tagLotsMinPercent,
    tagEyeCanSeeMinPercent,
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
  const categories: Array<{ category: EventCategory; name: string }> = [
    { category: "facial", name: "facial" },
    { category: "orgasm", name: "regular" },
  ];
  const sections = categories.flatMap(({ category, name }) => {
    const categoryEvents = events.filter(
      (event) => event.category === category
    );
    if (categoryEvents.length === 0) return [];

    const qualifiers = [
      ["GOAT", categoryEvents.filter((event) => event.quality === "GOAT")],
      [
        "Really Hot",
        categoryEvents.filter((event) => event.quality === "Really Hot"),
      ],
    ] as const;
    const qualifierSummary = qualifiers
      .filter(([, qualifiedEvents]) => qualifiedEvents.length > 0)
      .map(([label, qualifiedEvents]) => `${qualifiedEvents.length} ${label}`)
      .join(", ");
    const eventName =
      category === "facial" && categoryEvents.length !== 1 ? "facials" : name;
    return [
      `${categoryEvents.length} ${eventName}${
        qualifierSummary ? ` (${qualifierSummary})` : ""
      }`,
    ];
  });

  return `${events.length} ${events.length === 1 ? "orgasm" : "orgasms"}${
    sections.length > 0 ? ` · ${sections.join(" · ")}` : ""
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

  const simultaneousPerformers = orgasmMarkers.reduce<
    SceneCardInsightPerformer[]
  >((largestGroup, marker) => {
    const simultaneousMarkerPerformers = Array.from(
      new Map(
        (marker.top_performers ?? []).map((performer) => [
          performer.id,
          performer,
        ])
      ).values()
    );
    return simultaneousMarkerPerformers.length > largestGroup.length
      ? simultaneousMarkerPerformers
      : largestGroup;
  }, []);
  const simultaneousCount = simultaneousPerformers.length;
  if (simultaneousCount >= 2) {
    candidates.push({
      key: "orgasm-simultaneous",
      label: `${simultaneousCount} vatos nut at the same time`,
      detail: "One orgasm marker has this many top performers",
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
      performerPreview: performer, // CUSTOM: show the vato tied to the repeated-orgasm chip.
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
      statsParts: topRows.map((row) =>
        tagAmountLabel(row.amountLevel, displayTagName(row.tag))
      ), // CUSTOM
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
      statsLabel: label, // CUSTOM: group performer-specific details.
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
          statsLabel: `Rare ${category} ${role}`, // CUSTOM: group performer instances.
          detail: `${count} of ${total} ${category}-role scenes (${Math.round(
            percent
          )}%) · usually ${getPerformerRareRoleAction(category, usualRole)}`,
          tone: "rare",
          performerPreview: performer, // CUSTOM: show the vato tied to the rare-role chip.
          kind: "rare-role",
          score: (thresholds.rareRoleMaximumPercent - percent) * 1000 + total,
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

function getNegativeCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  // CUSTOM: No-orgasm is only meaningful after a completed primary activity
  // range proves that the scene has been processed.
  const hasCompletedActivity = hasCompletedActivityMarker(
    scene,
    roleTagIds,
    sceneDuration
  );
  const candidates = getAttractivenessNegativeCandidates(scene);

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
    ...getRareRoleCandidates(
      scene,
      roleTagIds,
      thresholds,
      roleStatsByPerformer
    ),
    ...getNegativeCandidates(scene, roleTagIds),
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
    visible: selectSceneCardInsights(
      candidates,
      thresholds.visibleInsightLimit
    ),
    all: selectAllSceneCardInsights(candidates),
    candidates, // CUSTOM: Stats uses the same candidates and selection as cards.
    visibleInsightLimit: thresholds.visibleInsightLimit,
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
