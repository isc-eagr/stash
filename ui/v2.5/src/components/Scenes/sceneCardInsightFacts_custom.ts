import { activityDurationCustom } from "src/utils/activityIntervals_custom";
import type { SceneCardInsightMarker } from "./sceneCardInsightTypes_custom";

type InsightInterval = {
  start: number;
  end: number;
};

function markerInterval(
  marker: SceneCardInsightMarker,
  sceneDuration: number
): InsightInterval | undefined {
  if (marker.end_seconds === null || marker.end_seconds === undefined) {
    return undefined;
  }

  const maximum = sceneDuration > 0 ? sceneDuration : Number.POSITIVE_INFINITY;
  const start = Math.max(0, Math.min(marker.seconds, maximum));
  const end = Math.max(0, Math.min(marker.end_seconds, maximum));
  return end > start ? { start, end } : undefined;
}

// Covered time counts overlapping markers once; untimed markers add none.
export function markerStats(
  markers: Iterable<SceneCardInsightMarker>,
  sceneDuration: number
) {
  const uniqueMarkers = new Map<string, SceneCardInsightMarker>();
  for (const marker of markers) uniqueMarkers.set(marker.id, marker);

  const intervals = Array.from(uniqueMarkers.values())
    .map((marker) => markerInterval(marker, sceneDuration))
    .filter((interval): interval is InsightInterval => !!interval);
  const duration = activityDurationCustom(intervals);

  return { duration, markerCount: uniqueMarkers.size };
}

export function percentOfScene(duration: number, sceneDuration: number) {
  return sceneDuration > 0
    ? Math.min(100, Math.max(0, (duration / sceneDuration) * 100))
    : 0;
}
