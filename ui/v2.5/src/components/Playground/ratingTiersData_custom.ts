import {
  getRatingCardClass,
  hasRoyalSapphireSceneMarker,
  type IRatingCardOverrideTagIds,
  type IRatingCardThresholdConfig,
} from "src/utils/ratingCardStyles_custom";

export const ratingTiers = [
  { key: "royal_sapphire", label: "Royal Sapphire", color: "#95b4ff" },
  { key: "gold", label: "Gold", color: "#f2cd70" },
  { key: "silver", label: "Silver", color: "#c3d2e4" },
  { key: "bronze", label: "Bronze", color: "#dca476" },
  { key: "none", label: "No Tier", color: "#7e8998" },
] as const;

export type RatingTier = (typeof ratingTiers)[number]["key"];

type RatingTierTag = { id?: string | null };
type RatingTierMarkerTag = RatingTierTag & {
  ancestor_ids?: readonly string[] | null;
  parents?: readonly RatingTierMarkerTag[] | null;
};

export interface IRatingTierEntity {
  rating100?: number | null;
  tags?: readonly RatingTierTag[] | null;
  rating_tier_tags?: readonly RatingTierTag[] | null;
}

export interface IRatingTierScene extends IRatingTierEntity {
  rating_scores?:
    | readonly {
        section?: string | null;
        key?: string | null;
        raw_value?: number | null;
      }[]
    | null;
  scene_markers?:
    | readonly {
        primary_tag?: RatingTierMarkerTag | null;
        tags?: readonly RatingTierMarkerTag[] | null;
      }[]
    | null;
  scene_marker_tag_ancestors?:
    | readonly {
        tag_id?: string | null;
        ancestor_ids?: readonly string[] | null;
      }[]
    | null;
}

export interface IRatingTierConfig {
  thresholds?: IRatingCardThresholdConfig | null;
  overrideTagIds?: IRatingCardOverrideTagIds | null;
  goatTagId?: string | null;
}

const tierClasses: Array<[string, RatingTier]> = [
  ["rating-royal-sapphire", "royal_sapphire"],
  ["rating-5-stars", "gold"],
  ["rating-4-stars", "silver"],
  ["rating-3-stars", "bronze"],
];

// Use the same shared card classifier as scenes, performers, and the server
// metallic filter. Only a rated entity below Bronze receives the No Tier band.
export function ratingTierForEntity(
  entity: IRatingTierEntity,
  config: IRatingTierConfig,
  entityType: "scene" | "performer",
  scene?: IRatingTierScene
): RatingTier | undefined {
  const sceneData: IRatingTierScene | undefined =
    entityType === "scene" ? scene ?? entity : undefined;
  const ratingClass = getRatingCardClass({
    rating: entity.rating100,
    tags: entity.rating_tier_tags ?? entity.tags,
    goatTagId: config.goatTagId,
    overrideTagIds: config.overrideTagIds,
    thresholds: config.thresholds,
    thresholdEntity: entityType,
    ratingScores: sceneData?.rating_scores,
    sceneHasRoyalSapphireBonus:
      entityType === "scene" &&
      hasRoyalSapphireSceneMarker(
        sceneData?.scene_markers,
        config.goatTagId,
        sceneData?.scene_marker_tag_ancestors
      ),
  });
  const tier = tierClasses.find(([className]) =>
    ratingClass.includes(className)
  )?.[1];
  if (tier) return tier;
  return entity.rating100 === null || entity.rating100 === undefined
    ? undefined
    : "none";
}
