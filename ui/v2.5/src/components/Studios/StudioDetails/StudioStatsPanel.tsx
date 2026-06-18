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
      <table className="table table-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{TextUtils.secondsToTimestamp(row.seconds)}</td>
              <td>{formatPercent(row.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
