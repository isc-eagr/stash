import type { ISortMetricBadgeCustom } from "src/components/Shared/SortMetricBadge_custom";

export type IStudioSortMetricDefinition = Pick<
  ISortMetricBadgeCustom,
  "messageID" | "format"
>;

interface IStudioSortMetricSource {
  studio: {
    child_studios: readonly unknown[];
    rating100?: number | null;
    tags: readonly unknown[];
  };
  stats?: {
    active_sort_value?: string | null;
    gallery_count: number;
    image_count: number;
    o_counter: number;
    scene_count: number;
    unique_performer_count: number;
    studio_activity_stats: {
      oral_percent: number;
      other_percent: number;
      outstanding_percent: number;
      sex_percent: number;
      solo_percent: number;
      standard_percent: number;
      unusable_percent: number;
    };
    studio_role_counts: {
      facial_scene_count: number;
      oral_scene_count: number;
      sex_scene_count: number;
      solo_scene_count: number;
    };
  };
}

export interface IStudioSortMetric extends IStudioSortMetricDefinition {
  sortBy: string;
  value?: number | string | null;
}

const activeBackendValue = (source: IStudioSortMetricSource) =>
  source.stats?.active_sort_value;

const definitions: Record<
  string,
  IStudioSortMetricDefinition & {
    value: (
      source: IStudioSortMetricSource
    ) => number | string | null | undefined;
  }
