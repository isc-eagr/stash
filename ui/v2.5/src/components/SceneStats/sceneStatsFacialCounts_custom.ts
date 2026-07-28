export type SceneStatsTagRef = {
  id?: string;
};

export type SceneStatsFacialMarker = {
  primary_tag?: SceneStatsTagRef | null;
  tags?: SceneStatsTagRef[] | null;
  tag_ids?: string[] | null;
};

export type SceneStatsFacialScene = {
  scene_markers?: SceneStatsFacialMarker[] | null;
  is_release_past_year?: boolean;
};

export type SceneStatsFacialRoleTagIDs = {
  facial?: Set<string>;
  reallyHot?: Set<string>;
};

export function tagMatches(
  tag: SceneStatsTagRef | null | undefined,
  targetIds?: Set<string>
) {
  return !!tag?.id && !!targetIds && targetIds.has(tag.id);
}

export function markerHasTag(
  marker: SceneStatsFacialMarker,
  targetIds?: Set<string>
) {
  if (targetIds && marker.tag_ids?.some((tagID) => targetIds.has(tagID))) {
    return true;
  }
  if (tagMatches(marker.primary_tag, targetIds)) return true;
  return marker.tags?.some((tag) => tagMatches(tag, targetIds)) ?? false;
}

export function facialCount(
  scene: SceneStatsFacialScene,
  facialTagIDs?: Set<string>
) {
  if (!facialTagIDs) return 0;
  return (
    scene.scene_markers?.filter((marker) => markerHasTag(marker, facialTagIDs))
      .length ?? 0
  );
}

export function facialCountPastYear(
  scene: SceneStatsFacialScene,
  facialTagIDs?: Set<string>
) {
  return scene.is_release_past_year ? facialCount(scene, facialTagIDs) : 0;
}

export function reallyHotFacialCount(
  scene: SceneStatsFacialScene,
  roleTagIDs: SceneStatsFacialRoleTagIDs
) {
  const { facial, reallyHot } = roleTagIDs;
  if (!facial || !reallyHot) return 0;

  return (
    scene.scene_markers?.filter(
      (marker) =>
        markerHasTag(marker, facial) && markerHasTag(marker, reallyHot)
    ).length ?? 0
  );
}
