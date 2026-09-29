const statsNameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

// Dashboard metrics can traverse markers or parse dates. Evaluate each once,
// and reuse one collator instead of creating one for every tied comparison.
export function rankStatsItems<T>(
  items: readonly T[],
  metricValue: (item: T) => number,
  label: (item: T) => string
): T[] {
  return items
    .map((item) => ({ item, value: metricValue(item), label: label(item) }))
    .sort(
      (a, b) => b.value - a.value || statsNameCollator.compare(a.label, b.label)
    )
    .map(({ item }) => item);
}
