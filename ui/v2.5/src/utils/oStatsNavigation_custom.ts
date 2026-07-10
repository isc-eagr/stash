export function makeStudioOStatsUrl(studioID: string) {
  return `/ostats/studio/${encodeURIComponent(studioID)}`;
}
