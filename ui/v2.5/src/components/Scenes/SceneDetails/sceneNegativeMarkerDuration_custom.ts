export interface ISceneNegativeMarkerTimeRange {
  start_seconds: number;
  end_seconds: number;
}

/**
 * Returns the unique video time covered by negative markers.
 *
 * Negative markers can overlap, so their durations are merged before they
 * are summed. When a video duration is available, ranges are bounded to it.
 */
export function getSceneNegativeMarkerTotalDuration(
  markers: readonly ISceneNegativeMarkerTimeRange[],
  sceneDuration?: number
) {
  const maximum =
    sceneDuration !== undefined &&
    Number.isFinite(sceneDuration) &&
    sceneDuration > 0
      ? sceneDuration
      : Number.POSITIVE_INFINITY;

  const intervals = markers.flatMap((marker) => {
    if (
      !Number.isFinite(marker.start_seconds) ||
      !Number.isFinite(marker.end_seconds)
    ) {
      return [];
    }

    const start = Math.max(0, Math.min(marker.start_seconds, maximum));
    const end = Math.max(0, Math.min(marker.end_seconds, maximum));
    return end > start ? [{ start, end }] : [];
  });

  intervals.sort((a, b) => a.start - b.start || a.end - b.end);

  let total = 0;
  let current = intervals[0];

  for (const interval of intervals.slice(1)) {
    if (!current) {
      current = interval;
      continue;
    }

    if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
      continue;
    }

    total += current.end - current.start;
    current = interval;
  }

  return total + (current ? current.end - current.start : 0);
}
