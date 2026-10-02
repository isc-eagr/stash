import type { TaskProgressMilestoneDataFragment as Milestone } from "src/core/generated-graphql";
import {
  buildTaskProgressHistorySeries,
  taskProgressCurrentGoalPeriods,
  taskProgressCurrentPercentageChanges,
  taskProgressHistoryPercentages,
} from "../taskProgress_custom";
import {
  plannedTaskProgressFinishDate,
  progressForecast,
  progressToday,
} from "./progressMath_custom";

export function milestoneFromSearch(search: string): string | undefined {
  return new URLSearchParams(search).get("milestone") ?? undefined;
}

export function resolveMilestoneSelection(
  availableIDs: readonly string[],
  explicitID?: string,
  rememberedID?: string
): string | undefined {
  if (explicitID !== undefined) return explicitID;
  return rememberedID && availableIDs.includes(rememberedID)
    ? rememberedID
    : availableIDs[0];
}

export function milestoneSearch(
  search: string,
  milestoneID?: string,
  view: "trackers" | "milestones" | "reports" = "milestones"
): string {
  const params = new URLSearchParams(search);
  if (view === "milestones") {
    params.set("view", "milestones");
    if (milestoneID) params.set("milestone", milestoneID);
    else params.delete("milestone");
  } else {
    if (view === "reports") params.set("view", "reports");
    else params.delete("view");
    params.delete("milestone");
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function milestoneForecast(
  milestone: Milestone,
  today = progressToday()
) {
  const start = milestone.history[0]?.date ?? today;
  const forecast = progressForecast(
    {
      history: milestone.history,
      current_count: milestone.current_count,
      started_on: start,
      status: "ACTIVE",
    },
    today
  );
  const completionPaceFinish =
    forecast.days >= 3 &&
    forecast.completedRate > 0 &&
    milestone.current_count > 0
      ? plannedTaskProgressFinishDate(
          milestone.current_count,
          forecast.completedRate,
          today
        )
      : undefined;
  return {
    ...forecast,
    observed: forecast.observed ?? completionPaceFinish,
    assumesNoIncoming: !forecast.observed && !!completionPaceFinish,
  };
}

export type MilestoneTrackerPeriod = "day" | "week" | "month";

/** Items completed and percentage points gained in the current day/week/month. */
export function milestoneTrackerPeriods(
  tracker: Milestone["trackers"][number],
  today = progressToday()
): Record<MilestoneTrackerPeriod, { completed: number; percent: number }> {
  const goals = taskProgressCurrentGoalPeriods(tracker.history, null, today);
  const changes = taskProgressCurrentPercentageChanges(tracker.history, today);
  const period = (key: MilestoneTrackerPeriod) => ({
    completed: goals[key].completed,
    percent: changes[key],
  });
  return { day: period("day"), week: period("week"), month: period("month") };
}

/** True when the tracker completed nothing in the last `days` days. */
export function milestoneTrackerIdle(
  tracker: Pick<Milestone["trackers"][number], "history">,
  today = progressToday(),
  days = 30
): boolean {
  const since = new Date(
    Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86400000
  )
    .toISOString()
    .slice(0, 10);
  return !tracker.history.some(
    (day) => day.date >= since && day.date <= today && day.completed > 0
  );
}

export const milestoneCheckpointThresholds = [25, 50, 75, 100] as const;

/**
 * Marks each completion checkpoint and the first history date that reached it.
 * The current percentage also counts, so a checkpoint reached before history
 * began shows as reached without a date.
 */
export function milestoneCheckpoints(
  history: Milestone["history"],
  percentage: number,
  today = progressToday()
) {
  const points = buildTaskProgressHistorySeries(history, "all", today).filter(
    (point) => point.cumulativeCompleted > 0
  );
  return milestoneCheckpointThresholds.map((threshold) => {
    const date = points.find(
      (point) =>
        taskProgressHistoryPercentages(point).completedPercentage >= threshold
    )?.date;
    return { threshold, date, reached: !!date || percentage >= threshold };
  });
}

/** Completed and total items per type, skipping types with no items. */
export function milestoneItemProgress(
  milestone: Pick<Milestone, "item_counts" | "completed_item_counts">
) {
  const completed = new Map(
    milestone.completed_item_counts.map((item) => [item.item_type, item.count])
  );
  return milestone.item_counts
    .map((item) => {
      const done = completed.get(item.item_type) ?? 0;
      return {
        itemType: item.item_type,
        completed: done,
        total: done + item.count,
      };
    })
    .filter((item) => item.total > 0);
}

export function milestoneTargetProgress(
  milestone: Pick<Milestone, "target_date" | "current_count">,
  netRate: number,
  today = progressToday()
) {
  const target = milestone.target_date;
  if (!target) return undefined;
  if (milestone.current_count === 0)
    return { state: "complete" as const, requiredRate: 0 };
  const days = Math.round(
    (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000
  );
  if (days < 0) return { state: "overdue" as const, requiredRate: 0 };
  const requiredRate = Math.ceil(milestone.current_count / Math.max(1, days));
  if (!Number.isFinite(netRate) || netRate <= 0)
    return { state: "unavailable" as const, requiredRate };
  return {
    state:
      netRate > requiredRate
        ? ("ahead" as const)
        : netRate >= requiredRate
        ? ("on_track" as const)
        : ("behind" as const),
    requiredRate,
  };
}
