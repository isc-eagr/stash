import React from "react";
import { FormattedNumber } from "react-intl";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import { taskProgressCurrentGoalPeriods } from "../taskProgress_custom";
import {
  showTaskProgressCurrentPeriods,
  useTaskProgressReportingDate,
} from "./taskProgressCompletion_custom";
import { TaskProgressItemsDelta } from "./TaskProgressDelta";
import type {
  ITaskProgressPeriodComparison,
  TaskProgressComparisonPeriod,
} from "./taskProgressReports_custom";
import {
  taskProgressDailyGoalState,
  useProgressText,
} from "./progressView_custom";

const periods = [
  { key: "day", label: "Today", short: "Today" },
  { key: "week", label: "This week", short: "Week" },
  { key: "month", label: "This month", short: "Month" },
  { key: "year", label: "This year", short: "Year" },
] as const;

/**
 * Today, this week, this month, and this year.
 * - `hero`: large goal tiles, with optional change against the previous period.
 * - `row`: compact cells for tracker rows.
 */
export const TaskProgressPeriodTiles: React.FC<{
  history: readonly ITaskProgressHistoryEntry[];
  currentGoalPerDay?: number | null;
  status?: string;
  variant: "hero" | "row";
  comparisons?: Record<
    TaskProgressComparisonPeriod,
    ITaskProgressPeriodComparison
  >;
}> = ({ history, currentGoalPerDay, status, variant, comparisons }) => {
  const t = useProgressText();
  const today = useTaskProgressReportingDate();
  if (!showTaskProgressCurrentPeriods(status, history, today)) return null;
  const goals = taskProgressCurrentGoalPeriods(
    history,
    currentGoalPerDay,
    today
  );
  const hasDailyGoal = (currentGoalPerDay ?? 0) > 0;

  return (
    <section
      aria-label={t(hasDailyGoal ? "Goal progress" : "Completed items")}
      className={`progress-period-tiles progress-period-tiles-${variant}`}
    >
      {periods.map(({ key, label, short }) => {
        const goal = goals[key];
        const completed = Math.round(goal.completed);
        const target = Math.round(goal.goal);
        const state = hasDailyGoal
          ? taskProgressDailyGoalState(goal.completed, goal.goal)
          : completed > 0
          ? "green"
          : "neutral";
        const meter =
          goal.goal > 0 ? Math.min(100, (goal.completed / goal.goal) * 100) : 0;
        const comparison = comparisons?.[key];

        return (
          <div
            key={key}
            className={`progress-period-tile progress-goal-period-${state}`}
          >
            <div className="progress-period-tile-heading">
              <span>{t(variant === "row" ? short : label)}</span>
              {variant === "hero" && target > 0 && completed >= target && (
                <span className="progress-period-goal-met">
                  {t("Goal met")}
                </span>
              )}
            </div>
            <div className="progress-period-tile-value">
              <strong>
                <FormattedNumber value={completed} />
              </strong>
              {hasDailyGoal && (
                <small>
                  / <FormattedNumber value={target} />
                </small>
              )}
            </div>
            {hasDailyGoal && (
              <span aria-hidden="true" className="progress-period-meter">
                <span style={{ width: `${meter}%` }} />
              </span>
            )}
            {variant === "hero" && comparison && (
              <TaskProgressItemsDelta
                current={comparison.current.completed}
                previous={comparison.previous.completed}
                label={comparison.label}
              />
            )}
          </div>
        );
      })}
    </section>
  );
};
