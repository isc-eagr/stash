// CUSTOM: begin - multi-segment bulk selection helpers
export type MultiSegmentSelectionSegment = {
  id: string;
};

export function selectedMultiSegmentIdsToDelete(
  segments: MultiSegmentSelectionSegment[],
  selectedSegmentIds: Set<string>
) {
  return segments
    .map((segment) => segment.id)
    .filter((id) => selectedSegmentIds.has(id));
}

export function unselectedMultiSegmentIdsToDelete(
  segments: MultiSegmentSelectionSegment[],
  selectedSegmentIds: Set<string>
) {
  return segments
    .map((segment) => segment.id)
    .filter((id) => !selectedSegmentIds.has(id));
}
// CUSTOM: end
