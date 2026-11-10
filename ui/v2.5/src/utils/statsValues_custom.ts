// CUSTOM: Data keys never depend on translated missing-value labels.
export const STATS_UNKNOWN_VALUE_CUSTOM = "__unknown__";
export function cleanStatsValueCustom(
  value?: string | null
): string | undefined {
  const trimmed = value?.trim();
  return !trimmed ||
    ["<nil>", "null", "unknown", STATS_UNKNOWN_VALUE_CUSTOM].includes(
      trimmed.toLowerCase()
    )
    ? undefined
    : trimmed;
}
export function statsCountCustom(value?: number | null): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
