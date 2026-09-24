export function isReleaseMarkerSeekableCustom(
  seconds: number,
  duration?: number | null
): boolean {
  return (
    Number.isFinite(seconds) &&
    seconds >= 0 &&
    (duration == null || seconds <= duration)
  );
}
