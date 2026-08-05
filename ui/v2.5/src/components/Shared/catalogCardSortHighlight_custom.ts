export const CATALOG_CARD_SORT_HIGHLIGHT_CLASS_CUSTOM =
  "catalog-sort-highlight";

// CUSTOM: shared active-sort highlighting for values already rendered on cards
export function isCatalogCardSortHighlightedCustom(
  activeSortBy: string | undefined,
  ...matchingSortKeys: string[]
) {
  if (
    !activeSortBy ||
    activeSortBy === "random" ||
    activeSortBy.startsWith("random_")
  ) {
    return false;
  }

  return matchingSortKeys.includes(activeSortBy);
}

export function catalogCardSortHighlightClassCustom(
  activeSortBy: string | undefined,
  ...matchingSortKeys: string[]
) {
  return isCatalogCardSortHighlightedCustom(activeSortBy, ...matchingSortKeys)
    ? CATALOG_CARD_SORT_HIGHLIGHT_CLASS_CUSTOM
    : undefined;
}

export function hasCatalogCardSortValueCustom(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}
