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

export interface ISceneCastSplitCustom {
  solo: number;
  standard: number;
  threesome: number;
  group: number;
}

export interface ISceneTypeCastSplitCustom {
  sex: ISceneCastSplitCustom;
  oral: ISceneCastSplitCustom;
}

export type SceneCastBucketCustom = "standard" | "threesome" | "group";

// Vato count per bucket: Standard 2, Threesome 3, Group 4+.
export const sceneCastBucketsCustom: {
  key: SceneCastBucketCustom;
  label: string;
  vatos: number;
}[] = [
  { key: "standard", label: "Standard", vatos: 2 },
  { key: "threesome", label: "Threesome", vatos: 3 },
  { key: "group", label: "Group", vatos: 4 },
];

// Sex and Oral only count scenes with 2+ vatos; 1-vato sex/oral scenes
// (an anomaly) move to Solo.
export function applySceneTypeCastSplitCustom(
  counts: IStudioSceneTypeCountsCustom,
  split?: ISceneTypeCastSplitCustom | null
): IStudioSceneTypeCountsCustom {
  if (!split) return counts;
  const multi = (s: ISceneCastSplitCustom) =>
    s.standard + s.threesome + s.group;
  return {
    sex_scene_count: multi(split.sex),
    oral_scene_count: multi(split.oral),
    solo_scene_count:
      counts.solo_scene_count + split.sex.solo + split.oral.solo,
  };
}
