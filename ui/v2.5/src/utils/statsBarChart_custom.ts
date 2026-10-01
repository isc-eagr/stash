export type StatsBarSort = "natural" | "count";

export function formatStatsBarPercent(count: number, total: number) {
  if (total <= 0 || count <= 0) return "0%";
  const percent = (count / total) * 100;
  if (percent < 1) return "<1%";
  return `${percent.toLocaleString(undefined, {
    maximumFractionDigits: percent < 10 ? 1 : 0,
  })}%`;
}

// "natural" keeps the caller's order (chronological, numeric, or tiered);
// "count" puts the largest bars first and breaks ties by label.
export function sortStatsBarData<T extends { count: number; label: string }>(
  data: readonly T[],
  sort: StatsBarSort
): T[] {
  if (sort === "natural") return [...data];
  return [...data].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

export function statsRange(start: number, end: number) {
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
