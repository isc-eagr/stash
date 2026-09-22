export interface IProgressTracker {
  id: string;
  title: string;
  description: string;
  goal: number;
  tagId: string;
  tagName: string;
  isWorkingOn: boolean;
  startedOn: string;
}

export interface ITagItemCounts {
  scene_count: number;
  scene_marker_count: number;
  image_count: number;
  gallery_count: number;
  performer_count: number;
  studio_count: number;
  group_count: number;
}

export interface ITaskProgressHistoryEntry {
  date: string;
  completed: number;
  incoming: number;
  remaining: number;
  baselineCount?: number;
  goalPerDay?: number | null;
}

export interface ITaskProgressHistoryPoint extends ITaskProgressHistoryEntry {
  completedAverage: number;
  cumulativeCompleted: number;
}

export interface ITaskProgressHistoryPercentages {
  completedPercentage: number;
  remainingPercentage: number;
  periodProgressPercentage: number;
}

export type TaskProgressHistoryRange = 7 | 30 | "all";
export type TaskProgressHistoryGranularity = "day" | "week" | "month";

export function getTagItemCount(tag: ITagItemCounts): number {
  return (
    tag.scene_count +
    tag.scene_marker_count +
    tag.image_count +
    tag.gallery_count +
    tag.performer_count +
    tag.studio_count +
    tag.group_count
  );
}

export function reorderProgressTrackers(
  trackers: IProgressTracker[],
  draggedId: string,
  targetId: string
): IProgressTracker[] {
  const fromIndex = trackers.findIndex((tracker) => tracker.id === draggedId);
  const toIndex = trackers.findIndex((tracker) => tracker.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return trackers;

  const reordered = [...trackers];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

export function toggleProgressTrackerWorkingOn(
  trackers: IProgressTracker[],
  trackerId: string
): IProgressTracker[] {
  return trackers.map((tracker) =>
    tracker.id === trackerId
      ? { ...tracker, isWorkingOn: !tracker.isWorkingOn }
      : tracker
  );
}

export function getTrackerProgress(goal: number, currentCount: number) {
  const safeGoal = Math.max(goal, 0);
  const remaining = Math.max(currentCount, 0);
  const done = Math.max(safeGoal - remaining, 0);
  const percentage =
    safeGoal === 0
      ? remaining === 0
        ? 100
        : 0
      : Math.min((done / safeGoal) * 100, 100);

  return { done, remaining, percentage };
}

function parseTaskProgressCalendarDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return undefined;
  }

  return parsed;
}

function formatTaskProgressCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function currentTaskProgressCalendarDate(): string {
  const current = new Date();
  return `${current.getFullYear()}-${padTaskProgressDatePart(
    current.getMonth() + 1
  )}-${padTaskProgressDatePart(current.getDate())}`;
}

function addTaskProgressCalendarDays(value: string, days: number): string {
  const parsed = parseTaskProgressCalendarDate(value);
  if (!parsed) return value;

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatTaskProgressCalendarDate(parsed);
}

