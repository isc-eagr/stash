import React from "react";
import * as GQL from "src/core/generated-graphql";
import { useRoleTags } from "src/hooks/useRoleTags";
import TextUtils from "src/utils/text";
import {
  ACTIVITY_PIE_COLORS,
  ActivityPieChart,
  getSceneMarkerTagColorCustom,
} from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import type { IActivityPieSlice } from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import { SceneStatsActivityMatrix } from "src/components/SceneStats/SceneStatsActivityMatrix_custom"; // CUSTOM
import { PerformerSceneRatingAdvisorStats } from "../PerformerSceneRatingAdvisor_custom"; // CUSTOM

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

interface IStatsChartFooterRow {
  key: string;
  label: string;
  seconds: number;
  percent: number;
  color: string;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatStatValue(seconds: number, percent: number) {
  return `${TextUtils.secondsToTimestamp(seconds)} (${formatPercent(percent)})`;
}

function getActivityPieSlices(
  stats: GQL.PerformerActivityStats,
  soloColor: string
) {
  return [
    {
      key: "sex",
      label: activityLabels.sex,
      value: stats.sex_seconds,
      color: ACTIVITY_PIE_COLORS.sex,
      percentLabel: formatPercent(stats.sex_percent),
      sliceLabel: TextUtils.secondsToTimestamp(stats.sex_seconds),
      valueLabel: formatStatValue(stats.sex_seconds, stats.sex_percent),
    },
    {
      key: "oral",
      label: activityLabels.oral,
      value: stats.oral_seconds,
      color: ACTIVITY_PIE_COLORS.oral,
      percentLabel: formatPercent(stats.oral_percent),
      sliceLabel: TextUtils.secondsToTimestamp(stats.oral_seconds),
      valueLabel: formatStatValue(stats.oral_seconds, stats.oral_percent),
    },
    {
      key: "solo",
      label: activityLabels.solo,
      value: stats.solo_seconds,
      color: soloColor,
      percentLabel: formatPercent(stats.solo_percent),
      sliceLabel: TextUtils.secondsToTimestamp(stats.solo_seconds),
      valueLabel: formatStatValue(stats.solo_seconds, stats.solo_percent),
    },
  ];
}

function getRolePieSlices(
  stats: GQL.PerformerActivityStats,
  activity: ActivityCategory
): IActivityPieSlice[] {
  if (activity === "sex") {
    return [
      {
        key: "top",
        label: "Top",
        value: stats.sex_top_seconds,
        color: ACTIVITY_PIE_COLORS.top,
        percentLabel: formatPercent(stats.sex_top_percent),
        sliceLabel: TextUtils.secondsToTimestamp(stats.sex_top_seconds),
        valueLabel: formatStatValue(
          stats.sex_top_seconds,
          stats.sex_top_percent
        ),
      },
      {
        key: "bottom",
        label: "Bottom",
        value: stats.sex_bottom_seconds,
        color: ACTIVITY_PIE_COLORS.bottom,
        percentLabel: formatPercent(stats.sex_bottom_percent),
        sliceLabel: TextUtils.secondsToTimestamp(stats.sex_bottom_seconds),
        valueLabel: formatStatValue(
          stats.sex_bottom_seconds,
          stats.sex_bottom_percent
        ),
      },
    ];
  }

  if (activity === "oral") {
    return [
      {
        key: "top",
        label: "Top",
        value: stats.oral_top_seconds,
        color: ACTIVITY_PIE_COLORS.top,
        percentLabel: formatPercent(stats.oral_top_percent),
        sliceLabel: TextUtils.secondsToTimestamp(stats.oral_top_seconds),
        valueLabel: formatStatValue(
          stats.oral_top_seconds,
          stats.oral_top_percent
        ),
      },
      {
        key: "bottom",
        label: "Bottom",
        value: stats.oral_bottom_seconds,
        color: ACTIVITY_PIE_COLORS.bottom,
        percentLabel: formatPercent(stats.oral_bottom_percent),
        sliceLabel: TextUtils.secondsToTimestamp(stats.oral_bottom_seconds),
        valueLabel: formatStatValue(
          stats.oral_bottom_seconds,
          stats.oral_bottom_percent
        ),
      },
    ];
  }

  return [];
}

function renderStatsChartFooter(rows: IStatsChartFooterRow[]) {
  return (
    <div className="custom-stats-chart-table">
      {rows
        .filter((row) => row.seconds > 0)
        .map((row) => (
          <div className="custom-stats-chart-row" key={row.key}>
            <span
              aria-hidden="true"
              className="custom-stats-color-swatch"
              style={{ backgroundColor: row.color }}
            />
            <span className="custom-stats-label">{row.label}</span>
            <span className="custom-stats-value">
              {TextUtils.secondsToTimestamp(row.seconds)}
            </span>
            <span className="custom-stats-value">
              {formatPercent(row.percent)}
            </span>
          </div>
        ))}
    </div>
  );
}

export const PerformerStatsPanel: React.FC<IProps> = ({
  active,
  performer,
}) => {
  const { soloTag } = useRoleTags();
  const soloMarkerColor = getSceneMarkerTagColorCustom(soloTag?.name);
  const stats = performer.activity_stats;
  const activityPieSlices = getActivityPieSlices(stats, soloMarkerColor);
  const activityRows: IStatsChartFooterRow[] = [
    {
      key: "sex",
      label: activityLabels.sex,
      seconds: stats.sex_seconds,
      percent: stats.sex_percent,
      color: ACTIVITY_PIE_COLORS.sex,
    },
    {
      key: "oral",
      label: activityLabels.oral,
      seconds: stats.oral_seconds,
      percent: stats.oral_percent,
      color: ACTIVITY_PIE_COLORS.oral,
    },
    {
      key: "solo",
      label: activityLabels.solo,
      seconds: stats.solo_seconds,
      percent: stats.solo_percent,
      color: soloMarkerColor,
    },
  ];
  const roleCharts = (["sex", "oral"] as ActivityCategory[])
    .map((activity) => {
      const slices = getRolePieSlices(stats, activity);
      const totalSeconds =
        activity === "sex" ? stats.sex_seconds : stats.oral_seconds;
      const rows: IStatsChartFooterRow[] =
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
        slices,
        totalSeconds,
      };
    })
    .filter((chart) => chart.slices.length > 0);

  return (
    <div className="performer-stats-panel mt-3">
      <div className="custom-stats-overview">
        <ActivityPieChart
          centerLabel={TextUtils.secondsToTimestamp(
            stats.total_activity_seconds
          )}
          className="custom-stats-overview-chart performer-stats-chart"
          footer={renderStatsChartFooter(activityRows)}
          showLegend={false}
          size={220}
          slices={activityPieSlices}
          title="Activities"
        />
        {roleCharts.map((chart) => (
          <ActivityPieChart
            centerLabel={TextUtils.secondsToTimestamp(chart.totalSeconds)}
            className="custom-stats-overview-chart performer-stats-chart"
            footer={renderStatsChartFooter(chart.rows)}
            key={chart.activity}
            showLegend={false}
            size={220}
            slices={chart.slices}
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
