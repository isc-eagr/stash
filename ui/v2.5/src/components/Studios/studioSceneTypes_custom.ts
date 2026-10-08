export interface IStudioSceneTypeCountsCustom {
  sex_scene_count: number;
  oral_scene_count: number;
  solo_scene_count: number;
}

// Use the same scene counts as the former category strip.
export function getStudioSceneTypesCustom(
  counts?: IStudioSceneTypeCountsCustom | null
) {
  const rows = (["sex", "oral", "solo"] as const).map((key) => ({
    key,
    label: { sex: "Sex", oral: "Oral", solo: "Solo" }[key],
    count: Math.max(0, counts?.[`${key}_scene_count`] ?? 0),
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    ...row,
    percent: total > 0 ? (row.count / total) * 100 : 0,
  }));
}
