import {
  subtractActivityIntervalsCustom as subtractSceneActivityIntervals,
  intersectActivityIntervalsCustom as intersectSceneActivityIntervals,
  activityDurationCustom as getSceneActivityDuration,
  type ActivityIntervalCustom as SceneActivityInterval,
} from "src/utils/activityIntervals_custom";
import type * as GQL from "src/core/generated-graphql";
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
  // Share of this activity's time inside negative markers. Outstanding excludes
  // that time, so this and outstandingPercent never overlap.
  negativePercent?: number;
};

export type SceneActivityMetricRows = {
  activity: SceneActivityMetric[];
  quality: SceneActivityMetric[];
};

import { ACTIVITY_LABELS_CUSTOM as SCENE_ACTIVITY_LABELS_CUSTOM } from "src/utils/activityLabels_custom";
export { SCENE_ACTIVITY_LABELS_CUSTOM };

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
  facialTagId?: string;
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
  // CUSTOM: flattened ancestry; marker tags only carry their direct parents.
  scene_marker_tag_ancestors?: Array<{
    tag_id: string;
    ancestor_ids: string[];
  }>;
};

export type SceneActivityTagAncestors = ReadonlyMap<string, readonly string[]>;

// CUSTOM: shared with the scene Stats tab so both classify markers alike.
export function sceneActivityTagAncestors(
  scene: Pick<SceneActivityScene, "scene_marker_tag_ancestors">
): SceneActivityTagAncestors {
  return new Map(
    (scene.scene_marker_tag_ancestors ?? []).map(({ tag_id, ancestor_ids }) => [
      tag_id,
      ancestor_ids,
    ])
  );
}

function sceneActivityMarkerHasPrimaryTag(
  marker: SceneActivityScene["scene_markers"][number],
  targetId: string | undefined
): boolean {
  return !!targetId && marker.primary_tag.id === targetId;
}

export function sceneActivityMarkerCategory(
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
  targetTagId: string | undefined,
  ancestors: SceneActivityTagAncestors
): boolean {
  return (
    !!targetTagId &&
    (tag.id === targetTagId ||
      !!ancestors.get(tag.id)?.includes(targetTagId) ||
      !!tag.parents?.some((parent) =>
        sceneActivityTagMatches(parent, targetTagId, ancestors)
      ))
  );
}

function sceneActivityMarkerHasTag(
  marker: SceneActivityScene["scene_markers"][number],
  targetTagId: string | undefined,
  ancestors: SceneActivityTagAncestors
) {
  return [marker.primary_tag, ...marker.tags].some((tag) =>
    sceneActivityTagMatches(tag, targetTagId, ancestors)
  );
}

export function sceneActivityMarkerIsOutstanding(
  marker: SceneActivityScene["scene_markers"][number],
  roleTagIds: SceneActivityRoleTagIds,
  ancestors: SceneActivityTagAncestors
): boolean {
  const isGoat = sceneActivityMarkerHasTag(
    marker,
    roleTagIds.goatTagId,
    ancestors
  );
  // Every Orgasm marker needs an explicit Really Hot/GOAT qualifier.
  if (sceneActivityMarkerHasTag(marker, roleTagIds.orgasmTagId, ancestors)) {
    return (
      isGoat ||
      sceneActivityMarkerHasTag(marker, roleTagIds.reallyHotTagId, ancestors)
    );
  }
  // Other timed non-activity markers are Outstanding across their full range.
  if (!sceneActivityMarkerCategory(marker, roleTagIds)) return true;
  return isGoat || marker.tags.length > 0;
}

export type SceneMarkerCountKeyCustom =
  | "orgasm_count"
  | "really_hot_orgasm_count"
  | "facial_count"
  | "regular_orgasm_count"
  | "goat_orgasm_count"
  | "regular_facial_count"
  | "goat_facial_count"
  | "really_hot_facial_count";

// Counts orgasm/facial markers (primary or secondary tag, including subtags),
// matching the backend marker-count sorts. Undefined when the needed role tags
// are not configured.
export function getSceneMarkerCountCustom(
  scene: Pick<
    SceneActivityScene,
    "scene_markers" | "scene_marker_tag_ancestors"
  >,
  roleTagIds: SceneActivityRoleTagIds,
  key: SceneMarkerCountKeyCustom
): number | undefined {
  const roleTagId = key.endsWith("orgasm_count")
    ? roleTagIds.orgasmTagId
    : roleTagIds.facialTagId;
  const quality = key.startsWith("really_hot_")
    ? "really_hot"
    : key.startsWith("goat_")
    ? "goat"
    : key.startsWith("regular_")
    ? "regular"
    : undefined;
  const reallyHot = quality === "really_hot";
  if (
    !roleTagId ||
    (reallyHot && !roleTagIds.reallyHotTagId) ||
    (quality === "goat" && !roleTagIds.goatTagId)
  ) {
    return undefined;
  }

  const ancestors = sceneActivityTagAncestors(scene);
  return scene.scene_markers.filter((marker) => {
    if (!sceneActivityMarkerHasTag(marker, roleTagId, ancestors)) return false;
    if (!quality) return true;
    const goat = sceneActivityMarkerHasTag(
      marker,
      roleTagIds.goatTagId,
      ancestors
    );
    const hot = sceneActivityMarkerHasTag(
      marker,
      roleTagIds.reallyHotTagId,
      ancestors
    );
    return quality === "goat"
      ? goat
      : quality === "really_hot"
      ? hot && !goat
      : !hot && !goat;
  }).length;
}

