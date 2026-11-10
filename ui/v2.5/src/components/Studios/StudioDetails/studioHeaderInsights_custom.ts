// CUSTOM: which Rating Advisor averages the studio header shows: the rated
// scene rubrics in one panel, vatos in another.
interface IRatingSectionCustom {
  entity_count: number;
}

export type StudioHeaderSceneRatingKeyCustom =
  | "solo_scenes"
  | "sex_scenes"
  | "threesome_scenes"
  | "group_scenes";

export interface IStudioHeaderRatingStatsCustom
  extends Record<StudioHeaderSceneRatingKeyCustom, IRatingSectionCustom> {
  performers: IRatingSectionCustom;
}

const sceneRatingKeys: StudioHeaderSceneRatingKeyCustom[] = [
  "solo_scenes",
  "sex_scenes",
  "threesome_scenes",
  "group_scenes",
];

export function formatStudioHeaderRatingCustom(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

export function getStudioHeaderRatingPanelsCustom(
  stats?: IStudioHeaderRatingStatsCustom | null
) {
  return {
    sceneKeys: stats
      ? sceneRatingKeys.filter((key) => stats[key].entity_count > 0)
      : [],
    showVatos: !!stats && stats.performers.entity_count > 0,
  };
}
