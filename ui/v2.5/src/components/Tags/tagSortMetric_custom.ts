import type * as GQL from "src/core/generated-graphql";
import {
  resolveSortMetricCustom,
  type SortMetricDefinitionCustom,
} from "../Shared/sortMetric_custom";

type TagSortMetricData = GQL.TagDataFragment | GQL.TagListDataFragment;
type TagSortMetricSource = {
  activeSortValue?: string | null;
  tag: TagSortMetricData & {
    created_at?: string;
    updated_at?: string;
  };
};

const definitions: Record<
  string,
  SortMetricDefinitionCustom<TagSortMetricSource>
> = {
  random: { messageID: "random", format: "none", value: () => undefined },
  scenes_duration: {
    messageID: "scenes_duration",
    format: "duration",
    value: ({ activeSortValue }) => activeSortValue,
  },
  scenes_size: {
    messageID: "scenes_size",
    format: "bytes",
    value: ({ activeSortValue }) => activeSortValue,
  },
  galleries_count: {
    messageID: "gallery_count",
    format: "count",
    value: ({ tag }) => tag.gallery_count,
  },
  images_count: {
    messageID: "image_count",
    format: "count",
    value: ({ tag }) => tag.image_count,
  },
  performers_count: {
    messageID: "performer_count",
    format: "count",
    value: ({ tag }) => tag.performer_count,
  },
  scenes_count: {
    messageID: "scene_count",
    format: "count",
    value: ({ tag }) => tag.scene_count,
  },
  groups_count: {
    messageID: "group_count",
    format: "count",
    value: ({ tag }) => tag.group_count,
  },
  scene_markers_count: {
    messageID: "marker_count",
    format: "count",
    value: ({ tag }) => tag.scene_marker_count,
  },
  studios_count: {
    messageID: "studio_count",
    format: "count",
    value: ({ tag }) => tag.studio_count,
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: ({ tag }) => tag.created_at,
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: ({ tag }) => tag.updated_at,
  },
};

export function getTagSortMetricCustom(
  sortBy: string | undefined,
  tag: TagSortMetricSource["tag"],
  activeSortValue?: string | null
) {
  return resolveSortMetricCustom(sortBy, "name", definitions, {
    activeSortValue,
    tag,
  });
}
