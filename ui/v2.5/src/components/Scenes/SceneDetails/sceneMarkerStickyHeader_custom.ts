// CUSTOM: keep sticky activity headers visibly separated from the marker toolbar.
const stickyHeaderGapPixels = 4;

export function getSceneMarkerStickyHeaderOffset(
  toolbarHeight: number
): string {
  return `${Math.max(0, Math.ceil(toolbarHeight)) + stickyHeaderGapPixels}px`;
}
