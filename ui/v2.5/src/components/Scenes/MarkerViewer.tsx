import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import { markerTitle } from "src/core/markers";
import { MultiVideoViewer, IVideoViewerItem } from "./MultiVideoViewer";

const FIND_MARKERS_FOR_VIEWER = gql`
  query FindMarkersForViewer($ids: [ID!]) {
    findSceneMarkers(ids: $ids) {
      scene_markers {
        ...SceneMarkerData
      }
    }
  }
  ${GQL.SceneMarkerDataFragmentDoc}
`;

interface IFindMarkersForViewerResult {
  findSceneMarkers: {
    scene_markers: GQL.SceneMarkerDataFragment[];
  };
}

function performerDisplayName(p: {
  name: string;
  disambiguation?: string | null;
}) {
  return p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name;
}

export const MarkerViewer: React.FC = () => {
  const location = useLocation();

  const markerIds = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = params.get("ids");
    return ids ? ids.split(",").filter(Boolean) : [];
  }, [location.search]);

  const { data, loading } = useQuery<IFindMarkersForViewerResult>(
    FIND_MARKERS_FOR_VIEWER,
    {
      skip: markerIds.length === 0,
      variables: { ids: markerIds },
    }
  );

  const items = useMemo<IVideoViewerItem[]>(() => {
    return (data?.findSceneMarkers.scene_markers ?? []).map((m) => ({
      id: m.id,
      streamUrl: m.stream,
      title: markerTitle(m) || m.scene?.title || `Marker ${m.id}`,
      sceneId: m.scene?.id ?? undefined,
      topPerformerNames: (m.top_performers ?? [])
        .map(performerDisplayName)
        .filter(Boolean),
      bottomPerformerNames: (m.bottom_performers ?? [])
        .map(performerDisplayName)
        .filter(Boolean),
      topPerformers: (m.top_performers ?? []).map((p) => ({
        id: p.id,
        name: performerDisplayName(p),
        image_path: p.image_path,
        disambiguation: p.disambiguation,
      })),
      bottomPerformers: (m.bottom_performers ?? []).map((p) => ({
        id: p.id,
        name: performerDisplayName(p),
        image_path: p.image_path,
        disambiguation: p.disambiguation,
      })),
    }));
  }, [data?.findSceneMarkers.scene_markers]);

  return (
    <MultiVideoViewer
      items={items}
      orderedIds={markerIds}
      loading={loading}
      title="Marker Viewer"
      itemLabel="marker"
      emptyMessage="No markers found for this viewer URL."
    />
  );
};

export default MarkerViewer;
