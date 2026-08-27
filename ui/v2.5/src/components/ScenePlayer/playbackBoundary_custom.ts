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
  const sortedRanges = ranges
    .filter(
      ({ start, end }) =>
        Number.isFinite(start) && Number.isFinite(end) && end > start
    )
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const mergedRanges: IPlaybackRange[] = [];

  for (const range of sortedRanges) {
    const previous = mergedRanges[mergedRanges.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      mergedRanges.push(range);
    }
  }

  return mergedRanges;
}

export function findContainingOrNextPlaybackRange(
  ranges: readonly IPlaybackRange[],
  currentTime: number
): IPlaybackRange | undefined {
  return ranges.find((range) => currentTime < range.end);
}
// CUSTOM: end
