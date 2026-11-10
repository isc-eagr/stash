export type MarkerPlaylistDirectionCustom = 1 | -1;

// The next marker in `direction` that has not failed to load, wrapping around
// the playlist. Undefined when every other marker has failed.
export function getMarkerPlaylistStepIndexCustom(
  count: number,
  from: number,
  direction: MarkerPlaylistDirectionCustom,
  isFailed: (index: number) => boolean
): number | undefined {
  for (let offset = 1; offset <= count; offset += 1) {
    const index = (((from + direction * offset) % count) + count) % count;
    if (!isFailed(index)) return index;
  }
  return undefined;
}

// The index that keeps playing after the marker at `removed` is deleted.
export function followRemovedIndexCustom(
  index: number,
  removed: number,
  remainingCount: number
): number {
  if (index > removed) return index - 1;
  if (index === removed)
    return Math.max(0, Math.min(index, remainingCount - 1));
  return index;
}

const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_DURATION_MS = 600;

// A quick, mostly horizontal swipe: left plays the next marker, right the
// previous one.
export function getMarkerPlayerSwipeDirectionCustom(
  dx: number,
  dy: number,
  durationMs: number
): MarkerPlaylistDirectionCustom | undefined {
  if (durationMs > SWIPE_MAX_DURATION_MS) return undefined;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return undefined;
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return undefined;
  return dx < 0 ? 1 : -1;
}
