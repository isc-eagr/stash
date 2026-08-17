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
  SceneCardInsightThresholdKey,
  SceneCardInsightThresholds,
} from "./sceneCardInsightTypes_custom";

export const defaultSceneCardInsightThresholds: SceneCardInsightThresholds = {
  goodOutstandingPercent: 20,
  greatOutstandingPercent: 40,
  amazingOutstandingPercent: 60,
  nearPerfectOutstandingPercent: 80,
  fewHighlightsMaxEpisodes: 1,
  fewHighlightsMaxPercent: 5,
  fillerTotalPercent: 20,
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

function sharedMarkerPerformerScope(markers: Iterable<SceneCardInsightMarker>) {
  let shared: ReturnType<typeof performerScope> | undefined;
  for (const marker of markers) {
    const performers = markerPerformers(marker);
    if (performers.length === 0) return undefined;
    const current = performerScope(performers);
    if (shared && shared.key !== current.key) return undefined;
    shared = current;
  }
  return shared;
}

function markerPerformerScopeKey(marker: SceneCardInsightMarker) {
  const performers = markerPerformers(marker);
  return performers.length > 0
    ? `performer:${performerScope(performers).key}`
    : "unassigned";
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

function eventLabel(category: EventCategory) {
  return category === "orgasm" ? "Orgasm" : "Facial";
}

function eventCountLabel(category: EventCategory, count: number) {
  return `${
    category === "facial" ? "Facials" : eventLabel(category)
  } ×${count}`;
}

type TagAmountLevel = "good-amount" | "lots" | "eye-can-see";

function tagAmountLevel(
  percent: number,
  thresholds: SceneCardInsightThresholds
): TagAmountLevel | undefined {
  if (percent >= thresholds.tagEyeCanSeeMinPercent) return "eye-can-see";
  if (percent >= thresholds.tagLotsMinPercent) return "lots";
  if (percent >= thresholds.tagGoodAmountMinPercent) return "good-amount";
  return undefined;
}

function tagAmountLabel(level: TagAmountLevel, name: string) {
  if (level === "eye-can-see") return `${name} as far as the eye can see`;
  if (level === "lots") return `Lots of ${name}`;
  return `Good amount of ${name}`;
}

function tagCoverageDetail(stats: MarkerStats, sceneDuration: number) {
  return `${Math.round(
    percentOfScene(stats.duration, sceneDuration)
  )}% of scene · ${markerCoverageDetail(stats)}`;
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
  return (Object.keys(activityMarkers) as ActivityCategory[])
    .flatMap((category): InsightCandidate[] => {
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
      const level = activityQualityLevel(
        activityOutstandingPercent,
        thresholds
      );
      if (!level) return [];

      const activityName = activityLabels[category];
      const detail = `${Math.round(
        activityOutstandingPercent
      )}% of ${activityName} is Outstanding (${formatDuration(
        outstandingDuration
      )})`;
      return [
        {
          key: `activity-${category}`,
          label: `${level.label} ${activityName}`,
          detail,
          tone: "activity",
          kind: "activity-quality",
          score:
            level.rank * 1_000_000 +
            activityOutstandingPercent * 1_000 +
            outstandingDuration,
        },
      ];
    })
    .sort(compareSceneCardInsightCandidates);
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
      markerHasConfiguredTag(marker, roleTagIds?.orgasmTagId) &&
      !markerHasConfiguredTag(marker, roleTagIds?.facialTagId)
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
      score: 20_000 + simultaneousCount,
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
      score: 10_000 + markers.size,
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

function getAutomaticCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const goatTagGroups = new Map<string, GoatTagMarkerGroup>();
  const goatEventGroups: Record<
    EventCategory,
    Map<string, PerformerMarkerGroup>
  > = {
    orgasm: new Map(),
    facial: new Map(),
  };
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
        const eventCategory = eventCategoryForTag(tag, roleTagIds);
        if (eventCategory) {
          addPerformerMarker(goatEventGroups[eventCategory], marker);
          return;
        }
        addGoatTagMarker(goatTagGroups, tag, marker);
      });
    });

  const goatPerformerGroups = new Map<
    string,
    {
      markers: Map<string, SceneCardInsightMarker>;
      parts: Array<{
        eventCategory?: EventCategory;
        name: string;
        markerCount: number;
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
      markerCount: markers.size,
      tagID: tag.id,
    });
    goatPerformerGroups.set(groupKey, group);
  });

  goatEventGroups.orgasm.forEach(({ markers, performer }, groupKey) => {
    const nonFacialMarkers = new Map(
      [...markers].filter(
        ([, marker]) => !markerHasConfiguredTag(marker, roleTagIds?.facialTagId)
      )
    );
    if (nonFacialMarkers.size === 0) return;
    const group = goatPerformerGroups.get(groupKey) ?? {
      markers: new Map<string, SceneCardInsightMarker>(),
      parts: [],
      performer,
    };
    nonFacialMarkers.forEach((marker) => group.markers.set(marker.id, marker));
    group.parts.push({
      eventCategory: "orgasm",
      name: eventLabel("orgasm"),
      markerCount: nonFacialMarkers.size,
      tagID: `orgasm:${groupKey}`,
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
    const descriptors = parts.map((part) =>
      part.eventCategory
        ? `${eventLabel(part.eventCategory)} ×${part.markerCount}`
        : part.name
    );
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

  const goatFacialMarkers = new Map<string, SceneCardInsightMarker>();
  goatEventGroups.facial.forEach(({ markers }) =>
    markers.forEach((marker) => goatFacialMarkers.set(marker.id, marker))
  );
  if (goatFacialMarkers.size > 0) {
    const stats = markerStats(goatFacialMarkers.values(), sceneDuration);
    goatCandidates.push({
      key: "goat-facial",
      label: `GOAT ${eventCountLabel("facial", stats.markerCount)}`,
      detail: markerCoverageDetail(stats),
      tone: "goat",
      kind: "goat",
      score: stats.duration * 100 + stats.episodes,
    });
  }

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

  const reallyHotCandidates: InsightCandidate[] = [];
  const reallyHotCategories: EventCategory[] = ["facial", "orgasm"];
  reallyHotCategories.forEach((category) => {
    const configuredTagID =
      category === "orgasm" ? roleTagIds?.orgasmTagId : roleTagIds?.facialTagId;
    if (!configuredTagID || !roleTagIds?.reallyHotTagId) return;
    const markers = scene.scene_markers.filter(
      (marker) =>
        markerHasConfiguredTag(marker, configuredTagID) &&
        markerHasConfiguredTag(marker, roleTagIds.reallyHotTagId) &&
        !markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId) &&
        (category !== "orgasm" ||
          !markerHasConfiguredTag(marker, roleTagIds?.facialTagId))
    );
    if (markers.length === 0) return;
    const stats = markerStats(markers, sceneDuration);
    reallyHotCandidates.push({
      key: `really-hot-${category}`,
      label:
        category === "facial"
          ? `Really Hot ${eventCountLabel(category, stats.markerCount)}`
          : `Really Hot ${eventCountLabel(
              category,
              stats.markerCount
            ).toLocaleLowerCase()}`,
      detail: markerCoverageDetail(stats),
      tone: "event",
      kind: category === "facial" ? "facial" : "really-hot-event",
      score: stats.duration * 100 + stats.episodes,
    });
  });

  const standardFacialMarkers = scene.scene_markers.filter(
    (marker) =>
      markerHasConfiguredTag(marker, roleTagIds?.facialTagId) &&
      !markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
      !markerHasConfiguredTag(marker, roleTagIds?.reallyHotTagId) &&
      !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
  );
  const standardFacialCandidates: InsightCandidate[] = [];
  if (standardFacialMarkers.length > 0) {
    const stats = markerStats(standardFacialMarkers, sceneDuration);
    standardFacialCandidates.push({
      key: "standard-facial",
      label: eventCountLabel("facial", stats.markerCount),
      detail: markerCoverageDetail(stats),
      tone: "event",
      kind: "facial",
      score: stats.duration * 100 + stats.episodes,
    });
  }

  return [
    ...goatCandidates,
    ...getOrgasmAutomaticCandidates(scene, roleTagIds),
    ...reallyHotCandidates,
    ...standardFacialCandidates,
  ].sort(compareSceneCardInsightCandidates);
}

function getTagCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const groups = new Map<string, TagMarkerGroup>();
  scene.scene_markers
    .filter(
      (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) => {
      const seenTagIDs = new Set<string>();
      allMarkerTags(marker).forEach((tag) => {
        if (
          seenTagIDs.has(tag.id) ||
          tagIsActivity(tag, roleTagIds) ||
          tagIsQualifier(tag, roleTagIds) ||
          eventCategoryForTag(tag, roleTagIds)
        ) {
          return;
        }
        seenTagIDs.add(tag.id);
        addTagMarker(groups, tag, marker);
      });
    });

  const goatPerformerScopesByTagID = new Map<string, Set<string>>();
  scene.scene_markers
    .filter(
      (marker) =>
        markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
        !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) => {
      const scopeKey = markerPerformerScopeKey(marker);
      allMarkerTags(marker)
        .filter(
          (tag) =>
            !tagIsActivity(tag, roleTagIds) && !tagIsQualifier(tag, roleTagIds)
        )
        .forEach((tag) => {
          const scopes = goatPerformerScopesByTagID.get(tag.id) ?? new Set();
          scopes.add(scopeKey);
          goatPerformerScopesByTagID.set(tag.id, scopes);
        });
    });
  type TagCandidatePart = InsightCandidate & {
    amountLevel: TagAmountLevel;
    markers: Map<string, SceneCardInsightMarker>;
    name: string;
    performer?: ReturnType<typeof performerScope>;
    tagID: string;
  };

  const parts = Array.from(groups.values()).flatMap(
    ({ tag, markers }): TagCandidatePart[] => {
      const goatPerformerScopes = goatPerformerScopesByTagID.get(tag.id);
      const amountMarkers = new Map(
        [...markers].filter(
          ([, marker]) =>
            !goatPerformerScopes?.has(markerPerformerScopeKey(marker))
        )
      );
      if (amountMarkers.size === 0) return [];
      const stats = markerStats(amountMarkers.values(), sceneDuration);
      const amountLevel = tagAmountLevel(
        percentOfScene(stats.duration, sceneDuration),
        thresholds
      );
      if (!amountLevel) return [];
      const name = displayTagName(tag);
      return [
        {
          key: `tag-${tag.id}`,
          label: tagAmountLabel(amountLevel, name),
          detail: tagCoverageDetail(stats, sceneDuration),
          tone: "tag",
          kind: "tag",
          score:
            percentOfScene(stats.duration, sceneDuration) * 10_000 +
            stats.duration,
          amountLevel,
          markers: amountMarkers,
          name,
          performer: sharedMarkerPerformerScope(amountMarkers.values()),
          tagID: tag.id,
        },
      ];
    }
  );

  const unscopedCandidates: InsightCandidate[] = [];
  const performerGroups = new Map<string, TagCandidatePart[]>();
  parts.forEach((part) => {
    if (!part.performer) {
      const {
        amountLevel: _amountLevel,
        markers: _markers,
        name: _name,
        performer: _performer,
        tagID: _tagID,
        ...candidate
      } = part;
      unscopedCandidates.push(candidate);
      return;
    }
    const groupKey = `${part.performer.key}:${part.amountLevel}`;
    const group = performerGroups.get(groupKey) ?? [];
    group.push(part);
    performerGroups.set(groupKey, group);
  });

  const performerCandidates = Array.from(performerGroups.values()).map(
    (performerParts): InsightCandidate => {
      const sortedParts = [...performerParts].sort(
        (a, b) => b.score - a.score || a.name.localeCompare(b.name)
      );
      const [{ amountLevel, performer: scopedPerformer }] = sortedParts;
      const performer = scopedPerformer!;
      const markers = new Map<string, SceneCardInsightMarker>();
      sortedParts.forEach((part) =>
        part.markers.forEach((marker) => markers.set(marker.id, marker))
      );
      const stats = markerStats(markers.values(), sceneDuration);
      const names = sortedParts.map((part) => part.name);
      return {
        key: `tag-performer-${performer.key}-${amountLevel}-${sortedParts
          .map((part) => part.tagID)
          .sort()
          .join("-")}`,
        label: `${tagAmountLabel(amountLevel, joinInsightNames(names))} from ${
          performer.label
        }`,
        detail: tagCoverageDetail(stats, sceneDuration),
        tone: "tag",
        kind: "tag",
        score:
          Math.max(...sortedParts.map((part) => part.score)) +
          stats.duration * 100 +
          stats.episodes,
      };
    }
  );

  return [...performerCandidates, ...unscopedCandidates].sort(
    compareSceneCardInsightCandidates
  );
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
    const category = activityCategoryForMarker(marker, roleTagIds);
    if (category !== "sex" && category !== "oral") return;
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

function hasInteractionEvidence(
  markers: Map<string, SceneCardInsightMarker> | undefined,
  sceneDuration: number
) {
  return !!markers && hasMinimumRuleEvidence(markers.values(), sceneDuration);
}

function getInteractionCandidate(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InsightCandidate[] {
  const graph = buildInteractionGraph(scene, roleTagIds);
  if (graph.cast.length < 2) return [];
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const hasEvidence = (markers?: Map<string, SceneCardInsightMarker>) =>
    hasInteractionEvidence(markers, sceneDuration);
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
      `All ${possiblePairs} vato pairings interact meaningfully`,
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
      "Every vato meaningfully gives and receives oral",
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
      "All three vatos interact meaningfully with both partners",
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
        `${centerPerformers[0].name} interacts meaningfully with every other vato`,
        1
      );
    }
  }

  return [];
}

