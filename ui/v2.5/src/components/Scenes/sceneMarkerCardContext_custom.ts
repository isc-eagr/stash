import { useMemo } from "react";
import * as GQL from "src/core/generated-graphql";

export function toSceneMarkerCardContext(
  marker: GQL.SceneMarkerDataFragment
): GQL.SceneMarkerCardContextDataFragment {
  return {
    id: marker.id,
    seconds: marker.seconds,
    end_seconds: marker.end_seconds,
    primary_tag: marker.primary_tag,
    tags: marker.tags,
    top_performers: marker.top_performers,
    bottom_performers: marker.bottom_performers,
  };
}

export function getSceneMarkerCardContextMap(
  markers: readonly GQL.SceneMarkerDataFragment[],
  data?: GQL.FindSceneMarkerCardContextsQuery
): Map<string, GQL.SceneMarkerCardContextDataFragment[]> {
  const contextsBySceneID = new Map<
    string,
    GQL.SceneMarkerCardContextDataFragment[]
  >();

  markers.forEach((marker) => {
    const contexts = contextsBySceneID.get(marker.scene.id) ?? [];
    contexts.push(toSceneMarkerCardContext(marker));
    contextsBySceneID.set(marker.scene.id, contexts);
  });

  data?.findScenes.scenes.forEach((scene) => {
    contextsBySceneID.set(scene.id, scene.scene_markers);
  });

  return contextsBySceneID;
}

export function useSceneMarkerCardContextMap(
  markers: readonly GQL.SceneMarkerDataFragment[]
) {
  const sceneIDs = useMemo(
    () => Array.from(new Set(markers.map((marker) => marker.scene.id))),
    [markers]
  );
  const { data } = GQL.useFindSceneMarkerCardContextsQuery({
    skip: sceneIDs.length === 0,
    variables: { ids: sceneIDs },
  });

  return useMemo(
    () => getSceneMarkerCardContextMap(markers, data),
    [data, markers]
  );
}
