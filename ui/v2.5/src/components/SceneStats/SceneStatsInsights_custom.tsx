import { StatsBarChart } from "src/components/StatsBarChart_custom";
import { ACTIVITY_PIE_COLORS } from "src/components/Shared/activityColors_custom";
import { SCENE_ACTIVITY_LABELS_CUSTOM } from "src/components/Scenes/sceneActivityMetricsData_custom";
import React from "react";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import {
  StatsChartGroup,
  StatsSplitBar,
} from "src/components/StatsCharts_custom";
import { RatingAdvisorCriteriaMeters } from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import { useSceneStatsInsightsQuery } from "src/core/generated-graphql";
import type {
  StatsDateRangeInput,
  StatsCohortInput,
} from "src/core/generated-graphql";
import TextUtils from "src/utils/text";

interface IProps {
  studioId?: string;
  depth?: number;
  studioName?: string;
  dateRange?: StatsDateRangeInput | null;
  cohort?: StatsCohortInput;
}

const TIME_UNIT: [string, string] = ["second", "seconds"];

function formatTime(seconds: number) {
  return TextUtils.formatDurationRange(seconds);
}

// CUSTOM: Activity & Ratings sit in their own panel at the end of Scene Stats:
// overlapping activity bars and partitioned quality, then the rating criteria meters.
export const SceneStatsInsights: React.FC<IProps> = ({
  studioId,
  depth,
  studioName,
  dateRange,
  cohort,
}) => {
  const { data, error, loading } = useSceneStatsInsightsQuery({
    variables: { studioId, depth, dateRange, cohort },
  });

  const scopeLabel = cohort
    ? "the matching scenes"
    : studioName
    ? `${studioName} scenes`
    : "every scene";

  if (loading) {
    return <LoadingIndicator message="Loading activity and ratings…" />;
  }
  if (error) {
    return <ErrorMessage error={error.message} />;
  }
  if (!data) return null;

  const activity = data.sceneStatsActivity;
  const activityTime = Math.max(
    0,
    activity.total_seconds - activity.activity_other_seconds
  );

  return (
    <StatsChartGroup
      className="stats-group--panel"
      title="Activity & Ratings"
      description={`Marker time and advisor averages for ${scopeLabel}.`}
    >
      <StatsBarChart
        variant="ranked"
        total={activityTime}
        maxValue={activityTime}
        title="Activity Type"
        unit={TIME_UNIT}
        formatValue={formatTime}
        totalNote="Activity time is the union of the marked ranges. Types can overlap."
        data={[
          {
            key: "sex",
            label: SCENE_ACTIVITY_LABELS_CUSTOM.sex,
            count: activity.sex_seconds,
            color: ACTIVITY_PIE_COLORS.sex,
          },
          {
            key: "oral",
            label: SCENE_ACTIVITY_LABELS_CUSTOM.oral,
            count: activity.oral_seconds,
            color: ACTIVITY_PIE_COLORS.oral,
          },
          {
            key: "solo",
            label: SCENE_ACTIVITY_LABELS_CUSTOM.solo,
            count: activity.solo_seconds,
            color: ACTIVITY_PIE_COLORS.solo,
          },
        ]}
      />
      <StatsSplitBar
        title="Quality"
        unit={TIME_UNIT}
        formatValue={formatTime}
        data={[
          {
            key: "outstanding",
            label: "Outstanding",
            count: activity.outstanding_seconds,
            color: ACTIVITY_PIE_COLORS.outstanding,
          },
          {
            key: "standard",
            label: "Standard",
            count: activity.standard_seconds,
            color: ACTIVITY_PIE_COLORS.standard,
          },
          {
            key: "unclassified",
            label: "Unclassified",
            count: activity.other_seconds,
            color: ACTIVITY_PIE_COLORS.other,
          },
          {
            key: "unusable",
            label: "Unusable",
            count: activity.unusable_seconds,
            color: ACTIVITY_PIE_COLORS.unusable,
          },
        ]}
      />
      <div className="stats-wide">
        <RatingAdvisorCriteriaMeters
          description="Averages only count scenes rated on each criterion."
          sectionKeys={[
            "solo_scenes",
            "sex_scenes",
            "threesome_scenes",
            "group_scenes",
          ]}
          stats={data.globalRatingAdvisorStats}
          title={
            studioName ? `${studioName} Rating Criteria` : "Rating Criteria"
          }
        />
      </div>
    </StatsChartGroup>
  );
};
