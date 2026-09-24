import React from "react";
import { FormattedNumber } from "react-intl";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import {
  taskProgressCurrentGoalPeriods,
  taskProgressCurrentPercentageChanges,
} from "../taskProgress_custom";
import { progressToday } from "./progressMath_custom";
import {
  taskProgressDailyGoalState,
  useProgressText,
} from "./progressView_custom";

interface IProps {
  currentGoalPerDay?: number | null;
  history: readonly ITaskProgressHistoryEntry[];
  compact?: boolean;
}

export const TaskProgressGoalSummary: React.FC<IProps> = ({
  currentGoalPerDay,
  history,
  compact = false,
}) => {
  const t = useProgressText();
  const today = progressToday();
  const goals = taskProgressCurrentGoalPeriods(
    history,
    currentGoalPerDay,
    today
  );
  const changes = taskProgressCurrentPercentageChanges(history, today);
  const periods = [
    { key: "day", label: t("Today") },
    { key: "week", label: t("This week") },
    { key: "month", label: t("This month") },
  ] as const;
  const hasDailyGoal = (currentGoalPerDay ?? 0) > 0;

  return (
    <section
      aria-label={t(hasDailyGoal ? "Goal progress" : "Completed items")}
      className={`progress-goal-summary${
        compact ? " progress-goal-summary-compact" : ""
      }`}
    >
      {periods.map(({ key, label }) => {
        const goal = goals[key];
        const state = hasDailyGoal
          ? taskProgressDailyGoalState(goal.completed, goal.goal)
          : goal.completed > 0
          ? "green"
          : "neutral"; // CUSTOM: Empty periods use the default white text color.
        const percentage =
          goal.goal > 0 ? Math.min(100, (goal.completed / goal.goal) * 100) : 0;
        const completed = Math.round(goal.completed);
        const progress = hasDailyGoal
          ? `${completed} / ${Math.round(goal.goal)}`
          : completed;
        const values = (
          <span className="progress-goal-period-values">
            {compact ? <small>{progress}</small> : <strong>{progress}</strong>}
            <small className="progress-goal-period-change">
              <FormattedNumber
                maximumFractionDigits={2}
                minimumFractionDigits={2}
                signDisplay="always"
                style="percent"
                value={changes[key] / 100}
              />
            </small>
          </span>
        );
        return (
          <div
            className={`progress-goal-period progress-goal-period-${key} progress-goal-period-${state}`}
            key={key}
          >
            {compact ? (
              <span>
                <strong>{label}</strong>
                {values}
              </span>
            ) : (
              <div className="progress-goal-period-heading">
                <span className="progress-goal-period-label">{label}</span>
                {values}
              </div>
            )}
            {hasDailyGoal && (
              <span aria-hidden="true" className="progress-goal-meter">
                <span style={{ width: `${percentage}%` }} />
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
};
