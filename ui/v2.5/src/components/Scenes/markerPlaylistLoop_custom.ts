export function getToggledMarkerPlaylistLoopIdCustom(
  loopSingleMarkerId: string | null,
  markerId: string
): string | null {
  return loopSingleMarkerId === markerId ? null : markerId;
}
