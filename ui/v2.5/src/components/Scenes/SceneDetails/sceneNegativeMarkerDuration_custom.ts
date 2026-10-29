import { activityDurationCustom } from "src/utils/activityIntervals_custom";

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

  return activityDurationCustom(intervals);
}
