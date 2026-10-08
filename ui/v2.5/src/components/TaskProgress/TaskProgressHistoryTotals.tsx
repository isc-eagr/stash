import React from "react";
import { useIntl } from "react-intl";
import { formatTaskProgressDate } from "../taskProgress_custom";
import type { ITaskProgressHistoryPoint } from "../taskProgress_custom";
import { TaskProgressHistoryTooltip } from "./TaskProgressHistoryTooltip";
import type { TaskProgressHistoryView } from "./TaskProgressHistoryTooltip";
import { useProgressText } from "./progressView_custom";

export const TaskProgressHistoryTotals: React.FC<{
  points: readonly ITaskProgressHistoryPoint[];
  title: string;
  completionOnly: boolean;
  view: TaskProgressHistoryView;
  onView: (view: TaskProgressHistoryView) => void;
}> = ({ points, title, completionOnly, view, onView }) => {
  const intl = useIntl();
  const t = useProgressText();
  const [showIncoming, setShowIncoming] = React.useState(false);
  const [hoverDate, setHoverDate] = React.useState<string>();
  const width = 720;
  const height = 240;
  const left = 48;
  const right = width - 54;
  const top = 24;
  const bottom = height - 32;
  const metric = (point: ITaskProgressHistoryPoint) =>
    view === "remaining" ? point.remaining : point.cumulativeCompleted;
  const max = Math.max(1, ...points.map(metric));
  const incomingMax = Math.max(1, ...points.map((point) => point.incoming));
  const x = (index: number) =>
    left + ((index + 0.5) / points.length) * (right - left);
  const y = (value: number, scale = max) =>
    bottom - (value / scale) * (bottom - top);
  const path = (
    value: (point: ITaskProgressHistoryPoint) => number,
    scale = max
  ) =>
    points
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${x(index)},${y(value(point), scale)}`
      )
      .join(" ");
  const hovered = points.find((point) => point.date === hoverDate);
  const tickCount = Math.min(6, points.length);
  const ticks = new Set(
    Array.from({ length: tickCount }, (_, index) =>
      Math.round((index * (points.length - 1)) / Math.max(1, tickCount - 1))
    )
  );
  return (
    <details className="task-progress-history-chart-totals">
      <summary>{t("Totals trend")}</summary>
      <div className="task-progress-history-chart-controls">
        {!completionOnly && (
          <div
            className="task-progress-history-chart-toggle"
            role="group"
            aria-label={t("Line metric")}
          >
            {(["remaining", "cumulative"] as const).map((metricView) => (
              <button
                key={metricView}
                type="button"
                aria-pressed={view === metricView}
                className={view === metricView ? "active" : undefined}
                onClick={() => onView(metricView)}
              >
                {t(metricView === "remaining" ? "Remaining" : "Cumulative")}
              </button>
            ))}
          </div>
        )}
        <label className="task-progress-history-chart-incoming-toggle">
          <input
            type="checkbox"
            checked={showIncoming}
            onChange={(event) => setShowIncoming(event.target.checked)}
          />
          {t("Show incoming")}
        </label>
      </div>
      <div className="task-progress-history-chart-legend" aria-hidden="true">
        <span className={view}>
          {t(view === "remaining" ? "Remaining" : "Cumulative completed")}
        </span>
        {showIncoming && <span className="incoming">{t("Incoming")}</span>}
        <span className="baseline">{t("Baseline")}</span>
      </div>
      <div className="task-progress-history-chart-plot">
        <svg
          className="task-progress-history-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}: ${t("Totals trend")}`}
        >
          <desc>
            {t(
              "Cumulative or remaining totals, baseline markers, and optional incoming activity. A data table follows the chart."
            )}
          </desc>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio} aria-hidden="true">
              <line
                className="task-progress-history-chart-grid"
                x1={left}
                x2={right}
                y1={y(max * ratio)}
                y2={y(max * ratio)}
              />
              <text
                className="task-progress-history-chart-axis-label"
                x={left - 7}
                y={y(max * ratio) + 4}
                textAnchor="end"
              >
                {intl.formatNumber(max * ratio, { maximumFractionDigits: 0 })}
              </text>
              {showIncoming && (
                <text
                  className="task-progress-history-chart-axis-label incoming"
                  x={right + 7}
                  y={y(max * ratio) + 4}
                >
                  {intl.formatNumber(incomingMax * ratio, {
                    maximumFractionDigits: 0,
                  })}
                </text>
              )}
            </g>
          ))}
          {points.map((point, index) => (
            <g
              key={point.date}
              className="task-progress-history-chart-day-target"
              tabIndex={0}
              role="img"
              aria-label={`${formatTaskProgressDate(point.date)}: ${metric(
                point
              )}`}
              onFocus={() => setHoverDate(point.date)}
              onBlur={() => setHoverDate(undefined)}
              onMouseEnter={() => setHoverDate(point.date)}
              onMouseLeave={() => setHoverDate(undefined)}
            >
              <rect
                x={left + (index / points.length) * (right - left)}
                y={top}
                width={(right - left) / points.length}
                height={bottom - top}
              />
              {point.baselineCount !== undefined && (
                <g aria-hidden="true">
                  <line
                    className="task-progress-history-chart-baseline"
                    x1={x(index)}
                    x2={x(index)}
                    y1={top}
                    y2={bottom}
                  />
                  <path
                    className="task-progress-history-chart-baseline-marker"
                    d={`M${x(index) - 5},${top} L${x(index) + 5},${top} L${x(
                      index
                    )},${top + 7} Z`}
                  />
                </g>
              )}
              {ticks.has(index) && (
                <text
                  className="task-progress-history-chart-date-label"
                  x={x(index)}
                  y={height - 10}
                  textAnchor="middle"
                >
                  {formatTaskProgressDate(point.date)}
                </text>
              )}
            </g>
          ))}
          <path
            className={`task-progress-history-chart-metric-line ${view}`}
            d={path(metric)}
            aria-hidden="true"
          />
          {showIncoming && (
            <path
              className="task-progress-history-chart-incoming-line"
              d={path((point) => point.incoming, incomingMax)}
              aria-hidden="true"
            />
          )}
          {points.map((point, index) => (
            <circle
              key={`${point.date}-point`}
              className={`task-progress-history-chart-metric-point ${view}`}
              cx={x(index)}
              cy={y(metric(point))}
              r="2.75"
              aria-hidden="true"
            />
          ))}
        </svg>
        {hovered && (
          <div
            className={`task-progress-history-chart-tooltip${
              y(metric(hovered)) < top + 82 ? " below" : ""
            }`}
            role="tooltip"
            style={{
              left: `clamp(7rem, ${
                (x(points.indexOf(hovered)) / width) * 100
              }%, calc(100% - 7rem))`,
              top: `${(y(metric(hovered)) / height) * 100}%`,
            }}
          >
            <TaskProgressHistoryTooltip
              point={hovered}
              view={view}
              showIncoming={showIncoming}
            />
          </div>
        )}
      </div>
    </details>
  );
};
