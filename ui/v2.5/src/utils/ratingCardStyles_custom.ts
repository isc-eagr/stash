export type RatingCardTheme = "premium" | "classic";

export const defaultRatingCardTheme: RatingCardTheme = "premium";

export interface IRatingCardThresholds {
  bronze?: number;
  silver?: number;
  gold?: number;
  royalSapphire?: number;
}

export interface IRatingCardThresholdConfig extends IRatingCardThresholds {
  scene?: IRatingCardThresholds;
  performer?: IRatingCardThresholds;
}

export interface IRatingCardOverrideTagIds {
  bronzeTagId?: string | null;
  silverTagId?: string | null;
  goldTagId?: string | null;
  royalSapphireTagId?: string | null;
}

export const defaultRatingCardThresholds: Required<IRatingCardThresholds> = {
  bronze: 60,
  silver: 73,
  gold: 84,
  royalSapphire: 90,
};

interface IRatingCardTag {
  id?: string | null;
}

interface IRatingCardScore {
  section?: string | null;
  key?: string | null;
  raw_value?: number | null;
}

interface IRatingCardMarkerTag extends IRatingCardTag {
  ancestor_ids?: readonly string[] | null;
  parents?: readonly IRatingCardMarkerTag[] | null;
}

interface IRatingCardMarker {
  primary_tag?: IRatingCardMarkerTag | null;
  tags?: readonly IRatingCardMarkerTag[] | null;
}

interface IRatingCardMarkerTagAncestors {
  tag_id?: string | null;
  ancestor_ids?: readonly string[] | null;
}

const royalSapphireGoatElementValues = new Set([0.5, 1, 1.5, 2]);

export function isRoyalSapphireSceneBonus(
  key?: string | null,
  rawValue?: number | null
): boolean {
  if (rawValue === undefined || rawValue === null) return false;

  return key === "godTierOrgasm"
    ? rawValue === 1
    : key === "goatElement" && royalSapphireGoatElementValues.has(rawValue);
}

export function hasRoyalSapphireSceneBonus(
  scores: readonly IRatingCardScore[] | null | undefined
): boolean {
  return !!scores?.some(
    (score) =>
      (!score.section || score.section === "bonus") &&
      isRoyalSapphireSceneBonus(score.key, score.raw_value)
  );
}

// CUSTOM: A configured GOAT marker (including a descendant tag) promotes its
// whole scene to Royal Sapphire, matching the scene metallic filter.
export function hasRoyalSapphireSceneMarker(
  markers: readonly IRatingCardMarker[] | null | undefined,
  goatTagId?: string | null,
  tagAncestors?: readonly IRatingCardMarkerTagAncestors[] | null
): boolean {
  if (!goatTagId) return false;

  const ancestorsByTagId = new Map(
    tagAncestors?.map(({ tag_id, ancestor_ids }) => [
      tag_id,
      ancestor_ids ?? [],
    ]) ?? []
  );
  const matches = (
    tag: IRatingCardMarkerTag | null | undefined,
    visited = new Set<string>()
  ): boolean => {
    if (!tag?.id) return false;
    if (tag.id === goatTagId) return true;
    if (
      tag.ancestor_ids?.includes(goatTagId) ||
      ancestorsByTagId.get(tag.id)?.includes(goatTagId)
    ) {
      return true;
    }
    if (visited.has(tag.id)) return false;
    visited.add(tag.id);
    return !!tag.parents?.some((parent) => matches(parent, visited));
  };

  return !!markers?.some(
    (marker) =>
      matches(marker.primary_tag) || marker.tags?.some((tag) => matches(tag))
  );
}

export function normalizeRatingCardTheme(
  theme?: string | null
): RatingCardTheme {
  return theme === "classic" ? "classic" : defaultRatingCardTheme;
}

export function isRatingCardHomePage(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.location.pathname === "/" ||
    window.location.pathname === "/frontpage"
  );
}

function hasConfiguredTag(
  tags: readonly IRatingCardTag[] | null | undefined,
  tagId?: string | null
): boolean {
  return !!tagId && !!tags?.some((tag) => tag?.id === tagId);
}

function normalizeThreshold(value: number | undefined, fallback: number) {
  if (value === undefined || Number.isNaN(value)) return fallback;

  return Math.max(0, Math.round(value));
}

