import {
  progressPercentage,
  taskProgressCompletedCount,
  progressToday,
} from "./progressMath_custom";
import { taskProgressNextMedal } from "./taskProgressScoreboard_custom";
import {
  readTaskProgressFinishPlan,
  taskProgressFinishEstimate,
} from "./taskProgressFinish_custom";
import type { ITaskProgressReportHistoryDay } from "./taskProgressReports_custom";

export const taskProgressSortOptions = [
  { value: "manual", label: "Manual order" },
  { value: "next_medal", label: "Closest to next medal" },
  { value: "finish", label: "Estimated finish" },
  { value: "completed_today", label: "Completed Today" },
  { value: "completed_week", label: "Completed This Week" },
  { value: "completed_month", label: "Completed This Month" },
  { value: "completed_year", label: "Completed This Year" },
  { value: "progress_desc", label: "Progress: high to low" },
  { value: "progress_asc", label: "Progress: low to high" },
] as const;

export type TaskProgressSort =
  (typeof taskProgressSortOptions)[number]["value"];

/** Items still needed for the next medal; trackers with every medal sort last. */
function nextMedalNeed(tracker: Parameters<typeof progressPercentage>[0]) {
  const completed = taskProgressCompletedCount(tracker);
  return (
    taskProgressNextMedal(completed, completed + tracker.current_count)?.need ??
    Infinity
  );
}

type SortableTracker = Parameters<typeof progressPercentage>[0] & {
  id?: string;
  history?: readonly ITaskProgressReportHistoryDay[];
  status?: string;
  started_on?: string;
};

// Calendar completion sorts use the same Mexico City date key as the progress
// page and Monday-first week used by its reports.
function completionPeriodStart(sort: TaskProgressSort, today: string) {
  if (sort === "completed_today") return today;
  if (sort === "completed_month") return `${today.slice(0, 7)}-01`;
  if (sort === "completed_year") return `${today.slice(0, 4)}-01-01`;
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function completedDuring(
  tracker: SortableTracker,
  start: string,
  today: string
) {
  return (
    tracker.history?.reduce(
      (total, day) =>
        day.date >= start && day.date <= today ? total + day.completed : total,
      0
    ) ?? 0
  );
}

/**
 * Estimated finish from the tracker's saved Details plan; trackers without an
 * estimate, including finished ones, sort last.
 */
function finishTime(tracker: SortableTracker, today?: string) {
  if (!tracker.id || !tracker.history || tracker.current_count === 0) {
    return Infinity;
  }
  const { date } = taskProgressFinishEstimate(
    {
      history: tracker.history,
      remaining: tracker.current_count,
      status: tracker.status,
      startedOn: tracker.started_on,
    },
    readTaskProgressFinishPlan(`task-progress-tracker-plan-${tracker.id}`),
    today
  );
  return date ? Date.parse(`${date}T00:00:00Z`) : Infinity;
}

const ascending = (left: number, right: number) =>
  left === right ? 0 : left - right;

export function sortTaskProgressTrackers<T extends SortableTracker>(
  trackers: readonly T[],
  sort: TaskProgressSort,
  today?: string
): T[] {
  const result = [...trackers];
  if (sort === "manual") return result;
  if (sort === "next_medal") {
    return result.sort((a, b) => ascending(nextMedalNeed(a), nextMedalNeed(b)));
  }
  if (sort === "finish") {
    const times = new Map(
      result.map((item) => [item, finishTime(item, today)])
    );
    return result.sort((a, b) => ascending(times.get(a)!, times.get(b)!));
  }
  if (
    sort === "completed_today" ||
    sort === "completed_week" ||
    sort === "completed_month" ||
    sort === "completed_year"
  ) {
    const currentDate = today ?? progressToday();
    const start = completionPeriodStart(sort, currentDate);
    const counts = new Map(
      result.map((item) => [item, completedDuring(item, start, currentDate)])
    );
    return result.sort((a, b) => ascending(counts.get(b)!, counts.get(a)!));
  }
  const direction = sort === "progress_asc" ? 1 : -1;
  return result.sort(
    (a, b) => direction * (progressPercentage(a) - progressPercentage(b))
  );
}
