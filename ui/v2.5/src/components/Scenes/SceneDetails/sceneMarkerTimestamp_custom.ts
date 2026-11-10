// CUSTOM: Keep new marker drafts aligned with the millisecond precision used by
// marker timestamp inputs and persisted marker boundaries.
export function toMarkerMilliseconds(seconds: number | undefined): number {
  return Math.round((seconds ?? 0) * 1000) / 1000;
}

export function formatSceneMarkerDuration(seconds: number): string {
  const milliseconds = Math.round(Math.abs(seconds) * 1000);
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const remainingSeconds = (milliseconds % 60000) / 1000;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds}s`);
  }
  return parts.join(" ");
}
