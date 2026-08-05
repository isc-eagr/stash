type MarkerTitle = string | null | undefined;

function normalizeMarkerTitle(title: string) {
  return title.trim().toLocaleLowerCase();
}

export function mergeMarkerTitleSuggestions(
  regularTitles: MarkerTitle[],
  additionalTitles: MarkerTitle[] = [],
  includeRegularTitles = true
) {
  const titles = new Map<string, string>();
  const sourceTitles = includeRegularTitles
    ? [...regularTitles, ...additionalTitles]
    : additionalTitles;

  sourceTitles.forEach((title) => {
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) return;

    const normalizedTitle = normalizeMarkerTitle(trimmedTitle);
    if (!titles.has(normalizedTitle)) {
      titles.set(normalizedTitle, trimmedTitle);
    }
  });

  return [...titles.values()];
}

export function canCreateMarkerTitle(
  inputTitle: string,
  existingTitles: string[]
) {
  const normalizedInput = normalizeMarkerTitle(inputTitle);
  return (
    normalizedInput.length > 0 &&
    !existingTitles.some(
      (title) => normalizeMarkerTitle(title) === normalizedInput
    )
  );
}
