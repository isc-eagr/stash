import {
  metallicRatingChartBucket,
  type MetallicRatingChartKey,
} from "src/utils/metallicRatingChart_custom";
import { sceneMetallicRating } from "src/utils/sceneMetallicRating_custom";
import { sceneStatsRatingBucket } from "src/components/SceneStats/sceneStatsChartBuckets_custom";
import type { IUIConfig } from "src/core/config";

export const O_STATS_UNKNOWN_BUCKET = "unknown";

export type OStatsSceneCount = {
  scene_id: string;
  title?: string | null;
  screenshot_path?: string;
  rating100?: number | null;
  tag_ids: string[];
  has_royal_sapphire_bonus: boolean;
  count: number;
};

export type OStatsBucketCount = {
  key: string;
  label: string;
  sortValue: number;
  count: number;
};

export function oStatsRatingBucket(scene: OStatsSceneCount) {
  return sceneStatsRatingBucket(scene.rating100) ?? O_STATS_UNKNOWN_BUCKET;
}

export function oStatsTierBucket(
  scene: OStatsSceneCount,
  uiConfig: IUIConfig | undefined
): MetallicRatingChartKey | typeof O_STATS_UNKNOWN_BUCKET {
  const tier = metallicRatingChartBucket(
    scene.rating100,
    sceneMetallicRating(
      {
        rating100: scene.rating100,
        tags: scene.tag_ids,
        has_royal_sapphire_bonus: scene.has_royal_sapphire_bonus,
      },
      uiConfig
    )
  );
  return tier?.key ?? O_STATS_UNKNOWN_BUCKET;
}

// Sum O events per bucket. Known buckets come back in natural order; the
// Unknown bucket is returned separately for the chart badge.
export function oStatsBucketCounts(
  scenes: readonly OStatsSceneCount[],
  bucketOf: (scene: OStatsSceneCount) => string,
  describe: (key: string) => { label: string; sortValue: number }
) {
  const counts = new Map<string, number>();
  scenes.forEach((scene) => {
    const key = bucketOf(scene);
    counts.set(key, (counts.get(key) ?? 0) + scene.count);
  });

  const data: OStatsBucketCount[] = [];
  counts.forEach((count, key) => {
    if (key === O_STATS_UNKNOWN_BUCKET) return;
    data.push({ key, count, ...describe(key) });
  });
  data.sort((a, b) => a.sortValue - b.sortValue);
  return { data, unknownCount: counts.get(O_STATS_UNKNOWN_BUCKET) ?? 0 };
}

export function oStatsSceneIDsInBucket(
  scenes: readonly OStatsSceneCount[],
  bucketOf: (scene: OStatsSceneCount) => string,
  bucket: string
) {
  return scenes
    .filter((scene) => bucketOf(scene) === bucket)
    .map((scene) => scene.scene_id);
}
