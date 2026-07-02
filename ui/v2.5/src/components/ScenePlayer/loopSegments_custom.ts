import type { ILoopSegmentInput } from "./multi-segment-loop";

// CUSTOM: begin - multi-segment loop negative marker filtering
export interface INegativeLoopMarker {
  start_seconds: number;
  end_seconds: number;
}

interface ILoopInterval {
  start: number;
  end: number;
}

const minimumLoopSegmentSeconds = 0.001;

function normalizeLoopSegmentInterval(
  start: number,
  end: number
): ILoopInterval {
  const normalizedStart = Math.min(start, end);
  const normalizedEnd = Math.max(start, end);

  return {
    start: normalizedStart,
    end: normalizedEnd > normalizedStart ? normalizedEnd : normalizedStart + 1,
  };
}

function normalizeNegativeMarkerInterval(
  marker: INegativeLoopMarker
): ILoopInterval {
  return {
    start: Math.min(marker.start_seconds, marker.end_seconds),
    end: Math.max(marker.start_seconds, marker.end_seconds),
  };
}

function mergeLoopIntervals(intervals: ILoopInterval[]) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: ILoopInterval[] = [];

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged;
}

export function filterLoopSegmentsOutsideNegativeMarkers(
  segments: ILoopSegmentInput[],
  negativeMarkers?: INegativeLoopMarker[] | null
): ILoopSegmentInput[] {
  const blockers = mergeLoopIntervals(
    (negativeMarkers ?? [])
      .map(normalizeNegativeMarkerInterval)
      .filter((marker) => marker.end - marker.start > minimumLoopSegmentSeconds)
  );

  return segments.flatMap((segment) => {
    const normalized = normalizeLoopSegmentInterval(segment.start, segment.end);
    const normalizedSegment = {
      ...segment,
      start: normalized.start,
      end: normalized.end,
    };

    return blockers.reduce<ILoopSegmentInput[]>(
      (remainingSegments, blocker) =>
        remainingSegments.flatMap((remainingSegment) => {
          if (
            blocker.end <= remainingSegment.start ||
            blocker.start >= remainingSegment.end
          ) {
            return [remainingSegment];
          }

          const splitSegments: ILoopSegmentInput[] = [];
          if (blocker.start > remainingSegment.start) {
            splitSegments.push({
              ...remainingSegment,
              end: Math.min(blocker.start, remainingSegment.end),
            });
          }
          if (blocker.end < remainingSegment.end) {
            splitSegments.push({
              ...remainingSegment,
              start: Math.max(blocker.end, remainingSegment.start),
            });
          }

          return splitSegments.filter(
            (s) => s.end - s.start > minimumLoopSegmentSeconds
          );
        }),
      [normalizedSegment]
    );
  });
}
// CUSTOM: end