export function normalizeRatingCardThresholds(
  thresholds?: IRatingCardThresholds | null
): Required<IRatingCardThresholds> {
  return {
    bronze: normalizeThreshold(
      thresholds?.bronze,
      defaultRatingCardThresholds.bronze
    ),
    silver: normalizeThreshold(
      thresholds?.silver,
      defaultRatingCardThresholds.silver
    ),
    gold: normalizeThreshold(
      thresholds?.gold,
      defaultRatingCardThresholds.gold
    ),
    royalSapphire: normalizeThreshold(
      thresholds?.royalSapphire,
      defaultRatingCardThresholds.royalSapphire
    ),
  };
}

export function getRatingCardThresholdsForEntity(
  thresholds?: IRatingCardThresholdConfig | null,
  entityType: "scene" | "performer" = "scene"
): Required<IRatingCardThresholds> {
  const entityThresholds =
    entityType === "performer" ? thresholds?.performer : thresholds?.scene;

  return normalizeRatingCardThresholds(entityThresholds ?? thresholds);
}

export type MetallicRatingTierCustom =
  | "none"
  | "bronze"
  | "silver"
  | "gold"
  | "royal_sapphire";
export const METALLIC_TIER_CLASSES_CUSTOM: Record<
  MetallicRatingTierCustom,
  string
> = {
  none: "",
  bronze: "rating-3-stars",
  silver: "rating-4-stars",
  gold: "rating-5-stars",
  royal_sapphire: "rating-royal-sapphire",
};
type MetallicRatingInputCustom = {
  rating?: number | null;
  tags?: readonly IRatingCardTag[] | null;
  goatTagId?: string | null;
  overrideTagIds?: IRatingCardOverrideTagIds | null;
  thresholds?: IRatingCardThresholdConfig | null;
  thresholdEntity?: "scene" | "performer";
  ratingScores?: readonly IRatingCardScore[] | null;
  sceneHasRoyalSapphireBonus?: boolean;
};

// The one semantic classifier for cards, charts, Playground and predicates.
export function getMetallicRatingTierCustom(
  input: MetallicRatingInputCustom
): MetallicRatingTierCustom | undefined {
  const {
    rating,
    tags,
    goatTagId,
    overrideTagIds,
    thresholds,
    thresholdEntity,
    ratingScores,
    sceneHasRoyalSapphireBonus,
  } = input;
  if (
    (thresholdEntity !== "performer" &&
      (sceneHasRoyalSapphireBonus ||
        hasRoyalSapphireSceneBonus(ratingScores))) ||
    hasConfiguredTag(tags, overrideTagIds?.royalSapphireTagId) ||
    hasConfiguredTag(tags, goatTagId)
  )
    return "royal_sapphire";
  if (hasConfiguredTag(tags, overrideTagIds?.goldTagId)) return "gold";
  if (hasConfiguredTag(tags, overrideTagIds?.silverTagId)) return "silver";
  if (hasConfiguredTag(tags, overrideTagIds?.bronzeTagId)) return "bronze";
  if (rating === undefined || rating === null || !Number.isFinite(rating))
    return undefined;
  const limits = getRatingCardThresholdsForEntity(thresholds, thresholdEntity);
  if (rating >= limits.royalSapphire) return "royal_sapphire";
  if (rating >= limits.gold) return "gold";
  if (rating >= limits.silver) return "silver";
  if (rating >= limits.bronze) return "bronze";
  return "none";
}

export function getRatingCardClass({
  rating,
  tags,
  goatTagId,
  overrideTagIds,
  theme,
  thresholds,
  thresholdEntity,
  ratingScores,
  sceneHasRoyalSapphireBonus,
  disabled,
}: {
  rating?: number | null;
  tags?: readonly IRatingCardTag[] | null;
  goatTagId?: string | null;
  overrideTagIds?: IRatingCardOverrideTagIds | null;
  theme?: string | null;
  thresholds?: IRatingCardThresholdConfig | null;
  thresholdEntity?: "scene" | "performer";
  ratingScores?: readonly IRatingCardScore[] | null;
  sceneHasRoyalSapphireBonus?: boolean;
  disabled?: boolean;
}): string {
  if (disabled) return "";

  const themeClass = `rating-card-theme-${normalizeRatingCardTheme(theme)}`;

  const tier = getMetallicRatingTierCustom({
    rating,
    tags,
    goatTagId,
    overrideTagIds,
    thresholds,
    thresholdEntity,
    ratingScores,
    sceneHasRoyalSapphireBonus,
  });
  const tierClass = tier ? METALLIC_TIER_CLASSES_CUSTOM[tier] : "";
  return tierClass ? `${themeClass} ${tierClass}` : "";
}
