import { ACTIVITY_LABELS_CUSTOM } from "src/utils/activityLabels_custom";
import React from "react";
import type { SceneActivityMetricRows } from "src/components/Scenes/sceneActivityMetricsData_custom";
import { SceneActivityMetrics } from "src/components/Scenes/SceneActivityMetrics_custom";
import type { StudioActivityStats } from "src/core/generated-graphql";
import { getPartitionPercentagesCustom } from "src/components/Shared/activityTypePercentages_custom";

// Performers only carry Sex/Oral/Solo time; quality fields are optional.
export type ActivityStatsChartsData = Pick<
  StudioActivityStats,
  | "sex_seconds"
  | "oral_seconds"
  | "solo_seconds"
  | "sex_percent"
  | "oral_percent"
  | "solo_percent"
> &
  Partial<Omit<StudioActivityStats, "__typename">>;

interface IProps {
  stats: ActivityStatsChartsData;
  className?: string;
  compact?: boolean;
  only?: "activity" | "quality";
  activeSortBy?: string;
  // Stats panel: a text legend under the bars instead of boxes.
  legend?: boolean;
}

export const ActivityStatsCharts: React.FC<IProps> = ({
  stats,
  className = "",
  compact = false,
  only,
  activeSortBy,
  legend,
}) => {
  const qualityPercentages = getPartitionPercentagesCustom(
    {
      outstanding: stats.outstanding_seconds ?? 0,
      standard: stats.standard_seconds ?? 0,
      unclassified: stats.other_seconds ?? 0,
      unusable: stats.unusable_seconds ?? 0,
    },
    ["outstanding", "standard", "unclassified", "unusable"]
  );
  const activityMetrics: SceneActivityMetricRows = {
    activity: [
      {
        key: "sex",
        label: ACTIVITY_LABELS_CUSTOM.sex,
        duration: stats.sex_seconds,
        percent: Math.round(stats.sex_percent),
      },
      {
        key: "oral",
        label: ACTIVITY_LABELS_CUSTOM.oral,
        duration: stats.oral_seconds,
        percent: Math.round(stats.oral_percent),
      },
      {
        key: "solo",
        label: ACTIVITY_LABELS_CUSTOM.solo,
        duration: stats.solo_seconds,
        percent: Math.round(stats.solo_percent),
      },
      {
        key: "other",
        label: "Other",
        duration: stats.activity_other_seconds ?? 0,
        percent: 0,
        showPercent: false,
      },
    ],
    quality: [
      {
        key: "outstanding",
        label: "Outstanding",
        duration: stats.outstanding_seconds ?? 0,
        percent: qualityPercentages.outstanding,
      },
      {
        key: "standard",
        label: "Standard",
        duration: stats.standard_seconds ?? 0,
        percent: qualityPercentages.standard,
      },
      {
        key: "unclassified",
        label: "Unclassified",
        duration: stats.other_seconds ?? 0,
        percent: qualityPercentages.unclassified,
      },
      {
        key: "unusable",
        label: "Unusable",
        duration: stats.unusable_seconds ?? 0,
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
        compact={compact}
        legend={legend}
        only={only}
        activeSortBy={activeSortBy}
        sceneId="aggregate-scene-stats"
      />
    </div>
  );
};
