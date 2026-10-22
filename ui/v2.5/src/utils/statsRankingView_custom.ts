// CUSTOM: Shared, bookmarkable presentation choice. Unrelated URL state survives.
export function statsRankingViewCustom(search: string): "cards" | "table" {
  return new URLSearchParams(search).get("rankingView") === "table"
    ? "table"
    : "cards";
}
export function statsRankingViewSearchCustom(
  search: string,
  view: "cards" | "table"
) {
  const params = new URLSearchParams(search);
  if (view === "table") params.set("rankingView", "table");
  else params.delete("rankingView");
  const value = params.toString();
  return value ? `?${value}` : "";
}
