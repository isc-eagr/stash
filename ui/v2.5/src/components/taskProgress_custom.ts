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
