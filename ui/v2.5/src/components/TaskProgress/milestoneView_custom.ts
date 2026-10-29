import type { TaskProgressMilestoneDataFragment as Milestone } from "src/core/generated-graphql";
import {
  plannedTaskProgressFinishDate,
  progressForecast,
  progressToday,
} from "./progressMath_custom";

export function milestoneFromSearch(search: string): string | undefined {
  return new URLSearchParams(search).get("milestone") ?? undefined;
}

export function milestoneSearch(
  search: string,
  milestoneID?: string,
  view: "trackers" | "milestones" = "milestones"
): string {
  const params = new URLSearchParams(search);
  if (view === "milestones") {
    params.set("view", "milestones");
    if (milestoneID) params.set("milestone", milestoneID);
    else params.delete("milestone");
  } else {
    params.delete("view");
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

/** Items left across milestones; a tracker shared by several counts once. */
export function milestonesRemaining(
  milestones: readonly {
    trackers: readonly Pick<
      Milestone["trackers"][number],
      "id" | "current_count"
    >[];
  }[]
) {
  const left = new Map<string, number>();
  for (const milestone of milestones) {
    for (const tracker of milestone.trackers) {
      left.set(tracker.id, tracker.current_count);
    }
  }
  return [...left.values()].reduce((sum, count) => sum + count, 0);
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
