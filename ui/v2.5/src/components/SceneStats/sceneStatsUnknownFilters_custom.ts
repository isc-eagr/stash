import { sceneStatsPositiveCount } from "./sceneStatsChartBuckets_custom";

export const STATS_UNKNOWN_FILTER_VALUE = "__unknown__";

export type SceneStatsUnknownValues = {
  ethnicities?: ReadonlyArray<string | null | undefined>;
  countries?: ReadonlyArray<string | null | undefined>;
  performerCount?: number | null;
  ratingBucket?: string | null;
  metallicRatingBucket?: string | null;
  releaseYear?: number | null;
  releaseMonth?: number | null;
  releaseDay?: number | null;
  facialCount?: number | null;
  reallyHotFacialCount?: number | null;
  sceneType?: string | null;
  resolution?: string | null;
};

function hasKnownDemographic(values?: SceneStatsUnknownValues["ethnicities"]) {
  return !!values?.some((value) => {
    const cleaned = value?.trim();
    return !!cleaned && cleaned.toLowerCase() !== "<nil>";
  });
}

// Match the chart's unknown population using the same already-derived buckets.
// The caller applies the selected year/month scope before testing release dates.
export function isSceneStatsUnknownValue(
  category: string,
  values: SceneStatsUnknownValues,
  releaseLevel: "year" | "month" | "day" = "year"
): boolean {
  switch (category) {
    case "ethnicity":
      return !hasKnownDemographic(values.ethnicities);
    case "country":
      return !hasKnownDemographic(values.countries);
    case "performer_count":
      return sceneStatsPositiveCount(values.performerCount) === undefined;
    case "rating":
      return !values.ratingBucket;
    case "metallic_rating":
      return !values.metallicRatingBucket;
    case "release_day": {
      const releaseValues = {
        year: values.releaseYear,
        month: values.releaseMonth,
        day: values.releaseDay,
      };
      return (
        releaseValues[releaseLevel] === undefined ||
        releaseValues[releaseLevel] === null
      );
    }
    case "facial_count":
      return sceneStatsPositiveCount(values.facialCount) === undefined;
    case "really_hot_facial_count":
      return sceneStatsPositiveCount(values.reallyHotFacialCount) === undefined;
    case "scene_type":
      return !values.sceneType;
    case "resolution":
      return !values.resolution;
    // Facial status and duration always have a chart bucket, even for zero.
    default:
      return false;
  }
}
