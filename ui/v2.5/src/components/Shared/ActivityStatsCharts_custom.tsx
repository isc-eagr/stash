import React from "react";
import {
  ACTIVITY_PIE_COLORS,
  ActivityPieChart,
  getSceneMarkerTagColorCustom,
} from "src/components/Shared/ActivityPieChart_custom";
import type { IActivityPieSlice } from "src/components/Shared/ActivityPieChart_custom";
import type { StudioActivityStats } from "src/core/generated-graphql";
import { useRoleTags } from "src/hooks/useRoleTags";
import TextUtils from "src/utils/text";

interface IStatsRow {
  key: string;
  label: string;
  seconds: number;
  percent: number;
  color?: string;
}

interface IProps {
  stats: StudioActivityStats;
  className?: string;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getActivityColor(key: string, soloColor = ACTIVITY_PIE_COLORS.solo) {
  const colors: Record<string, string> = {
    sex: ACTIVITY_PIE_COLORS.sex,
    oral: ACTIVITY_PIE_COLORS.oral,
    solo: soloColor,
    other: ACTIVITY_PIE_COLORS.other,
    outstanding: ACTIVITY_PIE_COLORS.outstanding,
    standard: ACTIVITY_PIE_COLORS.standard,
    unusable: ACTIVITY_PIE_COLORS.unusable,
  };

  return colors[key] ?? ACTIVITY_PIE_COLORS.other;
}

function getActivityPieSlices(
  rows: IStatsRow[],
  soloColor?: string
): IActivityPieSlice[] {
  return rows
    .filter((row) => row.seconds > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: row.seconds,
      color: row.color ?? getActivityColor(row.key, soloColor),
      percentLabel: formatPercent(row.percent),
      sliceLabel: TextUtils.secondsToTimestamp(row.seconds),
      valueLabel: `${TextUtils.secondsToTimestamp(
        row.seconds
      )} (${formatPercent(row.percent)})`,
    }));
}

function renderStatsChartFooter(rows: IStatsRow[], soloColor?: string) {
  return (
    <div className="custom-stats-chart-table">
      {rows
        .filter((row) => row.seconds > 0)
        .map((row) => (
          <div className="custom-stats-chart-row" key={row.key}>
            <span
              aria-hidden="true"
              className="custom-stats-color-swatch"
              style={{
                backgroundColor:
                  row.color ?? getActivityColor(row.key, soloColor),
              }}
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

export const ActivityStatsCharts: React.FC<IProps> = ({
  stats,
  className = "",
}) => {
  const { soloTag } = useRoleTags();
  const soloMarkerColor = getSceneMarkerTagColorCustom(soloTag?.name);
  const activityRows: IStatsRow[] = [
    {
      key: "sex",
      label: "Sex",
      seconds: stats.sex_seconds,
      percent: stats.sex_percent,
    },
    {
      key: "oral",
      label: "Oral",
      seconds: stats.oral_seconds,
      percent: stats.oral_percent,
    },
    {
      key: "solo",
      label: "Solo",
      seconds: stats.solo_seconds,
      percent: stats.solo_percent,
      color: soloMarkerColor,
    },
    {
      key: "other",
      label: "Other",
      seconds: stats.activity_other_seconds,
      percent: stats.activity_other_percent,
    },
  ];
  const qualityRows: IStatsRow[] = [
    {
      key: "outstanding",
      label: "Outstanding",
      seconds: stats.outstanding_seconds,
      percent: stats.outstanding_percent,
    },
    {
      key: "standard",
      label: "Standard",
      seconds: stats.standard_seconds,
      percent: stats.standard_percent,
    },
    {
      key: "unusable",
      label: "Unusable",
      seconds: stats.unusable_seconds,
      percent: stats.unusable_percent,
    },
  ];

  return (
    <div className={`custom-stats-overview ${className}`.trim()}>
      <ActivityPieChart
        centerLabel={TextUtils.secondsToTimestamp(stats.total_seconds)}
        className="custom-stats-overview-chart studio-stats-chart"
        footer={renderStatsChartFooter(activityRows, soloMarkerColor)}
        showLegend={false}
        size={240}
        slices={getActivityPieSlices(activityRows, soloMarkerColor)}
        title="Activity Type"
      />
      <ActivityPieChart
        centerLabel={TextUtils.secondsToTimestamp(stats.total_seconds)}
        className="custom-stats-overview-chart studio-stats-chart"
        footer={renderStatsChartFooter(qualityRows, soloMarkerColor)}
        showLegend={false}
        size={240}
        slices={getActivityPieSlices(qualityRows, soloMarkerColor)}
        title="Quality"
      />
    </div>
  );
};
