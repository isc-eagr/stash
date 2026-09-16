import React from "react";
import TextUtils from "src/utils/text";

export interface IPerformerStatsBarRow {
  key: string;
  label: string;
  seconds: number;
  percent: number;
  color: string;
}

interface IProps {
  title: string;
  totalSeconds: number;
  rows: IPerformerStatsBarRow[];
}

export function getPerformerStatsBarWidth(percent: number) {
  if (!Number.isFinite(percent)) return 0;

  return Math.min(Math.max(percent, 0), 100);
}

function formatPercent(percent: number) {
  return `${Math.round(percent)}%`;
}

export const PerformerStatsBarChart: React.FC<IProps> = ({
  title,
  totalSeconds,
  rows,
}) => {
  const visibleRows = rows.filter((row) => row.seconds > 0);

  if (visibleRows.length === 0) return null;

  return (
    <section className="performer-stats-bar-chart">
      <header className="performer-stats-bar-chart-header">
        <h3 className="performer-stats-bar-chart-title">{title}</h3>
        <span className="performer-stats-bar-chart-total">
          {TextUtils.secondsToTimestamp(totalSeconds)}
        </span>
      </header>
      <div className="performer-stats-bar-chart-rows">
        {visibleRows.map((row) => {
          const width = getPerformerStatsBarWidth(row.percent);
          const percentLabel = formatPercent(row.percent);

          return (
            <div className="performer-stats-bar-chart-row" key={row.key}>
              <div className="performer-stats-bar-chart-row-header">
                <span
                  aria-hidden="true"
                  className="performer-stats-bar-chart-swatch"
                  style={{ backgroundColor: row.color }}
                />
                <span className="performer-stats-bar-chart-label">
                  {row.label}
                </span>
                <span className="performer-stats-bar-chart-value">
                  {TextUtils.secondsToTimestamp(row.seconds)}
                </span>
                <span className="performer-stats-bar-chart-percent">
                  {percentLabel}
                </span>
              </div>
              <div
                aria-label={`${row.label}: ${percentLabel}`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={width}
                className="performer-stats-bar-chart-track"
                role="progressbar"
              >
                <span
                  className="performer-stats-bar-chart-fill"
                  style={{
                    backgroundColor: row.color,
                    width: `${width}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
