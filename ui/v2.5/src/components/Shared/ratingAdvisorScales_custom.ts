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

export const SCENE_GOAT_ELEMENT_BONUS_CHOICES_CUSTOM: IRatingAdvisorChoiceCustom[] =
  [
    {
      value: 0.5,
      label: "GOAT +5",
      description: "A little GOAT sazón. Nice touch.",
    },
    {
      value: 1,
      label: "GOAT +10",
      description: "A chingón GOAT moment that bumps the scene for real.",
    },
    {
      value: 1.5,
      label: "GOAT +15",
      description: "Big GOAT moment. You'd keep the scene just for this.",
    },
    {
      value: 2,
      label: "GOAT +20",
      description:
        "Life-changing. You're into vatos and collect porn exactly for moments like this.",
    },
  ];

export function getSceneGoatElementBonusFilterChoicesCustom() {
  return SCENE_GOAT_ELEMENT_BONUS_CHOICES_CUSTOM.map(({ value, label }) => ({
    value,
    label,
  }));
}

export const SCENE_ORGASM_QUALITY_CHOICES_CUSTOM: IRatingAdvisorChoiceCustom[] =
  [
    {
      value: 0,
      label: "Absent/bad nuts",
      description: "Qué gacho. No nut, fake nut, or they hid it from you.",
    },
    {
      value: 1,
      label: "Below average nuts",
      description: "There's a nut, but it's barely there, or meh.",
    },
    {
      value: 2,
      label: "Standard nuts",
      description:
        "Normalito. A solid nut, hot because nuts are hot but that's it.",
    },
    {
      value: 3,
      label: "Above average",
      description:
        "That nut is delicious. The vato seems to have loved it, or it's a facial which by default falls in this range.",
    },
    {
      value: 4,
      label: "Outstanding nuts",
      description:
        "You thought this kind of nut was only possible in dreams. The amount of mecos and the way the bright white looks on screen, the pulsing, or the way the vato squirms. DAMN!!!",
    },
  ];

export function getSceneOrgasmQualityFilterChoicesCustom() {
  return SCENE_ORGASM_QUALITY_CHOICES_CUSTOM.map(({ value, label }) => ({
    value,
    label,
  }));
}

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

// Points one O earns; performers only score every 2nd O from the 3rd on.
function getRatingAdvisorOBonusCustom(
  entityType: RatingAdvisorEntityCustom,
  o: number
) {
  const step = entityType === "scene" ? 1 : 2;
  return o >= 3 && (o - 3) % step === 0
    ? getRatingAdvisorOrgasmMilestoneBonusCustom(o)
    : 0;
}

function getSafeOrgasmCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function calculateRatingAdvisorOrgasmBonusCustom(
  entityType: RatingAdvisorEntityCustom,
  count: number
) {
  const safeCount = getSafeOrgasmCount(count);
  let total = 0;

  for (let o = 3; o <= safeCount; o++) {
    total += getRatingAdvisorOBonusCustom(entityType, o);
  }

  return total;
}

export interface IRatingAdvisorOTrackTierCustom {
  bonus: number;
  start: number;
  end: number;
  dots: { number: number; earns: number; recorded: boolean }[];
}

// O track for the O Count bonus: tiers through +3 always show; higher tiers
// show only once the count reaches them.
export function getRatingAdvisorOTrackCustom(
  entityType: RatingAdvisorEntityCustom,
  count: number
) {
  const safeCount = getSafeOrgasmCount(count);
  const tiers: IRatingAdvisorOTrackTierCustom[] = [];

  for (let bonus = 0, start = 1; bonus <= 3 || start <= safeCount; bonus++) {
    // Each tier after the first is twice as long: 3–5, 6–11, 12–23, ...
    const end = bonus === 0 ? 2 : start * 2 - 1;
    const dots = [];
    for (let o = start; o <= end; o++) {
      dots.push({
        number: o,
        earns: getRatingAdvisorOBonusCustom(entityType, o),
        recorded: o <= safeCount,
      });
    }
    tiers.push({ bonus, start, end, dots });
    start = end + 1;
  }

  return tiers;
}