export function getSceneActivityDataCustom<
  M extends SceneActivityScene["scene_markers"][number]
>(
  scene: Omit<SceneActivityScene, "scene_markers"> & { scene_markers: M[] },
  roleTagIds: SceneActivityRoleTagIds
) {
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
  const markers: Array<{
    marker: M;
    category: SceneActivityCategory;
    interval: SceneActivityInterval;
  }> = [];
  const ancestors = sceneActivityTagAncestors(scene);

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
      markers.push({ marker, category, interval });
    }

    if (sceneActivityMarkerIsOutstanding(marker, roleTagIds, ancestors)) {
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
  const activityIntervals = Object.values(intervalsByCategory).flat();
  const activityTimeSeconds = getSceneActivityDuration(activityIntervals);
  const activityPercentages = getActivityTypePercentagesCustom(
    activityDurations,
    activityTimeSeconds
  );
  // CUSTOM: retain overlapping non-activity coverage and include any portion
  // outside Sex/Oral/Solo instead of clipping Outstanding to activity.
  const usableOutstandingIntervals = subtractSceneActivityIntervals(
    outstandingIntervals,
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
    [...activityIntervals, ...outstandingIntervals, ...unusableIntervals]
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

  const activityOtherIntervals = subtractSceneActivityIntervals(
    [{ start: 0, end: sceneDuration }],
    activityIntervals
  );
  const qualityByActivity = Object.fromEntries(
    (["sex", "oral", "solo"] as const).map((category) => [
      category,
      {
        totalSeconds: activityDurations[category],
        outstandingSeconds: getSceneActivityDuration(
          intersectSceneActivityIntervals(
            intervalsByCategory[category],
            usableOutstandingIntervals
          )
        ),
        unusableSeconds: getSceneActivityDuration(
          intersectSceneActivityIntervals(
            intervalsByCategory[category],
            unusableIntervals
          )
        ),
        standardSeconds: getSceneActivityDuration(
          subtractSceneActivityIntervals(intervalsByCategory[category], [
            ...outstandingIntervals,
            ...unusableIntervals,
          ])
        ),
      },
    ])
  ) as Record<
    SceneActivityCategory,
    {
      totalSeconds: number;
      outstandingSeconds: number;
      unusableSeconds: number;
      standardSeconds: number;
    }
  >;
  return {
    totalSeconds: sceneDuration,
    activityTimeSeconds,
    sexSeconds: activityDurations.sex,
    oralSeconds: activityDurations.oral,
    soloSeconds: activityDurations.solo,
    otherSeconds: getSceneActivityDuration(activityOtherIntervals),
    outstandingSeconds: outstandingDuration,
    standardSeconds: standardDuration,
    unclassifiedSeconds: unclassifiedDuration,
    unusableSeconds: unusableDuration,
    markers,
    qualityByActivity,
    activityOtherIntervals,
    outstandingVisibleIntervals: usableOutstandingIntervals,
    standardIntervals,
    unclassifiedIntervals,
    unusableIntervals,
    activityDurations,
    activityPercentages,
    qualityPercentages,
    intervalsByCategory,
    usableOutstandingIntervals,
    outstandingDuration,
    unusableDuration,
    standardDuration,
    unclassifiedDuration,
  };
}

export function getSceneActivityMetrics(
  scene: SceneActivityScene,
  roleTagIds: SceneActivityRoleTagIds
): SceneActivityMetricRows | undefined {
  const activity = getSceneActivityDataCustom(scene, roleTagIds);
  if (!activity) return undefined;
  const {
    activityDurations,
    activityPercentages,
    qualityPercentages,
    qualityByActivity,
    outstandingDuration,
    unusableDuration,
    standardDuration,
    unclassifiedDuration,
  } = activity;
  return {
    activity: (["sex", "oral", "solo"] as const).flatMap((key) => {
      const label = SCENE_ACTIVITY_LABELS_CUSTOM[key];
      const duration = activityDurations[key];
      if (duration <= 0) return [];
      const activityOutstandingDuration =
        qualityByActivity[key].outstandingSeconds;
      const activityNegativeDuration = qualityByActivity[key].unusableSeconds;

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
          negativePercent: Math.round(
            (activityNegativeDuration / duration) * 100
          ),
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
