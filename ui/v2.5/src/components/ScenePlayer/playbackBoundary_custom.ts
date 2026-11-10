import { mergeActivityIntervalsCustom } from "src/utils/activityIntervals_custom";

// CUSTOM: begin - precise scene-player playback boundary helpers
export const PLAYBACK_BOUNDARY_TOLERANCE_SECONDS = 0.004;

export interface IPlaybackRange {
  start: number;
  end: number;
}

export function getPlaybackBoundaryDelayMs(
  currentTime: number,
  boundaryTime: number,
  playbackRate: number
): number {
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(boundaryTime) ||
    !Number.isFinite(playbackRate) ||
    playbackRate <= 0
  ) {
    return 0;
  }

  return Math.max(0, ((boundaryTime - currentTime) / playbackRate) * 1000);
}

export function isPlaybackBoundaryDue(
  currentTime: number,
  boundaryTime: number
): boolean {
  return (
    Number.isFinite(currentTime) &&
    Number.isFinite(boundaryTime) &&
    currentTime >= boundaryTime - PLAYBACK_BOUNDARY_TOLERANCE_SECONDS
  );
}

export function mergePlaybackRanges(
  ranges: readonly IPlaybackRange[]
): IPlaybackRange[] {
  return mergeActivityIntervalsCustom(
    ranges.filter(
      ({ start, end }) =>
        Number.isFinite(start) && Number.isFinite(end) && end > start
    )
  );
}

export function findContainingOrNextPlaybackRange(
  ranges: readonly IPlaybackRange[],
  currentTime: number
): IPlaybackRange | undefined {
  return ranges.find((range) => currentTime < range.end);
}
// CUSTOM: end
