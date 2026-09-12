import { useEffect, useMemo, useState } from "react";
import {
  getRatingCardThresholdsForEntity,
  type IRatingCardThresholdConfig,
} from "src/utils/ratingCardStyles_custom";

export function useRatingTierThresholdDraft(
  configured: IRatingCardThresholdConfig | null | undefined,
  entity: "scene" | "performer"
) {
  const { bronze, silver, gold, royalSapphire } =
    getRatingCardThresholdsForEntity(configured, entity);
  const saved = useMemo(
    () => ({ bronze, silver, gold, royalSapphire }),
    [bronze, silver, gold, royalSapphire]
  );
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const changed = JSON.stringify(saved) !== JSON.stringify(draft);
  return { draft, setDraft, changed, reset: () => setDraft(saved) };
}
