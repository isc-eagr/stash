import type { SceneCardInsightMarker } from "./sceneCardInsightTypes_custom";

export type InsightInterval = {
  start: number;
  end: number;
};

export type MarkerStats = {
  duration: number;
  episodes: number;
  markerCount: number;
};

// A tiny marker should not establish a whole-scene activity or interaction claim.
export const minimumRuleEvidencePercent = 5;

export function markerInterval(
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

export function mergeIntervals(intervals: InsightInterval[]) {
  const sorted = [...intervals].sort(
    (a, b) => a.start - b.start || a.end - b.end
  );
  const merged: InsightInterval[] = [];

  sorted.forEach((interval) => {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
      return;
    }
    previous.end = Math.max(previous.end, interval.end);
  });

  return merged;
}

export function intervalDuration(intervals: InsightInterval[]) {
  return mergeIntervals(intervals).reduce(
    (total, interval) => total + interval.end - interval.start,
    0
  );
}

export function markerStats(
  markers: Iterable<SceneCardInsightMarker>,
  sceneDuration: number
): MarkerStats {
  const uniqueMarkers = new Map<string, SceneCardInsightMarker>();
  for (const marker of markers) uniqueMarkers.set(marker.id, marker);

  const timedIntervals: InsightInterval[] = [];
  let untimedEpisodes = 0;
  uniqueMarkers.forEach((marker) => {
    const interval = markerInterval(marker, sceneDuration);
    if (interval) timedIntervals.push(interval);
    else untimedEpisodes += 1;
  });
  const merged = mergeIntervals(timedIntervals);

  return {
    duration: intervalDuration(merged),
    episodes: merged.length + untimedEpisodes,
    markerCount: uniqueMarkers.size,
  };
}

export function overlapSeconds(a: InsightInterval, b: InsightInterval) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

export function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

function markerLabel(count: number) {
  return `${count} ${count === 1 ? "marker" : "markers"}`;
}

export function markerCoverageDetail(stats: MarkerStats) {
  return `${formatDuration(stats.duration)} (across ${markerLabel(
    stats.markerCount
  )})`;
}

export function percentOfScene(duration: number, sceneDuration: number) {
  return sceneDuration > 0
    ? Math.min(100, Math.max(0, (duration / sceneDuration) * 100))
    : 0;
}

export function hasMinimumRuleEvidence(
  markers: Iterable<SceneCardInsightMarker>,
  sceneDuration: number
) {
  return (
    percentOfScene(
      markerStats(markers, sceneDuration).duration,
      sceneDuration
    ) >= minimumRuleEvidencePercent
  );
}
