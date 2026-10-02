export const O_STATS_LATEST_COUNT_CUSTOM = 5;
export const O_STATS_TIMELINE_PAGE_SIZE_CUSTOM = 25;
export const O_STATS_TIMELINE_PATH_CUSTOM = "/ostats/timeline";

export function oStatsTimelinePageCustom(search: string) {
  const value = Number(new URLSearchParams(search).get("page"));
  return Number.isInteger(value) && value > 0 && value <= 2147483647
    ? value
    : 1;
}

export function oStatsTimelineSearchCustom(search: string, page: number) {
  const params = new URLSearchParams(search);
  params.delete("page");
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function oStatsTimelinePageURLCustom(path: string, page: number) {
  const [pathname, search = ""] = path.split("?", 2);
  return `${pathname}${oStatsTimelineSearchCustom(search, page)}`;
}
