import {
  aggregateTaskProgressHistorySeries,
  buildTaskProgressHistorySeries,
  taskProgressHistoryPercentages,
} from "../taskProgress_custom";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import { taskProgressCheckpointTiers } from "./taskProgressCheckpoints_custom";

export interface ITaskProgressNextMedal {
  threshold: number;
  label: string;
  /** Items still needed to reach the medal. */
  need: number;
}

/** The first unearned medal and how many items it still needs. */
export function taskProgressNextMedal(
  completed: number,
  total: number
): ITaskProgressNextMedal | undefined {
  if (total <= 0) return undefined;
  const tier = taskProgressCheckpointTiers.find(
    ({ threshold }) => completed < Math.ceil((total * threshold) / 100)
  );
  if (!tier) return undefined;
  return {
    threshold: tier.threshold,
    label: tier.label,
    need: Math.ceil((total * tier.threshold) / 100) - completed,
  };
}

/**
 * Consecutive days that met their daily goal, counting back from today.
 * Today only adds to the streak once its goal is met; an unmet today never
 * breaks it, since the day is still running.
 */
export function taskProgressGoalStreak(
  entries: readonly ITaskProgressHistoryEntry[],
  today: string
) {
  const points = buildTaskProgressHistorySeries(entries, "all", today);
  const met = (point: (typeof points)[number]) =>
    (point.goalPerDay ?? 0) > 0 && point.completed >= (point.goalPerDay ?? 0);
  let streak = 0;
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index];
    if (met(point)) streak++;
    else if (point.date !== today) break;
  }
  return streak;
}

export interface ITaskProgressCompletionPoint {
  date: string;
  percent: number;
}

export type TaskProgressCloseStep = "fortnight" | "month";

/**
 * Completion percentage on the first recorded day, then at the close of every
 * second week (ending with the running week) or every month, oldest first.
 * Closes in the running period use today. Longer histories keep the last
 * `count` closes.
 */
export function taskProgressCompletionCloses(
  entries: readonly ITaskProgressHistoryEntry[],
  today: string,
  step: TaskProgressCloseStep,
  count = 13
): ITaskProgressCompletionPoint[] {
  const days = buildTaskProgressHistorySeries(entries, "all", today);
  if (!days.length) return [];
  const periodEnd = (start: string) => {
    const end = new Date(`${start}T00:00:00Z`);
    if (step === "month") end.setUTCMonth(end.getUTCMonth() + 1, 0);
    else end.setUTCDate(end.getUTCDate() + 6);
    const date = end.toISOString().slice(0, 10);
    return date < today ? date : today;
  };
  const periods = aggregateTaskProgressHistorySeries(
    days,
    step === "month" ? "month" : "week"
  ).filter(
    (_, index, all) => step === "month" || (all.length - 1 - index) % 2 === 0
  );
  const closes = periods.slice(-count).map((point) => ({
    date: periodEnd(point.date),
    percent: taskProgressHistoryPercentages(point).completedPercentage,
  }));
  const opening = {
    date: days[0].date,
    percent: taskProgressHistoryPercentages(days[0]).completedPercentage,
  };
  return periods.length <= count && opening.date < closes[0].date
    ? [opening, ...closes]
    : closes;
}
