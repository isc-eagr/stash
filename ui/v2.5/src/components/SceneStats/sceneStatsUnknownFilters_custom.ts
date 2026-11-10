import {
  cleanStatsValueCustom,
  statsCountCustom,
  STATS_UNKNOWN_VALUE_CUSTOM,
} from "src/utils/statsValues_custom";

export const STATS_UNKNOWN_FILTER_VALUE = STATS_UNKNOWN_VALUE_CUSTOM;

export type SceneStatsUnknownValues = {
  ethnicities?: ReadonlyArray<string | null | undefined>;
  countries?: ReadonlyArray<string | null | undefined>;
  oCount?: number | null;
  performerCount?: number | null;
  ratingBucket?: string | null;
  metallicRatingBucket?: string | null;
  releaseYear?: number | null;
  releaseMonth?: number | null;
  releaseDay?: number | null;
  facialCount?: number | null;
  sceneType?: string | null;
  resolution?: string | null;
};

function hasKnownDemographic(values?: SceneStatsUnknownValues["ethnicities"]) {
  return !!values?.some((value) => {
    return cleanStatsValueCustom(value) !== undefined;
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
    case "o_count":
      return statsCountCustom(values.oCount) === undefined;
    case "performer_count":
      return statsCountCustom(values.performerCount) === undefined;
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
      return statsCountCustom(values.facialCount) === undefined;
    case "scene_type":
      return !values.sceneType;
    case "resolution":
      return !values.resolution;
    // Facial status and duration always have a chart bucket, even for zero.
    default:
      return false;
  }
}
