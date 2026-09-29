import {
  buildTaskProgressHistorySeries,
  taskProgressHistoryPercentages,
} from "../taskProgress_custom";

export type TaskProgressReportRange = "week" | "month" | "year";

export interface ITaskProgressReportPeriod {
  start: string;
  end: string;
  through: string;
}

export interface ITaskProgressReportHistoryDay {
  date: string;
  completed: number;
  incoming: number;
  remaining: number;
  baseline_count?: number | null;
  goal_per_day?: number | null;
}

export interface ITaskProgressReportRow {
  completed: number;
  totalCompleted: number;
  expected: number;
  goalDaysMet: number;
  goalDays: number;
  advanced: number;
}

export function activeTaskProgressReportItems<
  T extends { completed: number; name: string }
>(items: readonly T[]): T[] {
  return items
    .filter((item) => item.completed > 0)
    .sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name));
}

export function firstTaskProgressReportActivity(
  histories: readonly (readonly ITaskProgressReportHistoryDay[])[]
): string | undefined {
  let first: string | undefined;
  histories.forEach((history) =>
    history.forEach((day) => {
      if (
        (day.completed > 0 || day.incoming > 0) &&
        (!first || day.date < first)
      ) {
        first = day.date;
      }
    })
  );
  return first;
}

function dateAtUTC(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function taskProgressReportPeriod(
  range: TaskProgressReportRange,
  anchor: string,
  today: string
): ITaskProgressReportPeriod {
  const startDate = dateAtUTC(anchor);
  const endDate = dateAtUTC(anchor);
  if (range === "week") {
    startDate.setUTCDate(
      startDate.getUTCDate() - ((startDate.getUTCDay() + 6) % 7)
    );
    endDate.setTime(startDate.getTime());
    endDate.setUTCDate(endDate.getUTCDate() + 6);
  } else if (range === "month") {
    startDate.setUTCDate(1);
    endDate.setUTCMonth(startDate.getUTCMonth() + 1, 0);
  } else {
    startDate.setUTCMonth(0, 1);
    endDate.setUTCMonth(11, 31);
  }
  const end = dateKey(endDate);
  return {
    start: dateKey(startDate),
    end,
    through: end < today ? end : today,
  };
}

export function shiftTaskProgressReportPeriod(
  range: TaskProgressReportRange,
  anchor: string,
  offset: number
): string {
  const date = dateAtUTC(anchor);
  if (range === "week") date.setUTCDate(date.getUTCDate() + offset * 7);
  else if (range === "month") {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + offset);
  } else date.setUTCFullYear(date.getUTCFullYear() + offset, 0, 1);
  return dateKey(date);
}

export function boundedTaskProgressReportAnchor(
  range: TaskProgressReportRange,
  candidate: string,
  firstActivity: string,
  today: string
): string {
  const candidateStart = taskProgressReportPeriod(
    range,
    candidate,
    today
  ).start;
  const firstStart = taskProgressReportPeriod(
    range,
    firstActivity,
    today
  ).start;
  const currentStart = taskProgressReportPeriod(range, today, today).start;
  if (candidateStart < firstStart || candidate < firstActivity) {
    return firstActivity;
  }
  if (candidateStart > currentStart || candidate > today) return today;
  return candidate;
}

export function taskProgressReportRow(
  history: readonly ITaskProgressReportHistoryDay[],
  period: ITaskProgressReportPeriod,
  today: string
): ITaskProgressReportRow {
  const entries = history.map((day) => ({
    ...day,
    baselineCount: day.baseline_count ?? undefined,
    goalPerDay: day.goal_per_day,
  }));
  const points = buildTaskProgressHistorySeries(entries, "all", today);
  const selected = points.filter(
    (point) => point.date >= period.start && point.date <= period.through
  );
  const completed = selected.reduce(
    (total, point) => total + point.completed,
    0
  );
  const incoming = selected.reduce((total, point) => total + point.incoming, 0);
  const expected = selected.reduce(
    (total, point) => total + Math.max(0, point.goalPerDay ?? 0),
    0
  );
  const goalDays = selected.filter((point) => (point.goalPerDay ?? 0) > 0);
  const goalDaysMet = goalDays.filter(
    (point) => point.completed >= (point.goalPerDay ?? 0)
  ).length;
  const last = selected[selected.length - 1];
  const previous = points.filter((point) => point.date < period.start).pop();
  const totalCompleted =
    last?.cumulativeCompleted ?? previous?.cumulativeCompleted ?? 0;
  const advanced = last
    ? taskProgressHistoryPercentages({
        completed,
        incoming,
        remaining: last.remaining,
        cumulativeCompleted: totalCompleted,
      }).periodProgressPercentage
    : 0;
  return {
    completed,
    totalCompleted,
    expected,
    goalDaysMet,
    goalDays: goalDays.length,
    advanced,
  };
}
