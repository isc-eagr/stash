import { daysInMonth, statsRange } from "src/utils/statsBarChart_custom";

export type SceneStatsReleaseLevel = "year" | "month" | "day";

export type SceneStatsReleaseBucket = {
  key: string;
  value: number;
  count: number;
};

// Zero-fill the release chart so empty years, months, and days stay visible.
// Years span the first to last release year; months and days cover the whole
// selected year or month.
export function fillSceneStatsReleaseBuckets(
  counts: ReadonlyMap<number, number>,
  level: SceneStatsReleaseLevel,
  selectedYear?: number,
  selectedMonth?: number
): SceneStatsReleaseBucket[] {
  let values: number[];
  if (level === "year") {
    const years = Array.from(counts.keys());
    if (years.length === 0) return [];
    values = statsRange(Math.min(...years), Math.max(...years));
  } else if (level === "month") {
    values = statsRange(1, 12);
  } else {
    if (!selectedYear || !selectedMonth) return [];
    values = statsRange(1, daysInMonth(selectedYear, selectedMonth));
  }

  return values.map((value) => ({
    key:
      level === "year"
        ? String(value)
        : level === "month"
        ? `${selectedYear}-${value}`
        : `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
            value
          ).padStart(2, "0")}`,
    value,
    count: counts.get(value) ?? 0,
  }));
}
