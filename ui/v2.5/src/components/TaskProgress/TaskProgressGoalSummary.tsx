import React from "react";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import { taskProgressCurrentGoalPeriods } from "../taskProgress_custom";
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
  const goals = taskProgressCurrentGoalPeriods(
    history,
    currentGoalPerDay,
    progressToday()
  );
  const periods = [
    { key: "day", label: t("Today") },
    { key: "week", label: t("This week") },
    { key: "month", label: t("This month") },
  ] as const;

  if (!periods.some(({ key }) => goals[key].goal > 0)) return null;

  return (
    <section
      aria-label={t("Goal progress")}
      className={`progress-goal-summary${
        compact ? " progress-goal-summary-compact" : ""
      }`}
    >
      {periods.map(({ key, label }) => {
        const goal = goals[key];
        const state = taskProgressDailyGoalState(goal.completed, goal.goal);
        const percentage =
          goal.goal > 0 ? Math.min(100, (goal.completed / goal.goal) * 100) : 0;
        return (
          <div
            className={`progress-goal-period progress-goal-period-${state}`}
            key={key}
          >
            {compact ? (
              <span>
                <strong>{label}</strong>
                <small>
                  {Math.round(goal.completed)} /{" "}
                  {goal.goal ? Math.round(goal.goal) : "—"}
                </small>
              </span>
            ) : (
              <>
                <strong>
                  {Math.round(goal.completed)} /{" "}
                  {goal.goal ? Math.round(goal.goal) : "—"}
                </strong>
                <span>{label}</span>
              </>
            )}
            <span aria-hidden="true" className="progress-goal-meter">
              <span style={{ width: `${percentage}%` }} />
            </span>
          </div>
        );
      })}
    </section>
  );
};
