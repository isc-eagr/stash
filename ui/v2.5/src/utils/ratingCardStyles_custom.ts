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

function getRatingTierClass(
  rating?: number | null,
  thresholds?: IRatingCardThresholdConfig | null,
  thresholdEntity?: "scene" | "performer"
): string {
  if (rating === undefined || rating === null) return "";

  const normalizedThresholds = getRatingCardThresholdsForEntity(
    thresholds,
    thresholdEntity
  );

  if (rating >= normalizedThresholds.royalSapphire)
    return "rating-royal-sapphire";
  if (rating >= normalizedThresholds.gold) return "rating-5-stars";
  if (rating >= normalizedThresholds.silver) return "rating-4-stars";
  if (rating >= normalizedThresholds.bronze) return "rating-3-stars";
  return "";
}

function getRatingTierOverrideClass(
  tags: readonly IRatingCardTag[] | null | undefined,
  overrideTagIds?: IRatingCardOverrideTagIds | null,
  goatTagId?: string | null
): string {
  if (
    hasConfiguredTag(tags, overrideTagIds?.royalSapphireTagId) ||
    hasConfiguredTag(tags, goatTagId)
  ) {
    return "rating-royal-sapphire";
  }
  if (hasConfiguredTag(tags, overrideTagIds?.goldTagId)) {
    return "rating-5-stars";
  }
  if (hasConfiguredTag(tags, overrideTagIds?.silverTagId)) {
    return "rating-4-stars";
  }
  if (hasConfiguredTag(tags, overrideTagIds?.bronzeTagId)) {
    return "rating-3-stars";
  }

  return "";
}

export function getRatingCardClass({
  rating,
  tags,
  goatTagId,
  overrideTagIds,
  theme,
  thresholds,
  thresholdEntity,
  disabled,
}: {
  rating?: number | null;
  tags?: readonly IRatingCardTag[] | null;
  goatTagId?: string | null;
  overrideTagIds?: IRatingCardOverrideTagIds | null;
  theme?: string | null;
  thresholds?: IRatingCardThresholdConfig | null;
  thresholdEntity?: "scene" | "performer";
  disabled?: boolean;
}): string {
  if (disabled) return "";

  const themeClass = `rating-card-theme-${normalizeRatingCardTheme(theme)}`;

  const overrideClass = getRatingTierOverrideClass(
    tags,
    overrideTagIds,
    goatTagId
  );
  if (overrideClass) return `${themeClass} ${overrideClass}`;

  const tierClass = getRatingTierClass(rating, thresholds, thresholdEntity);
  if (!tierClass) return "";

  return `${themeClass} ${tierClass}`;
}

export function isRoyalSapphireRatingCard({
  rating,
  tags,
  overrideTagIds,
  thresholds,
  thresholdEntity,
}: {
  rating?: number | null;
  tags?: readonly IRatingCardTag[] | null;
  overrideTagIds?: IRatingCardOverrideTagIds | null;
  thresholds?: IRatingCardThresholdConfig | null;
  thresholdEntity?: "scene" | "performer";
}) {
  const overrideClass = getRatingTierOverrideClass(tags, overrideTagIds);
  if (overrideClass) return overrideClass === "rating-royal-sapphire";

  return (
    getRatingTierClass(rating, thresholds, thresholdEntity) ===
    "rating-royal-sapphire"
  );
}
