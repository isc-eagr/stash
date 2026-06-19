import React from "react";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";

interface IProps {
  studio: GQL.StudioDetailDataFragment;
  showChildStudioContent: boolean;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export const StudioStatsPanel: React.FC<IProps> = ({
  studio,
  showChildStudioContent,
}) => {
  const stats = showChildStudioContent
    ? studio.studio_activity_stats_all
    : studio.studio_activity_stats;

  const rows = [
    {
      label: "Total qualifying scene length",
      seconds: stats.total_seconds,
      percent: 100,
    },
    {
      label: "Sex",
      seconds: stats.sex_seconds,
      percent: stats.sex_percent,
    },
    {
      label: "Oral",
      seconds: stats.oral_seconds,
      percent: stats.oral_percent,
    },
    {
      label: "Solo",
      seconds: stats.solo_seconds,
      percent: stats.solo_percent,
    },
    {
      label: "Other",
      seconds: stats.other_seconds,
      percent: stats.other_percent,
    },
  ];

  return (
    <div className="studio-stats-panel mt-3">
      <div className="custom-stats-list">
        {rows.map((row) => (
          <div className="custom-stats-row" key={row.label}>
            <span className="custom-stats-label">{row.label}</span>
            <span className="custom-stats-value">
              {TextUtils.secondsToTimestamp(row.seconds)} (
              {formatPercent(row.percent)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
