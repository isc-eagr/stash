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
}

export interface ITaskProgressHistoryPoint extends ITaskProgressHistoryEntry {
  completedAverage: number;
  cumulativeCompleted: number;
}

export type TaskProgressHistoryRange = 7 | 30 | "all";

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
    });
  });

  const sortedEntries = [...groupedEntries.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const [firstEntry] = sortedEntries;
  if (!firstEntry) return [];

  let { remaining } = firstEntry;
  let cumulativeCompleted = 0;
  const points: ITaskProgressHistoryPoint[] = [];
  for (
    let { date } = firstEntry;
    date <= today;
    date = addTaskProgressCalendarDays(date, 1)
  ) {
    const entry = groupedEntries.get(date);
    if (entry) remaining = entry.remaining;

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
      completedAverage,
      cumulativeCompleted,
    });
  }

  if (range === "all") return points;

  const requestedStart = addTaskProgressCalendarDays(today, -(range - 1));
  return points.filter((point) => point.date >= requestedStart);
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
  if (value instanceof Date) {
    return `${padTaskProgressDatePart(
      value.getDate()
    )}/${padTaskProgressDatePart(value.getMonth() + 1)}/${value.getFullYear()}`;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
