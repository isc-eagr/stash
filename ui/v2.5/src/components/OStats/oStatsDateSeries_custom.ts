import { daysInMonth, statsRange } from "src/utils/statsBarChart_custom";

export type OStatsSeriesPoint = {
  value: number;
  count: number;
};

function fill(
  values: readonly number[],
  counts: ReadonlyArray<{ value: number; count: number }>
): OStatsSeriesPoint[] {
  const byValue = new Map(counts.map((item) => [item.value, item.count]));
  return values.map((value) => ({ value, count: byValue.get(value) ?? 0 }));
}

// Show only years with O events, in chronological order.
export function oStatsYears(
  counts: ReadonlyArray<{ year: number; count: number }>
) {
  return counts
    .filter((item) => item.count > 0)
    .map((item) => ({ value: item.year, count: item.count }))
    .sort((a, b) => a.value - b.value);
}

export function fillOStatsMonths(
  counts: ReadonlyArray<{ month: number; count: number }>
) {
  return fill(
    statsRange(1, 12),
    counts.map((item) => ({ value: item.month, count: item.count }))
  );
}

export function fillOStatsDays(
  year: number,
  month: number,
  counts: ReadonlyArray<{ day: number; count: number }>
) {
  return fill(
    statsRange(1, daysInMonth(year, month)),
    counts.map((item) => ({ value: item.day, count: item.count }))
  );
}
