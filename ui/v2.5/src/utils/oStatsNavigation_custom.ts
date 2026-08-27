export function makeStudioOStatsUrl(studioID: string) {
  return `/ostats/studio/${encodeURIComponent(studioID)}`;
}

export function makeSceneOStatsUrl(sceneID: string) {
  return `/ostats/scene/${encodeURIComponent(sceneID)}`;
}

export function makePerformerOStatsUrl(performerID: string) {
  return `/ostats/vato/${encodeURIComponent(performerID)}`;
}

export function makeOStatsSceneEventUrl(
  sceneID: string,
  videoTimestamp: number | null | undefined,
  linkToEntity: boolean
) {
  if (!linkToEntity) return makeSceneOStatsUrl(sceneID);

  const sceneUrl = `/scenes/${encodeURIComponent(sceneID)}`;
  return videoTimestamp === null || videoTimestamp === undefined
    ? sceneUrl
    : `${sceneUrl}?t=${Math.floor(videoTimestamp)}`;
}

export function makeOStatsPerformerUrl(
  performerID: string,
  linkToEntity: boolean
) {
  return linkToEntity
    ? `/performers/${encodeURIComponent(performerID)}`
    : makePerformerOStatsUrl(performerID);
}
