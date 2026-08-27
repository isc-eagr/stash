export function formatSceneOOrdinalLabelCustom(ordinal: number): string {
  const suffix =
    ordinal % 100 >= 11 && ordinal % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[ordinal % 10] ?? "th";

  return `${ordinal}${suffix} O`;
}

export function shouldShowSceneOOrdinalChipCustom(
  isFirstForScene: boolean
): boolean {
  return !isFirstForScene;
}
