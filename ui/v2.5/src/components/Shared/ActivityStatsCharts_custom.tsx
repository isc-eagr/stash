import React from "react";
import type { SceneActivityMetricRows } from "src/components/Scenes/sceneActivityMetricsData_custom";
import { SceneActivityMetrics } from "src/components/Scenes/SceneActivityMetrics_custom";
import type { StudioActivityStats } from "src/core/generated-graphql";
import {
  getActivityTypePercentagesCustom,
  getPartitionPercentagesCustom,
} from "src/components/Shared/activityTypePercentages_custom";

interface IProps {
  stats: StudioActivityStats;
  className?: string;
}

export const ActivityStatsCharts: React.FC<IProps> = ({
  stats,
  className = "",
}) => {
  const activityPercentages = getActivityTypePercentagesCustom({
    sex: stats.sex_seconds,
    oral: stats.oral_seconds,
    solo: stats.solo_seconds,
  });
  const qualityPercentages = getPartitionPercentagesCustom(
    {
      outstanding: stats.outstanding_seconds,
      standard: stats.standard_seconds,
      unclassified: stats.other_seconds,
      unusable: stats.unusable_seconds,
    },
    ["outstanding", "standard", "unclassified", "unusable"]
  );
  const activityMetrics: SceneActivityMetricRows = {
    activity: [
      {
        key: "sex",
        label: "Fucking",
        duration: stats.sex_seconds,
        percent: activityPercentages.sex,
      },
      {
        key: "oral",
        label: "Eating pito",
        duration: stats.oral_seconds,
        percent: activityPercentages.oral,
      },
      {
        key: "solo",
        label: "Jerking",
        duration: stats.solo_seconds,
        percent: activityPercentages.solo,
      },
      {
        key: "other",
        label: "Other",
        duration: stats.activity_other_seconds,
        percent: 0,
        showPercent: false,
      },
    ],
    quality: [
      {
        key: "outstanding",
        label: "Outstanding",
        duration: stats.outstanding_seconds,
        percent: qualityPercentages.outstanding,
      },
      {
        key: "standard",
        label: "Standard",
        duration: stats.standard_seconds,
        percent: qualityPercentages.standard,
      },
      {
        key: "unclassified",
        label: "Unclassified",
        duration: stats.other_seconds,
        percent: qualityPercentages.unclassified,
      },
      {
        key: "unusable",
        label: "Unusable",
        duration: stats.unusable_seconds,
        percent: qualityPercentages.unusable,
      },
    ],
  };

  return (
    <div
      className={
        "custom-stats-overview custom-stats-overview--scene-activity " +
        className
      }
    >
      <SceneActivityMetrics
        activityMetrics={activityMetrics}
        className="scene-activity-metrics--stats"
        sceneId="aggregate-scene-stats"
        showDistributionBars
      />
    </div>
  );
};
