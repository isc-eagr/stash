import { gql, useQuery } from "@apollo/client";
import type { FindStudioPerformerStatsQuery } from "src/core/generated-graphql";

type StudioPerformerCardStatsData = {
  findStudio?: Omit<
    NonNullable<FindStudioPerformerStatsQuery["findStudio"]>,
    "studio_performer_activity_stats"
  > | null;
};

// Performer cards show scoped role counts but do not render activity statistics.
// Studio cards retain the full query, including their activity statistics.
export const STUDIO_PERFORMER_CARD_STATS = gql`
  query StudioPerformerCardStats($id: ID!, $performerId: ID!, $depth: Int) {
    findStudio(id: $id) {
      id
      scene_count(depth: $depth, performer_id: $performerId)
      studio_performer_role_stats(performer_id: $performerId, depth: $depth) {
        sex_scene_count
        sex_top_count
        sex_bottom_count
        sex_with_top_count
        sex_with_bottom_count
        oral_scene_count
        oral_top_count
        oral_bottom_count
        oral_with_top_count
        oral_with_bottom_count
        solo_scene_count
        facial_scene_count
        facial_top_count
        facial_bottom_count
        facial_with_top_count
        facial_with_bottom_count
        facial_marker_with_top_count
        facial_marker_with_bottom_count
        sex_unique_partner_count
        oral_unique_partner_count
        facial_unique_partner_count
        orgasm_top_count
        facial_marker_count
        feet_top_count
      }

      group_count(depth: $depth, performer_id: $performerId)
      image_count(depth: $depth, performer_id: $performerId)
      gallery_count(depth: $depth, performer_id: $performerId)
      o_counter(depth: $depth, performer_id: $performerId)
    }
  }
`;

export function useStudioPerformerCardStats(
  studioId: string | undefined,
  performerId: string,
  depth: number
) {
  return useQuery<StudioPerformerCardStatsData>(STUDIO_PERFORMER_CARD_STATS, {
    variables: { id: studioId ?? "", performerId, depth },
    skip: !studioId,
  });
}
