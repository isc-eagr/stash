export function formatStatsTotal(
  count: number,
  singular: string,
  plural: string
) {
  const noun = count === 1 ? singular : plural;
  return `Total: ${count.toLocaleString()} ${noun}`;
}

export function formatStatsDrilldownTotal(
  count: number,
  overallCount: number,
  singular: string,
  plural: string
) {
  const noun = count === 1 ? singular : plural;
  return `Drilldown total: ${count.toLocaleString()} ${noun} · Overall: ${overallCount.toLocaleString()}`;
}
