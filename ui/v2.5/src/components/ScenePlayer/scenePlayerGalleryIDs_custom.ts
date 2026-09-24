import type * as GQL from "src/core/generated-graphql";

export const scenePlayerGalleryIDsCustom = (
  scene: GQL.SceneDataFragment,
  releaseId?: string
): string[] => {
  const selected = scene.galleries?.map((gallery) => gallery.id) ?? [];
  if (releaseId) return selected;
  return [
    ...selected,
    ...(scene.releases?.flatMap((release) =>
      release.galleries?.map((gallery) => gallery.id)
    ) ?? []),
  ];
};
