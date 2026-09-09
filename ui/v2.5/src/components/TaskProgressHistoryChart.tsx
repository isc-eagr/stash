import React from "react";
import { useIntl } from "react-intl";
import {
  buildTaskProgressHistorySeries,
  filterTaskProgressHistoryActivityPoints,
  formatTaskProgressDate,
} from "./taskProgress_custom";
import type {
  ITaskProgressHistoryEntry,
  ITaskProgressHistoryPoint,
  TaskProgressHistoryRange,
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
const RANGE_OPTIONS: readonly TaskProgressHistoryRange[] = [7, 30, "all"];

let nextTaskProgressHistoryChartID = 0;

function createTaskProgressHistoryChartID() {
  nextTaskProgressHistoryChartID += 1;
  return nextTaskProgressHistoryChartID;
}

function historyDateValue(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
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
  const points = React.useMemo(
    () => buildTaskProgressHistorySeries(history, range, today),
    [history, range, today]
  );

  const chartTitle = intl.formatMessage(
    {
      id: "task_progress.history.chart_title",
      defaultMessage: "{title} daily progress",
    },
    { title }
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
  const incomingLabel = intl.formatMessage({
    id: "task_progress.history.incoming",
    defaultMessage: "Incoming",
  });
  const averageLabel = intl.formatMessage({
    id: "task_progress.history.seven_day_average",
    defaultMessage: "7-day average",
  });
  const baselineLabel = intl.formatMessage({
    id: "task_progress.history.baseline",
    defaultMessage: "Baseline",
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
      Math.max(point.completed, point.incoming, point.completedAverage)
    )
  );
  const metricValue = (point: ITaskProgressHistoryPoint) =>
    view === "remaining" ? point.remaining : point.cumulativeCompleted;
  const metricMax = Math.max(1, ...points.map(metricValue));
  const bandWidth = PLOT_WIDTH / points.length;
  const barGroupWidth = Math.min(Math.max(bandWidth * 0.72, 2), 22);
  const barWidth = barGroupWidth / 2;
  const xForIndex = (index: number) =>
    MARGIN.left + bandWidth * index + bandWidth / 2;
  const activityY = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (value / activityMax) * PLOT_HEIGHT;
  const metricY = (point: ITaskProgressHistoryPoint) =>
    MARGIN.top + PLOT_HEIGHT - (metricValue(point) / metricMax) * PLOT_HEIGHT;
  const averagePath = linePath(points, xForIndex, (point) =>
    activityY(point.completedAverage)
  );
  const metricPath = linePath(points, xForIndex, metricY);
  const tickStep = Math.max(1, Math.ceil(points.length / 6));
  const titleID = `task-progress-history-${chartID}-title`;
  const descriptionID = `task-progress-history-${chartID}-description`;
  const formatShortDate = (date: string) =>
    intl.formatDate(historyDateValue(date), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const formatDayLabel = (point: ITaskProgressHistoryPoint) => {
    const baseline =
      point.baselineCount === undefined
        ? ""
        : intl.formatMessage(
            {
              id: "task_progress.history.day_baseline",
              defaultMessage: ", baseline {count}",
            },
            { count: point.baselineCount }
          );

    return intl.formatMessage(
      {
        id: "task_progress.history.day_summary",
        defaultMessage:
          "{date}: {completed} completed, {incoming} incoming, {remaining} remaining, {cumulative} cumulative completed{baseline}",
      },
      {
        baseline,
        completed: point.completed,
        cumulative: point.cumulativeCompleted,
        date: formatTaskProgressDate(point.date),
        incoming: point.incoming,
        remaining: point.remaining,
      }
    );
  };

  return (
    <section className="task-progress-history-chart">
      <div className="task-progress-history-chart-controls">
        <div
          aria-label={intl.formatMessage({
            id: "task_progress.history.range",
            defaultMessage: "History range",
          })}
          className="task-progress-history-chart-toggle"
          role="group"
        >
          {RANGE_OPTIONS.map((option) => (
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
      </div>

      <div className="task-progress-history-chart-legend" aria-hidden="true">
        <span className="completed">{completedLabel}</span>
        <span className="incoming">{incomingLabel}</span>
        <span className="average">{averageLabel}</span>
        <span className={view}>{metricLabel}</span>
        <span className="baseline">{baselineLabel}</span>
      </div>

      <svg
        aria-labelledby={`${titleID} ${descriptionID}`}
        className="task-progress-history-chart-svg"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <title id={titleID}>{chartTitle}</title>
        <desc id={descriptionID}>
          {intl.formatMessage(
            {
              id: "task_progress.history.chart_description",
              defaultMessage:
                "Daily completed and incoming item bars, a seven-day completion average, baseline markers, and a {metric} line. A data table follows the chart.",
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
                  maximumFractionDigits: 1,
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

        {points.map((point, index) => {
          const centerX = xForIndex(index);
          const completedY = activityY(point.completed);
          const incomingY = activityY(point.incoming);
          return (
            <g aria-hidden="true" key={`${point.date}-bars`}>
              <rect
                className="task-progress-history-chart-completed"
                height={MARGIN.top + PLOT_HEIGHT - completedY}
                width={barWidth}
                x={centerX - barGroupWidth / 2}
                y={completedY}
              />
              <rect
                className="task-progress-history-chart-incoming"
                height={MARGIN.top + PLOT_HEIGHT - incomingY}
                width={barWidth}
                x={centerX}
                y={incomingY}
              />
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
          className="task-progress-history-chart-average-line"
          d={averagePath}
        />
        <path
          aria-hidden="true"
          className={`task-progress-history-chart-metric-line ${view}`}
          d={metricPath}
        />
        {points.map((point, index) => (
          <React.Fragment key={`${point.date}-line-points`}>
            <circle
              aria-hidden="true"
              className="task-progress-history-chart-average-point"
              cx={xForIndex(index)}
              cy={activityY(point.completedAverage)}
              r="2"
            />
            <circle
              aria-hidden="true"
              className={`task-progress-history-chart-metric-point ${view}`}
              cx={xForIndex(index)}
              cy={metricY(point)}
              r="2.75"
            />
          </React.Fragment>
        ))}

        {points.map((point, index) => {
          const showTick =
            index === 0 ||
            index === points.length - 1 ||
            index % tickStep === 0;
          return showTick ? (
            <text
              aria-hidden="true"
              className="task-progress-history-chart-date-label"
              key={`${point.date}-label`}
              textAnchor="middle"
              x={xForIndex(index)}
              y={CHART_HEIGHT - 14}
            >
              {formatShortDate(point.date)}
            </text>
          ) : null;
        })}

        {points.map((point, index) => (
          <g
            aria-label={formatDayLabel(point)}
            aria-pressed={onSelectDay ? selectedDate === point.date : undefined}
            className={`task-progress-history-chart-day-target${
              selectedDate === point.date ? " selected" : ""
            }`}
            key={`${point.date}-target`}
            onClick={() => onSelectDay?.(point.date)}
            onKeyDown={(event) => activateDay(event, point.date, onSelectDay)}
            role={onSelectDay ? "button" : undefined}
            tabIndex={onSelectDay ? 0 : undefined}
          >
            <title>{formatDayLabel(point)}</title>
            <rect
              height={PLOT_HEIGHT}
              width={bandWidth}
              x={MARGIN.left + bandWidth * index}
              y={MARGIN.top}
            />
          </g>
        ))}
      </svg>

      <details className="task-progress-history-chart-data">
        <summary>
          {intl.formatMessage({
            id: "task_progress.history.view_data",
            defaultMessage: "View daily data",
          })}
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
                <th scope="col">{averageLabel}</th>
                <th scope="col">{baselineLabel}</th>
              </tr>
            </thead>
            <tbody>
              {tablePoints.length ? (
                tablePoints.map((point) => (
                  <tr key={`${point.date}-row`}>
                    <th scope="row">
                      {onSelectDay ? (
                        <button
                          aria-pressed={selectedDate === point.date}
                          className="task-progress-history-chart-date-button"
                          onClick={() => onSelectDay(point.date)}
                          type="button"
                        >
                          {formatTaskProgressDate(point.date)}
                        </button>
                      ) : (
                        formatTaskProgressDate(point.date)
                      )}
                    </th>
                    <td>{intl.formatNumber(point.completed)}</td>
                    <td>{intl.formatNumber(point.incoming)}</td>
                    <td>{intl.formatNumber(point.remaining)}</td>
                    <td>{intl.formatNumber(point.cumulativeCompleted)}</td>
                    <td>
                      {intl.formatNumber(point.completedAverage, {
                        maximumFractionDigits: 1,
                      })}
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
