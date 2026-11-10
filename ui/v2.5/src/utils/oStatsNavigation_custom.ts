export function makeStudioOStatsUrl(studioID: string) {
  return `/ostats/studio/${encodeURIComponent(studioID)}`;
}

export function makeSceneOStatsUrl(sceneID: string) {
  return `/ostats/scene/${encodeURIComponent(sceneID)}`;
}

export function makePerformerOStatsUrl(performerID: string) {
  return `/ostats/vato/${encodeURIComponent(performerID)}`;
}

// A release O opens its parent scene with that release selected.
export function makeOStatsSceneEventUrl(
  sceneID: string,
  videoTimestamp: number | null | undefined,
  linkToEntity: boolean,
  releaseID?: string | null
) {
  if (!linkToEntity) return makeSceneOStatsUrl(sceneID);

  const params = new URLSearchParams();
  if (releaseID) params.set("release", releaseID);
  if (videoTimestamp !== null && videoTimestamp !== undefined) {
    params.set("t", String(Math.floor(videoTimestamp)));
  }
  const query = params.toString();
  return `/scenes/${encodeURIComponent(sceneID)}${query ? `?${query}` : ""}`;
}

export function makeOStatsPerformerUrl(
  performerID: string,
  linkToEntity: boolean
) {
  return linkToEntity
    ? `/performers/${encodeURIComponent(performerID)}`
    : makePerformerOStatsUrl(performerID);
}
