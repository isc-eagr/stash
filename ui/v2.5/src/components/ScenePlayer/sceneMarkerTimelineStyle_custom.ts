// CUSTOM: Royal Sapphire state detection for scene-player timeline markers.

interface ISceneMarkerTimelineStyleTag {
  id: string;
  parents?: readonly ISceneMarkerTimelineStyleTag[] | null;
}

interface ISceneMarkerTimelineStyleMarker {
  primary_tag?: ISceneMarkerTimelineStyleTag | null;
  tags?: readonly ISceneMarkerTimelineStyleTag[] | null;
}

function timelineTagMatchesConfiguredTag(
  tag: ISceneMarkerTimelineStyleTag | null | undefined,
  tagId?: string | null,
  visited: Set<string> = new Set()
): boolean {
  if (!tag || !tagId) return false;
  if (tag.id === tagId) return true;
  if (visited.has(tag.id)) return false;

  visited.add(tag.id);
  return !!tag.parents?.some((parent) =>
    timelineTagMatchesConfiguredTag(parent, tagId, visited)
  );
}

export function isSceneMarkerTimelineRoyalSapphire(
  marker: ISceneMarkerTimelineStyleMarker,
  {
    goatTagId,
    royalSapphireTagId,
  }: {
    goatTagId?: string | null;
    royalSapphireTagId?: string | null;
  }
): boolean {
  const markerTags = [marker.primary_tag, ...(marker.tags ?? [])];

  return markerTags.some(
    (tag) =>
      timelineTagMatchesConfiguredTag(tag, goatTagId) ||
      timelineTagMatchesConfiguredTag(tag, royalSapphireTagId)
  );
}
