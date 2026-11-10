// CUSTOM: top → bottom ethnicity grids for Sex and Oral on Vato Stats.
import { cleanStatsValueCustom } from "src/utils/statsValues_custom";

export type VatoStatsRolePairActivity = "SEX" | "ORAL";

export interface IVatoStatsRolePair {
  activity: VatoStatsRolePairActivity;
  scene_id: string;
  top_id: string;
  bottom_id: string;
}

interface IVatoRolePairAxis {
  key: string;
  label: string;
  count: number;
}

export interface IVatoRolePairGrid {
  tops: IVatoRolePairAxis[];
  bottoms: IVatoRolePairAxis[];
  // Scene IDs per "top|bottom" ethnicity pair.
  cells: Map<string, string[]>;
  sceneIds: string[];
  // Scenes with a pair where a vato has no ethnicity.
  unknownSceneIds: string[];
}

export function vatoRolePairKey(top: string, bottom: string) {
  return `${top}|${bottom}`;
}

// Matches the marker filter's ethnicity rule: Afrolatino also counts as
// Black and Latino, Mixed as Black and White.
const ETHNICITY_ALSO_CUSTOM: Record<string, string[]> = {
  afrolatino: ["Black", "Latino"],
  mixed: ["Black", "White"],
};

export function vatoRolePairEthnicities(ethnicity: string) {
  return [ethnicity, ...(ETHNICITY_ALSO_CUSTOM[ethnicity.toLowerCase()] ?? [])];
}

// A scene counts once in every top → bottom ethnicity pair it has (see
// vatoRolePairEthnicities). With
// selected vatos, only pairs with one of them on either side count.
export function buildVatoRolePairGrid(
  pairs: readonly IVatoStatsRolePair[],
  activity: VatoStatsRolePairActivity,
  vatos: readonly { id: string; ethnicity?: string | null }[],
  selected?: ReadonlySet<string>
): IVatoRolePairGrid {
  const ethnicities = new Map(
    vatos.map((vato) => [vato.id, cleanStatsValueCustom(vato.ethnicity)])
  );
  const cells = new Map<string, Set<string>>();
  const tops = new Map<string, Set<string>>();
  const bottoms = new Map<string, Set<string>>();
  const known = new Set<string>();
  const unknown = new Set<string>();
  const add = (map: Map<string, Set<string>>, key: string, scene: string) => {
    const scenes = map.get(key) ?? new Set<string>();
    scenes.add(scene);
    map.set(key, scenes);
  };

  pairs.forEach((pair) => {
    if (pair.activity !== activity) return;
    if (selected && !selected.has(pair.top_id) && !selected.has(pair.bottom_id))
      return;

    const top = ethnicities.get(pair.top_id);
    const bottom = ethnicities.get(pair.bottom_id);
    if (!top || !bottom) {
      unknown.add(pair.scene_id);
      return;
    }
    const topGroups = vatoRolePairEthnicities(top);
    const bottomGroups = vatoRolePairEthnicities(bottom);
    for (const t of topGroups) {
      add(tops, t, pair.scene_id);
      for (const b of bottomGroups) {
        add(cells, vatoRolePairKey(t, b), pair.scene_id);
      }
    }
    for (const b of bottomGroups) add(bottoms, b, pair.scene_id);
    known.add(pair.scene_id);
  });

  const axis = (map: Map<string, Set<string>>) =>
    Array.from(map, ([key, scenes]) => ({
      key,
      label: key,
      count: scenes.size,
    })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    tops: axis(tops),
    bottoms: axis(bottoms),
    cells: new Map(Array.from(cells, ([key, scenes]) => [key, [...scenes]])),
    sceneIds: [...known],
    unknownSceneIds: [...unknown],
  };
}
