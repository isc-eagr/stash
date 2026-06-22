import React from "react";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import {
  ACTIVITY_PIE_COLORS,
  ActivityPieChart,
} from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import type { IActivityPieSlice } from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM

interface IProps {
  studio: GQL.StudioDetailDataFragment;
  showChildStudioContent: boolean;
}

interface IStatsRow {
  key: string;
  label: string;
  seconds: number;
  percent: number;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatStatValue(row: Pick<IStatsRow, "seconds" | "percent">) {
  return `${TextUtils.secondsToTimestamp(row.seconds)} (${formatPercent(
    row.percent
  )})`;
}

function getActivityColor(key: string) {
  const colors: Record<string, string> = {
    sex: ACTIVITY_PIE_COLORS.sex,
    oral: ACTIVITY_PIE_COLORS.oral,
    solo: ACTIVITY_PIE_COLORS.solo,
    other: ACTIVITY_PIE_COLORS.other,
    unusable: ACTIVITY_PIE_COLORS.unusable,
  };

  return colors[key] ?? ACTIVITY_PIE_COLORS.other;
}

function getActivityPieSlices(rows: IStatsRow[]): IActivityPieSlice[] {
  return rows
    .filter((row) => row.key !== "total" && row.seconds > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: row.seconds,
      color: getActivityColor(row.key),
      percentLabel: formatPercent(row.percent),
      sliceLabel: TextUtils.secondsToTimestamp(row.seconds),
      valueLabel: formatStatValue(row),
    }));
}

function renderStatsChartFooter(rows: IStatsRow[]) {
  return (
    <div className="custom-stats-chart-table">
      {rows
        .filter((row) => row.key !== "total" && row.seconds > 0)
        .map((row) => (
          <div className="custom-stats-chart-row" key={row.key}>
            <span
              aria-hidden="true"
              className="custom-stats-color-swatch"
              style={{ backgroundColor: getActivityColor(row.key) }}
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

export const StudioStatsPanel: React.FC<IProps> = ({
  studio,
  showChildStudioContent,
}) => {
  const stats = showChildStudioContent
    ? studio.studio_activity_stats_all
    : studio.studio_activity_stats;

  const rows: IStatsRow[] = [
    {
      key: "total",
      label: "Total qualifying scene length",
      seconds: stats.total_seconds,
      percent: 100,
    },
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
    },
    {
      key: "other",
      label: "Other",
      seconds: stats.other_seconds,
      percent: stats.other_percent,
    },
    {
      key: "unusable",
      label: "Unusable",
      seconds: stats.unusable_seconds,
      percent: stats.unusable_percent,
    },
  ];
  const activityPieSlices = getActivityPieSlices(rows);

  return (
    <div className="studio-stats-panel mt-3">
      <div className="custom-stats-overview">
        <ActivityPieChart
          centerLabel={TextUtils.secondsToTimestamp(stats.total_seconds)}
          className="custom-stats-overview-chart studio-stats-chart"
          footer={renderStatsChartFooter(rows)}
          showLegend={false}
          size={240}
          slices={activityPieSlices}
          title="Activity"
        />
      </div>
    </div>
  );
};
