import type * as GQL from "src/core/generated-graphql";
import {
  resolveSortMetricCustom,
  type SortMetricDefinitionCustom,
} from "../Shared/sortMetric_custom";

type GroupSortMetricSource = {
  activeSortValue?: string | null;
  group: GQL.ListGroupDataFragment & {
    created_at?: string;
    updated_at?: string;
  };
};

const definitions: Record<
  string,
  SortMetricDefinitionCustom<GroupSortMetricSource>
> = {
  random: { messageID: "random", format: "none", value: () => undefined },
  date: {
    messageID: "date",
    format: "date",
    value: ({ group }) => group.date,
  },
  duration: {
    messageID: "duration",
    format: "duration",
    value: ({ group }) => group.duration,
  },
  rating: {
    messageID: "rating",
    format: "rating",
    value: ({ group }) => group.rating100,
  },
  tag_count: {
    messageID: "tag_count",
    format: "count",
    value: ({ group }) => group.tags.length,
  },
  sub_group_order: {
    messageID: "sub_group_order",
    format: "count",
    value: ({ activeSortValue }) => activeSortValue,
  },
  scenes_count: {
    messageID: "scene_count",
    format: "count",
    value: ({ group }) => group.scene_count,
  },
  o_counter: {
    messageID: "o_count",
    format: "count",
    value: ({ group }) => group.o_counter,
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: ({ group }) => group.created_at,
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: ({ group }) => group.updated_at,
  },
};

export function getGroupSortMetricCustom(
  sortBy: string | undefined,
  group: GroupSortMetricSource["group"],
  activeSortValue?: string | null
) {
  return resolveSortMetricCustom(sortBy, "name", definitions, {
    activeSortValue,
    group,
  });
}
