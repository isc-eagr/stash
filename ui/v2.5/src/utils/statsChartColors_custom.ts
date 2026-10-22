import { SEMANTIC_COLORS_CUSTOM as colors } from "./semanticColors_custom";
// CUSTOM: shared Black Steel colors for stats split bars and stacked columns:
// copper and steel, with lightness steps so neighbors stay distinct.
export const STATS_ACCENT = "var(--stats-accent)";

// Categories with no order; neighbors differ in lightness, not just hue.
export const STATS_CATEGORY_COLORS = [
  STATS_ACCENT,
  "#c1c6c9",
  "#704025",
  "#7a8288",
  "#f0c08f",
  "#464d53",
  "#9b5a32",
  "#dfe2e3",
];

// Shared semantic palettes; decorative categories above have no fixed meaning.
export const STATS_METALLIC_COLORS: Record<string, string> = {
  royal_sapphire: colors.royalSapphire,
  goat: colors.goat,
  gold: colors.gold,
  silver: colors.silver,
  bronze: colors.bronze,
  none: colors.noTier,
};
export const STATS_TOP_COLOR = colors.top;
export const STATS_BOTTOM_COLOR = colors.bottom;
export const STATS_QUALITY_COLORS: Record<string, string> = {
  regular: colors.regular,
  really_hot: colors.reallyHot,
  goat: colors.goat,
};

export const STATS_QUALITY_LEGEND = [
  { key: "regular", label: "Regular", color: STATS_QUALITY_COLORS.regular },
  {
    key: "really_hot",
    label: "Really Hot",
    color: STATS_QUALITY_COLORS.really_hot,
  },
  { key: "goat", label: "GOAT", color: STATS_QUALITY_COLORS.goat },
];

const DARK_TEXT = "#101317";
const LIGHT_TEXT = "#ffffff";

// Text on a colored segment; the copper accent takes dark text.
export function statsSegmentInk(color: string) {
  const token = color.match(/^var\((--semantic-[a-z-]+)\)$/)?.[1];
  if (token) return `var(${token}-ink)`;
  if (!color.startsWith("#")) return "var(--stats-accent-ink, #101317)";
  const value = parseInt(color.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? DARK_TEXT : LIGHT_TEXT;
}

export function statsPaletteColor(palette: readonly string[], index: number) {
  return palette[index % palette.length];
}

export function statsMetallicColor(key: string) {
  return STATS_METALLIC_COLORS[key] ?? STATS_METALLIC_COLORS.none;
}

// Fixed meanings take precedence over a decorative chart palette.
export function statsSemanticColorCustom(key: string) {
  const map: Record<string, string> = {
    sex: colors.sex,
    oral: colors.oral,
    solo: colors.solo,
    top: colors.top,
    bottom: colors.bottom,
    outstanding: colors.outstanding,
    standard: colors.standard,
    unclassified: colors.unclassified,
    unusable: colors.unusable,
    REGULAR: colors.regular,
    REALLY_HOT: colors.reallyHot,
    GOAT: colors.goat,
  };
  return map[key];
}
export function statsQualityGlowCustom(color?: string) {
  if (color !== colors.reallyHot && color !== colors.goat) return undefined;
  const key = color === colors.goat ? "goat" : "really-hot";
  return `0 0 0.45rem rgba(var(--semantic-${key}-rgb), 0.45)`;
}
