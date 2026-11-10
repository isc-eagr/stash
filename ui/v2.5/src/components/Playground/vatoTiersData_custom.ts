import { statsCountryName } from "src/utils/statsCountry_custom";
import {
  ratingTierForEntity,
  ratingTiers,
  type IRatingTierConfig,
  type RatingTier,
} from "./ratingTiersData_custom";

export const vatoTiers = ratingTiers;

export type VatoTier = RatingTier;
export type VatoTierDimension = "ethnicity" | "country";
export type VatoTierSort = "label" | "total" | VatoTier;
export const vatoTierUnknownValue = "__unknown__";
export interface IVatoTierPerformer {
  id: string;
  name: string;
  image_path?: string | null;
  ethnicity?: string | null;
  country?: string | null;
  rating100?: number | null;
  rating_tier_tags?: { id: string }[] | null;
  tier: VatoTier;
}
export interface IVatoTierFilters {
  ethnicity: string[];
  country: string[];
}
export const emptyVatoTierFilters: IVatoTierFilters = {
  ethnicity: [],
  country: [],
};

export function vatoTierFilterValue(
  performer: IVatoTierPerformer,
  dimension: VatoTierDimension
) {
  const value = performer[dimension]?.trim();
  if (!value) return vatoTierUnknownValue;
  return dimension === "country" && /^[a-z]{2}$/i.test(value)
    ? value.toUpperCase()
    : value;
}

export function vatoTierDisplayValue(
  value: string,
  dimension: VatoTierDimension
) {
  if (value === vatoTierUnknownValue) return "Unknown";
  return dimension === "country" ? statsCountryName(value) : value;
}

export function vatoTierValue(
  performer: IVatoTierPerformer,
  dimension: VatoTierDimension
) {
  return vatoTierDisplayValue(
    vatoTierFilterValue(performer, dimension),
    dimension
  );
}

export function filterTierVatos(
  performers: readonly IVatoTierPerformer[],
  filters: IVatoTierFilters
) {
  return performers.filter((performer) =>
    (["ethnicity", "country"] as const).every(
      (dimension) =>
        !filters[dimension].length ||
        filters[dimension].includes(vatoTierFilterValue(performer, dimension))
    )
  );
}

export function countVatoTiers(performers: readonly IVatoTierPerformer[]) {
  const counts = {
    bronze: 0,
    silver: 0,
    gold: 0,
    royal_sapphire: 0,
    none: 0,
  };
  performers.forEach(({ tier }) => {
    counts[tier] += 1;
  });
  return counts;
}

export function projectedVatoTier(
  performer: IVatoTierPerformer,
  config: IRatingTierConfig
): VatoTier {
  // The baseline loader only returns performers assigned to one of its five
  // saved tiers. Keep that server tier as a defensive fallback if a legacy or
  // partial payload lacks the raw fields needed for a preview.
  return ratingTierForEntity(performer, config, "performer") ?? performer.tier;
}

export function projectVatoTiers(
  performers: readonly IVatoTierPerformer[],
  config: IRatingTierConfig
): IVatoTierPerformer[] {
  return performers.map((performer) => ({
    ...performer,
    tier: projectedVatoTier(performer, config),
  }));
}

export function groupTierVatos(
  performers: readonly IVatoTierPerformer[],
  dimension: VatoTierDimension,
  sort: VatoTierSort,
  descending: boolean
) {
  const groups = new Map<
    string,
    { members: IVatoTierPerformer[]; values: Set<string> }
  >();
  performers.forEach((performer) => {
    const label = vatoTierValue(performer, dimension);
    const group = groups.get(label) ?? {
      members: [],
      values: new Set<string>(),
    };
    group.members.push(performer);
    group.values.add(vatoTierFilterValue(performer, dimension));
    groups.set(label, group);
  });
  return [...groups]
    .map(([label, { members, values }]) => ({
      label,
      members,
      values: [...values],
      total: members.length,
      ...countVatoTiers(members),
    }))
    .sort((a, b) => {
      const difference =
        sort === "label" ? a.label.localeCompare(b.label) : a[sort] - b[sort];
      return (
        difference * (descending ? -1 : 1) || a.label.localeCompare(b.label)
      );
    });
}

// Use the server's metallic filter so configured thresholds and tag precedence
// match the original tier table, including performers without scenes.
export const VATO_TIERS_QUERY = `
  query PlaygroundVatoTiers(
    $page: Int!
    $tier: [ID!]!
    $modifier: CriterionModifier!
    $rating: IntCriterionInput
  ) {
    findPerformers(
      filter: { page: $page, per_page: 200, sort: "id", direction: ASC }
      performer_filter: {
        metallic_rating: { value: $tier, modifier: $modifier }
        rating100: $rating
      }
    ) {
      count
      performers {
        id name image_path ethnicity country rating100
        rating_tier_tags: tags { id }
      }
    }
  }
`;

const metallicTierKeys = ["bronze", "silver", "gold", "royal_sapphire"];
const metallicRatingIncludeNonMetallicValue = "__include_non_metallic__";

export function vatoTierRequest(tier: VatoTier) {
  return tier === "none"
    ? {
        values: [...metallicTierKeys, metallicRatingIncludeNonMetallicValue],
        modifier: "EXCLUDES",
        // A No Tier vato has an actual rating below Bronze. Unrated vatos
        // are intentionally outside every tier total.
        rating: { value: 0, modifier: "NOT_NULL" },
      }
    : { values: [tier], modifier: "INCLUDES" };
}

export interface IVatoTierPage {
  findPerformers: {
    count: number;
    performers: Omit<IVatoTierPerformer, "tier">[];
  };
}

export async function loadTierVatos(
  request: (page: number, tier: VatoTier) => Promise<IVatoTierPage>,
  signal: AbortSignal,
  progress: (loaded: number, tier: string) => void
) {
  const performers: IVatoTierPerformer[] = [];
  const seen = new Set<string>();
  for (const tier of vatoTiers) {
    let total: number | undefined;
    let loaded = 0;
    for (let page = 1; ; page += 1) {
      if (signal.aborted) throw new Error("Loading cancelled.");
      const { findPerformers: batch } = await request(page, tier.key);
      if (signal.aborted) throw new Error("Loading cancelled.");
      if (total !== undefined && total !== batch.count)
        throw new Error("The library changed. Reload vatos to retry.");
      total = batch.count;
      for (const performer of batch.performers) {
        if (seen.has(performer.id))
          throw new Error("Vato tiers changed. Reload vatos to retry.");
        seen.add(performer.id);
        performers.push({ ...performer, tier: tier.key });
      }
      loaded += batch.performers.length;
      progress(performers.length, tier.label);
      if (loaded === total) break;
      if (!batch.performers.length || loaded > total)
        throw new Error("Incomplete vato data. Reload vatos to retry.");
    }
  }
  return performers;
}
