import React from "react";
import { useIntl } from "react-intl";
import {
  filterTaskProgressHistoryActivityPoints,
  formatTaskProgressDate,
} from "./taskProgress_custom";
import type {
  ITaskProgressHistoryEntry,
  TaskProgressHistoryRange,
} from "./taskProgress_custom";
import {
  progressToday,
  useProgressText,
} from "./TaskProgress/progressView_custom";
import { taskProgressChartSeries } from "./TaskProgress/taskProgressChart_custom";
import { TaskProgressReportActivity } from "./TaskProgress/TaskProgressReportActivity";
import { TaskProgressHistoryPeriod } from "./TaskProgress/TaskProgressHistoryPeriod";
import { TaskProgressHistoryTooltip } from "./TaskProgress/TaskProgressHistoryTooltip";
import type { TaskProgressHistoryView } from "./TaskProgress/TaskProgressHistoryTooltip";
import { TaskProgressHistoryTotals } from "./TaskProgress/TaskProgressHistoryTotals";
import {
  boundedTaskProgressReportAnchor,
  taskProgressReportDays,
  taskProgressReportPeriod,
} from "./TaskProgress/taskProgressReports_custom";
import type { TaskProgressReportRange } from "./TaskProgress/taskProgressReports_custom";

interface IProps {
  history: readonly ITaskProgressHistoryEntry[];
  title: string;
  onSelectDay?: (date: string) => void;
  selectedDate?: string;
  today?: string;
  completionOnly?: boolean;
}

const dailyRanges: readonly TaskProgressHistoryRange[] = [7, 30, "all"];
const periods = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
] as const;

export const TaskProgressHistoryChart: React.FC<IProps> = ({
  history,
  title,
  onSelectDay,
  selectedDate,
  today = progressToday(),
  completionOnly = false,
}) => {
  const intl = useIntl();
  const t = useProgressText();
  const [range, setRange] = React.useState<TaskProgressHistoryRange>(30);
  const [period, setPeriod] = React.useState<TaskProgressReportRange>("day");
  const [selectedAnchor, setAnchor] = React.useState<string>();
  const [selectedView, setView] =
    React.useState<TaskProgressHistoryView>("cumulative");
  const view = completionOnly ? "cumulative" : selectedView;
  const firstDate = history.map((day) => day.date).sort()[0] ?? today;
  const anchor = selectedAnchor
    ? boundedTaskProgressReportAnchor(period, selectedAnchor, firstDate, today)
    : today;
  const selected = React.useMemo(
    () => taskProgressReportPeriod(period, anchor, today),
    [period, anchor, today]
  );
  const points = React.useMemo(
    () => taskProgressChartSeries(history, period, range, anchor, today),
    [history, period, range, anchor, today]
  );
  const days = React.useMemo(
    () =>
      period === "day"
        ? points.map((point) => ({
            date: point.date,
            completed: point.completed,
            goal: point.goalPerDay ?? 0,
            future: false,
          }))
        : taskProgressReportDays(
            history.map((day) => ({ ...day, goal_per_day: day.goalPerDay })),
            selected,
            today
          ),
    [history, period, points, selected, today]
  );
  const tablePoints = filterTaskProgressHistoryActivityPoints(points);
  const headings = [
    "Date",
    "Completed",
    "Incoming",
    "Remaining",
    "Cumulative",
    "Goal",
    "Baseline",
  ];

  if (!history.length)
    return (
      <div className="task-progress-history-chart task-progress-history-chart-empty">
        {t("No progress history has been recorded yet.")}
      </div>
    );

  return (
    <section
      className="task-progress-history-chart"
      aria-label={`${title}: ${t("Activity progression")}`}
    >
      <div className="task-progress-history-chart-controls">
        <div
          className="task-progress-history-chart-toggle"
          role="group"
          aria-label={t("Progress period")}
        >
          {periods.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              className={period === key ? "active" : undefined}
              onClick={() => setPeriod(key)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        {period === "day" && (
          <div
            className="task-progress-history-chart-toggle"
            role="group"
            aria-label={t("History range")}
          >
            {dailyRanges.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                className={range === option ? "active" : undefined}
                onClick={() => setRange(option)}
              >
                {option === "all" ? t("All") : `${option}d`}
              </button>
            ))}
          </div>
        )}
      </div>
      <TaskProgressHistoryPeriod
        range={period}
        anchor={anchor}
        firstDate={firstDate}
        today={today}
        onChange={setAnchor}
      />
      <TaskProgressReportActivity
        range={period}
        days={days}
        selectedDate={selectedDate ?? (period === "day" ? anchor : undefined)}
        onSelectDay={onSelectDay}
        renderDayTooltip={(date) => {
          const point = points.find((item) => item.date === date);
          return point ? (
            <TaskProgressHistoryTooltip
              point={point}
              view={view}
              showIncoming
            />
          ) : undefined;
        }}
      />
      {points.length > 0 && (
        <TaskProgressHistoryTotals
          points={points}
          title={title}
          completionOnly={completionOnly}
          view={view}
          onView={setView}
        />
      )}
      <details className="task-progress-history-chart-data">
        <summary>{t("View daily data")}</summary>
        <div className="table-responsive">
          <table className="table table-sm">
            <caption className="sr-only">
              {title}: {t("Activity progression")}
            </caption>
            <thead>
              <tr>
                {headings.map((heading) => (
                  <th key={heading} scope="col">
                    {t(heading)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablePoints.length ? (
                tablePoints.map((point) => (
                  <tr key={point.date}>
                    <th scope="row">
                      {onSelectDay ? (
                        <button
                          className="task-progress-history-chart-date-button"
                          type="button"
                          aria-pressed={selectedDate === point.date}
                          onClick={() => onSelectDay(point.date)}
                        >
                          {formatTaskProgressDate(point.date)}
                        </button>
                      ) : (
                        formatTaskProgressDate(point.date)
                      )}
                    </th>
                    {[
                      point.completed,
                      point.incoming,
                      point.remaining,
                      point.cumulativeCompleted,
                      point.goalPerDay || undefined,
                      point.baselineCount,
                    ].map((value, index) => (
                      <td key={headings[index + 1]}>
                        {value === undefined ? "—" : intl.formatNumber(value)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headings.length} className="text-muted">
                    {t("No activity in this range.")}
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
