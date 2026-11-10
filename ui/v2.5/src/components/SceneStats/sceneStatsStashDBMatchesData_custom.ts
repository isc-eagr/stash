// CUSTOM: Average StashDB Matches by scene attribute, to compare which kinds of
// content the community matches most. Only organized scenes with a count are
// included; a scene with several values (ethnicities, countries, vato ratings)
// counts once toward each.
import { createInsightEntityLink } from "src/utils/insightSceneLinks_custom";
import { statsCountryName } from "src/utils/statsCountry_custom";
import { sceneStatsReleaseYear } from "./sceneStatsChartBuckets_custom";
import type { SceneStatsScene } from "./sceneStatsCompactData_custom";

export interface IStashDBMatchesGroupCustom {
  key: string;
  label: string;
  // Ordinal tables sort by this, descending; others by average.
  sortValue?: number;
}

export interface IStashDBMatchesRowCustom extends IStashDBMatchesGroupCustom {
  sceneCount: number;
  average: number;
  // The row's scenes, for its Scenes drilldown.
  sceneIds: string[];
}

export type StashDBMatchesDimensionCustom =
  | "performer_count"
  | "ethnicity"
  | "country"
  | "release_year"
  | "rating"
  | "metallic_rating"
  | "vato_rating"
  | "scene_type"
  | "best_facial"
  | "best_nut"
  | "vato"
  | "studio";

// Dimensions whose groups need page data (role tags, configuration, Nut Stats).
export type StashDBMatchesPageDimensionCustom =
  | "scene_type"
  | "metallic_rating"
  | "best_facial"
  | "best_nut";

// Dimensions grouped by ID; the page resolves names after grouping.
export const STASHDB_MATCHES_NAMED_DIMENSIONS_CUSTOM: readonly StashDBMatchesDimensionCustom[] =
  ["vato", "studio"];

export type StashDBMatchesGroupsCustom = (
  scene: SceneStatsScene
) => IStashDBMatchesGroupCustom[];

export const STASHDB_MATCHES_TABLE_TITLES_CUSTOM: Record<
  StashDBMatchesDimensionCustom,
  string
> = {
  performer_count: "By Vato Count",
  ethnicity: "By Vato Ethnicity",
  country: "By Vato Country",
  release_year: "By Release Year",
  rating: "By Rating",
  metallic_rating: "By Metallic Rating",
  vato_rating: "By Vato Rating",
  scene_type: "By Scene Type",
  best_facial: "By Best Facial",
  best_nut: "By Best Nut",
  vato: "By Vato",
  studio: "By Studio",
};

// Vatos need this many scenes to be ranked, so one viral scene can't win.
export const STASHDB_MATCHES_VATO_MIN_SCENES_CUSTOM = 3;
// Groups under this many scenes are dimmed, or hidden by the page switch.
export const STASHDB_MATCHES_FEW_SCENES_CUSTOM = 3;
// Underrated Gems need a match besides yours: 1 is usually your own.
export const STASHDB_MATCHES_GEM_MIN_MATCHES_CUSTOM = 2;

export function stashDBMatchesScenesCustom(scenes: readonly SceneStatsScene[]) {
  return scenes.filter(
    (scene) =>
      scene.organized &&
      scene.stashdb_matches !== null &&
      scene.stashdb_matches !== undefined
  );
}

export function stashDBMatchesAverageCustom(
  scenes: readonly SceneStatsScene[]
) {
  if (scenes.length === 0) return undefined;
  return (
    scenes.reduce((sum, scene) => sum + (scene.stashdb_matches ?? 0), 0) /
    scenes.length
  );
}

// 10-point rating bands. Bonuses push ratings past 100, so bands keep going
// (100-109, 110-119, ...).
export function stashDBMatchesRatingBandCustom(
  rating?: number | null
): IStashDBMatchesGroupCustom | undefined {
  if (rating === null || rating === undefined || rating <= 0) return undefined;
  const start = Math.floor(Math.round(rating) / 10) * 10;
  return {
    key: String(start),
    label: `${start}-${start + 9}`,
    sortValue: start,
  };
}

function uniqueValues(values: readonly string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value && value.toLowerCase() !== "<nil>")
    )
  );
}

function uniqueGroups(groups: (IStashDBMatchesGroupCustom | undefined)[]) {
  const byKey = new Map<string, IStashDBMatchesGroupCustom>();
  groups.forEach((group) => {
    if (group && !byKey.has(group.key)) byKey.set(group.key, group);
  });
  return Array.from(byKey.values());
}

// Groupers that only need the scene; the page passes the rest in.
export const stashDBMatchesSceneGroupsCustom: Record<
  Exclude<StashDBMatchesDimensionCustom, StashDBMatchesPageDimensionCustom>,
  StashDBMatchesGroupsCustom
