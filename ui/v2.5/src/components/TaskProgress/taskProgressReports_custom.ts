import {
  buildTaskProgressHistorySeries,
  taskProgressHistoryPercentages,
} from "../taskProgress_custom";

export type TaskProgressReportRange = "day" | "week" | "month" | "year";

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
  activeDays: number;
  elapsedDays: number;
}

export interface ITaskProgressReportDay {
  date: string;
  completed: number;
  goal: number;
  future: boolean;
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

function addDays(date: string, days: number): string {
  const value = dateAtUTC(date);
  value.setUTCDate(value.getUTCDate() + days);
  return dateKey(value);
}

function daysBetween(start: string, end: string): number {
  return Math.round(
    (dateAtUTC(end).getTime() - dateAtUTC(start).getTime()) / 86400000
  );
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
  } else if (range === "year") {
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
  if (range === "day") date.setUTCDate(date.getUTCDate() + offset);
  else if (range === "week") date.setUTCDate(date.getUTCDate() + offset * 7);
  else if (range === "month") {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + offset);
  } else date.setUTCFullYear(date.getUTCFullYear() + offset, 0, 1);
  return dateKey(date);
}

/**
 * The period before `period`. While `period` is still running, the previous
 * period is cut to the same number of elapsed days so totals compare fairly.
 */
export function previousTaskProgressReportPeriod(
  range: TaskProgressReportRange,
  period: ITaskProgressReportPeriod,
  today: string
): ITaskProgressReportPeriod {
  const previous = taskProgressReportPeriod(
    range,
    shiftTaskProgressReportPeriod(range, period.start, -1),
    today
  );
  if (period.through >= period.end) return previous;
  const through = addDays(
    previous.start,
    daysBetween(period.start, period.through)
  );
  return {
    ...previous,
    through: through < previous.end ? through : previous.end,
  };
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
    activeDays: selected.filter((point) => point.completed > 0).length,
    elapsedDays: Math.max(0, daysBetween(period.start, period.through) + 1),
  };
}

export type TaskProgressComparisonPeriod = "day" | "week" | "month";

export interface ITaskProgressPeriodComparison {
  current: ITaskProgressReportRow;
  previous: ITaskProgressReportRow;
  label: string;
}

/**
 * Today, this week, and this month next to yesterday and the previous
 * week/month. Running periods compare against the same elapsed days.
 */
export function taskProgressPeriodComparisons(
  history: readonly ITaskProgressReportHistoryDay[],
  today: string
): Record<TaskProgressComparisonPeriod, ITaskProgressPeriodComparison> {
  const yesterday = addDays(today, -1);
  const period = (range: "week" | "month"): ITaskProgressPeriodComparison => {
    const current = taskProgressReportPeriod(range, today, today);
    return {
      current: taskProgressReportRow(history, current, today),
      previous: taskProgressReportRow(
        history,
        previousTaskProgressReportPeriod(range, current, today),
        today
      ),
      label: taskProgressComparisonLabel(range, current),
    };
  };
  return {
    day: {
      current: taskProgressReportRow(
        history,
        { start: today, end: today, through: today },
        today
      ),
      previous: taskProgressReportRow(
        history,
        { start: yesterday, end: yesterday, through: yesterday },
        today
      ),
      label: "vs yesterday",
    },
    week: period("week"),
    month: period("month"),
  };
}

/** Untranslated "vs ..." label for a report period. */
export function taskProgressComparisonLabel(
  range: TaskProgressReportRange,
  period: ITaskProgressReportPeriod
): string {
  if (range === "day") return "vs yesterday";
  return `vs ${period.through < period.end ? "same point " : ""}last ${range}`;
}

/** Seven daily points ending on the selected report date, without later activity. */
export function taskProgressReportTrendDays(
  history: readonly ITaskProgressReportHistoryDay[],
  anchor: string,
  today: string
): ITaskProgressReportDay[] {
  return taskProgressReportDays(
    history,
    { start: addDays(anchor, -6), end: anchor, through: anchor },
    today
  );
}

/** One entry per calendar day of the period; days after `through` are future. */
export function taskProgressReportDays(
  history: readonly ITaskProgressReportHistoryDay[],
  period: ITaskProgressReportPeriod,
  today: string
): ITaskProgressReportDay[] {
  const points = new Map(
    buildTaskProgressHistorySeries(
      history.map((day) => ({ ...day, goalPerDay: day.goal_per_day })),
      "all",
      today
    ).map((point) => [point.date, point])
  );
  const days: ITaskProgressReportDay[] = [];
  for (let date = period.start; date <= period.end; date = addDays(date, 1)) {
    const point = points.get(date);
    days.push({
      date,
      completed: point?.completed ?? 0,
      goal: Math.max(0, point?.goalPerDay ?? 0),
      future: date > period.through,
    });
  }
  return days;
}

/** Completions per calendar month (index 0 is January) for a yearly report. */
export function taskProgressReportMonths(
  days: readonly ITaskProgressReportDay[]
): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  days.forEach((day) => {
    months[Number(day.date.slice(5, 7)) - 1] += day.completed;
  });
  return months;
}

/**
 * Splits days into Monday-first weeks for calendar and heatmap grids. Slots
 * before the first day and after the last day are undefined.
 */
export function taskProgressReportWeeks<T extends { date: string }>(
  days: readonly T[]
): (T | undefined)[][] {
  if (!days.length) return [];
  const leading = (dateAtUTC(days[0].date).getUTCDay() + 6) % 7;
  const slots: (T | undefined)[] = [
    ...Array.from({ length: leading }, () => undefined),
    ...days,
  ];
  while (slots.length % 7) slots.push(undefined);
  return Array.from({ length: slots.length / 7 }, (_, week) =>
    slots.slice(week * 7, week * 7 + 7)
  );
}

/**
 * Heat level 0–4. Days with a goal scale against it, so meeting the goal is
 * the darkest shade; other days scale against the busiest day shown.
 */
export function taskProgressActivityLevel(
  day: Pick<ITaskProgressReportDay, "completed" | "goal">,
  max: number
) {
  const scale = day.goal > 0 ? day.goal : max;
  if (day.completed <= 0 || scale <= 0) return 0;
  return Math.min(4, Math.ceil((day.completed / scale) * 4));
}
