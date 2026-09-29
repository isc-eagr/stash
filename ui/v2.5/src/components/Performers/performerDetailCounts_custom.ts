import { gql, useQuery } from "@apollo/client";

export const PerformerStudioCountQuery = gql`
  query PerformerStudioCount($id: ID!) {
    findStudios(
      studio_filter: {
        scenes_filter: { performers: { modifier: INCLUDES, value: [$id] } }
      }
      filter: { per_page: 1 }
    ) {
      count
    }
  }
`;

export const PerformerMarkerCountQuery = gql`
  query PerformerMarkerCount($id: ID!) {
    findSceneMarkers(
      scene_marker_filter: {
        scene_marker_tags: {
          modifier: EQUALS
          groups_extended: [
            {
              tag_ids: []
              performer_mode: "OR"
              top_performer_ids: [$id]
              bottom_performer_ids: [$id]
            }
          ]
        }
      }
      filter: { per_page: 1 }
    ) {
      count
    }
  }
`;

export function usePerformerStudioCount(id: string) {
  const { data } = useQuery<{ findStudios: { count: number } }, { id: string }>(
    PerformerStudioCountQuery,
    { variables: { id } }
  );
  return data?.findStudios.count ?? 0;
}

// Match the Markers tab's top-OR-bottom filter. A marker assigned in both
// roles must only be counted once.
export function usePerformerMarkerCount(id: string) {
  const { data } = useQuery<
    { findSceneMarkers: { count: number } },
    { id: string }
  >(PerformerMarkerCountQuery, { variables: { id } });
  return data?.findSceneMarkers.count ?? 0;
}
