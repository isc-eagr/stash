import type { IUIConfig } from "src/core/config";
import type * as GQL from "src/core/generated-graphql";

export type SceneCardInsightThresholds = Required<
  NonNullable<IUIConfig["sceneCardInsightThresholds"]>
>;

export type SceneCardInsightThresholdKey = keyof SceneCardInsightThresholds;

export const defaultSceneCardInsightThresholds: SceneCardInsightThresholds = {
  relevantMinEpisodes: 3,
  relevantMinDurationSeconds: 60,
  goodOutstandingPercent: 20,
  greatOutstandingPercent: 40,
  amazingOutstandingPercent: 60,
  nearPerfectOutstandingPercent: 80,
  fewHighlightsMaxEpisodes: 1,
  fillerTotalPercent: 20,
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
    relevantMinEpisodes: finiteInteger(
      value?.relevantMinEpisodes,
      defaultSceneCardInsightThresholds.relevantMinEpisodes,
      1,
      100
    ),
    relevantMinDurationSeconds: finiteInteger(
      value?.relevantMinDurationSeconds,
      defaultSceneCardInsightThresholds.relevantMinDurationSeconds,
      0,
      86400
    ),
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
    fillerTotalPercent: finiteInteger(
      value?.fillerTotalPercent,
      defaultSceneCardInsightThresholds.fillerTotalPercent,
      0,
      100
    ),
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

export type SceneCardInsightTone =
  | "activity"
  | "interaction"
  | "tag"
  | "goat"
  | "event"
  | "negative";

export interface ISceneCardInsight {
  key: string;
  label: string;
  detail: string;
  tone: SceneCardInsightTone;
}

type SceneCardInsightTagParent = {
  id: string;
  parents?: SceneCardInsightTagParent[] | null;
};

type SceneCardInsightTag = {
  id: string;
  name: string;
  parents?: SceneCardInsightTagParent[] | null;
};

type SceneCardInsightPerformer = {
  id: string;
  name: string;
};

type SceneCardInsightMarker = Pick<
  GQL.SlimSceneDataFragment["scene_markers"][number],
  "id" | "seconds" | "end_seconds"
> & {
  primary_tag: SceneCardInsightTag;
  tags: SceneCardInsightTag[];
  top_performers?: SceneCardInsightPerformer[];
  bottom_performers?: SceneCardInsightPerformer[];
};

export type SceneCardInsightScene = Pick<GQL.SlimSceneDataFragment, "id"> & {
  files: Array<Pick<GQL.VideoFileDataFragment, "duration">>;
  performers: SceneCardInsightPerformer[];
  scene_markers: SceneCardInsightMarker[];
  negative_markers?: Array<{
    id: string;
    start_seconds: number;
    end_seconds: number;
  }>;
};

type ActivityCategory = "sex" | "oral" | "solo";
type EventCategory = "orgasm" | "facial";

type InsightInterval = {
  start: number;
  end: number;
};

type MarkerStats = {
  duration: number;
  episodes: number;
  markerCount: number;
};

type InsightCandidate = ISceneCardInsight & {
  rank: number;
};

const maxInsights = 7;
const maxActivityInsights = 2;
const ordinaryContextSlots = 5;

const activityLabels: Record<ActivityCategory, string> = {
  sex: "sex",
  oral: "oral",
  solo: "solo",
};

function allMarkerTags(marker: SceneCardInsightMarker) {
  return [marker.primary_tag, ...marker.tags];
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
    tagMatchesConfiguredTag(tag, roleTagIds?.reallyHotTagId)
  );
}

function markerIsOutstanding(
  marker: SceneCardInsightMarker,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  return (
    !activityCategoryForMarker(marker, roleTagIds) ||
    marker.tags.length > 0 ||
    markerHasConfiguredTag(marker, roleTagIds?.goatTagId)
  );
}

