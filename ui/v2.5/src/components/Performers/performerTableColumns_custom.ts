// Presets leave saved column choices intact until the user chooses a preset.
export const PERFORMER_BROWSE_COLUMNS_CUSTOM = [
  "image",
  "name",
  "rating",
  "scene_count",
  "sex_unique_partners",
  "oral_unique_partners",
];
export const PERFORMER_METRICS_COLUMNS_CUSTOM = [
  "name",
  "scene_count",
  "o_counter",
  "sex_unique_partners",
  "oral_unique_partners",
  "facial_unique_partners",
];
export const PERFORMER_TABLE_ASCENDING_SORTS_CUSTOM = ["name"];

export function showPerformerMediaTabCustom(
  count: number,
  key: string,
  activeKey?: string
) {
  return count > 0 || key === activeKey;
}
