export type PerformerRoleTileSize = "full" | "compact";

// Zero tiles only fit totals; scene strips list what happened in that scene.
export function showsZeroRoleTiles(
  tiles: PerformerRoleTileSize | undefined,
  sceneId: string | undefined
) {
  return !!tiles && !sceneId;
}

export function isZeroRoleTile(showZeroTiles: boolean, count?: number) {
  return showZeroTiles && count === 0;
}