function safeTaskProgressHistoryCount(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function taskProgressCompletionPercentage(
  completed: number,
  remaining: number
): number {
  const total = completed + remaining;
  return total === 0 ? 100 : Math.min(100, (completed / total) * 100);
}

/**
 * Reconstructs the progress immediately before a point's activity so daily,
 * weekly, and monthly buckets can report their percentage-point contribution.
 */
export function taskProgressHistoryPercentages(
  point: Pick<
    ITaskProgressHistoryPoint,
    "completed" | "incoming" | "remaining" | "cumulativeCompleted"
  >
): ITaskProgressHistoryPercentages {
  const completed = safeTaskProgressHistoryCount(point.cumulativeCompleted);
  const remaining = safeTaskProgressHistoryCount(point.remaining);
  const periodCompleted = safeTaskProgressHistoryCount(point.completed);
  const periodIncoming = safeTaskProgressHistoryCount(point.incoming);
  const previousCompleted = Math.max(0, completed - periodCompleted);
  const previousRemaining = Math.max(
    0,
    remaining + periodCompleted - periodIncoming
  );
  const completedPercentage = taskProgressCompletionPercentage(
    completed,
    remaining
  );

  return {
    completedPercentage,
    remainingPercentage:
      completed + remaining === 0 ? 0 : 100 - completedPercentage,
    periodProgressPercentage:
      completedPercentage -
      taskProgressCompletionPercentage(previousCompleted, previousRemaining),
  };
}

/**
 * Produces one point per calendar day and carries the last remaining count
 * through days without activity. Calendar dates are handled in UTC so a
 * browser timezone cannot shift a recorded day.
 */
export function buildTaskProgressHistorySeries(
  entries: readonly ITaskProgressHistoryEntry[],
  range: TaskProgressHistoryRange,
  today: string = currentTaskProgressCalendarDate()
): ITaskProgressHistoryPoint[] {
  const parsedToday = parseTaskProgressCalendarDate(today);
  if (!parsedToday) return [];

  const groupedEntries = new Map<string, ITaskProgressHistoryEntry>();
  entries.forEach((entry) => {
    if (!parseTaskProgressCalendarDate(entry.date) || entry.date > today) {
      return;
    }

    const existing = groupedEntries.get(entry.date);
    groupedEntries.set(entry.date, {
      date: entry.date,
      completed:
        (existing?.completed ?? 0) +
        safeTaskProgressHistoryCount(entry.completed),
      incoming:
        (existing?.incoming ?? 0) +
        safeTaskProgressHistoryCount(entry.incoming),
      remaining: safeTaskProgressHistoryCount(entry.remaining),
      baselineCount:
        entry.baselineCount === undefined
          ? existing?.baselineCount
          : safeTaskProgressHistoryCount(entry.baselineCount),
      goalPerDay:
        entry.goalPerDay === undefined
          ? existing?.goalPerDay
          : entry.goalPerDay && entry.goalPerDay > 0
          ? entry.goalPerDay
          : null,
    });
  });

  const sortedEntries = [...groupedEntries.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const [firstEntry] = sortedEntries;
  if (!firstEntry) return [];

  let { remaining } = firstEntry;
  let { goalPerDay } = firstEntry;
  let cumulativeCompleted = 0;
  const points: ITaskProgressHistoryPoint[] = [];
  for (
    let { date } = firstEntry;
    date <= today;
    date = addTaskProgressCalendarDays(date, 1)
  ) {
    const entry = groupedEntries.get(date);
    if (entry) {
      remaining = entry.remaining;
      if (entry.goalPerDay !== undefined) goalPerDay = entry.goalPerDay;
    }

    const completed = entry?.completed ?? 0;
    const incoming = entry?.incoming ?? 0;
    cumulativeCompleted += completed;
    const rollingStart = Math.max(points.length - 6, 0);
    const recentCompleted = points
      .slice(rollingStart)
      .reduce((total, point) => total + point.completed, completed);
    const completedAverage =
      recentCompleted / (points.length - rollingStart + 1);

    points.push({
      date,
      completed,
      incoming,
      remaining,
      baselineCount: entry?.baselineCount,
      ...(goalPerDay !== undefined ? { goalPerDay } : {}),
      completedAverage,
      cumulativeCompleted,
    });
  }

  if (range === "all") return points;

  const requestedStart = addTaskProgressCalendarDays(today, -(range - 1));
  return points.filter((point) => point.date >= requestedStart);
}

function taskProgressPeriodStart(
  date: string,
  granularity: TaskProgressHistoryGranularity
): string {
  if (granularity === "day") return date;
  const parsed = parseTaskProgressCalendarDate(date);
  if (!parsed) return date;
  if (granularity === "month") {
    parsed.setUTCDate(1);
  } else {
    const mondayOffset = (parsed.getUTCDay() + 6) % 7;
    parsed.setUTCDate(parsed.getUTCDate() - mondayOffset);
  }
  return formatTaskProgressCalendarDate(parsed);
}

export function aggregateTaskProgressHistorySeries(
  points: readonly ITaskProgressHistoryPoint[],
  granularity: TaskProgressHistoryGranularity
): ITaskProgressHistoryPoint[] {
  if (granularity === "day") return [...points];

  const grouped = new Map<string, ITaskProgressHistoryPoint[]>();
  points.forEach((point) => {
    const key = taskProgressPeriodStart(point.date, granularity);
    grouped.set(key, [...(grouped.get(key) ?? []), point]);
  });

  const result: ITaskProgressHistoryPoint[] = [];
  grouped.forEach((periodPoints, date) => {
    const last = periodPoints[periodPoints.length - 1];
    const completed = periodPoints.reduce(
      (total, point) => total + point.completed,
      0
    );
    const incoming = periodPoints.reduce(
      (total, point) => total + point.incoming,
      0
    );
    const goal = periodPoints.reduce(
      (total, point) => total + Math.max(0, point.goalPerDay ?? 0),
      0
    );
    const baseline = [...periodPoints]
      .reverse()
      .find((point) => point.baselineCount !== undefined)?.baselineCount;
    const rollingStart = Math.max(result.length - 6, 0);
    const rollingCompleted = result
      .slice(rollingStart)
      .reduce((total, point) => total + point.completed, completed);

    result.push({
      date,
      completed,
      incoming,
      remaining: last.remaining,
      baselineCount: baseline,
      goalPerDay: goal > 0 ? goal : null,
      completedAverage: rollingCompleted / (result.length - rollingStart + 1),
      cumulativeCompleted: last.cumulativeCompleted,
    });
  });
  return result;
}

export interface ITaskProgressGoalPeriod {
  completed: number;
  goal: number;
  start: string;
  end: string;
}

export function taskProgressCurrentGoalPeriods(
  entries: readonly ITaskProgressHistoryEntry[],
  currentGoalPerDay: number | null | undefined,
  today: string = currentTaskProgressCalendarDate()
): Record<"day" | "week" | "month", ITaskProgressGoalPeriod> {
  const points = buildTaskProgressHistorySeries(entries, "all", today);
  const byDate = new Map(points.map((point) => [point.date, point]));
  const completedFor = (start: string, end: string) =>
    points
      .filter((point) => point.date >= start && point.date <= end)
      .reduce((total, point) => total + point.completed, 0);
  const goalFor = (start: string, end: string) => {
    let goal = 0;
    for (
      let date = start;
      date <= end;
      date = addTaskProgressCalendarDays(date, 1)
    ) {
      goal += Math.max(
        0,
        byDate.get(date)?.goalPerDay ??
          (date === today ? currentGoalPerDay ?? 0 : 0)
      );
    }
    return goal;
  };
  const period = (granularity: "week" | "month"): ITaskProgressGoalPeriod => {
    const start = taskProgressPeriodStart(today, granularity);
    return {
      completed: completedFor(start, today),
      goal: goalFor(start, today),
      start,
      end: today,
    };
  };
  const todayPoint = byDate.get(today);
  return {
    day: {
      completed: todayPoint?.completed ?? 0,
      goal: Math.max(0, todayPoint?.goalPerDay ?? currentGoalPerDay ?? 0),
      start: today,
      end: today,
    },
    week: period("week"),
    month: period("month"),
  };
}

export function taskProgressCurrentPercentageChanges(
  entries: readonly ITaskProgressHistoryEntry[],
  today: string = currentTaskProgressCalendarDate()
): Record<TaskProgressHistoryGranularity, number> {
  const points = buildTaskProgressHistorySeries(entries, "all", today);
  const changeFor = (granularity: TaskProgressHistoryGranularity) => {
    const periods = aggregateTaskProgressHistorySeries(points, granularity);
    const current = periods[periods.length - 1];
    if (
      !current ||
      current.date !== taskProgressPeriodStart(today, granularity)
    ) {
      return 0;
    }

    return taskProgressHistoryPercentages(current).periodProgressPercentage;
  };

  return {
    day: changeFor("day"),
    week: changeFor("week"),
    month: changeFor("month"),
  };
}

export function filterTaskProgressHistoryActivityPoints(
  points: readonly ITaskProgressHistoryPoint[]
): ITaskProgressHistoryPoint[] {
  return points.filter((point) => point.completed > 0 || point.incoming > 0);
}

function padTaskProgressDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

export function parseTaskProgressDate(value: string): string | undefined {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;

  const [, day, month, year] = match;
  const parsed = new Date(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10)
  );
  if (
    parsed.getFullYear() !== Number.parseInt(year, 10) ||
    parsed.getMonth() !== Number.parseInt(month, 10) - 1 ||
    parsed.getDate() !== Number.parseInt(day, 10)
  ) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

export function formatTaskProgressDate(value: string | Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (value instanceof Date) {
    return `${padTaskProgressDatePart(value.getDate())}-${
      months[value.getMonth()]
    }-${value.getFullYear()}`;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}-${months[Number(month) - 1]}-${year}`;
}
