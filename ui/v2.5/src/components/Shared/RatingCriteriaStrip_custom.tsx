import React, { useMemo } from "react";
import { getRatingSummaryMetricsCustom } from "./RatingAdvisor_custom";
import {
  calculateRatingAdvisorOrgasmBonusCustom,
  formatRatingAdvisorContributionCustom,
  getRatingAdvisorAdjustmentSummariesCustom,
  getRatingAdvisorCriterionSummariesCustom,
  type RatingAdvisorEntityCustom,
} from "./ratingAdvisorScales_custom";
import type { SceneRatingModeCustom } from "./groupSceneRating_custom";
import { RatingStrip } from "./RatingStrip_custom";

// CUSTOM: one scene's or vato's stored Rating Advisor scores as an inline
// strip. Replaces the rating star's hover summary.
interface IRatingCriteriaStripProps {
  entityType: RatingAdvisorEntityCustom;
  entityId: string;
  ratingScores?: ReadonlyArray<{
    section?: string | null;
    key?: string | null;
    raw_value?: number | null;
  }> | null;
  oCount?: number | null;
  sceneRatingMode?: SceneRatingModeCustom;
  trailing?: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
}

export const RatingCriteriaStrip: React.FC<IRatingCriteriaStripProps> = ({
  entityType,
  entityId,
  ratingScores,
  oCount,
  sceneRatingMode,
  trailing,
  className,
  header,
}) => {
  const { criteria, adjustments } = useMemo(() => {
    const metrics = getRatingSummaryMetricsCustom(
      entityType,
      ratingScores,
      sceneRatingMode
    );
    return {
      criteria: getRatingAdvisorCriterionSummariesCustom(
        metrics,
        ratingScores
      ).map(({ metric, summary }) => ({
        key: metric.key,
        label: metric.shortTitle ?? metric.title,
        detail: `${metric.title}: ${summary.choice?.label ?? "Not rated"}`,
        steps: metric.choices.length - 1,
        value: summary.choiceIndex ?? 0,
        heatLevel: summary.heatLevel,
        rated: !!summary.choice,
      })),
      // Bonuses only count once an item has advisor scores.
      adjustments: ratingScores?.length
        ? getRatingAdvisorAdjustmentSummariesCustom(
            metrics,
            ratingScores,
            calculateRatingAdvisorOrgasmBonusCustom(entityType, oCount ?? 0)
          ).map((row) => {
            // The O Count bonus comes from the O counter, not markers.
            const label =
              row.key === "orgasm-count-bonus" ? "O Count" : row.title;
            const value = formatRatingAdvisorContributionCustom(
              row.contribution
            );
            return {
              key: row.key,
              label,
              section: row.section,
              value,
              detail: `${label}: ${value}`,
            };
          })
        : [],
    };
  }, [entityType, oCount, ratingScores, sceneRatingMode]);

  return (
    <RatingStrip
      adjustments={adjustments}
      className={className}
      criteria={criteria}
      header={header}
      idPrefix={`rating-criteria-${entityType}-${entityId}`}
      trailing={trailing}
    />
  );
};
