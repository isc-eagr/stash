import type * as GQL from "src/core/generated-graphql";

// CUSTOM: list/card views use a lightweight list fragment; detail-only payloads and
// role stats may be supplied by detail queries or lazy card stats queries.
type PerformerRoleStatsFields = Pick<
  GQL.PerformerDataFragment,
  | "sex_scene_count"
  | "oral_scene_count"
  | "solo_scene_count"
  | "facial_scene_count"
  | "sex_top_count"
  | "sex_bottom_count"
  | "oral_top_count"
  | "oral_bottom_count"
  | "facial_top_count"
  | "facial_bottom_count"
  | "facial_marker_count"
  | "facial_marker_top_count"
  | "facial_marker_bottom_count"
  | "facial_marker_with_top_count"
  | "facial_marker_with_bottom_count"
  | "orgasm_top_count"
  | "feet_top_count"
  | "feet_marker_count"
  | "sex_with_top_count"
  | "sex_with_bottom_count"
  | "oral_with_top_count"
  | "oral_with_bottom_count"
  | "facial_with_top_count"
  | "facial_with_bottom_count"
  | "sex_unique_partner_count"
  | "oral_unique_partner_count"
  | "facial_unique_partner_count"
>;

export type PerformerListData = GQL.PerformerListDataFragment &
  Partial<
    Pick<GQL.PerformerDataFragment, "additional_images" | "rating_scores">
  > &
  Partial<PerformerRoleStatsFields>;
