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
  } ${completedLabel}${
    day.goal > 0 && !day.future
      ? ` / ${day.goal} (${Math.round((day.completed / day.goal) * 100)}%)`
      : ""
  }`;
}

function dayColorClass(day: ITaskProgressReportDay, max: number) {
  return !day.future && day.goal > 0
    ? `progress-report-goal-${taskProgressDailyGoalState(
        day.completed,
        day.goal
      )}`
    : `progress-report-heat-${
        day.future ? 0 : taskProgressActivityLevel(day, max)
      }`;
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
                !bar.future && bar.goal && bar.goal > 0
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

const HeatLegend: React.FC<{ goal: boolean }> = ({ goal }) => {
  const t = useProgressText();
  return (
    <div className="progress-report-heat-legend" aria-hidden="true">
      {t(goal ? "Daily goal" : "Less")}
      {goal
        ? [
            { state: "red", label: "≤25%" },
            { state: "orange", label: "25–50%" },
            { state: "yellow", label: "50–80%" },
            { state: "green", label: "80–100%" },
            { state: "sapphire", label: ">100%" },
          ].map(({ state, label }) => (
            <span
              className={`progress-report-goal-${state}`}
              title={label}
              key={state}
            />
          ))
        : [0, 1, 2, 3, 4].map((level) => (
            <span className={`progress-report-heat-${level}`} key={level} />
          ))}
      {!goal && t("More")}
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
  const hasGoal = days.some((day) => !day.future && day.goal > 0);

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
                    className={`${dayColorClass(day, max)}${
                      day.future ? " progress-report-future" : ""
                    }`}
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
        <HeatLegend goal={hasGoal} />
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
                        ? `${dayColorClass(day, max)}${
                            day.future ? " progress-report-future" : ""
                          }`
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
      <HeatLegend goal={hasGoal} />
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
            goal: days.reduce(
              (sum, day) =>
                !day.future && Number(day.date.slice(5, 7)) === index + 1
                  ? sum + day.goal
                  : sum,
              0
            ),
            future: days.find((day) => day.date === start)?.future,
          };
        })}
      />
    </div>
  );
};
