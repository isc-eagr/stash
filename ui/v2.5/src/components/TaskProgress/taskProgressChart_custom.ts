import { buildTaskProgressHistorySeries } from "../taskProgress_custom";
import type {
  ITaskProgressHistoryEntry,
  TaskProgressHistoryRange,
} from "../taskProgress_custom";
import { taskProgressReportPeriod } from "./taskProgressReports_custom";
import type { TaskProgressReportRange } from "./taskProgressReports_custom";

/** Keep lifetime totals while selecting the daily trend or a calendar period. */
export function taskProgressChartSeries(
  history: readonly ITaskProgressHistoryEntry[],
  period: TaskProgressReportRange,
  range: TaskProgressHistoryRange,
  anchor: string,
  today: string
) {
  if (period === "day") {
    return buildTaskProgressHistorySeries(history, range, anchor);
  }
  const selected = taskProgressReportPeriod(period, anchor, today);
  return buildTaskProgressHistorySeries(history, "all", today).filter(
    (point) => point.date >= selected.start && point.date <= selected.through
  );
}
