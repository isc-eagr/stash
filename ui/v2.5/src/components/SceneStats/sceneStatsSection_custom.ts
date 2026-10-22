// Activity & Ratings now sit on the overview, so old ?section=insights links
// open the overview.
export type SceneStatsSection =
  | "overview"
  | "activity-matrix"
  | "stashdb-matches";

const extraSections: readonly string[] = ["activity-matrix", "stashdb-matches"];

export function sceneStatsSectionFromKey(
  key?: string | null
): SceneStatsSection {
  return key && extraSections.includes(key)
    ? (key as SceneStatsSection)
    : "overview";
}

export function sceneStatsSectionFromSearch(search: string): SceneStatsSection {
  return sceneStatsSectionFromKey(new URLSearchParams(search).get("section"));
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

// On/off switches kept in the URL, such as includeSubTags and hideFew.
export type SceneStatsFlag = "includeSubTags" | "hideFew";

export function sceneStatsFlagFromSearch(search: string, flag: SceneStatsFlag) {
  return new URLSearchParams(search).get(flag) === "true";
}

export function sceneStatsSearchForFlag(
  search: string,
  flag: SceneStatsFlag,
  on: boolean
) {
  const parameters = new URLSearchParams(search);
  if (on) parameters.set(flag, "true");
  else parameters.delete(flag);
  const value = parameters.toString();
  return value ? `?${value}` : "";
}
