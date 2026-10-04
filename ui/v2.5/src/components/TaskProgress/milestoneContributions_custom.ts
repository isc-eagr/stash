import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import { milestoneTrackerIdle } from "./milestoneView_custom";
import { taskProgressPeriodComparisons } from "./taskProgressReports_custom";
import type { TaskProgressComparisonPeriod } from "./taskProgressReports_custom";

export type MilestoneContributionSortKey =
  | "title"
  | "completed"
  | "percent"
  | "periodCompleted"
  | "periodPercent"
  | "share";

export const milestoneContributionPeriods = [
  { key: "day", label: "Day", current: "today", top: "Top today" },
  { key: "week", label: "Week", current: "this week", top: "Top this week" },
  {
    key: "month",
    label: "Month",
    current: "this month",
    top: "Top this month",
  },
] as const;

export function milestoneContributionHeaders(
  period: TaskProgressComparisonPeriod
): { key: MilestoneContributionSortKey; label: string }[] {
  const label = milestoneContributionPeriods.find(
    (item) => item.key === period
  )!.current;
  return [
    { key: "title", label: "Tracker" },
    { key: "completed", label: "Completed" },
    { key: "percent", label: "Tracker completed (%)" },
    { key: "periodCompleted", label: `Completed ${label}` },
    { key: "periodPercent", label: `Completion change ${label}` },
    { key: "share", label: `Share of ${period} completions (%)` },
  ];
}

export function milestoneContributionRows(
  trackers: readonly Tracker[],
  period: TaskProgressComparisonPeriod,
  today: string
) {
  const rows = trackers.map((tracker, index) => {
    const completed =
      tracker.mode === "FIXED"
        ? Math.max(0, tracker.goal - tracker.current_count)
        : tracker.completed_count;
    const total = completed + tracker.current_count;
    const comparison = taskProgressPeriodComparisons(tracker.history, today)[
      period
    ];
    return {
      tracker,
      index,
      comparison,
      idle: milestoneTrackerIdle(tracker, today),
      values: {
        completed,
        percent: total === 0 ? 100 : (completed / total) * 100,
        periodCompleted: comparison.current.completed,
        periodPercent: comparison.current.advanced,
        share: 0,
      },
    };
  });
  const total = rows.reduce((sum, row) => sum + row.values.periodCompleted, 0);
  rows.forEach((row) => {
    row.values.share =
      total > 0 ? (row.values.periodCompleted / total) * 100 : 0;
  });
  return rows;
}
