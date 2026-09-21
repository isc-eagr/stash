import React from "react";
import * as GQL from "src/core/generated-graphql";
import { ACTIVITY_PIE_COLORS } from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import { SceneStatsActivityMatrix } from "src/components/SceneStats/SceneStatsActivityMatrix_custom"; // CUSTOM
import { PerformerSceneRatingAdvisorStats } from "../PerformerSceneRatingAdvisor_custom"; // CUSTOM
import { PerformerStatsBarChart } from "./PerformerStatsBarChart_custom"; // CUSTOM
import type { IPerformerStatsBarRow } from "./PerformerStatsBarChart_custom"; // CUSTOM
import { getActivityTypePercentagesCustom } from "src/components/Shared/activityTypePercentages_custom"; // CUSTOM

interface IProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

type ActivityCategory = "sex" | "oral" | "solo";

const activityLabels: Record<ActivityCategory, string> = {
  sex: "Sex",
  oral: "Oral",
  solo: "Solo",
};

export const PerformerStatsPanel: React.FC<IProps> = ({
  active,
  performer,
}) => {
  const soloMarkerColor = ACTIVITY_PIE_COLORS.solo;
  const stats = performer.activity_stats;
  const activityPercentages = getActivityTypePercentagesCustom({
    sex: stats.sex_seconds,
    oral: stats.oral_seconds,
    solo: stats.solo_seconds,
  });
  const activityRows: IPerformerStatsBarRow[] = [
    {
      key: "sex",
      label: activityLabels.sex,
      seconds: stats.sex_seconds,
      percent: activityPercentages.sex,
      color: ACTIVITY_PIE_COLORS.sex,
    },
    {
      key: "oral",
      label: activityLabels.oral,
      seconds: stats.oral_seconds,
      percent: activityPercentages.oral,
      color: ACTIVITY_PIE_COLORS.oral,
    },
    {
      key: "solo",
      label: activityLabels.solo,
      seconds: stats.solo_seconds,
      percent: activityPercentages.solo,
      color: soloMarkerColor,
    },
  ];
  const roleCharts = (["sex", "oral"] as ActivityCategory[]).map((activity) => {
    const totalSeconds =
      activity === "sex" ? stats.sex_seconds : stats.oral_seconds;
    const rows: IPerformerStatsBarRow[] =
      activity === "sex"
        ? [
            {
              key: "sex-top",
              label: "Top",
              seconds: stats.sex_top_seconds,
              percent: stats.sex_top_percent,
              color: ACTIVITY_PIE_COLORS.top,
            },
            {
              key: "sex-bottom",
              label: "Bottom",
              seconds: stats.sex_bottom_seconds,
              percent: stats.sex_bottom_percent,
              color: ACTIVITY_PIE_COLORS.bottom,
            },
          ]
        : [
            {
              key: "oral-top",
              label: "Top",
              seconds: stats.oral_top_seconds,
              percent: stats.oral_top_percent,
              color: ACTIVITY_PIE_COLORS.top,
            },
            {
              key: "oral-bottom",
              label: "Bottom",
              seconds: stats.oral_bottom_seconds,
              percent: stats.oral_bottom_percent,
              color: ACTIVITY_PIE_COLORS.bottom,
            },
          ];

    return {
      activity,
      rows,
      totalSeconds,
    };
  });

  return (
    <div className="performer-stats-panel mt-3">
      <div className="custom-stats-overview">
        <PerformerStatsBarChart
          rows={activityRows}
          totalSeconds={stats.total_activity_seconds}
          title="Activities"
        />
        {roleCharts.map((chart) => (
          <PerformerStatsBarChart
            key={chart.activity}
            rows={chart.rows}
            totalSeconds={chart.totalSeconds}
            title={`${activityLabels[chart.activity]} Roles`}
          />
        ))}
      </div>
      {/* CUSTOM */}
      <PerformerSceneRatingAdvisorStats
        active={active}
        performerId={performer.id}
      />
      {/* CUSTOM */}
      <SceneStatsActivityMatrix
        active={active}
        performerId={performer.id}
        performerName={performer.name}
      />
    </div>
  );
};