// Matches dated O events to o numbers, oldest first. A scene's O Count
// leaves out its releases' O's, so those events don't take a o number.
export function getRatingAdvisorOEventsCustom<
  T extends { o_date: string; release_id?: string | null }
>(entityType: RatingAdvisorEntityCustom, events: readonly T[]) {
  const byO = new Map<number, T>();
  events
    .filter((event) => entityType !== "scene" || !event.release_id)
    .map((event, index) => ({ event, index, time: Date.parse(event.o_date) }))
    // Ties keep the server's newest-first order, reversed.
    .sort((a, b) => a.time - b.time || b.index - a.index)
    .forEach(({ event }, index) => byO.set(index + 1, event));
  return byO;
}

export function getRatingAdvisorOrgasmBonusDescriptionCustom(
  entityType: RatingAdvisorEntityCustom
) {
  if (entityType === "scene") {
    return "Each O past your 2nd adds points. Later O's are worth more.";
  }

  return "Every 2nd O to him from the 3rd on adds points. Later O's are worth more.";
}

const RATING_ADVISOR_ADJUSTMENT_TOOLTIP_LABELS_CUSTOM: Record<string, string> =
  {
    theme: "Uniform",
    oralOnly: "Oral-only",
    godTierOrgasm: "GOAT Nut",
    goatElement: "GOAT",
    unlikelyTop: "Unlikely top",
    orgasmBonus: "O Bonus",
    feetBonus: "Feet",
    groupBottomAttractiveness: "Hot bottom",
    groupOralOnly: "Oral-only",
    consistency: "Consistency",
    dick: "Pito",
    tattoosBonus: "Tattoos",
    noOrgasm: "No nut",
    production: "Production",
    extremelyPolished: "Extremely polished",
    feminine: "Feminine",
    "orgasm-count-bonus": "O count",
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

export function resolveRatingAdvisorScoresCustom<T>(
  mutationScores?: readonly T[] | null,
  queriedScores?: readonly T[] | null,
  initialScores?: readonly T[] | null
) {
  return mutationScores ?? queriedScores ?? initialScores;
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

export function normalizeRatingAdvisorPersistedScoreValueCustom(
  metric: IRatingAdvisorMetricScaleCustom,
  rawValue?: number | null
) {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }
  if (rawValue === 0 && !metric.choices.some((choice) => choice.value === 0)) {
    return undefined;
  }

  return normalizeRatingAdvisorScoreValueCustom(metric, rawValue);
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

export type RatingAdvisorTierCustom =
  | "plain"
  | "bronze"
  | "silver"
  | "gold"
  | "royal-sapphire";

export interface IRatingAdvisorTierThresholdsCustom {
  bronze: number;
  silver: number;
  gold: number;
  royalSapphire: number;
}

const RATING_ADVISOR_TIER_LABELS_CUSTOM: Record<
  RatingAdvisorTierCustom,
  string
> = {
  plain: "No tier",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  "royal-sapphire": "Royal Sapphire",
};

function getRatingAdvisorTierStepsCustom(
  thresholds: IRatingAdvisorTierThresholdsCustom
) {
  return [
    { tier: "bronze" as const, min: thresholds.bronze },
    { tier: "silver" as const, min: thresholds.silver },
    { tier: "gold" as const, min: thresholds.gold },
    { tier: "royal-sapphire" as const, min: thresholds.royalSapphire },
  ];
}

// The advisor's tier, and how far the next one is.
export function getRatingAdvisorTierCustom(
  rating100: number,
  thresholds: IRatingAdvisorTierThresholdsCustom,
  royalSapphireOverride = false
) {
  const steps = getRatingAdvisorTierStepsCustom(thresholds);
  let tier: RatingAdvisorTierCustom = "plain";
  if (royalSapphireOverride) {
    tier = "royal-sapphire";
  } else {
    for (const step of steps) {
      if (rating100 >= step.min) tier = step.tier;
    }
  }

  const tierIndex = steps.findIndex((step) => step.tier === tier);
  const next = royalSapphireOverride ? undefined : steps[tierIndex + 1];

  return {
    tier,
    label: RATING_ADVISOR_TIER_LABELS_CUSTOM[tier],
    next: next
      ? {
          tier: next.tier,
          label: RATING_ADVISOR_TIER_LABELS_CUSTOM[next.tier],
          remaining: Math.max(0, next.min - rating100),
        }
      : undefined,
  };
}

// Tier zones on a 0–100 ladder, as percentages of its width.
export function getRatingAdvisorTierLadderCustom(
  thresholds: IRatingAdvisorTierThresholdsCustom
) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const steps = getRatingAdvisorTierStepsCustom(thresholds);
  const starts = [
    { tier: "plain" as RatingAdvisorTierCustom, min: 0 },
    ...steps,
  ];

  return starts.map((step, index) => {
    const start = clamp(step.min);
    const end = clamp(starts[index + 1]?.min ?? 100);
    return { tier: step.tier, start, width: Math.max(0, end - start) };
  });
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
      choiceIndex: undefined,
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
      choiceIndex: undefined,
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
    choiceIndex,
  };
}

