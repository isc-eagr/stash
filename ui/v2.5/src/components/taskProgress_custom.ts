export interface IProgressTracker {
  id: string;
  title: string;
  description: string;
  goal: number;
  tagId: string;
  tagName: string;
  isWorkingOn: boolean;
}

interface ILegacyProgressTracker {
  id?: unknown;
  name?: unknown;
  initialValue?: unknown;
  tagId?: unknown;
  tagName?: unknown;
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

export function normalizeProgressTrackers(value: unknown): IProgressTracker[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((stored): IProgressTracker | undefined => {
      if (!stored || typeof stored !== "object") return undefined;

      const tracker = stored as Partial<IProgressTracker> &
        ILegacyProgressTracker;
      const id = stringValue(tracker.id);
      const tagId = stringValue(tracker.tagId);
      if (!id || !tagId) return undefined;

      return {
        id,
        title: stringValue(tracker.title) || stringValue(tracker.name),
        description: stringValue(tracker.description),
        goal: nonNegativeNumber(tracker.goal ?? tracker.initialValue),
        tagId,
        tagName: stringValue(tracker.tagName),
        isWorkingOn: tracker.isWorkingOn === true,
      };
    })
    .filter((tracker): tracker is IProgressTracker => !!tracker);
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
