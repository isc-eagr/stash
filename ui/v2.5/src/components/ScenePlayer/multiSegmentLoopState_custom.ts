// CUSTOM: pure multi-segment loop rules shared by the plugin and its tests.

interface ILoopRange {
  id: string;
  start: number;
  end: number;
}

// A seek can land a few frames before the requested segment start.
export const LOOP_SEGMENT_START_TOLERANCE_SECONDS = 0.05;
export const MIN_LOOP_SEGMENT_SECONDS = 0.1;

export type LoopSegmentEdge = "start" | "end";

export function loopSegmentContainsTime(
  segment: Pick<ILoopRange, "start" | "end">,
  time: number
): boolean {
  return (
    time >= segment.start - LOOP_SEGMENT_START_TOLERANCE_SECONDS &&
    time < segment.end
  );
}

/** Finds the segment under the playhead, searching from `fromIndex` in loop order. */
export function findLoopSegmentIndexAtTime(
  segments: readonly ILoopRange[],
  time: number,
  fromIndex: number,
  allowedIds: readonly string[] = []
): number {
  for (let offset = 0; offset < segments.length; offset++) {
    const index = (fromIndex + offset) % segments.length;
    const segment = segments[index];
    if (allowedIds.length && !allowedIds.includes(segment.id)) continue;
    if (loopSegmentContainsTime(segment, time)) return index;
  }
  return -1;
}

/**
 * Keeps the playhead when it is already inside a segment; otherwise starts at
 * the next segment by time, then wraps to the first.
 */
export function loopSegmentIndexForEnable(
  segments: readonly ILoopRange[],
  time: number,
  currentIndex: number
): { index: number; seek: boolean } {
  const containing = findLoopSegmentIndexAtTime(
    segments,
    time,
    Math.min(Math.max(currentIndex, 0), Math.max(segments.length - 1, 0))
  );
  if (containing >= 0) return { index: containing, seek: false };

  let upcoming = -1;
  segments.forEach((segment, index) => {
    if (
      segment.start > time &&
      (upcoming < 0 || segment.start < segments[upcoming].start)
    ) {
      upcoming = index;
    }
  });
  return { index: Math.max(upcoming, 0), seek: true };
}

/** Keeps the current segment selected, or moves to the next surviving one. */
export function loopSegmentIndexAfterRemoval(
  before: readonly Pick<ILoopRange, "id">[],
  currentIndex: number,
  removedIds: ReadonlySet<string>
): number {
  const remaining = before.filter((segment) => !removedIds.has(segment.id));
  if (!remaining.length) return 0;

  for (let offset = 0; offset < before.length; offset++) {
    const candidate = before[(currentIndex + offset) % before.length];
    if (candidate && !removedIds.has(candidate.id)) {
      return remaining.indexOf(candidate);
    }
  }
  return 0;
}

export function nudgedLoopSegmentBounds(
  segment: Pick<ILoopRange, "start" | "end">,
  edge: LoopSegmentEdge,
  deltaSeconds: number,
  duration: number
): { start: number; end: number } {
  const maxEnd =
    Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  if (edge === "start") {
    return {
      start: Math.max(
        0,
        Math.min(
          segment.end - MIN_LOOP_SEGMENT_SECONDS,
          segment.start + deltaSeconds
        )
      ),
      end: segment.end,
    };
  }
  return {
    start: segment.start,
    end: Math.min(
      maxEnd,
      Math.max(
        segment.start + MIN_LOOP_SEGMENT_SECONDS,
        segment.end + deltaSeconds
      )
    ),
  };
}

export function loopSegmentsMatch(
  a: readonly Pick<ILoopRange, "start" | "end">[],
  b: readonly Pick<ILoopRange, "start" | "end">[]
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (segment, index) =>
        Math.abs(segment.start - b[index].start) < 0.001 &&
        Math.abs(segment.end - b[index].end) < 0.001
    )
  );
}

/** Name of the saved preset whose segments match the current loop, if any. */
export function matchingLoopPresetName(
  segments: readonly Pick<ILoopRange, "start" | "end">[],
  presets: readonly {
    name: string;
    segments: readonly Pick<ILoopRange, "start" | "end">[];
  }[]
): string | undefined {
  if (!segments.length) return undefined;
  return presets.find((preset) => loopSegmentsMatch(segments, preset.segments))
    ?.name;
}
