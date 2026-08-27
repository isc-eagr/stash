export type SceneStatsSection = "overview" | "insights" | "activity-matrix";

export function sceneStatsSectionFromSearch(search: string): SceneStatsSection {
  const section = new URLSearchParams(search).get("section");
  if (section === "insights" || section === "activity-matrix") return section;
  return "overview";
}

export function sceneStatsSearchForSection(
  search: string,
  section: SceneStatsSection
) {
  const parameters = new URLSearchParams(search);
  if (section === "overview") parameters.delete("section");
  else parameters.set("section", section);
  const value = parameters.toString();
  return value ? `?${value}` : "";
}

export function sceneStatsIncludeSubTagsFromSearch(search: string) {
  return new URLSearchParams(search).get("includeSubTags") === "true";
}

export function sceneStatsSearchForIncludeSubTags(
  search: string,
  includeSubTags: boolean
) {
  const parameters = new URLSearchParams(search);
  if (includeSubTags) parameters.set("includeSubTags", "true");
  else parameters.delete("includeSubTags");
  const value = parameters.toString();
  return value ? `?${value}` : "";
}
