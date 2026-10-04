import { daysInMonth, statsRange } from "src/utils/statsBarChart_custom";

export type SceneStatsReleaseLevel = "year" | "month" | "day";

export type SceneStatsReleaseBucket = {
  key: string;
  value: number;
  count: number;
};

// Years show only populated buckets; months and days cover the whole
// selected year or month, including empty periods.
export function fillSceneStatsReleaseBuckets(
  counts: ReadonlyMap<number, number>,
  level: SceneStatsReleaseLevel,
  selectedYear?: number,
  selectedMonth?: number
): SceneStatsReleaseBucket[] {
  let values: number[];
  if (level === "year") {
    values = Array.from(counts.keys())
      .filter((year) => (counts.get(year) ?? 0) > 0)
      .sort((a, b) => a - b);
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
