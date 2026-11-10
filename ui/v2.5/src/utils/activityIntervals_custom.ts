// CUSTOM: Union, subtraction and intersection shared by every scene activity view.
export type ActivityIntervalCustom = { start: number; end: number };

export function mergeActivityIntervalsCustom(
  intervals: ActivityIntervalCustom[]
): ActivityIntervalCustom[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: ActivityIntervalCustom[] = [];

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

export function subtractActivityIntervalsCustom(
  intervals: ActivityIntervalCustom[],
  subtractIntervals: ActivityIntervalCustom[]
): ActivityIntervalCustom[] {
  const blockers = mergeActivityIntervalsCustom(subtractIntervals);

  return mergeActivityIntervalsCustom(intervals).flatMap((interval) => {
    let cursor = interval.start;
    const remaining: ActivityIntervalCustom[] = [];

    blockers.forEach((blocker) => {
      if (blocker.end <= cursor || blocker.start >= interval.end) return;

      if (blocker.start > cursor) {
        remaining.push({
          start: cursor,
          end: Math.min(blocker.start, interval.end),
        });
      }
      cursor = Math.max(cursor, blocker.end);
    });

    if (cursor < interval.end) {
      remaining.push({ start: cursor, end: interval.end });
    }

    return remaining;
  });
}

export function intersectActivityIntervalsCustom(
  firstIntervals: ActivityIntervalCustom[],
  secondIntervals: ActivityIntervalCustom[]
) {
  const first = mergeActivityIntervalsCustom(firstIntervals);
  const second = mergeActivityIntervalsCustom(secondIntervals);
  const intersections: ActivityIntervalCustom[] = [];
  let firstIndex = 0;
  let secondIndex = 0;

  while (firstIndex < first.length && secondIndex < second.length) {
    const start = Math.max(first[firstIndex].start, second[secondIndex].start);
    const end = Math.min(first[firstIndex].end, second[secondIndex].end);
    if (end > start) intersections.push({ start, end });

    if (first[firstIndex].end < second[secondIndex].end) {
      firstIndex += 1;
    } else {
      secondIndex += 1;
    }
  }

  return intersections;
}

export function activityDurationCustom(intervals: ActivityIntervalCustom[]) {
  return mergeActivityIntervalsCustom(intervals).reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0
  );
}
