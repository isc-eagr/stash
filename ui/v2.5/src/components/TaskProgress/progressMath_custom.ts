import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";

/** Truncate instead of rounding, so a label never shows a percent its medals and toasts have not reached. */
export function progressPercentDisplay(value: number, digits = 2) {
  const scale = 10 ** digits;
  // The epsilon keeps float noise (3 as 2.9999999999999996) from dropping a step.
  return Math.floor(value * scale + 1e-9) / scale;
}

export function progressToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function taskProgressCompletedCount(
  tracker: Pick<Tracker, "mode" | "goal" | "current_count" | "completed_count">
) {
  return tracker.mode === "FIXED"
    ? Math.max(0, tracker.goal - tracker.current_count)
    : tracker.completed_count;
}

export function progressPercentage(
  tracker: Pick<Tracker, "mode" | "goal" | "current_count" | "completed_count">
) {
  const completed = taskProgressCompletedCount(tracker);
  const total = completed + tracker.current_count;
  return total === 0 ? 100 : Math.min(100, (completed / total) * 100);
}

export function plannedTaskProgressFinishDate(
  remaining: number,
  itemsPerDay: number,
  today = progressToday()
) {
  if (remaining <= 0) return today;
  if (!Number.isFinite(itemsPerDay) || itemsPerDay <= 0) return undefined;

  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end)) return undefined;
  return new Date(end + Math.ceil(remaining / itemsPerDay) * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function progressForecast(
  tracker: {
    history: readonly { date: string; completed: number; incoming: number }[];
    current_count: number;
    started_on: string;
    status: string;
  },
  today = progressToday()
) {
  const end = Date.parse(`${today}T00:00:00Z`);
  const start = Math.max(
    Date.parse(`${tracker.started_on}T00:00:00Z`),
    end - 7 * 86400000
  );
  const days = Math.max(0, (end - start) / 86400000);
  const recent = tracker.history.filter(
    (d) => Date.parse(`${d.date}T00:00:00Z`) >= start && d.date < today
  );
  const completed = recent.reduce((n, d) => n + d.completed, 0);
  const incoming = recent.reduce((n, d) => n + d.incoming, 0);
  const netRate = days > 0 ? (completed - incoming) / days : 0;
  return {
    days,
    netRate,
    completedRate: days > 0 ? completed / days : 0,
    incomingRate: days > 0 ? incoming / days : 0,
    observed:
      days >= 3 &&
      netRate > 0 &&
      tracker.current_count > 0 &&
      tracker.status === "ACTIVE"
        ? new Date(end + Math.ceil(tracker.current_count / netRate) * 86400000)
            .toISOString()
            .slice(0, 10)
        : undefined,
  };
}
