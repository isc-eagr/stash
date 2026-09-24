import type { TaskProgressMilestoneDataFragment as Milestone } from "src/core/generated-graphql";
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

export function milestoneTrackerPace(
  tracker: Milestone["trackers"][number],
  today = progressToday()
): number | undefined {
  if (!tracker.history.length) return undefined;
  const forecast = progressForecast(
    {
      ...tracker,
      started_on: tracker.history[0].date,
      status: "ACTIVE",
    },
    today
  );
  if (forecast.days > 0) return forecast.completedRate;
  return tracker.history.find((day) => day.date === today)?.completed ?? 0;
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
