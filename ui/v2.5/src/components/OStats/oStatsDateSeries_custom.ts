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

// Years span the first to last year with an O, so a quiet year shows as zero.
export function fillOStatsYears(
  counts: ReadonlyArray<{ year: number; count: number }>
) {
  if (counts.length === 0) return [];
  const years = counts.map((item) => item.year);
  return fill(
    statsRange(Math.min(...years), Math.max(...years)),
    counts.map((item) => ({ value: item.year, count: item.count }))
  );
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
