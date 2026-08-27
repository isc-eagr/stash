// CUSTOM: Keep new marker drafts aligned with the millisecond precision used by
// marker timestamp inputs and persisted marker boundaries.
export function toMarkerMilliseconds(seconds: number | undefined): number {
  return Math.round((seconds ?? 0) * 1000) / 1000;
}