const rareRoleMinimumScenes = 5;
const rareRoleMaximumPercent = 20;

function getRareRoleCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
): InsightCandidate[] {
  if (!roleStatsByPerformer) return [];

  const activeRoles = new Set<string>();
  const activeFacialPerformers = new Set<string>();
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

    if (markerHasConfiguredTag(marker, roleTagIds?.facialTagId)) {
      [
        ...(marker.top_performers ?? []),
        ...(marker.bottom_performers ?? []),
      ].forEach((performer) => activeFacialPerformers.add(performer.id));
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
        if (count <= 0 || percent > rareRoleMaximumPercent) {
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
          score: (rareRoleMaximumPercent - percent) * 1000 + total,
        });
      });
    });

    if (
      activeFacialPerformers.has(performer.id) &&
      stats.scene_count >= rareRoleMinimumScenes &&
      stats.facial_scene_count > 0
    ) {
      const facialPercent =
        (stats.facial_scene_count / stats.scene_count) * 100;
      if (facialPercent <= rareRoleMaximumPercent) {
        candidates.push({
          key: `rare-facial-${performer.id}`,
          label: `Rare instance of ${performer.name} in a facial scene`,
          detail: `${stats.facial_scene_count} of ${
            stats.scene_count
          } scenes (${Math.round(facialPercent)}%) include a Facial`,
          tone: "rare",
          kind: "rare-role",
          score:
            (rareRoleMaximumPercent - facialPercent) * 1000 + stats.scene_count,
        });
      }
    }
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
  thresholds: SceneCardInsightThresholds
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

  if (sceneDuration > 0) {
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
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
) {
  scene = withSceneTagAncestors(scene);
  const thresholds = normalizeSceneCardInsightThresholds(configuredThresholds);
  const automaticCandidates = getAutomaticCandidates(scene, roleTagIds);
  return [
    ...automaticCandidates,
    ...getActivityCandidates(scene, roleTagIds, thresholds),
    ...getLeaningCandidate(scene, roleTagIds, thresholds),
    ...getInteractionCandidate(scene, roleTagIds),
    ...getRareRoleCandidates(scene, roleTagIds, roleStatsByPerformer),
    ...getNegativeCandidates(scene, roleTagIds, thresholds),
    ...getPerformerLineupCandidates(scene, ratingConfig),
    ...getTagCandidates(scene, roleTagIds, thresholds),
  ];
}

export function getSceneCardInsightSets(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"],
  ratingConfig?: SceneCardInsightRatingConfig,
  roleStatsByPerformer?: ReadonlyMap<string, SceneCardInsightPerformerRoleStats>
) {
  const candidates = getSceneCardInsightCandidates(
    scene,
    roleTagIds,
    configuredThresholds,
    ratingConfig,
    roleStatsByPerformer
  );
  return {
    visible: selectSceneCardInsights(candidates),
    all: selectAllSceneCardInsights(candidates),
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
