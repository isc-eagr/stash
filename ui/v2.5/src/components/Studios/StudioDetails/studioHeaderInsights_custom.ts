// CUSTOM: rating tiles shown in the studio detail header.
interface IRatingSectionCustom {
  entity_count: number;
  average_rating100?: number | null;
}

export interface IStudioHeaderRatingStatsCustom {
  overall_scene_average_rating100?: number | null;
  solo_scenes: IRatingSectionCustom;
  sex_scenes: IRatingSectionCustom;
  threesome_scenes: IRatingSectionCustom;
  group_scenes: IRatingSectionCustom;
  performers: IRatingSectionCustom;
}

export interface IStudioHeaderRatingTileCustom {
  key: string;
  label: string;
  value: string;
  count?: number;
  noun: string;
  highlight?: boolean;
}

export function formatStudioHeaderRatingCustom(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

// Returns no tiles when nothing in scope has advisor criteria.
export function getStudioHeaderRatingTilesCustom(
  stats?: IStudioHeaderRatingStatsCustom | null
): IStudioHeaderRatingTileCustom[] {
  if (!stats) return [];

  const sections = [
    { key: "solo", label: "Solo", noun: "scenes", s: stats.solo_scenes },
    { key: "standard", label: "Standard", noun: "scenes", s: stats.sex_scenes },
    {
      key: "threesome",
      label: "Threesome",
      noun: "scenes",
      s: stats.threesome_scenes,
    },
    { key: "group", label: "Group", noun: "scenes", s: stats.group_scenes },
    { key: "vatos", label: "Vatos", noun: "vatos", s: stats.performers },
  ];
  if (!sections.some(({ s }) => s.entity_count > 0)) return [];

  return [
    {
      key: "overall",
      label: "Overall",
      noun: "scenes",
      value: formatStudioHeaderRatingCustom(
        stats.overall_scene_average_rating100
      ),
      highlight: true,
    },
    ...sections.map(({ key, label, noun, s }) => ({
      key,
      label,
      noun,
      value: formatStudioHeaderRatingCustom(s.average_rating100),
      count: s.entity_count,
    })),
  ];
}
