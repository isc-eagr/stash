import React from "react";
import { SortMetricBadgeCustom } from "src/components/Shared/SortMetricBadge_custom";
import * as GQL from "src/core/generated-graphql";
import { getStudioSortMetricCustom } from "./studioSortMetric_custom";

interface IProps {
  sortBy?: string;
  sortDirection: GQL.SortDirectionEnum;
  stats?: GQL.StudioListStatsDataFragment;
  studio: GQL.StudioListDataFragment;
}

export const StudioSortMetricStrip: React.FC<IProps> = ({
  sortBy,
  sortDirection,
  stats,
  studio,
}) => {
  const metric = getStudioSortMetricCustom(sortBy, { stats, studio });
  return (
    <SortMetricBadgeCustom metric={metric} sortDirection={sortDirection} />
  );
};
