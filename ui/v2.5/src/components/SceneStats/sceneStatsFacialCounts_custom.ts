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
};

export type SceneStatsFacialRoleTagIDs = {
  facial?: Set<string>;
  reallyHot?: Set<string>;
  secondCamera?: Set<string>;
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

// 2nd Camera markers repeat a moment from another angle, so they never count
// as facials, matching Nut Stats and the Facial Count filters.
export function isFacialMarker(
  marker: SceneStatsFacialMarker,
  roleTagIDs: SceneStatsFacialRoleTagIDs
) {
  return (
    markerHasTag(marker, roleTagIDs.facial) &&
    !markerHasTag(marker, roleTagIDs.secondCamera)
  );
}

export function facialCount(
  scene: SceneStatsFacialScene,
  roleTagIDs: SceneStatsFacialRoleTagIDs
) {
  return (
    scene.scene_markers?.filter((marker) => isFacialMarker(marker, roleTagIDs))
      .length ?? 0
  );
}

export function reallyHotFacialCount(
  scene: SceneStatsFacialScene,
  roleTagIDs: SceneStatsFacialRoleTagIDs
) {
  if (!roleTagIDs.reallyHot) return 0;

  return (
    scene.scene_markers?.filter(
      (marker) =>
        isFacialMarker(marker, roleTagIDs) &&
        markerHasTag(marker, roleTagIDs.reallyHot)
    ).length ?? 0
  );
}
