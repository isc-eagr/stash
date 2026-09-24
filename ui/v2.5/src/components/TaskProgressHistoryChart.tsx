import React from "react";
import { useIntl } from "react-intl";
import {
  buildTaskProgressHistorySeries,
  aggregateTaskProgressHistorySeries,
  filterTaskProgressHistoryActivityPoints,
  formatTaskProgressDate,
  taskProgressHistoryPercentages,
} from "./taskProgress_custom";
import { taskProgressDailyGoalState } from "./TaskProgress/progressView_custom";
import type {
  ITaskProgressHistoryEntry,
  ITaskProgressHistoryPoint,
  TaskProgressHistoryRange,
  TaskProgressHistoryGranularity,
} from "./taskProgress_custom";

type TaskProgressHistoryView = "remaining" | "cumulative";

interface IProps {
  history: readonly ITaskProgressHistoryEntry[];
  title: string;
  onSelectDay?: (date: string) => void;
  selectedDate?: string;
  today?: string;
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 270;
const MARGIN = { top: 28, right: 54, bottom: 42, left: 48 };
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
const DAILY_RANGE_OPTIONS: readonly TaskProgressHistoryRange[] = [7, 30, "all"];
const AGGREGATED_RANGE_OPTIONS: readonly TaskProgressHistoryRange[] = [
  30,
  "all",
];

let nextTaskProgressHistoryChartID = 0;

function createTaskProgressHistoryChartID() {
  nextTaskProgressHistoryChartID += 1;
  return nextTaskProgressHistoryChartID;
}

function linePath(
  points: readonly ITaskProgressHistoryPoint[],
  x: (index: number) => number,
  y: (point: ITaskProgressHistoryPoint) => number
): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point)}`)
    .join(" ");
}

function activateDay(
  event: React.KeyboardEvent<SVGGElement>,
  date: string,
  onSelectDay?: (date: string) => void
) {
  if (!onSelectDay || (event.key !== "Enter" && event.key !== " ")) return;

  event.preventDefault();
  onSelectDay(date);
}

export const TaskProgressHistoryChart: React.FC<IProps> = ({
  history,
  title,
  onSelectDay,
  selectedDate,
  today,
}) => {
  const intl = useIntl();
  const [chartID] = React.useState(createTaskProgressHistoryChartID);
  const [range, setRange] = React.useState<TaskProgressHistoryRange>(30);
  const [view, setView] = React.useState<TaskProgressHistoryView>("remaining");
  const [granularity, setGranularity] =
    React.useState<TaskProgressHistoryGranularity>("day");
  const [showIncoming, setShowIncoming] = React.useState(false);
  const [tooltipIndex, setTooltipIndex] = React.useState<number | null>(null);
  const dailyPoints = React.useMemo(
    () => buildTaskProgressHistorySeries(history, range, today),
    [history, range, today]
  );
  const points = React.useMemo(
    () => aggregateTaskProgressHistorySeries(dailyPoints, granularity),
    [dailyPoints, granularity]
  );
  const rangeOptions =
    granularity === "day" ? DAILY_RANGE_OPTIONS : AGGREGATED_RANGE_OPTIONS;

  const chartTitle = intl.formatMessage(
    {
      id: "task_progress.history.chart_title",
      defaultMessage: "{title} {period} progress",
    },
    { title, period: granularity }
  );
  const metricLabel =
    view === "remaining"
      ? intl.formatMessage({
          id: "task_progress.history.remaining",
          defaultMessage: "Remaining",
        })
      : intl.formatMessage({
          id: "task_progress.history.cumulative_completed",
          defaultMessage: "Cumulative completed",
        });
  const completedLabel = intl.formatMessage({
    id: "task_progress.history.completed",
    defaultMessage: "Completed",
  });
  const completedStates = [
    { key: "red", label: "≤25% completed" },
    { key: "orange", label: "26–50% completed" },
    { key: "yellow", label: "51–80% completed" },
    { key: "green", label: "81–100% completed" },
    { key: "sapphire", label: ">100% completed" },
  ] as const;
  const incomingLabel = intl.formatMessage({
    id: "task_progress.history.incoming",
    defaultMessage: "Incoming",
  });
  const baselineLabel = intl.formatMessage({
    id: "task_progress.history.baseline",
    defaultMessage: "Baseline",
  });
  const goalLabel = intl.formatMessage({
    id: "task_progress.history.goal",
    defaultMessage: "Goal",
  });
  const dateLabel = intl.formatMessage({
    id: "date",
    defaultMessage: "Date",
  });
  const cumulativeLabel = intl.formatMessage({
    id: "task_progress.history.cumulative_short",
    defaultMessage: "Cumulative",
  });
  const tablePoints = filterTaskProgressHistoryActivityPoints(points);
  if (points.length === 0) {
    return (
      <div className="task-progress-history-chart task-progress-history-chart-empty">
        {intl.formatMessage({
          id: "task_progress.history.empty",
          defaultMessage: "No progress history has been recorded yet.",
        })}
      </div>
    );
  }

  const activityMax = Math.max(
    1,
    ...points.map((point) =>
      showIncoming ? Math.max(point.completed, point.incoming) : point.completed
    )
  );
  const metricValue = (point: ITaskProgressHistoryPoint) =>
    view === "remaining" ? point.remaining : point.cumulativeCompleted;
  const metricMax = Math.max(1, ...points.map(metricValue));
  const bandWidth = PLOT_WIDTH / points.length;
  const barGroupWidth = bandWidth * 0.82; // CUSTOM: use each period's available space
  const barWidth = showIncoming ? barGroupWidth / 2 : barGroupWidth;
  const xForIndex = (index: number) =>
    MARGIN.left + bandWidth * index + bandWidth / 2;
  const activityY = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (value / activityMax) * PLOT_HEIGHT;
  const metricY = (point: ITaskProgressHistoryPoint) =>
    MARGIN.top + PLOT_HEIGHT - (metricValue(point) / metricMax) * PLOT_HEIGHT;
  const metricPath = linePath(points, xForIndex, metricY);
  // CUSTOM: space at most six date labels evenly, including both endpoints.
  const tickCount = Math.min(6, points.length);
  const tickIndices = new Set(
    Array.from({ length: tickCount }, (_, tick) =>
      Math.round((tick * (points.length - 1)) / Math.max(1, tickCount - 1))
    )
  );
  const descriptionID = `task-progress-history-${chartID}-description`;
  const formatShortDate = (date: string) => formatTaskProgressDate(date);
  const formatPeriodLabel = (date: string) => formatTaskProgressDate(date);
  const formatTooltipPeriodLabel = (date: string) => {
    if (granularity === "day") return formatTaskProgressDate(date);
    if (granularity === "week") {
      return intl.formatMessage(
        {
          id: "task_progress.history.week_of",
          defaultMessage: "Week of {date}",
        },
        { date: formatShortDate(date) }
      );
    }
    return formatPeriodLabel(date);
  };
  const formatDayLabel = (point: ITaskProgressHistoryPoint) => {
    const percentages = taskProgressHistoryPercentages(point);
    const baseline =
      point.baselineCount === undefined
        ? ""
        : intl.formatMessage(
            {
              id: "task_progress.history.day_baseline",
              defaultMessage: ", baseline {count}",
            },
            { count: Math.round(point.baselineCount) }
          );

    const summary = showIncoming
      ? intl.formatMessage(
          {
            id: "task_progress.history.day_summary",
            defaultMessage:
              "{date}: {completed} completed, {incoming} incoming, {remaining} remaining, {cumulative} cumulative completed{baseline}",
          },
          {
            baseline,
            completed: Math.round(point.completed),
            cumulative: Math.round(point.cumulativeCompleted),
            date: formatTaskProgressDate(point.date),
            incoming: Math.round(point.incoming),
            remaining: Math.round(point.remaining),
          }
        )
      : intl.formatMessage(
          {
            id: "task_progress.history.day_summary_completed",
            defaultMessage:
              "{date}: {completed} completed, {remaining} remaining, {cumulative} cumulative completed{baseline}",
          },
          {
            baseline,
            completed: Math.round(point.completed),
            cumulative: Math.round(point.cumulativeCompleted),
            date: formatTaskProgressDate(point.date),
            remaining: Math.round(point.remaining),
          }
        );
    return `${summary}, ${intl.formatNumber(percentages.completedPercentage, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}% completed, ${intl.formatNumber(percentages.periodProgressPercentage, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}% progress this ${granularity}`;
  };
  const tooltipPoint = tooltipIndex === null ? undefined : points[tooltipIndex];
  const tooltipPercentages = tooltipPoint
    ? taskProgressHistoryPercentages(tooltipPoint)
    : undefined;
  const formatPercentage = (value: number, signed = false) =>
    `${signed && value > 0 ? "+" : ""}${intl.formatNumber(value, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}%`;
  const periodActivityLabel = intl.formatMessage(
    {
      id: "task_progress.history.completed_this_period",
      defaultMessage: "Completed this {period}",
    },
    { period: granularity }
  );
  const periodProgressLabel = intl.formatMessage(
    {
      id: "task_progress.history.progress_this_period",
      defaultMessage: "Progress this {period}",
    },
    { period: granularity }
  );

  return (
    <section className="task-progress-history-chart">
      <div className="task-progress-history-chart-controls">
        <div
          aria-label={intl.formatMessage({
            id: "task_progress.history.period",
            defaultMessage: "Progress period",
          })}
          className="task-progress-history-chart-toggle"
          role="group"
        >
          {(["day", "week", "month"] as const).map((period) => (
            <button
              aria-pressed={granularity === period}
              className={granularity === period ? "active" : undefined}
              key={period}
              onClick={() => {
                setGranularity(period);
                if (period !== "day" && range === 7) setRange(30);
              }}
              type="button"
            >
              {intl.formatMessage({
                id: `task_progress.history.period_${period}`,
                defaultMessage:
                  period === "day"
                    ? "Daily"
                    : period === "week"
                    ? "Weekly"
                    : "Monthly",
              })}
            </button>
          ))}
        </div>
        <div
          aria-label={intl.formatMessage({
            id: "task_progress.history.range",
            defaultMessage: "History range",
          })}
          className="task-progress-history-chart-toggle"
          role="group"
        >
          {rangeOptions.map((option) => (
            <button
              aria-pressed={range === option}
              className={range === option ? "active" : undefined}
              key={option}
              onClick={() => setRange(option)}
              type="button"
            >
              {option === "all"
                ? intl.formatMessage({
                    id: "task_progress.history.range_all",
                    defaultMessage: "All",
                  })
                : intl.formatMessage(
                    {
                      id: "task_progress.history.range_days",
                      defaultMessage: "{count}d",
                    },
                    { count: option }
                  )}
            </button>
          ))}
        </div>
        <div
          aria-label={intl.formatMessage({
            id: "task_progress.history.line_metric",
            defaultMessage: "Line metric",
          })}
          className="task-progress-history-chart-toggle"
          role="group"
        >
          <button
            aria-pressed={view === "remaining"}
            className={view === "remaining" ? "active" : undefined}
            onClick={() => setView("remaining")}
            type="button"
          >
            {intl.formatMessage({
              id: "task_progress.history.remaining",
              defaultMessage: "Remaining",
            })}
          </button>
          <button
            aria-pressed={view === "cumulative"}
            className={view === "cumulative" ? "active" : undefined}
            onClick={() => setView("cumulative")}
            type="button"
          >
            {cumulativeLabel}
          </button>
        </div>
        <label className="task-progress-history-chart-incoming-toggle">
          <input
            checked={showIncoming}
            onChange={(event) => setShowIncoming(event.target.checked)}
            type="checkbox"
          />
          {intl.formatMessage({
            id: "task_progress.history.show_incoming",
            defaultMessage: "Show incoming",
          })}
        </label>
      </div>

      <div className="task-progress-history-chart-legend" aria-hidden="true">
        {completedStates.map(({ key, label }) => (
          <span className={`completed completed-${key}`} key={key}>
            {label}
          </span>
        ))}
        {showIncoming && <span className="incoming">{incomingLabel}</span>}
        <span className={view}>{metricLabel}</span>
        <span className="baseline">{baselineLabel}</span>
      </div>

      <div className="task-progress-history-chart-plot">
        <svg
          aria-describedby={descriptionID}
          aria-label={chartTitle}
          className="task-progress-history-chart-svg"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          <desc id={descriptionID}>
            {intl.formatMessage(
              showIncoming
                ? {
                    id: "task_progress.history.chart_description",
                    defaultMessage:
                      "Completed and incoming item bars, baseline markers, and a {metric} line. Bar colors compare completed items with the goal that applied during each period. A data table follows the chart.",
                  }
                : {
                    id: "task_progress.history.chart_description_completed",
                    defaultMessage:
                      "Completed item bars, baseline markers, and a {metric} line. Bar colors compare completed items with the goal that applied during each period. A data table follows the chart.",
                  },
              { metric: metricLabel.toLocaleLowerCase() }
            )}
          </desc>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = MARGIN.top + PLOT_HEIGHT * (1 - ratio);
            return (
              <g aria-hidden="true" key={ratio}>
                <line
                  className="task-progress-history-chart-grid"
                  x1={MARGIN.left}
                  x2={MARGIN.left + PLOT_WIDTH}
                  y1={y}
                  y2={y}
                />
                <text
                  className="task-progress-history-chart-axis-label"
                  textAnchor="end"
                  x={MARGIN.left - 7}
                  y={y + 4}
                >
                  {intl.formatNumber(activityMax * ratio, {
                    maximumFractionDigits: 0,
                  })}
                </text>
                <text
                  className="task-progress-history-chart-axis-label"
                  textAnchor="start"
                  x={MARGIN.left + PLOT_WIDTH + 7}
                  y={y + 4}
                >
                  {intl.formatNumber(metricMax * ratio, {
                    maximumFractionDigits: 0,
                  })}
                </text>
              </g>
            );
          })}

          {points.map((point, index) => (
            <g
              aria-label={formatDayLabel(point)}
              aria-pressed={
                onSelectDay && granularity === "day"
                  ? selectedDate === point.date
                  : undefined
              }
              className={`task-progress-history-chart-day-target${
                selectedDate === point.date ? " selected" : ""
              }`}
              key={`${point.date}-target`}
              onBlur={() => setTooltipIndex(null)}
              onClick={() => {
                if (granularity === "day") onSelectDay?.(point.date);
              }}
              onFocus={() => setTooltipIndex(index)}
              onMouseEnter={() => setTooltipIndex(index)}
              onMouseLeave={() => setTooltipIndex(null)}
              onKeyDown={(event) =>
                activateDay(
                  event,
                  point.date,
                  granularity === "day" ? onSelectDay : undefined
                )
              }
              role={onSelectDay && granularity === "day" ? "button" : undefined}
              tabIndex={0}
            >
              <rect
                height={PLOT_HEIGHT}
                width={bandWidth}
                x={MARGIN.left + bandWidth * index}
                y={MARGIN.top}
              />
            </g>
          ))}

          {points.map((point, index) => {
            const centerX = xForIndex(index);
            const completedY = activityY(point.completed);
            const incomingY = activityY(point.incoming);
            return (
              <g
                className="task-progress-history-chart-bars"
                key={`${point.date}-bars`}
              >
                <rect
                  className={`task-progress-history-chart-completed${
                    point.goalPerDay
                      ? ` task-progress-history-chart-goal-${taskProgressDailyGoalState(
                          point.completed,
                          point.goalPerDay
                        )}`
                      : ""
                  }`}
                  height={MARGIN.top + PLOT_HEIGHT - completedY}
                  width={barWidth}
                  x={
                    showIncoming
                      ? centerX - barGroupWidth / 2
                      : centerX - barWidth / 2
                  }
                  y={completedY}
                />
                {showIncoming && (
                  <rect
                    className="task-progress-history-chart-incoming"
                    height={MARGIN.top + PLOT_HEIGHT - incomingY}
                    width={barWidth}
                    x={centerX}
                    y={incomingY}
                  />
                )}
                {point.baselineCount !== undefined && (
                  <>
                    <line
                      className="task-progress-history-chart-baseline"
                      x1={centerX}
                      x2={centerX}
                      y1={MARGIN.top}
                      y2={MARGIN.top + PLOT_HEIGHT}
                    />
                    <path
                      className="task-progress-history-chart-baseline-marker"
                      d={`M${centerX - 5},${MARGIN.top} L${centerX + 5},${
                        MARGIN.top
                      } L${centerX},${MARGIN.top + 7} Z`}
                    />
                  </>
                )}
              </g>
            );
          })}

          <path
            aria-hidden="true"
            className={`task-progress-history-chart-metric-line ${view}`}
            d={metricPath}
          />
          {points.map((point, index) => (
            <circle
              aria-hidden="true"
              className={`task-progress-history-chart-metric-point ${view}`}
              cx={xForIndex(index)}
              cy={metricY(point)}
              key={`${point.date}-metric-point`}
              r="2.75"
            />
          ))}

          {points.map((point, index) => {
            return tickIndices.has(index) ? (
              <text
                aria-hidden="true"
                className={`task-progress-history-chart-date-label${
                  range === 30 && granularity === "day" ? " thirty-day" : ""
                }`} // CUSTOM
                key={`${point.date}-label`}
                textAnchor="middle"
                x={xForIndex(index)}
                y={CHART_HEIGHT - 14}
              >
                {formatPeriodLabel(point.date)}
              </text>
            ) : null;
          })}
        </svg>
        {tooltipPoint && tooltipPercentages && (
          <div
            className={`task-progress-history-chart-tooltip${
              metricY(tooltipPoint) < MARGIN.top + 82 ? " below" : ""
            }`}
            role="tooltip"
            style={{
              left: `clamp(7rem, ${
                (xForIndex(tooltipIndex ?? 0) / CHART_WIDTH) * 100
              }%, calc(100% - 7rem))`,
              top: `${(metricY(tooltipPoint) / CHART_HEIGHT) * 100}%`,
            }}
          >
            <strong className="task-progress-history-chart-tooltip-title">
              {formatTooltipPeriodLabel(tooltipPoint.date)}
            </strong>
            <div
              className={`task-progress-history-chart-tooltip-metric ${view}`}
            >
              <span>{metricLabel}</span>
              <strong>
                {intl.formatNumber(Math.round(metricValue(tooltipPoint)))}
                <small>
                  {view === "remaining"
                    ? formatPercentage(tooltipPercentages.remainingPercentage) +
                      " remaining"
                    : formatPercentage(tooltipPercentages.completedPercentage) +
                      " completed"}
                </small>
              </strong>
            </div>
            <dl>
              <div>
                <dt>{periodActivityLabel}</dt>
                <dd>{intl.formatNumber(Math.round(tooltipPoint.completed))}</dd>
              </div>
              <div>
                <dt>{periodProgressLabel}</dt>
                <dd>
                  {formatPercentage(
                    tooltipPercentages.periodProgressPercentage,
                    true
                  )}
                </dd>
              </div>
              {showIncoming && (
                <div>
                  <dt>{incomingLabel}</dt>
                  <dd>
                    {intl.formatNumber(Math.round(tooltipPoint.incoming))}
                  </dd>
                </div>
              )}
              {tooltipPoint.goalPerDay ? (
                <div>
                  <dt>{goalLabel}</dt>
                  <dd>
                    {intl.formatNumber(Math.round(tooltipPoint.goalPerDay))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        )}
      </div>

      <details className="task-progress-history-chart-data">
        <summary>
          {intl.formatMessage(
            {
              id: "task_progress.history.view_data",
              defaultMessage: "View {period} data",
            },
            {
              period: granularity,
            }
          )}
        </summary>
        <div className="table-responsive">
          <table className="table table-sm">
            <caption className="sr-only">{chartTitle}</caption>
            <thead>
              <tr>
                <th scope="col">{dateLabel}</th>
                <th scope="col">{completedLabel}</th>
                <th scope="col">{incomingLabel}</th>
                <th scope="col">
                  {intl.formatMessage({
                    id: "task_progress.history.remaining",
                    defaultMessage: "Remaining",
                  })}
                </th>
                <th scope="col">{cumulativeLabel}</th>
                <th scope="col">{goalLabel}</th>
                <th scope="col">{baselineLabel}</th>
              </tr>
            </thead>
            <tbody>
              {tablePoints.length ? (
                tablePoints.map((point) => (
                  <tr key={`${point.date}-row`}>
                    <th scope="row">
                      {onSelectDay && granularity === "day" ? (
                        <button
                          aria-pressed={selectedDate === point.date}
                          className="task-progress-history-chart-date-button"
                          onClick={() => onSelectDay(point.date)}
                          type="button"
                        >
                          {formatTaskProgressDate(point.date)}
                        </button>
                      ) : granularity === "day" ? (
                        formatTaskProgressDate(point.date)
                      ) : (
                        formatPeriodLabel(point.date)
                      )}
                    </th>
                    <td>{intl.formatNumber(point.completed)}</td>
                    <td>{intl.formatNumber(point.incoming)}</td>
                    <td>{intl.formatNumber(point.remaining)}</td>
                    <td>{intl.formatNumber(point.cumulativeCompleted)}</td>
                    <td>
                      {point.goalPerDay
                        ? intl.formatNumber(Math.round(point.goalPerDay))
                        : "—"}
                    </td>
                    <td>
                      {point.baselineCount === undefined
                        ? "—"
                        : intl.formatNumber(point.baselineCount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-muted">
                    {intl.formatMessage({
                      id: "task_progress.history.no_activity",
                      defaultMessage: "No activity in this range.",
                    })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
};
