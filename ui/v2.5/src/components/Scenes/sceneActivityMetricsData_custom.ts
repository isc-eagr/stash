import type * as GQL from "src/core/generated-graphql";
import { isChronologicalSceneMarkerGoatTagged } from "./SceneDetails/sceneMarkerChronologyLayout_custom";
import {
  getActivityTypePercentagesCustom,
  getPartitionPercentagesCustom,
} from "../Shared/activityTypePercentages_custom";

export type SceneActivityCategory = "sex" | "oral" | "solo";
type SceneQualityCategory =
  | "outstanding"
  | "standard"
  | "unclassified"
  | "unusable";
export type SceneActivityMetricKey =
  | SceneActivityCategory
  | SceneQualityCategory
  | `${SceneActivityCategory}-${SceneQualityCategory}`
  | "other";

export type SceneActivityMetric = {
  key: SceneActivityMetricKey;
  label: string;
  percent: number;
  duration?: number;
  showPercent?: boolean;
  color?: string;
  outstandingPercent?: number;
  outstandingDuration?: number;
};

export type SceneActivityMetricRows = {
  activity: SceneActivityMetric[];
  quality: SceneActivityMetric[];
};

export function hasVisibleSceneActivitySortMetricCustom(
  sortBy: string | undefined,
  metrics: SceneActivityMetricRows | undefined
): boolean {
  const suffix = "_activity_percent";
  if (!sortBy?.endsWith(suffix) || !metrics) return false;

  const key = sortBy.slice(0, -suffix.length);
  return (
    metrics.activity.some(
      (metric) => metric.key === key && (metric.duration ?? 0) > 0
    ) ||
    metrics.quality.some(
      (metric) => metric.key === key && (metric.duration ?? 0) > 0
    )
  );
}

type SceneActivityInterval = {
  start: number;
  end: number;
};

type SceneActivityMetricTag = {
  id: string;
  parents?: SceneActivityMetricTag[] | null;
};

export type SceneActivityRoleTagIds = {
  sexTagId?: string;
  oralTagId?: string;
  soloTagId?: string;
  goatTagId?: string;
  orgasmTagId?: string;
  reallyHotTagId?: string;
};

export type SceneActivityScene = Pick<GQL.SlimSceneDataFragment, "id"> & {
  files: Array<Pick<GQL.VideoFileDataFragment, "duration">>;
  scene_markers: Array<
    Pick<
      GQL.SlimSceneDataFragment["scene_markers"][number],
      "seconds" | "end_seconds" | "primary_tag" | "tags"
    >
  >;
  negative_markers?: Array<{
    start_seconds: number;
    end_seconds: number;
  }>;
};

function sceneActivityMarkerHasPrimaryTag(
  marker: SceneActivityScene["scene_markers"][number],
  targetId: string | undefined
): boolean {
  return !!targetId && marker.primary_tag.id === targetId;
}

function sceneActivityMarkerCategory(
  marker: SceneActivityScene["scene_markers"][number],
  roleTagIds: SceneActivityRoleTagIds
): SceneActivityCategory | undefined {
  if (sceneActivityMarkerHasPrimaryTag(marker, roleTagIds.sexTagId)) {
    return "sex";
  }
  if (sceneActivityMarkerHasPrimaryTag(marker, roleTagIds.oralTagId)) {
    return "oral";
  }
  if (sceneActivityMarkerHasPrimaryTag(marker, roleTagIds.soloTagId)) {
    return "solo";
  }

  return undefined;
}

function sceneActivityTagMatches(
  tag: SceneActivityMetricTag,
  targetTagId: string | undefined
): boolean {
  return (
    !!targetTagId &&
    (tag.id === targetTagId ||
      !!tag.parents?.some((parent) =>
        sceneActivityTagMatches(parent, targetTagId)
      ))
  );
}

function sceneActivityMarkerHasTag(
  marker: SceneActivityScene["scene_markers"][number],
  targetTagId: string | undefined
) {
  return [marker.primary_tag, ...marker.tags].some((tag) =>
    sceneActivityTagMatches(tag, targetTagId)
  );
}

function sceneActivityMarkerIsOutstanding(
  marker: SceneActivityScene["scene_markers"][number],
  roleTagIds: SceneActivityRoleTagIds
): boolean {
  // CUSTOM: ordinary orgasms, including Facial descendants, are standard.
  // They only become Outstanding with an explicit Really Hot/GOAT qualifier.
  if (sceneActivityMarkerHasTag(marker, roleTagIds.orgasmTagId)) {
    return (
      isChronologicalSceneMarkerGoatTagged(marker, roleTagIds.goatTagId) ||
      sceneActivityMarkerHasTag(marker, roleTagIds.reallyHotTagId)
    );
  }
  return (
    isChronologicalSceneMarkerGoatTagged(marker, roleTagIds.goatTagId) ||
    !sceneActivityMarkerCategory(marker, roleTagIds) ||
    marker.tags.length > 0
  );
}

function mergeSceneActivityIntervals(
  intervals: SceneActivityInterval[]
): SceneActivityInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: SceneActivityInterval[] = [];

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged;
}

function subtractSceneActivityIntervals(
  intervals: SceneActivityInterval[],
  subtractIntervals: SceneActivityInterval[]
): SceneActivityInterval[] {
  const blockers = mergeSceneActivityIntervals(subtractIntervals);

  return mergeSceneActivityIntervals(intervals).flatMap((interval) => {
    let cursor = interval.start;
    const remaining: SceneActivityInterval[] = [];

    blockers.forEach((blocker) => {
      if (blocker.end <= cursor || blocker.start >= interval.end) return;

      if (blocker.start > cursor) {
        remaining.push({
          start: cursor,
          end: Math.min(blocker.start, interval.end),
        });
      }
      cursor = Math.max(cursor, blocker.end);
    });

    if (cursor < interval.end) {
      remaining.push({ start: cursor, end: interval.end });
    }

    return remaining;
  });
}

