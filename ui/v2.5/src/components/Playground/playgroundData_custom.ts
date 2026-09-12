import {
  getSceneRatingModeCustom,
  type SceneRatingModeCustom,
} from "../Shared/groupSceneRating_custom";
import {
  getRatingCardClass,
  hasRoyalSapphireSceneMarker,
  type IRatingCardOverrideTagIds,
  type IRatingCardThresholdConfig,
} from "src/utils/ratingCardStyles_custom";
import { metallicRatingChartBucket } from "src/utils/metallicRatingChart_custom";
import {
  markerHasTag,
  reallyHotFacialCount,
} from "../SceneStats/sceneStatsFacialCounts_custom";
import {
  sceneStatsActivityType,
  type SceneStatsActivityType,
} from "../SceneStats/sceneStatsChartBuckets_custom";
import type { StatsScene } from "../Shared/statsSceneData_custom";

export function playgroundScenesFromSnapshot(
  scenes: readonly StatsScene[]
): IPlaygroundScene[] {
  return scenes.map((scene) => ({ ...scene, tags: scene.rating_tier_tags }));
}

export interface IPlaygroundScene {
  id: string;
  title?: string | null;
  date?: string | null;
  rating100?: number | null;
  paths: { screenshot?: string | null };
  studio?: { id: string; name: string } | null;
  files: { duration: number }[];
  performers: {
    id: string;
    name: string;
    ethnicity?: string | null;
    country?: string | null;
  }[];
  tags: { id: string }[];
  rating_scores: {
    section: string;
    key: string;
    raw_value: number;
    weighted_value: number;
  }[];
  scene_markers: { primary_tag: { id: string }; tags: { id: string }[] }[];
  scene_marker_tag_ancestors: { tag_id: string; ancestor_ids: string[] }[];
}

export interface IPlaygroundConfig {
  roleTagIds?: {
    sexTagId?: string;
    oralTagId?: string;
    soloTagId?: string;
    facialTagId?: string;
    reallyHotTagId?: string;
    goatTagId?: string;
  };
  ratingCardOverrideTagIds?: IRatingCardOverrideTagIds;
  ratingCardThresholds?: IRatingCardThresholdConfig;
}

export interface IPlaygroundMetric {
  key: string;
  label: string;
  max: number;
  choices?: { value: number; label: string }[];
}

export interface IPlaygroundEntry {
  scene: IPlaygroundScene;
  mode: SceneRatingModeCustom;
  sceneType?: SceneStatsActivityType;
  ethnicities: string[];
  countries: string[];
  metallic: string;
  facial: "regular" | "rh" | "no";
  scores: Record<string, number | undefined>;
  adjustments: Set<string>;
}

export interface IPlaygroundFilters {
  sceneTypes: string[];
  ethnicities: string[];
  countries: string[];
  counts: string[];
  metallic: string[];
  facial: string[];
  present: string[];
  absent: string[];
}

export function playgroundFilterCount(filters: IPlaygroundFilters) {
  return Object.values(filters).reduce(
    (count, values) => count + values.length,
    0
  );
}

export const emptyPlaygroundFilters: IPlaygroundFilters = {
  sceneTypes: [],
  ethnicities: [],
  countries: [],
  counts: [],
  metallic: [],
  facial: [],
  present: [],
  absent: [],
};

export function updatePlaygroundFilter(
  filters: IPlaygroundFilters,
  key: keyof IPlaygroundFilters,
  values: string[]
): IPlaygroundFilters {
  const next = { ...filters, [key]: [...values] };
  if (key === "present")
    next.absent = next.absent.filter((value) => !values.includes(value));
  if (key === "absent")
    next.present = next.present.filter((value) => !values.includes(value));
  return next;
}

export function cleanPlaygroundValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.toLowerCase() !== "<nil>" ? trimmed : undefined;
}

