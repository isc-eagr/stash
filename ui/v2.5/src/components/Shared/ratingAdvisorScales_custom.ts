export interface IRatingAdvisorChoiceCustom {
  value: number;
  label: string;
  description: string;
  scoreValue?: number;
}

export const SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM = 1;
export const SCENE_NO_ORGASM_PENALTY_CUSTOM = -2;
export const SCENE_ENERGY_WEIGHT_CUSTOM = 0.4;
export const SCENE_USABLE_FACTOR_MAX_CUSTOM = 4;
export const SCENE_USABLE_FACTOR_WEIGHT_CUSTOM = 0.5;

export type RatingAdvisorEntityCustom = "scene" | "performer";

function getRatingAdvisorOrgasmMilestoneBonusCustom(count: number) {
  if (count < 3) {
    return 0;
  }

  let bonus = 1;
  for (let nextTier = 6; count >= nextTier; nextTier *= 2) {
    bonus += 1;
  }

  return bonus;
}

export function calculateRatingAdvisorOrgasmBonusCustom(
  entityType: RatingAdvisorEntityCustom,
  count: number
) {
  if (!Number.isFinite(count)) {
    return 0;
  }

  const safeCount = Math.max(0, Math.floor(count));
  const step = entityType === "scene" ? 1 : 2;
  let total = 0;

  for (let milestone = 3; milestone <= safeCount; milestone += step) {
    total += getRatingAdvisorOrgasmMilestoneBonusCustom(milestone);
  }

  return total;
}

export function getRatingAdvisorOrgasmBonusDescriptionCustom(
  entityType: RatingAdvisorEntityCustom
) {
  if (entityType === "scene") {
    return "Auto bonus: every nut from the 3rd earns its tier (+1 at 3–5, +2 at 6–11, +3 at 12–23; tiers keep doubling).";
  }

  return "Auto bonus: every 2 nuts from the 3rd earns its tier (+1 at 3–5, +2 at 6–11, +3 at 12–23; tiers keep doubling).";
}

const RATING_ADVISOR_ADJUSTMENT_TOOLTIP_LABELS_CUSTOM: Record<string, string> =
  {
    theme: "Uniform",
    oralOnly: "Oral-only",
    godTierOrgasm: "Orgasm",
    goatElement: "GOAT",
    unlikelyTop: "Unlikely top",
    orgasmBonus: "O Bonus",
    feetBonus: "Feet",
    groupBottomAttractiveness: "Hot bottom",
    groupOralOnly: "Oral-only",
    consistency: "Consistency",
    dick: "Pito",
    tattoosBonus: "Tattoos",
    noOrgasm: "No orgasm",
    production: "Production",
    feminine: "Feminine",
    "orgasm-count-bonus": "Orgasm count",
  };

export function getRatingAdvisorAdjustmentTooltipLabelCustom(
  key: string,
  fallback: string
) {
  return RATING_ADVISOR_ADJUSTMENT_TOOLTIP_LABELS_CUSTOM[key] ?? fallback;
}

export interface IRatingAdvisorMetricScaleCustom {
  max: number;
  weight?: number;
  choices: readonly IRatingAdvisorChoiceCustom[];
}

export type RatingAdvisorSixLevelChoiceTextCustom = Omit<
  IRatingAdvisorChoiceCustom,
  "value"
>;

export function ratingAdvisorSixLevelChoicesCustom(
  choices: RatingAdvisorSixLevelChoiceTextCustom[]
): IRatingAdvisorChoiceCustom[] {
  if (choices.length !== 6) {
    throw new Error("rating advisor six-level scales must have six choices");
  }

  return choices.map((choice, value) => ({
    ...choice,
    value,
  }));
}

export function getRatingAdvisorChoiceScoreCustom(
  metric: IRatingAdvisorMetricScaleCustom,
  score: number
) {
  const choice = metric.choices.find((c) => c.value === score);

  if (choice?.scoreValue !== undefined) {
    return choice.scoreValue;
  }

  return score * (metric.weight ?? 1);
}

export function calculateRatingAdvisorRating100Custom(
  scoreSubtotal: number,
  orgasmBonus: number
) {
  return Math.round(Math.max(0, scoreSubtotal) * 10) + orgasmBonus;
}

export function isRatingAdvisorRangeMetricCustom(
  metric: IRatingAdvisorMetricScaleCustom
) {
  return (
    metric.choices.length === metric.max + 1 &&
    metric.choices.every((choice, index) => choice.value === index)
  );
}

export function normalizeRatingAdvisorScoreValueCustom(
  metric: IRatingAdvisorMetricScaleCustom,
  rawValue?: number | null
) {
  if (rawValue === undefined || rawValue === null) {
    return 0;
  }

  const exactChoice = metric.choices.find(
    (choice) => choice.value === rawValue
  );
  if (exactChoice) {
    return exactChoice.value;
  }

  return metric.choices.reduce((nearest, choice) =>
    Math.abs(choice.value - rawValue) < Math.abs(nearest.value - rawValue)
      ? choice
      : nearest
  ).value;
}

export function getRatingAdvisorCompletionCustom(
  metricKeys: readonly string[],
  scores: Readonly<Record<string, number | undefined>>
) {
  const rated = metricKeys.filter((key) => scores[key] !== undefined).length;
  const total = metricKeys.length;

  return {
    rated,
    total,
    complete: rated === total,
    percent: total === 0 ? 100 : Math.round((rated / total) * 100),
  };
}

export function getRatingAdvisorChoiceHeatLevelCustom(
  choiceIndex: number,
  choiceCount: number
) {
  if (choiceCount <= 1) return 0;

  const safeIndex = Math.max(0, Math.min(choiceIndex, choiceCount - 1));
  return Math.round((safeIndex / (choiceCount - 1)) * 5);
}

export function getRatingAdvisorBarSummaryCustom(
  metric: IRatingAdvisorMetricScaleCustom,
  rawValue?: number | null
) {
  if (rawValue === undefined || rawValue === null) {
    return {
      fillPercent: 0,
      heatLevel: undefined,
      choice: undefined,
    };
  }

  const normalizedValue = normalizeRatingAdvisorScoreValueCustom(
    metric,
    rawValue
  );
  const choiceIndex = metric.choices.findIndex(
    (choice) => choice.value === normalizedValue
  );

  if (choiceIndex < 0) {
    return {
      fillPercent: 0,
      heatLevel: undefined,
      choice: undefined,
    };
  }

  return {
    fillPercent:
      choiceIndex === 0
        ? 0
        : Math.round(
            (choiceIndex / Math.max(1, metric.choices.length - 1)) * 100
          ),
    heatLevel: getRatingAdvisorChoiceHeatLevelCustom(
      choiceIndex,
      metric.choices.length
    ),
    choice: metric.choices[choiceIndex],
  };
}
