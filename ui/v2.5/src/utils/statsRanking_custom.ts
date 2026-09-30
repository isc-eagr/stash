const statsNameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

// Dashboard metrics can traverse markers or parse dates. Evaluate each once,
// and reuse one collator instead of creating one for every tied comparison.
// An optional tie-breaker (higher first) runs before the name.
export function rankStatsItems<T>(
  items: readonly T[],
  metricValue: (item: T) => number,
  label: (item: T) => string,
  tieBreaker?: (item: T) => number
): T[] {
  return items
    .map((item) => ({
      item,
      value: metricValue(item),
      tie: tieBreaker ? tieBreaker(item) : 0,
      label: label(item),
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        b.tie - a.tie ||
        statsNameCollator.compare(a.label, b.label)
    )
    .map(({ item }) => item);
}

// O Count ties go to whoever reached the count most recently.
export function mostRecentOTieBreaker(date?: string | null) {
  const timestamp = Date.parse(date ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}
