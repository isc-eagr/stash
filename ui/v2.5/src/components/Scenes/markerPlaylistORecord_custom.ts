export interface IMarkerPlaylistORecordTargetCustom {
  sceneId: string;
  videoTimestamp: number;
}

export function getMarkerPlaylistORecordTargetCustom(
  marker: { sceneId: string } | undefined,
  videoTimestamp: number
): IMarkerPlaylistORecordTargetCustom | undefined {
  const sceneId = marker?.sceneId.trim();
  if (!sceneId || !Number.isFinite(videoTimestamp) || videoTimestamp < 0) {
    return undefined;
  }

  return { sceneId, videoTimestamp };
}
