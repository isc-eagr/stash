import { gql, useQuery } from "@apollo/client";
import { useMemo } from "react";
import type * as GQL from "src/core/generated-graphql";

type CatalogSortMetricKindCustom = "group" | "performer" | "tag";
type CatalogSortMetricValueDataCustom = {
  id: string;
  value?: string | null;
};
type CatalogSortMetricQueryDataCustom = {
  groupSortMetricValues?: CatalogSortMetricValueDataCustom[];
  performerSortMetricValues?: CatalogSortMetricValueDataCustom[];
  tagSortMetricValues?: CatalogSortMetricValueDataCustom[];
};

const GroupSortMetricValuesCustom = gql`
  query GroupSortMetricValuesCustom(
    $ids: [ID!]!
    $find_filter: FindFilterType
    $parent_group_id: ID
  ) {
    groupSortMetricValues(
      group_ids: $ids
      find_filter: $find_filter
      parent_group_id: $parent_group_id
    ) {
      id
      value
    }
  }
`;

const PerformerSortMetricValuesCustom = gql`
  query PerformerSortMetricValuesCustom(
    $ids: [ID!]!
    $find_filter: FindFilterType
  ) {
    performerSortMetricValues(performer_ids: $ids, find_filter: $find_filter) {
      id
      value
    }
  }
`;

const TagSortMetricValuesCustom = gql`
  query TagSortMetricValuesCustom($ids: [ID!]!, $find_filter: FindFilterType) {
    tagSortMetricValues(tag_ids: $ids, find_filter: $find_filter) {
      id
      value
    }
  }
`;

const batchSorts: Record<CatalogSortMetricKindCustom, Set<string>> = {
  group: new Set(["sub_group_order"]),
  performer: new Set([
    "play_count",
    "last_played_at",
    "latest_scene",
    "scenes_duration",
    "scenes_size",
    "last_o_at",
    "average_scene_rating",
    "sex_topped_partners",
    "oral_topped_partners",
    "facial_topped_partners",
    "sex_bottomed_partners",
    "oral_bottomed_partners",
    "facial_bottomed_partners",
  ]),
  tag: new Set(["scenes_duration", "scenes_size"]),
};

export function useCatalogSortMetricValuesCustom(
  kind: CatalogSortMetricKindCustom,
  ids: string[],
  sortBy: string | undefined,
  sortDirection: GQL.SortDirectionEnum,
  parentGroupId?: string
) {
  const shouldLoad = !!sortBy && batchSorts[kind].has(sortBy);
  const query = {
    group: GroupSortMetricValuesCustom,
    performer: PerformerSortMetricValuesCustom,
    tag: TagSortMetricValuesCustom,
  }[kind];
  const { data, loading } = useQuery<CatalogSortMetricQueryDataCustom>(query, {
    skip: !shouldLoad || ids.length === 0,
    variables: {
      ids,
      find_filter: { sort: sortBy, direction: sortDirection },
      parent_group_id: parentGroupId,
    },
    fetchPolicy: "cache-first",
  });

  return useMemo(() => {
    if (!shouldLoad || loading) return new Map<string, string | null>();

    const values = {
      group: data?.groupSortMetricValues,
      performer: data?.performerSortMetricValues,
      tag: data?.tagSortMetricValues,
    }[kind];
    return new Map(values?.map((item) => [item.id, item.value]) ?? []);
  }, [data, kind, loading, shouldLoad]);
}