export function preparePlaygroundScene(
  scene: IPlaygroundScene,
  config: IPlaygroundConfig
): IPlaygroundEntry {
  const roles = config.roleTagIds ?? {};
  const tagIDsFor = (id?: string) =>
    id
      ? new Set([
          id,
          ...scene.scene_marker_tag_ancestors
            .filter((tag) => tag.ancestor_ids.includes(id))
            .map((tag) => tag.tag_id),
        ])
      : undefined;
  const hasMarker = (id?: string) => {
    const targetIDs = tagIDsFor(id);
    return scene.scene_markers.some((marker) =>
      markerHasTag(marker, targetIDs)
    );
  };
  const sceneType = sceneStatsActivityType(
    hasMarker(roles.sexTagId),
    hasMarker(roles.oralTagId),
    hasMarker(roles.soloTagId)
  );
  const ratingClass = getRatingCardClass({
    rating: scene.rating100,
    tags: scene.tags,
    ratingScores: scene.rating_scores,
    thresholds: config.ratingCardThresholds,
    thresholdEntity: "scene",
    overrideTagIds: config.ratingCardOverrideTagIds,
    goatTagId: roles.goatTagId,
    sceneHasRoyalSapphireBonus: hasRoyalSapphireSceneMarker(
      scene.scene_markers,
      roles.goatTagId,
      scene.scene_marker_tag_ancestors
    ),
  });
  const tier = [
    ["rating-royal-sapphire", "royal_sapphire"],
    ["rating-5-stars", "gold"],
    ["rating-4-stars", "silver"],
    ["rating-3-stars", "bronze"],
  ].find(([className]) => ratingClass.includes(className))?.[1];
  const values = (key: "ethnicity" | "country") => [
    ...new Set(
      scene.performers
        .map((performer) => cleanPlaygroundValue(performer[key]))
        .filter((value): value is string => !!value)
    ),
  ];
  return {
    scene,
    mode: getSceneRatingModeCustom(
      scene.performers.length,
      sceneType === "solo"
    ),
    sceneType,
    ethnicities: values("ethnicity"),
    countries: values("country"),
    metallic:
      metallicRatingChartBucket(scene.rating100, tier)?.key ?? "unrated",
    facial:
      reallyHotFacialCount(scene, {
        facial: tagIDsFor(roles.facialTagId),
        reallyHot: tagIDsFor(roles.reallyHotTagId),
      }) > 0
        ? "rh"
        : hasMarker(roles.facialTagId)
        ? "regular"
        : "no",
    scores: Object.fromEntries(
      scene.rating_scores
        .filter((score) => score.section === "criterion")
        .map((score) => [score.key, score.raw_value])
    ),
    adjustments: new Set(
      scene.rating_scores
        .filter(
          (score) =>
            (score.section === "bonus" || score.section === "penalty") &&
            (score.raw_value !== 0 || score.weighted_value !== 0)
        )
        .map((score) => `${score.section}:${score.key}`)
    ),
  };
}

export function matchesPlaygroundFilters(
  entry: IPlaygroundEntry,
  filters: IPlaygroundFilters
) {
  const any = (selected: string[], values: string[]) =>
    !selected.length || selected.some((value) => values.includes(value));
  return (
    any(filters.sceneTypes, entry.sceneType ? [entry.sceneType] : []) &&
    any(
      filters.ethnicities,
      entry.ethnicities.length ? entry.ethnicities : ["unknown"]
    ) &&
    any(
      filters.countries,
      entry.countries.length ? entry.countries : ["unknown"]
    ) &&
    any(filters.counts, [String(entry.scene.performers.length)]) &&
    any(filters.metallic, [entry.metallic]) &&
    any(filters.facial, [
      entry.facial,
      ...(entry.facial !== "no" ? ["any"] : []),
    ]) &&
    filters.present.every((key) => entry.adjustments.has(key)) &&
    filters.absent.every((key) => !entry.adjustments.has(key))
  );
}

export function playgroundMetricValue(
  entry: IPlaygroundEntry,
  metric: IPlaygroundMetric
) {
  const value =
    metric.key === "rating100"
      ? entry.scene.rating100
      : entry.scores[metric.key];
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  )
    return undefined;
  // Overall ratings can exceed 100 through advisor bonuses. Never clip them.
  if (
    metric.key !== "rating100" &&
    !metric.choices?.some((choice) => choice.value === value)
  )
    return undefined;
  return value;
}

export interface IPlaygroundPoint {
  entry: IPlaygroundEntry;
  x: number;
  y: number;
}

export function getPlaygroundPoints(
  entries: IPlaygroundEntry[],
  xMetric: IPlaygroundMetric,
  yMetric: IPlaygroundMetric
): IPlaygroundPoint[] {
  return entries.flatMap((entry) => {
    const x = playgroundMetricValue(entry, xMetric);
    const y = playgroundMetricValue(entry, yMetric);
    return x === undefined || y === undefined ? [] : [{ entry, x, y }];
  });
}

export function playgroundAxisMaximum(
  points: IPlaygroundPoint[],
  axis: "x" | "y",
  metric: IPlaygroundMetric
) {
  return points.reduce(
    (maximum, point) => Math.max(maximum, point[axis]),
    metric.max
  );
}
