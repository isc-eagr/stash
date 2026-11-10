export function getFlippedSceneMarkerPerformers<T extends { id: string }>(
  topPerformers: T[],
  bottomPerformers: T[]
) {
  return {
    topPerformers: bottomPerformers,
    bottomPerformers: topPerformers,
    top_performer_ids: bottomPerformers.map((performer) => performer.id),
    bottom_performer_ids: topPerformers.map((performer) => performer.id),
  };
}
