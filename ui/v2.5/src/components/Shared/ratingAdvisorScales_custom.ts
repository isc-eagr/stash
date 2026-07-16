export interface IRatingAdvisorChoiceCustom {
  value: number;
  label: string;
  description: string;
  scoreValue?: number;
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