type RatingAdvisorPersistedScoresCustom = ReadonlyArray<{
  section?: string | null;
  key?: string | null;
  raw_value?: number | null;
}> | null;

function findPersistedScore(
  scores: RatingAdvisorPersistedScoresCustom | undefined,
  key: string,
  section: string
) {
  return scores?.find(
    (candidate) =>
      candidate.key === key &&
      (candidate.section ?? "criterion").trim().toLowerCase() === section
  );
}

export function formatRatingAdvisorContributionCustom(value: number) {
  const ratingPoints = Math.round(value * 10);
  return ratingPoints > 0 ? `+${ratingPoints}` : ratingPoints.toString();
}

// Criterion bars (metrics without a bonus/penalty section) shared by the
// rating hover summary and scene cards.
export function getRatingAdvisorCriterionSummariesCustom<
  T extends IRatingAdvisorMetricScaleCustom & { key: string; section?: string }
>(metrics: readonly T[], scores?: RatingAdvisorPersistedScoresCustom) {
  return metrics.flatMap((metric) => {
    if (metric.section) return [];
    const score = findPersistedScore(scores, metric.key, "criterion");
    return [
      {
        metric,
        summary: getRatingAdvisorBarSummaryCustom(metric, score?.raw_value),
      },
    ];
  });
}

// Nonzero bonus and penalty rows, led by the O Count bonus (in rating points),
// shared by the rating hover summary and scene cards.
export function getRatingAdvisorAdjustmentSummariesCustom<
  T extends IRatingAdvisorMetricScaleCustom & {
    key: string;
    title: string;
    section?: "bonus" | "penalty";
  }
>(
  metrics: readonly T[],
  scores?: RatingAdvisorPersistedScoresCustom,
  orgasmBonus = 0
) {
  const rows = metrics.flatMap((metric) => {
    const { section } = metric;
    if (!section) return [];

    const value = normalizeRatingAdvisorPersistedScoreValueCustom(
      metric,
      findPersistedScore(scores, metric.key, section)?.raw_value
    );
    const contribution =
      value === undefined
        ? 0
        : getRatingAdvisorChoiceScoreCustom(metric, value);
    return contribution === 0
      ? []
      : [
          {
            key: metric.key,
            title: getRatingAdvisorAdjustmentTooltipLabelCustom(
              metric.key,
              metric.title
            ),
            section,
            contribution,
            description:
              metric.choices.find((choice) => choice.value === value)
                ?.description ?? "",
          },
        ];
  });

  if (orgasmBonus !== 0) {
    rows.unshift({
      key: "orgasm-count-bonus",
      title: getRatingAdvisorAdjustmentTooltipLabelCustom(
        "orgasm-count-bonus",
        "O Count bonus"
      ),
      section: "bonus",
      contribution: orgasmBonus / 10,
      description: "",
    });
  }

  return rows;
}