> = {
  tag_count: {
    messageID: "tag_count",
    format: "count",
    value: ({ studio }) => studio.tags.length,
  },
  random: { messageID: "random", format: "none", value: () => undefined },
  rating: {
    messageID: "rating",
    format: "rating",
    value: ({ studio }) => studio.rating100,
  },
  scenes_duration: {
    messageID: "scenes_duration",
    format: "duration",
    value: activeBackendValue,
  },
  scenes_size: {
    messageID: "scenes_size",
    format: "bytes",
    value: activeBackendValue,
  },
  latest_scene: {
    messageID: "latest_scene",
    format: "date",
    value: activeBackendValue,
  },
  galleries_count: {
    messageID: "gallery_count",
    format: "count",
    value: ({ stats }) => stats?.gallery_count,
  },
  images_count: {
    messageID: "image_count",
    format: "count",
    value: ({ stats }) => stats?.image_count,
  },
  scenes_count: {
    messageID: "scene_count",
    format: "count",
    value: ({ stats }) => stats?.scene_count,
  },
  child_count: {
    messageID: "subsidiary_studio_count",
    format: "count",
    value: ({ studio }) => studio.child_studios.length,
  },
  sex_scenes_count: {
    messageID: "sex_scene_count",
    format: "count",
    value: ({ stats }) => stats?.studio_role_counts.sex_scene_count,
  },
  oral_scenes_count: {
    messageID: "oral_scene_count",
    format: "count",
    value: ({ stats }) => stats?.studio_role_counts.oral_scene_count,
  },
  solo_scenes_count: {
    messageID: "solo_scene_count",
    format: "count",
    value: ({ stats }) => stats?.studio_role_counts.solo_scene_count,
  },
  facial_scenes_count: {
    messageID: "facial_scene_count",
    format: "count",
    value: ({ stats }) => stats?.studio_role_counts.facial_scene_count,
  },
  standard_facial_count: {
    messageID: "standard_facial_count",
    format: "count",
    value: activeBackendValue,
  },
  really_hot_facial_count: {
    messageID: "really_hot_facial_count",
    format: "count",
    value: activeBackendValue,
  },
  royal_sapphire_scenes_count: {
    messageID: "royal_sapphire_scene_count",
    format: "count",
    value: activeBackendValue,
  },
  gold_scenes_count: {
    messageID: "gold_scene_count",
    format: "count",
    value: activeBackendValue,
  },
  silver_scenes_count: {
    messageID: "silver_scene_count",
    format: "count",
    value: activeBackendValue,
  },
  bronze_scenes_count: {
    messageID: "bronze_scene_count",
    format: "count",
    value: activeBackendValue,
  },
  unique_performers_count: {
    messageID: "unique_performer_count",
    format: "count",
    value: ({ stats }) => stats?.unique_performer_count,
  },
  o_count: {
    messageID: "o_count",
    format: "count",
    value: activeBackendValue,
  },
  sex_activity_percent: {
    messageID: "sex_activity_percent",
    format: "percent",
    value: ({ stats }) => stats?.studio_activity_stats.sex_percent,
  },
  oral_activity_percent: {
    messageID: "oral_activity_percent",
    format: "percent",
    value: ({ stats }) => stats?.studio_activity_stats.oral_percent,
  },
  solo_activity_percent: {
    messageID: "solo_activity_percent",
    format: "percent",
    value: ({ stats }) => stats?.studio_activity_stats.solo_percent,
  },
  other_activity_percent: {
    messageID: "other_activity_percent",
    format: "percent",
    value: ({ stats }) => stats?.studio_activity_stats.other_percent,
  },
  outstanding_activity_percent: {
    messageID: "outstanding_activity_percent",
    format: "percent",
    value: ({ stats }) => stats?.studio_activity_stats.outstanding_percent,
  },
  standard_activity_percent: {
    messageID: "standard_activity_percent",
    format: "percent",
    value: ({ stats }) => stats?.studio_activity_stats.standard_percent,
  },
  unusable_activity_percent: {
    messageID: "unusable_activity_percent",
    format: "percent",
    value: ({ stats }) => stats?.studio_activity_stats.unusable_percent,
  },
  rating_criteria_solo_performer_appeal: {
    messageID: "rating_criteria_solo_performer_appeal",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_solo_performance: {
    messageID: "rating_criteria_solo_performance",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_solo_usability: {
    messageID: "rating_criteria_solo_usability",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_top_attractiveness: {
    messageID: "rating_criteria_top_attractiveness",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_bottom_attractiveness: {
    messageID: "rating_criteria_bottom_attractiveness",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_chemistry: {
    messageID: "rating_criteria_chemistry",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_payoff: {
    messageID: "rating_criteria_payoff",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_standout: {
    messageID: "rating_criteria_standout",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_group_top_attractiveness: {
    messageID: "rating_criteria_group_top_attractiveness",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_group_energy: {
    messageID: "rating_criteria_group_energy",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_group_payoff: {
    messageID: "rating_criteria_group_payoff",
    format: "decimal",
    value: activeBackendValue,
  },
  rating_criteria_group_usability: {
    messageID: "rating_criteria_group_usability",
    format: "decimal",
    value: activeBackendValue,
  },
  average_solo_scene_rating: {
    messageID: "average_solo_scene_rating",
    format: "rating",
    value: activeBackendValue,
  },
  average_standard_scene_rating: {
    messageID: "average_standard_scene_rating",
    format: "rating",
    value: activeBackendValue,
  },
  average_group_scene_rating: {
    messageID: "average_group_scene_rating",
    format: "rating",
    value: activeBackendValue,
  },
  average_performer_rating: {
    messageID: "average_performer_rating",
    format: "rating",
    value: activeBackendValue,
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: activeBackendValue,
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: activeBackendValue,
  },
};

export function getStudioSortMetricCustom(
  sortBy: string | undefined,
  source: IStudioSortMetricSource
): IStudioSortMetric | undefined {
  if (
    !sortBy ||
    sortBy === "name" ||
    sortBy === "random" ||
    sortBy.startsWith("random_")
  ) {
    return undefined;
  }

  const normalizedSort = sortBy;
  const definition = definitions[normalizedSort];
  if (!definition) return undefined;

  return {
    sortBy: normalizedSort,
    messageID: definition.messageID,
    format: definition.format,
    value: definition.value(source),
  };
}
