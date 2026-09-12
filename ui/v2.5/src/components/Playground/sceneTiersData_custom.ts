import type { IPlaygroundEntry } from "./playgroundData_custom";
import {
  ratingTierForEntity,
  type IRatingTierConfig,
  type RatingTier,
} from "./ratingTiersData_custom";

export type SceneTierDimension = "sceneType" | "studio";
export type SceneTierSort = "label" | "total" | RatingTier;

export interface ISceneTierMember {
  entry: IPlaygroundEntry;
  current?: RatingTier;
  projected?: RatingTier;
}

export interface ISceneTierBandCount {
  count: number;
  ids: string[];
}

export interface ISceneTierCounts {
  current: Record<RatingTier, ISceneTierBandCount>;
  projected: Record<RatingTier, ISceneTierBandCount>;
  currentTotal: number;
  projectedTotal: number;
  currentIds: string[];
  projectedIds: string[];
}

export interface ISceneTierGroup extends ISceneTierCounts {
  key: string;
  label: string;
}

function emptyBands(): Record<RatingTier, ISceneTierBandCount> {
  return {
    royal_sapphire: { count: 0, ids: [] },
    gold: { count: 0, ids: [] },
    silver: { count: 0, ids: [] },
    bronze: { count: 0, ids: [] },
    none: { count: 0, ids: [] },
  };
}

export function createSceneTierMembers(
  entries: readonly IPlaygroundEntry[],
  currentConfig: IRatingTierConfig,
  projectedConfig: IRatingTierConfig
): ISceneTierMember[] {
  return entries.map((entry) => ({
    entry,
    current: ratingTierForEntity(
      entry.scene,
      currentConfig,
      "scene",
      entry.scene
    ),
    projected: ratingTierForEntity(
      entry.scene,
      projectedConfig,
      "scene",
      entry.scene
    ),
  }));
}

export function countSceneTiers(
  members: readonly ISceneTierMember[]
): ISceneTierCounts {
  const counts: ISceneTierCounts = {
    current: emptyBands(),
    projected: emptyBands(),
    currentTotal: 0,
    projectedTotal: 0,
    currentIds: [],
    projectedIds: [],
  };
  members.forEach(({ entry, current, projected }) => {
    if (current) {
      counts.current[current].count += 1;
      counts.current[current].ids.push(entry.scene.id);
      counts.currentTotal += 1;
      counts.currentIds.push(entry.scene.id);
    }
    if (projected) {
      counts.projected[projected].count += 1;
      counts.projected[projected].ids.push(entry.scene.id);
      counts.projectedTotal += 1;
      counts.projectedIds.push(entry.scene.id);
    }
  });
  return counts;
}

export function sceneTierGroupLabel(
  entry: IPlaygroundEntry,
  dimension: SceneTierDimension
) {
  if (dimension === "sceneType") {
    return entry.sceneType
      ? entry.sceneType.charAt(0).toUpperCase() + entry.sceneType.slice(1)
      : "Unknown";
  }
  const studio = entry.scene.studio?.name?.trim();
  return studio && studio.toLocaleLowerCase() !== "<nil>" ? studio : "Unknown";
}

export function sceneTierGroupKey(
  entry: IPlaygroundEntry,
  dimension: SceneTierDimension
) {
  if (dimension === "sceneType") return entry.sceneType ?? "__unknown__";
  return entry.scene.studio?.id ?? "__unknown__";
}

export function groupSceneTiers(
  members: readonly ISceneTierMember[],
  dimension: SceneTierDimension,
  sort: SceneTierSort,
  descending: boolean
): ISceneTierGroup[] {
  const grouped = new Map<
    string,
    { label: string; members: ISceneTierMember[] }
  >();
  members.forEach((member) => {
    const key = sceneTierGroupKey(member.entry, dimension);
    const label = sceneTierGroupLabel(member.entry, dimension);
    const group = grouped.get(key) ?? { label, members: [] };
    group.members.push(member);
    grouped.set(key, group);
  });
  return [...grouped]
    .map(([key, group]) => ({
      key,
      label: group.label,
      ...countSceneTiers(group.members),
    }))
    .filter(
      ({ currentTotal, projectedTotal }) => currentTotal || projectedTotal
    )
    .sort((a, b) => {
      const difference =
        sort === "label"
          ? a.label.localeCompare(b.label)
          : sort === "total"
          ? a.currentTotal - b.currentTotal
          : a.current[sort].count - b.current[sort].count;
      return (
        difference * (descending ? -1 : 1) || a.label.localeCompare(b.label)
      );
    });
}
