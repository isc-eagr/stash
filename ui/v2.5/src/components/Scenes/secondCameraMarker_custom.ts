// CUSTOM: a 2nd Camera marker shows another angle of a nut already counted, so
// marker cards mark it and tile counts skip it. Matches the tag or a direct
// child of it on the marker's own tags.
type MarkerTag = { id: string; parents?: Array<{ id: string }> | null };

export function isSecondCameraMarkerCustom(
  tags: MarkerTag[],
  secondCameraTagId?: string
): boolean {
  if (!secondCameraTagId) return false;
  return tags.some(
    (tag) =>
      tag.id === secondCameraTagId ||
      !!tag.parents?.some((parent) => parent.id === secondCameraTagId)
  );
}
