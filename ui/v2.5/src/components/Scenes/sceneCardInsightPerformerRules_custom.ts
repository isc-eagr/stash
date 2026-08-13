import { isRoyalSapphireRatingCard } from "src/utils/ratingCardStyles_custom";
import type {
  SceneCardInsightCandidate,
  SceneCardInsightRatingConfig,
  SceneCardInsightScene,
} from "./sceneCardInsightTypes_custom";

function isMexicanCountry(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized === "MX" || normalized === "MEX" || normalized === "MEXICO";
}

function performerNames(names: string[]) {
  return names.sort((a, b) => a.localeCompare(b)).join(", ");
}

export function getPerformerLineupCandidates(
  scene: SceneCardInsightScene,
  ratingConfig?: SceneCardInsightRatingConfig
): SceneCardInsightCandidate[] {
  const uniquePerformers = [
    ...new Map(
      scene.performers.map((performer) => [performer.id, performer])
    ).values(),
  ];
  const mexicanPerformers = uniquePerformers.filter((performer) =>
    isMexicanCountry(performer.country)
  );
  const favoritePerformers = uniquePerformers.filter((performer) =>
    isRoyalSapphireRatingCard({
      rating: performer.rating100,
      tags: performer.rating_tier_tags,
      thresholds: ratingConfig?.thresholds,
      overrideTagIds: ratingConfig?.overrideTagIds,
      thresholdEntity: "performer",
    })
  );
  const candidates: SceneCardInsightCandidate[] = [];

  if (mexicanPerformers.length > 0) {
    const allMexican =
      uniquePerformers.length >= 2 &&
      mexicanPerformers.length === uniquePerformers.length;
    candidates.push({
      key: "lineup-mexican",
      label: allMexican
        ? "All-Mexican"
        : mexicanPerformers.length === 1
        ? "Mexican vato"
        : `Mexican vatos ×${mexicanPerformers.length}`,
      detail: performerNames(
        mexicanPerformers.map((performer) => performer.name)
      ),
      tone: "lineup",
      kind: "country-lineup",
      score: mexicanPerformers.length,
    });
  }

  if (favoritePerformers.length > 0) {
    candidates.push({
      key: "lineup-favorite-vatos",
      label: `Favorite Vatos ×${favoritePerformers.length}`,
      detail: `Royal Sapphire: ${performerNames(
        favoritePerformers.map((performer) => performer.name)
      )}`,
      tone: "lineup",
      kind: "favorite-lineup",
      score: favoritePerformers.length,
    });
  }

  return candidates;
}
