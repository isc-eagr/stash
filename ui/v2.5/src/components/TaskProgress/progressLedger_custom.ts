import { buildTaskProgressHistorySeries } from "../taskProgress_custom";
import type {
  ITaskProgressReportHistoryDay,
  ITaskProgressReportPeriod,
} from "./taskProgressReports_custom";
import {
  plannedTaskProgressFinishDate,
  progressForecast,
} from "./progressMath_custom";

export interface IProgressLedgerSnapshot {
  completed: number;
  total: number;
  percent: number;
  previousPercent?: number;
  netCompletedGain: number;
}

/** Percentages use actual closing snapshots, not scope-adjusted work progress. */
export function progressLedgerSnapshot(
  history: readonly ITaskProgressReportHistoryDay[],
  period: ITaskProgressReportPeriod,
  today: string,
  live?: { completed: number; remaining: number }
): IProgressLedgerSnapshot {
  const points = buildTaskProgressHistorySeries(
    history.map((day) => ({
      ...day,
      baselineCount: day.baseline_count ?? undefined,
      completedTotal: day.completed_total ?? undefined,
      goalPerDay: day.goal_per_day,
    })),
    "all",
    today
  );
  const recorded = points.filter((p) => p.date < period.start).pop();
  const last = points.filter((p) => p.date <= period.through).pop();
  // Without history before the period, it starts from the opening of the
  // first recorded day, so everything since tracking began counts as gain.
  const first = recorded
    ? undefined
    : points.find((p) => p.date >= period.start && p.date <= period.through);
  const before =
    recorded ??
    (first && {
      cumulativeCompleted:
        first.previousCompleted ??
        Math.max(0, first.cumulativeCompleted - first.completed),
      remaining:
        first.previousRemaining ??
        Math.max(
          0,
          first.remaining +
            first.completed -
            first.incoming -
            first.added +
            first.removed
        ),
    });
  const current = period.through === today ? live : undefined;
  const completed = Math.max(
    0,
    current?.completed ?? last?.cumulativeCompleted ?? 0
  );
  const remaining = Math.max(0, current?.remaining ?? last?.remaining ?? 0);
  const total = completed + remaining;
  const priorTotal = before ? before.cumulativeCompleted + before.remaining : 0;
  return {
    completed,
    total,
    percent: total > 0 ? (completed / total) * 100 : 0,
    previousPercent: before
      ? priorTotal > 0
        ? (before.cumulativeCompleted / priorTotal) * 100
        : 0
      : undefined,
    netCompletedGain: before
      ? Math.min(completed, Math.max(0, completed - before.cumulativeCompleted))
      : 0,
  };
}

export function progressLedgerForecast(
  history: readonly ITaskProgressReportHistoryDay[],
  remaining: number,
  today: string,
  status = "ACTIVE",
  startedOn = history[0]?.date ?? today
) {
  const forecast = progressForecast(
    { history, current_count: remaining, started_on: startedOn, status },
    today
  );
  const fallback =
    status === "ACTIVE" && forecast.days >= 3 && forecast.completedRate > 0
      ? plannedTaskProgressFinishDate(remaining, forecast.completedRate, today)
      : undefined;
  return {
    ...forecast,
    date: forecast.observed ?? fallback,
    assumesNoIncoming: !forecast.observed && !!fallback,
  };
}
