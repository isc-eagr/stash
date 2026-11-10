export interface IMarkerPreloadCandidateCustom {
  id: string;
  sceneId: string;
  releaseId?: string | null;
}

export function getNextSceneMarkerIndexCustom(
  markers: IMarkerPreloadCandidateCustom[],
  currentIndex: number,
  loopEnabled: boolean,
  loopSingleMarkerId: string | null
): number | undefined {
  const currentMarker = markers[currentIndex];
  if (!currentMarker || loopSingleMarkerId === currentMarker.id) {
    return undefined;
  }

  const maximumOffset = loopEnabled ? markers.length : markers.length - 1;
  for (let offset = 1; offset <= maximumOffset; offset += 1) {
    const candidateIndex = currentIndex + offset;
    if (!loopEnabled && candidateIndex >= markers.length) {
      break;
    }

    const wrappedIndex = candidateIndex % markers.length;
    if (
      markers[wrappedIndex].sceneId !== currentMarker.sceneId ||
      markers[wrappedIndex].releaseId !== currentMarker.releaseId
    ) {
      return wrappedIndex;
    }
  }

  return undefined;
}

export function markerPreloadMatchesCustom(
  preload:
    | {
        markerId: string;
        sceneId: string;
        releaseId?: string | null;
      }
    | null
    | undefined,
  marker: IMarkerPreloadCandidateCustom
) {
  return (
    preload?.markerId === marker.id &&
    preload.sceneId === marker.sceneId &&
    preload.releaseId === marker.releaseId
  );
}