function intersectSceneActivityIntervals(
  firstIntervals: SceneActivityInterval[],
  secondIntervals: SceneActivityInterval[]
) {
  const first = mergeSceneActivityIntervals(firstIntervals);
  const second = mergeSceneActivityIntervals(secondIntervals);
  const intersections: SceneActivityInterval[] = [];
  let firstIndex = 0;
  let secondIndex = 0;

  while (firstIndex < first.length && secondIndex < second.length) {
    const start = Math.max(first[firstIndex].start, second[secondIndex].start);
    const end = Math.min(first[firstIndex].end, second[secondIndex].end);
    if (end > start) intersections.push({ start, end });

    if (first[firstIndex].end < second[secondIndex].end) {
      firstIndex += 1;
    } else {
      secondIndex += 1;
    }
  }

  return intersections;
}

function getSceneActivityDuration(intervals: SceneActivityInterval[]) {
  return mergeSceneActivityIntervals(intervals).reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0
  );
}

export function getSceneActivityMetrics(
  scene: SceneActivityScene,
  roleTagIds: SceneActivityRoleTagIds
): SceneActivityMetricRows | undefined {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  if (sceneDuration <= 0) return undefined;

  const intervalsByCategory: Record<
    SceneActivityCategory,
    SceneActivityInterval[]
  > = {
    sex: [],
    oral: [],
    solo: [],
  };
  const outstandingIntervals: SceneActivityInterval[] = [];

  scene.scene_markers.forEach((marker) => {
    if (marker.end_seconds === null || marker.end_seconds === undefined) {
      return;
    }

    const interval = {
      start: Math.max(0, Math.min(marker.seconds, sceneDuration)),
      end: Math.max(0, Math.min(marker.end_seconds, sceneDuration)),
    };

    if (interval.end <= interval.start) return;

    const category = sceneActivityMarkerCategory(marker, roleTagIds);
    if (category) {
      intervalsByCategory[category].push(interval);
    }

    if (sceneActivityMarkerIsOutstanding(marker, roleTagIds)) {
      outstandingIntervals.push(interval);
    }
  });

  const unusableIntervals =
    scene.negative_markers
      ?.map((marker) => ({
        start: Math.max(0, Math.min(marker.start_seconds, sceneDuration)),
        end: Math.max(0, Math.min(marker.end_seconds, sceneDuration)),
      }))
      .filter((interval) => interval.end > interval.start) ?? [];

  const activityDurations = {
    sex: getSceneActivityDuration(intervalsByCategory.sex),
    oral: getSceneActivityDuration(intervalsByCategory.oral),
    solo: getSceneActivityDuration(intervalsByCategory.solo),
  };
  const activityPercentages =
    getActivityTypePercentagesCustom(activityDurations);
  const activityIntervals = Object.values(intervalsByCategory).flat();
  const activityOutstandingIntervals = intersectSceneActivityIntervals(
    activityIntervals,
    outstandingIntervals
  );
  const usableOutstandingIntervals = subtractSceneActivityIntervals(
    activityOutstandingIntervals,
    unusableIntervals
  );
  const outstandingDuration = getSceneActivityDuration(
    usableOutstandingIntervals
  );
  const unusableDuration = getSceneActivityDuration(unusableIntervals);
  const standardIntervals = subtractSceneActivityIntervals(activityIntervals, [
    ...outstandingIntervals,
    ...unusableIntervals,
  ]);
  const standardDuration = getSceneActivityDuration(standardIntervals);
  const unclassifiedIntervals = subtractSceneActivityIntervals(
    [{ start: 0, end: sceneDuration }],
    [...activityIntervals, ...unusableIntervals]
  );
  const unclassifiedDuration = getSceneActivityDuration(unclassifiedIntervals);
  const qualityDurations = {
    outstanding: outstandingDuration,
    standard: standardDuration,
    unclassified: unclassifiedDuration,
    unusable: unusableDuration,
  };
  const qualityPercentages = getPartitionPercentagesCustom(qualityDurations, [
    "outstanding",
    "standard",
    "unclassified",
    "unusable",
  ]);

  return {
    activity: (
      [
        ["sex", "Fucking"],
        ["oral", "Eating pito"],
        ["solo", "Jerking"],
      ] as const
    ).flatMap(([key, label]) => {
      const duration = activityDurations[key];
      if (duration <= 0) return [];
      const activityOutstandingDuration = getSceneActivityDuration(
        intersectSceneActivityIntervals(
          intervalsByCategory[key],
          usableOutstandingIntervals
        )
      );

      return [
        {
          key,
          label,
          percent: activityPercentages[key],
          duration,
          outstandingPercent: Math.round(
            (activityOutstandingDuration / duration) * 100
          ),
          outstandingDuration: activityOutstandingDuration,
        },
      ];
    }),
    quality: [
      {
        key: "outstanding",
        label: "Outstanding",
        duration: outstandingDuration,
        percent: qualityPercentages.outstanding,
      },
      {
        key: "standard",
        label: "Standard",
        duration: standardDuration,
        percent: qualityPercentages.standard,
      },
      {
        key: "unclassified",
        label: "Unclassified",
        duration: unclassifiedDuration,
        percent: qualityPercentages.unclassified,
      },
      {
        key: "unusable",
        label: "Unusable",
        duration: unusableDuration,
        percent: qualityPercentages.unusable,
      },
    ],
  };
}
