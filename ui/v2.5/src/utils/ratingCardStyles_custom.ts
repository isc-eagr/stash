export type RatingCardTheme = "premium" | "classic";

export const defaultRatingCardTheme: RatingCardTheme = "premium";

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

function getRatingTierClass(rating?: number | null): string {
  if (rating === undefined || rating === null) return "";
  if (rating >= 90) return "rating-goat";
  if (rating >= 84) return "rating-5-stars";
  if (rating >= 73) return "rating-4-stars";
  if (rating >= 60) return "rating-3-stars";
  return "";
}

export function getRatingCardClass({
  rating,
  tags,
  goatTagId,
  theme,
  disabled,
}: {
  rating?: number | null;
  tags?: readonly IRatingCardTag[] | null;
  goatTagId?: string | null;
  theme?: string | null;
  disabled?: boolean;
}): string {
  if (disabled) return "";

  const themeClass = `rating-card-theme-${normalizeRatingCardTheme(theme)}`;

  if (hasConfiguredTag(tags, goatTagId)) {
    return `${themeClass} rating-goat`;
  }

  const tierClass = getRatingTierClass(rating);
  if (!tierClass) return "";

  return `${themeClass} ${tierClass}`;
}
