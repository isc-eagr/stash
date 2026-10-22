import { getMetallicRatingTierCustom } from "src/utils/ratingCardStyles_custom";
import type { IUIConfig } from "src/core/config";

export type SceneMetallicRatingScene = {
  rating100?: number | null;
  tags: readonly string[];
  has_royal_sapphire_bonus: boolean;
};

export type SceneMetallicRating =
  | "royal_sapphire"
  | "gold"
  | "silver"
  | "bronze";

type UIConfig = IUIConfig | undefined;

// Scene Stats and O Stats use the same semantic classifier as cards.
export function sceneMetallicRating(
  scene: SceneMetallicRatingScene,
  uiConfig: UIConfig
): SceneMetallicRating | undefined {
  const tier = getMetallicRatingTierCustom({
    rating: scene.rating100,
    tags: scene.tags.map((id) => ({ id })),
    thresholds: uiConfig?.ratingCardThresholds,
    overrideTagIds: uiConfig?.ratingCardOverrideTagIds,
    goatTagId: uiConfig?.roleTagIds?.goatTagId,
    sceneHasRoyalSapphireBonus: scene.has_royal_sapphire_bonus,
    thresholdEntity: "scene",
  });
  return tier === "none" ? undefined : tier;
}