> = {
  performer_count: (scene) => {
    const count = Math.min(scene.performer_count, 4);
    if (count <= 0) return [];
    return [
      {
        key: String(count),
        label:
          count === 4
            ? "4+ vatos"
            : `${count} ${count === 1 ? "vato" : "vatos"}`,
        sortValue: -count,
      },
    ];
  },
  ethnicity: (scene) =>
    uniqueValues(scene.performer_ethnicities).map((ethnicity) => ({
      key: ethnicity,
      label: ethnicity,
    })),
  country: (scene) =>
    uniqueValues(scene.performer_countries).map((country) => ({
      key: country,
      label: statsCountryName(country),
    })),
  release_year: (scene) => {
    const year = sceneStatsReleaseYear(scene.effective_date ?? scene.date);
    return year
      ? [{ key: String(year), label: String(year), sortValue: year }]
      : [];
  },
  rating: (scene) =>
    uniqueGroups([stashDBMatchesRatingBandCustom(scene.rating100)]),
  vato_rating: (scene) =>
    uniqueGroups(scene.performer_ratings.map(stashDBMatchesRatingBandCustom)),
  vato: (scene) =>
    uniqueValues(scene.performer_ids).map((id) => ({ key: id, label: id })),
  studio: (scene) =>
    scene.studio_id ? [{ key: scene.studio_id, label: scene.studio_id }] : [],
};

// By Vato and By Studio rows are keyed by ID. Performer and studio IDs
// overlap, so each table reads only its own names.
export function stashDBMatchesLabelRowsCustom(
  dimension: StashDBMatchesDimensionCustom,
  rows: IStashDBMatchesRowCustom[],
  names: Partial<
    Record<StashDBMatchesDimensionCustom, ReadonlyMap<string, string>>
  >
) {
  const byID = names[dimension];
  if (!STASHDB_MATCHES_NAMED_DIMENSIONS_CUSTOM.includes(dimension)) return rows;
  return rows.map((row) => ({
    ...row,
    label: byID?.get(row.key) ?? `#${row.key}`,
  }));
}

export interface IStashDBMatchesGapSceneCustom {
  id: string;
  title: string;
  rating: number;
  matches: number;
  // Rating percentile minus matches percentile, from -1 to 1.
  gap: number;
}

// Midrank percentiles (0 lowest, 1 highest), so ties share a rank.
function percentiles(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const ranks = new Map<number, number>();
  for (let start = 0; start < sorted.length; ) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[start]) end++;
    ranks.set(sorted[start], (start + end) / 2 / (sorted.length - 1));
    start = end + 1;
  }
  return values.map((value) => ranks.get(value) ?? 0);
}

// Your rating vs the community's matches, compared as percentiles of the
// rated, counted scenes. Underrated: you rate it far above how much it's
// matched. Overhyped: matched far more than you rate it.
export function stashDBMatchesRatingGapsCustom(
  scenes: readonly SceneStatsScene[],
  limit = 10
) {
  const rated = scenes.filter(
    (scene) => scene.rating100 !== null && scene.rating100 !== undefined
  );
  if (rated.length < 2) return { underrated: [], overhyped: [] };

  const ratingRanks = percentiles(rated.map((scene) => scene.rating100 ?? 0));
  const matchRanks = percentiles(
    rated.map((scene) => scene.stashdb_matches ?? 0)
  );
  const gaps: IStashDBMatchesGapSceneCustom[] = rated.map((scene, index) => ({
    id: scene.id,
    title: scene.title || `Scene ${scene.id}`,
    rating: scene.rating100 ?? 0,
    matches: scene.stashdb_matches ?? 0,
    gap: ratingRanks[index] - matchRanks[index],
  }));

  return {
    underrated: gaps
      .filter(
        (scene) =>
          scene.gap > 0 &&
          scene.matches >= STASHDB_MATCHES_GEM_MIN_MATCHES_CUSTOM
      )
      .sort((a, b) => b.gap - a.gap || b.rating - a.rating)
      .slice(0, limit),
    overhyped: gaps
      .filter((scene) => scene.gap < 0)
      .sort((a, b) => a.gap - b.gap || b.matches - a.matches)
      .slice(0, limit),
  };
}

export function buildStashDBMatchesTableCustom(
  scenes: readonly SceneStatsScene[],
  groupsFor: StashDBMatchesGroupsCustom
): IStashDBMatchesRowCustom[] {
  const rows = new Map<
    string,
    IStashDBMatchesGroupCustom & {
      sceneCount: number;
      total: number;
      sceneIds: string[];
    }
  >();
  scenes.forEach((scene) => {
    groupsFor(scene).forEach((group) => {
      const row = rows.get(group.key) ?? {
        ...group,
        sceneCount: 0,
        total: 0,
        sceneIds: [],
      };
      row.sceneCount += 1;
      row.total += scene.stashdb_matches ?? 0;
      row.sceneIds.push(scene.id);
      rows.set(group.key, row);
    });
  });

  return Array.from(rows.values())
    .map(({ total, ...row }) => ({ ...row, average: total / row.sceneCount }))
    .sort((a, b) =>
      a.sortValue !== undefined && b.sortValue !== undefined
        ? b.sortValue - a.sortValue
        : b.average - a.average ||
          b.sceneCount - a.sceneCount ||
          a.label.localeCompare(b.label)
    );
}

// Scenes list of exactly the row's scenes, most matched first. The IDs ride in
// a browser snapshot (as Playground drilldowns do), so big rows keep short URLs.
export function stashDBMatchesRowScenesURLCustom(
  tableTitle: string,
  row: IStashDBMatchesRowCustom
) {
  return `${createInsightEntityLink(
    "scene",
    `StashDB Matches ${tableTitle}: ${row.label}`,
    row.sceneIds
  )}&sortby=stashdb_matches&sortdir=desc`;
}
