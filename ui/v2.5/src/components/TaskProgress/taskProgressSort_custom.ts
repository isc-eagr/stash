import {
  progressPercentage,
  taskProgressCompletedCount,
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
  const direction = sort === "progress_asc" ? 1 : -1;
  return result.sort(
    (a, b) => direction * (progressPercentage(a) - progressPercentage(b))
  );
}
