import React from "react";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";

interface IProps {
  performer: GQL.PerformerDataFragment;
}

interface IStatsRow {
  label: string;
  seconds: number;
  percent: number;
  isMainCategory?: boolean;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export const PerformerStatsPanel: React.FC<IProps> = ({ performer }) => {
  const stats = performer.activity_stats;

  const rows: IStatsRow[] = [
    {
      label: "Total time spent in sex",
      seconds: stats.sex_seconds,
      percent: stats.sex_percent,
      isMainCategory: true,
    },
    {
      label: "Total time spent in sex as top",
      seconds: stats.sex_top_seconds,
      percent: stats.sex_top_percent,
    },
    {
      label: "Total time spent in sex as bottom",
      seconds: stats.sex_bottom_seconds,
      percent: stats.sex_bottom_percent,
    },
    {
      label: "Total time spent in oral",
      seconds: stats.oral_seconds,
      percent: stats.oral_percent,
      isMainCategory: true,
    },
    {
      label: "Total time spent in oral as top",
      seconds: stats.oral_top_seconds,
      percent: stats.oral_top_percent,
    },
    {
      label: "Total time spent in oral as bottom",
      seconds: stats.oral_bottom_seconds,
      percent: stats.oral_bottom_percent,
    },
    {
      label: "Total time spent solo",
      seconds: stats.solo_seconds,
      percent: stats.solo_percent,
      isMainCategory: true,
    },
  ];

  return (
    <div className="performer-stats-panel mt-3">
      <table className="table table-sm">
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={row.isMainCategory ? "font-weight-bold" : undefined}
            >
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
