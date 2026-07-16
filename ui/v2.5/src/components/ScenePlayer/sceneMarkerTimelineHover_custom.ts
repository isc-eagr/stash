import {
  getChronologicalSceneMarkerHighlightPerformers,
  type ISceneMarkerChronologyHighlightPerformer,
  type ISceneMarkerChronologySearchMarker,
} from "../Scenes/SceneDetails/sceneMarkerChronologySearch_custom";

export function getSceneMarkerTimelineHoverPerformers<
  M extends ISceneMarkerChronologySearchMarker
>(
  marker: M,
  allMarkers: M[]
): Array<ISceneMarkerChronologyHighlightPerformer<M>> {
  return getChronologicalSceneMarkerHighlightPerformers(marker, allMarkers);
}
