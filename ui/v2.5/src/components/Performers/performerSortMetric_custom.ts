import type * as GQL from "src/core/generated-graphql";
import {
  resolveSortMetricCustom,
  type SortMetricDefinitionCustom,
} from "../Shared/sortMetric_custom";
import type { IPerformerRoleStats } from "./PerformerCard";
import type { PerformerListData } from "./performerTypes_custom";

type PerformerSortMetricSource = {
  activeSortValue?: string | null;
  performer: PerformerListData & {
    created_at?: string;
    updated_at?: string;
  };
  roleStats?: IPerformerRoleStats | null;
};

const backendOr = (
  source: PerformerSortMetricSource,
  fallback: boolean | number | string | null | undefined
) => source.activeSortValue ?? fallback;

const activityValue = (
  source: PerformerSortMetricSource,
  field: keyof GQL.PerformerActivityStats
) => backendOr(source, source.performer.activity_stats[field]);

const roleValue = (
  source: PerformerSortMetricSource,
  field: keyof IPerformerRoleStats
) => backendOr(source, source.roleStats?.[field]);

const definitions: Record<
  string,
  SortMetricDefinitionCustom<PerformerSortMetricSource>
> = {
  height: {
    messageID: "height",
    format: "decimal",
    value: (source) => backendOr(source, source.performer.height_cm),
  },
  birthdate: {
    messageID: "birthdate",
    format: "date",
    value: (source) => backendOr(source, source.performer.birthdate),
  },
  tag_count: {
    messageID: "tag_count",
    format: "count",
    value: (source) => backendOr(source, source.performer.tags.length),
  },
  random: { messageID: "random", format: "none", value: () => undefined },
  rating: {
    messageID: "rating",
    format: "rating",
    value: (source) => backendOr(source, source.performer.rating100),
  },
  penis_length: {
    messageID: "penis_length",
    format: "decimal",
    value: (source) => backendOr(source, source.performer.penis_length),
  },
  play_count: {
    messageID: "play_count",
    format: "count",
    value: (source) => source.activeSortValue,
  },
  last_played_at: {
    messageID: "last_played_at",
    format: "datetime",
    value: (source) => source.activeSortValue,
  },
  latest_scene: {
    messageID: "latest_scene",
    format: "date",
    value: (source) => source.activeSortValue,
  },
  career_start: {
    messageID: "career_start",
    format: "date",
    value: (source) => backendOr(source, source.performer.career_start),
  },
  career_end: {
    messageID: "career_end",
    format: "date",
    value: (source) => backendOr(source, source.performer.career_end),
  },
  weight: {
    messageID: "weight",
    format: "decimal",
    value: (source) => backendOr(source, source.performer.weight),
  },
  scenes_duration: {
    messageID: "scenes_duration",
    format: "duration",
    value: (source) => source.activeSortValue,
  },
  scenes_size: {
    messageID: "scenes_size",
    format: "bytes",
    value: (source) => source.activeSortValue,
  },
  scenes_count: {
    messageID: "scene_count",
    format: "count",
    value: (source) => backendOr(source, source.performer.scene_count),
  },
  images_count: {
    messageID: "image_count",
    format: "count",
    value: (source) => backendOr(source, source.performer.image_count),
  },
  galleries_count: {
    messageID: "gallery_count",
    format: "count",
    value: (source) => backendOr(source, source.performer.gallery_count),
  },
  o_counter: {
    messageID: "o_count",
    format: "count",
    value: (source) => backendOr(source, source.performer.o_counter),
  },
  last_o_at: {
    messageID: "last_o_at",
    format: "datetime",
    value: (source) => source.activeSortValue,
  },
  sex_scenes_count: {
    messageID: "sex_scene_count",
    format: "count",
    value: (source) => roleValue(source, "sex_scene_count"),
  },
  oral_scenes_count: {
    messageID: "oral_scene_count",
    format: "count",
    value: (source) => roleValue(source, "oral_scene_count"),
  },
  facial_scenes_count: {
    messageID: "facial_scene_count",
    format: "count",
    value: (source) => roleValue(source, "facial_scene_count"),
  },
  solo_scenes_count: {
    messageID: "solo_scene_count",
    format: "count",
    value: (source) => roleValue(source, "solo_scene_count"),
  },
  sex_activity_percent: {
    messageID: "sex_activity_percent",
    format: "percent",
    value: (source) => activityValue(source, "sex_percent"),
  },
  oral_activity_percent: {
    messageID: "oral_activity_percent",
    format: "percent",
    value: (source) => activityValue(source, "oral_percent"),
  },
  solo_activity_percent: {
    messageID: "solo_activity_percent",
    format: "percent",
    value: (source) => activityValue(source, "solo_percent"),
  },
  sex_top_activity_percent: {
    messageID: "sex_top_activity_percent",
    format: "percent",
    value: (source) => activityValue(source, "sex_top_percent"),
  },
  sex_bottom_activity_percent: {
    messageID: "sex_bottom_activity_percent",
    format: "percent",
    value: (source) => activityValue(source, "sex_bottom_percent"),
  },
  oral_top_activity_percent: {
    messageID: "oral_top_activity_percent",
    format: "percent",
    value: (source) => activityValue(source, "oral_top_percent"),
  },
  oral_bottom_activity_percent: {
    messageID: "oral_bottom_activity_percent",
    format: "percent",
    value: (source) => activityValue(source, "oral_bottom_percent"),
  },
  orgasm_count: {
    messageID: "orgasm_count",
    format: "count",
    value: (source) => roleValue(source, "orgasm_top_count"),
  },
  feet_markers_count: {
    messageID: "feet_markers_count",
    format: "count",
    value: (source) => roleValue(source, "feet_top_count"),
  },
  facial_given_count: {
    messageID: "facial_given_count",
    format: "count",
    value: (source) => roleValue(source, "facial_marker_with_top_count"),
  },
  facial_received_count: {
    messageID: "facial_received_count",
    format: "count",
    value: (source) => roleValue(source, "facial_marker_with_bottom_count"),
  },
  sex_unique_partners: {
    messageID: "sex_unique_partners",
    format: "count",
    value: (source) => roleValue(source, "sex_unique_partner_count"),
  },
  oral_unique_partners: {
    messageID: "oral_unique_partners",
    format: "count",
    value: (source) => roleValue(source, "oral_unique_partner_count"),
  },
  facial_unique_partners: {
    messageID: "facial_unique_partners",
    format: "count",
    value: (source) => roleValue(source, "facial_unique_partner_count"),
  },
  sex_topped_partners: {
    messageID: "sex_topped_partners",
    format: "count",
    value: (source) => source.activeSortValue,
  },
  oral_topped_partners: {
    messageID: "oral_topped_partners",
    format: "count",
    value: (source) => source.activeSortValue,
  },
  facial_topped_partners: {
    messageID: "facial_topped_partners",
    format: "count",
    value: (source) => source.activeSortValue,
  },
  sex_bottomed_partners: {
    messageID: "sex_bottomed_partners",
    format: "count",
    value: (source) => source.activeSortValue,
  },
  oral_bottomed_partners: {
    messageID: "oral_bottomed_partners",
    format: "count",
    value: (source) => source.activeSortValue,
  },
  facial_bottomed_partners: {
    messageID: "facial_bottomed_partners",
    format: "count",
    value: (source) => source.activeSortValue,
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: (source) => backendOr(source, source.performer.created_at),
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: (source) => backendOr(source, source.performer.updated_at),
  },
};

export function getPerformerSortMetricCustom(
  sortBy: string | undefined,
  performer: PerformerSortMetricSource["performer"],
  roleStats?: IPerformerRoleStats | null,
  activeSortValue?: string | null
) {
  return resolveSortMetricCustom(sortBy, "name", definitions, {
    activeSortValue,
    performer,
    roleStats,
  });
}
