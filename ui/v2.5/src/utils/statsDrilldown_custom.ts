import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
export function formatStatsTotal(
  count: number,
  singular: string,
  plural: string
) {
  const noun = count === 1 ? singular : plural;
  return `Total: ${count.toLocaleString(getAppLocaleCustom())} ${noun}`;
}

export function formatStatsDrilldownTotal(
  count: number,
  overallCount: number,
  singular: string,
  plural: string
) {
  const noun = count === 1 ? singular : plural;
  return `Drilldown total: ${count.toLocaleString(
    getAppLocaleCustom()
  )} ${noun} · Overall: ${overallCount.toLocaleString(getAppLocaleCustom())}`;
}
