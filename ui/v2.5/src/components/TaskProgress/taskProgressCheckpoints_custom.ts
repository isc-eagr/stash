import {
  buildTaskProgressHistorySeries,
  taskProgressHistoryPercentages,
} from "../taskProgress_custom";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import { progressToday } from "./progressMath_custom";

export const taskProgressCheckpointTiers = [
  { threshold: 25, label: "Bronze" },
  { threshold: 50, label: "Silver" },
  { threshold: 75, label: "Gold" },
  { threshold: 100, label: "Alpha Sapphire" },
] as const;

/** First date each checkpoint was reached, including progress before history began. */
export function taskProgressCheckpoints(
  history: readonly ITaskProgressHistoryEntry[],
  percentage: number,
  today = progressToday(),
  thresholds: readonly number[] = taskProgressCheckpointTiers.map(
    (tier) => tier.threshold
  )
) {
  const points = buildTaskProgressHistorySeries(history, "all", today).filter(
    (point) => point.cumulativeCompleted > 0
  );
  return thresholds.map((threshold) => {
    const date = points.find(
      (point) =>
        taskProgressHistoryPercentages(point).completedPercentage >= threshold
    )?.date;
    return { threshold, date, reached: !!date || percentage >= threshold };
  });
}