function markerInterval(
  marker: SceneCardInsightMarker,
  sceneDuration: number
): InsightInterval | undefined {
  if (marker.end_seconds === null || marker.end_seconds === undefined) {
    return undefined;
  }

  const maximum = sceneDuration > 0 ? sceneDuration : Number.POSITIVE_INFINITY;
  const start = Math.max(0, Math.min(marker.seconds, maximum));
  const end = Math.max(0, Math.min(marker.end_seconds, maximum));
  return end > start ? { start, end } : undefined;
}

function mergeIntervals(intervals: InsightInterval[]) {
  const sorted = [...intervals].sort(
    (a, b) => a.start - b.start || a.end - b.end
  );
  const merged: InsightInterval[] = [];

  sorted.forEach((interval) => {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
      return;
    }
    previous.end = Math.max(previous.end, interval.end);
  });

  return merged;
}

function intervalDuration(intervals: InsightInterval[]) {
  return mergeIntervals(intervals).reduce(
    (total, interval) => total + interval.end - interval.start,
    0
  );
}

function markerStats(
  markers: Iterable<SceneCardInsightMarker>,
  sceneDuration: number
): MarkerStats {
  const uniqueMarkers = new Map<string, SceneCardInsightMarker>();
  for (const marker of markers) uniqueMarkers.set(marker.id, marker);

  const timedIntervals: InsightInterval[] = [];
  let untimedEpisodes = 0;
  uniqueMarkers.forEach((marker) => {
    const interval = markerInterval(marker, sceneDuration);
    if (interval) timedIntervals.push(interval);
    else untimedEpisodes += 1;
  });
  const merged = mergeIntervals(timedIntervals);

  return {
    duration: intervalDuration(merged),
    episodes: merged.length + untimedEpisodes,
    markerCount: uniqueMarkers.size,
  };
}

function overlapSeconds(a: InsightInterval, b: InsightInterval) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

function episodeLabel(count: number) {
  return `${count} ${count === 1 ? "episode" : "episodes"}`;
}

function markerLabel(count: number) {
  return `${count} ${count === 1 ? "marker" : "markers"}`;
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
  if (tagMatchesConfiguredTag(tag, roleTagIds?.orgasmTagId)) return "orgasm";
  if (tagMatchesConfiguredTag(tag, roleTagIds?.facialTagId)) return "facial";
  return undefined;
}

function eventLabel(category: EventCategory) {
  return category === "orgasm" ? "Orgasm" : "Facial";
}

function eventCountLabel(category: EventCategory, count: number) {
  return `${eventLabel(category)} ×${count}`;
}

function statsDetail(stats: MarkerStats) {
  const pieces = [episodeLabel(stats.episodes), markerLabel(stats.markerCount)];
  if (stats.duration > 0) pieces.unshift(formatDuration(stats.duration));
  return pieces.join(" · ");
}

function isRelevant(
  stats: MarkerStats,
  thresholds: SceneCardInsightThresholds
) {
  return (
    stats.episodes >= thresholds.relevantMinEpisodes ||
    stats.duration > thresholds.relevantMinDurationSeconds
  );
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
    markerIsOutstanding(marker, roleTagIds)
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
      if (!isRelevant(activityStats, thresholds)) return [];

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
          rank:
            level.rank * 1_000_000 +
            activityOutstandingPercent * 1_000 +
            outstandingDuration,
        },
      ];
    })
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));
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
  const activityDurations = (
    Object.keys(activityLabels) as ActivityCategory[]
  ).map((category) => ({
    category,
    duration: markerStats(
      scene.scene_markers.filter(
        (marker) => activityCategoryForMarker(marker, roleTagIds) === category
      ),
      sceneDuration
    ).duration,
  }));
  if (activityDurations.filter(({ duration }) => duration > 0).length <= 1) {
    return [];
  }

  const sexDuration =
    activityDurations.find(({ category }) => category === "sex")?.duration ?? 0;
  const oralDuration =
    activityDurations.find(({ category }) => category === "oral")?.duration ??
    0;
  if (sexDuration <= 0 && oralDuration <= 0) return [];
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
      detail: `${Math.round(sexPercent)}% sex · ${Math.round(
        oralPercent
      )}% oral among sex/oral activity`,
      tone: "activity",
      rank: 750_000_000 + combinedDuration,
    },
  ];
}

