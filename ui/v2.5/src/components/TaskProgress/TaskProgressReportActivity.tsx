import React from "react";
import { formatTaskProgressDate } from "../taskProgress_custom";
import {
  taskProgressDailyGoalState,
  useProgressText,
} from "./progressView_custom";
import {
  taskProgressActivityLevel,
  taskProgressReportMonths,
  taskProgressReportWeeks,
} from "./taskProgressReports_custom";
import type {
  ITaskProgressReportDay,
  TaskProgressReportRange,
} from "./taskProgressReports_custom";

interface IBar {
  key: string;
  label: string;
  value: number;
  goal?: number;
  future?: boolean;
}

const weekdayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  timeZone: "UTC",
});
const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
  // 2024-01-01 was a Monday.
  weekdayFormat.format(new Date(Date.UTC(2024, 0, 1 + index)))
);

function dayTitle(day: ITaskProgressReportDay, completedLabel: string) {
  return `${formatTaskProgressDate(day.date)}: ${
    day.completed
  } ${completedLabel}`;
}

const ReportBars: React.FC<{ bars: readonly IBar[]; label: string }> = ({
  bars,
  label,
}) => {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div className="progress-report-bars" role="list" aria-label={label}>
      {bars.map((bar) => (
        <div
          className={`progress-report-bar${
            bar.future ? " progress-report-future" : ""
          }`}
          key={bar.key}
          role="listitem"
          aria-label={`${bar.label}: ${bar.value}`}
        >
          <span className="progress-report-bar-value">
            {bar.future ? "" : bar.value}
          </span>
          <span className="progress-report-bar-track">
            <span
              className={
                bar.goal
                  ? `progress-report-goal-${taskProgressDailyGoalState(
                      bar.value,
                      bar.goal
                    )}`
                  : undefined
              }
              style={{ height: `${(bar.value / max) * 100}%` }}
            />
          </span>
          <span className="progress-report-bar-label">{bar.label}</span>
        </div>
      ))}
    </div>
  );
};

const HeatLegend: React.FC = () => {
  const t = useProgressText();
  return (
    <div className="progress-report-heat-legend" aria-hidden="true">
      {t("Less")}
      {[0, 1, 2, 3, 4].map((level) => (
        <span className={`progress-report-heat-${level}`} key={level} />
      ))}
      {t("More")}
    </div>
  );
};

export const TaskProgressReportActivity: React.FC<{
  range: TaskProgressReportRange;
  days: readonly ITaskProgressReportDay[];
}> = ({ range, days }) => {
  const t = useProgressText();
  const completedLabel = t("completed");
  const max = Math.max(0, ...days.map((day) => day.completed));

  if (range === "week") {
    return (
      <ReportBars
        label={t("Daily completions")}
        bars={days.map((day, index) => ({
          key: day.date,
          label: `${weekdayLabels[index]} ${day.date.slice(8)}`,
          value: day.completed,
          goal: day.goal,
          future: day.future,
        }))}
      />
    );
  }

  if (range === "month") {
    return (
      <div className="progress-report-calendar">
        <div className="progress-report-calendar-grid" role="grid">
          <div role="row" className="progress-report-calendar-row">
            {weekdayLabels.map((label) => (
              <span role="columnheader" key={label}>
                {label}
              </span>
            ))}
          </div>
          {taskProgressReportWeeks(days).map((week, index) => (
            <div
              role="row"
              className="progress-report-calendar-row"
              key={week.find(Boolean)?.date ?? index}
            >
              {week.map((day, slot) =>
                day ? (
                  <span
                    role="gridcell"
                    className={`progress-report-heat-${taskProgressActivityLevel(
                      day,
                      max
                    )}${day.future ? " progress-report-future" : ""}`}
                    key={day.date}
                    title={dayTitle(day, completedLabel)}
                  >
                    <small>{Number(day.date.slice(8))}</small>
                    {day.completed > 0 && <strong>{day.completed}</strong>}
                  </span>
                ) : (
                  <span role="gridcell" key={`empty-${slot}`} />
                )
              )}
            </div>
          ))}
        </div>
        <HeatLegend />
      </div>
    );
  }

  const weeks = taskProgressReportWeeks(days);
  return (
    <div className="progress-report-year">
      <div className="progress-report-heatmap-scroll">
        <div
          className="progress-report-heatmap"
          role="img"
          aria-label={t("Daily completions")}
        >
          <div className="progress-report-heatmap-days" aria-hidden="true">
            {weekdayLabels.map((label, index) => (
              <span key={label}>{index % 2 === 0 ? label : ""}</span>
            ))}
          </div>
          {weeks.map((week, index) => {
            const monthStart = week.find((day) => day?.date.endsWith("-01"));
            return (
              <div
                className="progress-report-heatmap-week"
                key={week.find(Boolean)?.date ?? index}
              >
                <span className="progress-report-heatmap-month">
                  {monthStart
                    ? monthFormat.format(new Date(`${monthStart.date}T00:00Z`))
                    : ""}
                </span>
                {week.map((day, slot) => (
                  <span
                    className={
                      day
                        ? `progress-report-heat-${taskProgressActivityLevel(
                            day,
                            max
                          )}${day.future ? " progress-report-future" : ""}`
                        : "progress-report-heatmap-empty"
                    }
                    key={day?.date ?? `empty-${slot}`}
                    title={day ? dayTitle(day, completedLabel) : undefined}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <HeatLegend />
      <ReportBars
        label={t("Monthly completions")}
        bars={taskProgressReportMonths(days).map((value, index) => {
          const start = `${days[0].date.slice(0, 4)}-${String(
            index + 1
          ).padStart(2, "0")}-01`;
          return {
            key: start,
            label: monthFormat.format(new Date(`${start}T00:00Z`)),
            value,
            future: days.find((day) => day.date === start)?.future,
          };
        })}
      />
    </div>
  );
};
