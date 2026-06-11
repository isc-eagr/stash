import type * as GQL from "src/core/generated-graphql";

// CUSTOM: list/card views do not need detail-only rating advisor or image manager payloads.
export type PerformerListData = Omit<
  GQL.PerformerDataFragment,
  "additional_images" | "rating_scores"
> &
  Partial<
    Pick<GQL.PerformerDataFragment, "additional_images" | "rating_scores">
  >;
