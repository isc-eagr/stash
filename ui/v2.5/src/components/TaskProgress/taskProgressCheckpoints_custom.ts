import {
  buildTaskProgressHistorySeries,
  taskProgressHistoryPercentages,
} from "../taskProgress_custom";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import { progressToday } from "./progressMath_custom";

/** First date each checkpoint was reached, including progress before history began. */
export function taskProgressCheckpoints(
  history: readonly ITaskProgressHistoryEntry[],
  percentage: number,
  today = progressToday()
) {
  const points = buildTaskProgressHistorySeries(history, "all", today).filter(
    (point) => point.cumulativeCompleted > 0
  );
  return ([25, 50, 75, 100] as const).map((threshold) => {
    const date = points.find(
      (point) =>
        taskProgressHistoryPercentages(point).completedPercentage >= threshold
    )?.date;
    return { threshold, date, reached: !!date || percentage >= threshold };
  });
}