type TagMarkerGroup = {
  tag: SceneCardInsightTag;
  markers: Map<string, SceneCardInsightMarker>;
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

function orgasmRepeatPhrase(count: number) {
  return count === 2 ? "nuts twice" : `nuts ${count} times`;
}

function getOrgasmAutomaticCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
): InsightCandidate[] {
  const orgasmMarkers = scene.scene_markers.filter((marker) =>
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
      rank: 950_000_000 + simultaneousCount,
    });
  }

  const performerMarkers = new Map<
    string,
    {
      markers: Map<string, SceneCardInsightMarker>;
      performer: SceneCardInsightPerformer;
    }
  >();
  orgasmMarkers
    .filter(
      (marker) => !markerHasConfiguredTag(marker, roleTagIds?.secondCameraTagId)
    )
    .forEach((marker) => {
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
      rank: 940_000_000 + markers.size,
    });
  });

  return candidates.sort(
    (a, b) => b.rank - a.rank || a.label.localeCompare(b.label)
  );
}

function getAutomaticCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const goatGroups = new Map<string, TagMarkerGroup>();
  const goatMarkersWithoutTags = new Map<string, SceneCardInsightMarker>();

  scene.scene_markers
    .filter((marker) => markerHasConfiguredTag(marker, roleTagIds?.goatTagId))
    .forEach((marker) => {
      const insightTags = allMarkerTags(marker).filter(
        (tag) =>
          !tagIsActivity(tag, roleTagIds) && !tagIsQualifier(tag, roleTagIds)
      );
      if (insightTags.length === 0) {
        goatMarkersWithoutTags.set(marker.id, marker);
      }
      insightTags.forEach((tag) => addTagMarker(goatGroups, tag, marker));
    });

  const hasGoatFacial = scene.scene_markers.some(
    (marker) =>
      markerHasConfiguredTag(marker, roleTagIds?.facialTagId) &&
      markerHasConfiguredTag(marker, roleTagIds?.goatTagId)
  );
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
  goatGroups.forEach(({ tag, markers }) => {
    const eventCategory = eventCategoryForTag(tag, roleTagIds);
    if (hasGoatFacial && eventCategory === "orgasm") return;
    const performer = sharedMarkerPerformerScope(markers.values());
    const groupKey =
      eventCategory === "facial"
        ? `facial:${performer?.key ?? tag.id}`
        : performer
        ? `performer:${performer.key}`
        : `tag:${tag.id}`;
    const group = goatPerformerGroups.get(groupKey) ?? {
      markers: new Map<string, SceneCardInsightMarker>(),
      parts: [],
      performer,
    };
    markers.forEach((marker) => group.markers.set(marker.id, marker));
    group.parts.push({
      eventCategory,
      name: displayTagName(tag),
      markerCount: markers.size,
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
      detail: `GOAT · ${statsDetail(stats)}`,
      tone: "goat",
      rank: 1_000_000_000 + stats.duration * 100 + stats.episodes,
    };
  });

  if (goatMarkersWithoutTags.size > 0) {
    const stats = markerStats(goatMarkersWithoutTags.values(), sceneDuration);
    const performer = sharedMarkerPerformerScope(
      goatMarkersWithoutTags.values()
    );
    const performerSuffix = performer ? ` from ${performer.label}` : "";
    goatCandidates.push({
      key: "goat-moment",
      label:
        stats.markerCount === 1
          ? `GOAT moment${performerSuffix}`
          : `GOAT moments ×${stats.markerCount}${performerSuffix}`,
      detail: statsDetail(stats),
      tone: "goat",
      rank: 1_000_000_000 + stats.duration * 100 + stats.episodes,
    });
  }

  const reallyHotCandidates: InsightCandidate[] = [];
  const markerHasGoatEvent = (
    marker: SceneCardInsightMarker,
    category: EventCategory
  ) =>
    markerHasConfiguredTag(marker, roleTagIds?.goatTagId) &&
    markerHasConfiguredTag(
      marker,
      category === "orgasm" ? roleTagIds?.orgasmTagId : roleTagIds?.facialTagId
    );
  const hasReallyHotFacial = scene.scene_markers.some(
    (marker) =>
      markerHasConfiguredTag(marker, roleTagIds?.facialTagId) &&
      markerHasConfiguredTag(marker, roleTagIds?.reallyHotTagId)
  );
  const reallyHotCategories: EventCategory[] = hasReallyHotFacial
    ? ["facial"]
    : ["orgasm"];
  reallyHotCategories.forEach((category) => {
    const configuredTagID =
      category === "orgasm" ? roleTagIds?.orgasmTagId : roleTagIds?.facialTagId;
    if (!configuredTagID || !roleTagIds?.reallyHotTagId) return;
    const markers = scene.scene_markers.filter(
      (marker) =>
        markerHasConfiguredTag(marker, configuredTagID) &&
        markerHasConfiguredTag(marker, roleTagIds.reallyHotTagId) &&
        !markerHasGoatEvent(marker, category)
    );
    if (markers.length === 0) return;
    const stats = markerStats(markers, sceneDuration);
    reallyHotCandidates.push({
      key: `really-hot-${category}`,
      label: `Really Hot ${eventCountLabel(
        category,
        stats.markerCount
      ).toLocaleLowerCase()}`,
      detail: statsDetail(stats),
      tone: "event",
      rank: 900_000_000 + stats.duration * 100 + stats.episodes,
    });
  });

  return [
    ...goatCandidates,
    ...getOrgasmAutomaticCandidates(scene, roleTagIds),
    ...reallyHotCandidates,
  ].sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));
}

function getTagCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds,
  automaticCandidates: InsightCandidate[]
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const groups = new Map<string, TagMarkerGroup>();
  scene.scene_markers.forEach((marker) => {
    const seenTagIDs = new Set<string>();
    allMarkerTags(marker).forEach((tag) => {
      if (
        seenTagIDs.has(tag.id) ||
        tagIsActivity(tag, roleTagIds) ||
        tagIsQualifier(tag, roleTagIds)
      ) {
        return;
      }
      seenTagIDs.add(tag.id);
      addTagMarker(groups, tag, marker);
    });
  });

  const automaticGoatTagIDs = new Set(
    scene.scene_markers
      .filter((marker) => markerHasConfiguredTag(marker, roleTagIds?.goatTagId))
      .flatMap((marker) => allMarkerTags(marker))
      .filter(
        (tag) =>
          !tagIsActivity(tag, roleTagIds) && !tagIsQualifier(tag, roleTagIds)
      )
      .map((tag) => tag.id)
  );
  const reallyHotEventCategories = new Set(
    automaticCandidates
      .filter((candidate) => candidate.key.startsWith("really-hot-"))
      .map((candidate) => candidate.key.slice("really-hot-".length))
  );

  type TagCandidatePart = InsightCandidate & {
    eventCategory?: EventCategory;
    markers: Map<string, SceneCardInsightMarker>;
    name: string;
    performer?: ReturnType<typeof performerScope>;
    tagID: string;
  };

  const parts = Array.from(groups.values()).flatMap(
    ({ tag, markers }): TagCandidatePart[] => {
      if (automaticGoatTagIDs.has(tag.id)) return [];
      const stats = markerStats(markers.values(), sceneDuration);
      if (!isRelevant(stats, thresholds)) return [];
      const eventCategory = eventCategoryForTag(tag, roleTagIds);
      if (eventCategory && reallyHotEventCategories.has(eventCategory)) {
        return [];
      }
      const name = displayTagName(tag);
      return [
        {
          key: `tag-${tag.id}`,
          label: eventCategory
            ? eventCountLabel(eventCategory, stats.markerCount)
            : `Lots of ${name}`,
          detail: statsDetail(stats),
          tone: eventCategory ? "event" : "tag",
          rank:
            (eventCategory ? 700_000_000 : 600_000_000) +
            stats.duration * 100 +
            stats.episodes,
          eventCategory,
          markers,
          name,
          performer: eventCategory
            ? undefined
            : sharedMarkerPerformerScope(markers.values()),
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
        eventCategory: _eventCategory,
        markers: _markers,
        name: _name,
        performer: _performer,
        tagID: _tagID,
        ...candidate
      } = part;
      unscopedCandidates.push(candidate);
      return;
    }
    const group = performerGroups.get(part.performer.key) ?? [];
    group.push(part);
    performerGroups.set(part.performer.key, group);
  });

  const performerCandidates = Array.from(performerGroups.values()).map(
    (performerParts): InsightCandidate => {
      const sortedParts = [...performerParts].sort(
        (a, b) => b.rank - a.rank || a.name.localeCompare(b.name)
      );
      const performer = sortedParts[0].performer!;
      const markers = new Map<string, SceneCardInsightMarker>();
      sortedParts.forEach((part) =>
        part.markers.forEach((marker) => markers.set(marker.id, marker))
      );
      const stats = markerStats(markers.values(), sceneDuration);
      const descriptors = sortedParts.map((part) =>
        part.eventCategory
          ? eventCountLabel(part.eventCategory, part.markers.size)
          : part.name
      );
      const onlyEvent =
        sortedParts.length === 1 && !!sortedParts[0].eventCategory;
      return {
        key: `tag-performer-${performer.key}-${sortedParts
          .map((part) => part.tagID)
          .sort()
          .join("-")}`,
        label: `${onlyEvent ? "" : "Lots of "}${joinInsightNames(
          descriptors
        )} from ${performer.label}`,
        detail: `${statsDetail(stats)} · ${joinInsightNames(
          sortedParts.map((part) => part.name)
        )} from ${performer.label}`,
        tone: sortedParts.every((part) => !!part.eventCategory)
          ? "event"
          : "tag",
        rank:
          Math.max(...sortedParts.map((part) => part.rank)) +
          stats.duration * 100 +
          stats.episodes,
      };
    }
  );

  return [...performerCandidates, ...unscopedCandidates].sort(
    (a, b) => b.rank - a.rank || a.label.localeCompare(b.label)
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

function meaningfulInteractionMarkers(
  markers: Map<string, SceneCardInsightMarker> | undefined,
  sceneDuration: number,
  thresholds: SceneCardInsightThresholds
) {
  return (
    !!markers &&
    isRelevant(markerStats(markers.values(), sceneDuration), thresholds)
  );
}

function getInteractionCandidate(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds
): InsightCandidate[] {
  const graph = buildInteractionGraph(scene, roleTagIds);
  if (graph.cast.length < 2) return [];
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const meaningful = (markers?: Map<string, SceneCardInsightMarker>) =>
    meaningfulInteractionMarkers(markers, sceneDuration, thresholds);
  const directed = (
    category: InteractionCategory,
    topID: string,
    bottomID: string
  ) =>
    meaningful(
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
      ? meaningful(
          graph.roleMarkers.get(interactionRoleKey(category, role, performerID))
        )
      : meaningful(combinedInteractionMarkers(graph, performerID, role));

  const partners = new Map<string, Set<string>>(
    graph.cast.map((performer) => [performer.id, new Set<string>()])
  );
  graph.pairMarkers.forEach((markers, key) => {
    if (!meaningful(markers)) return;
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
    (markers) => meaningful(markers)
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
      rank: 875_000_000 + priority,
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
      "Both vatos meaningfully top and bottom each other in sex and oral",
      10
    );
  }

  if (twoVatoSexVersatile && !twoVatoOralVersatile) {
    return candidate(
      "sexually-versatile",
      "Sexually Versatile",
      "Both vatos meaningfully top and bottom each other in sex, but not oral",
      9
    );
  }

  if (twoVatoOralVersatile && !twoVatoSexVersatile) {
    return candidate(
      "orally-versatile",
      "Orally Versatile",
      "Both vatos meaningfully top and bottom each other in oral, but not sex",
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
      "Every vato meaningfully tops and bottoms",
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

function getNegativeCandidates(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  thresholds: SceneCardInsightThresholds
) {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  const outstandingStats = markerStats(
    scene.scene_markers.filter((marker) =>
      markerIsOutstanding(marker, roleTagIds)
    ),
    sceneDuration
  );
  const candidates: InsightCandidate[] = [];

  if (outstandingStats.episodes <= thresholds.fewHighlightsMaxEpisodes) {
    candidates.push({
      key: "few-highlights",
      label: "Few highlights",
      detail: `${statsDetail(outstandingStats)} outstanding`,
      tone: "negative",
      rank: 800_000_000,
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
        detail: `${formatDuration(totalFillerDuration)} total · ${Math.round(
          fillerPercent
        )}% filler (no positive marker; negative markers count)`,
        tone: "negative",
        rank: 850_000_000 + totalFillerDuration,
      });
    }
  }

  return candidates.sort(
    (a, b) => b.rank - a.rank || a.label.localeCompare(b.label)
  );
}

export function getSceneCardInsights(
  scene: SceneCardInsightScene,
  roleTagIds: IUIConfig["roleTagIds"],
  configuredThresholds?: IUIConfig["sceneCardInsightThresholds"]
): ISceneCardInsight[] {
  const thresholds = normalizeSceneCardInsightThresholds(configuredThresholds);
  const leaningCandidates = getLeaningCandidate(scene, roleTagIds, thresholds);
  const allAutomaticCandidates = getAutomaticCandidates(scene, roleTagIds);
  const goatCandidates = allAutomaticCandidates.filter((candidate) =>
    candidate.key.startsWith("goat-")
  );
  const nonGoatAutomaticCandidates = allAutomaticCandidates.filter(
    (candidate) => !candidate.key.startsWith("goat-")
  );
  const automaticCandidates = [
    ...goatCandidates,
    ...nonGoatAutomaticCandidates.slice(
      0,
      Math.max(
        0,
        maxInsights - goatCandidates.length - leaningCandidates.length
      )
    ),
  ];
  const activityCandidates = getActivityCandidates(
    scene,
    roleTagIds,
    thresholds
  );
  const contextualCandidates = [
    ...getInteractionCandidate(scene, roleTagIds, thresholds),
    ...getNegativeCandidates(scene, roleTagIds, thresholds),
    ...getTagCandidates(scene, roleTagIds, thresholds, automaticCandidates),
  ].sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  const availableAfterMandatory =
    maxInsights - automaticCandidates.length - leaningCandidates.length;
  const selectedActivity = activityCandidates.slice(
    0,
    Math.min(maxActivityInsights, availableAfterMandatory)
  );
  const contextCapacity = Math.min(
    ordinaryContextSlots,
    Math.max(0, availableAfterMandatory - selectedActivity.length)
  );
  const selectedContext = contextualCandidates.slice(0, contextCapacity);

  const selectedInsights = [
    ...automaticCandidates,
    ...selectedActivity,
    ...leaningCandidates,
    ...selectedContext,
  ];
  const visibleInsights =
    goatCandidates.length > maxInsights
      ? goatCandidates
      : selectedInsights.slice(0, maxInsights);
  return visibleInsights.map(({ rank: _rank, ...insight }) => insight);
}
