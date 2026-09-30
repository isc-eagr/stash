import { getRatingCardThresholdsForEntity } from "src/utils/ratingCardStyles_custom";
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

function hasTag(scene: SceneMetallicRatingScene, tagId?: string | null) {
  return !!tagId && scene.tags.includes(tagId);
}

// Shared by Scene Stats and O Stats: GOAT/bonus and override tags win, then
// the configured scene rating thresholds.
export function sceneMetallicRating(
  scene: SceneMetallicRatingScene,
  uiConfig: UIConfig
): SceneMetallicRating | undefined {
  const overrideTagIds = uiConfig?.ratingCardOverrideTagIds;
  const goatTagId = uiConfig?.roleTagIds?.goatTagId;

  if (
    scene.has_royal_sapphire_bonus ||
    hasTag(scene, overrideTagIds?.royalSapphireTagId) ||
    hasTag(scene, goatTagId)
  ) {
    return "royal_sapphire";
  }
  if (hasTag(scene, overrideTagIds?.goldTagId)) return "gold";
  if (hasTag(scene, overrideTagIds?.silverTagId)) return "silver";
  if (hasTag(scene, overrideTagIds?.bronzeTagId)) return "bronze";

  const rating = scene.rating100;
  if (rating === undefined || rating === null) return undefined;

  const thresholds = getRatingCardThresholdsForEntity(
    uiConfig?.ratingCardThresholds,
    "scene"
  );
  if (rating >= thresholds.royalSapphire) return "royal_sapphire";
  if (rating >= thresholds.gold) return "gold";
  if (rating >= thresholds.silver) return "silver";
  if (rating >= thresholds.bronze) return "bronze";
  return undefined;
}
