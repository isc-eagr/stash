import assert from "node:assert/strict";

import {
  calculateRatingAdvisorOrgasmBonusCustom,
  calculateRatingAdvisorRating100Custom,
  getRatingAdvisorBarSummaryCustom,
  getRatingAdvisorAdjustmentTooltipLabelCustom,
  getRatingAdvisorCompletionCustom,
  getRatingAdvisorChoiceHeatLevelCustom,
  getRatingAdvisorChoiceScoreCustom,
  getSceneOrgasmQualityFilterChoicesCustom,
  normalizeRatingAdvisorScoreValueCustom,
  ratingAdvisorSixLevelChoicesCustom,
  SCENE_ENERGY_WEIGHT_CUSTOM,
  SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
  SCENE_NO_ORGASM_PENALTY_CUSTOM,
  SCENE_ORGASM_QUALITY_CHOICES_CUSTOM,
  SCENE_USABLE_FACTOR_MAX_CUSTOM,
  SCENE_USABLE_FACTOR_WEIGHT_CUSTOM,
} from "../src/components/Shared/ratingAdvisorScales_custom.ts";

assert.equal(calculateRatingAdvisorRating100Custom(-2, 1), 1);
assert.equal(calculateRatingAdvisorRating100Custom(7.25, 2), 75);

assert.deepEqual(
  [2, 4, 6, 12, 24].map((count) =>
    calculateRatingAdvisorOrgasmBonusCustom("scene", count)
  ),
  [0, 2, 5, 18, 55],
  "scene O bonuses award every O using progressive doubling tiers"
);
assert.deepEqual(
  [2, 4, 7, 12, 13].map((count) =>
    calculateRatingAdvisorOrgasmBonusCustom("performer", count)
  ),
  [0, 1, 4, 8, 11],
  "performer O bonuses award every second O using progressive doubling tiers"
);

assert.equal(
  SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM * 10,
  10,
  "scene God-tier orgasms add 10 rating points"
);
assert.equal(
  SCENE_NO_ORGASM_PENALTY_CUSTOM * 10,
  -20,
  "missing orgasms subtract 20 rating points from scenes"
);
assert.equal(
  5 * SCENE_ENERGY_WEIGHT_CUSTOM * 10,
  20,
  "regular scene energy contributes at most 20 rating points"
);
assert.equal(
  SCENE_USABLE_FACTOR_MAX_CUSTOM * SCENE_USABLE_FACTOR_WEIGHT_CUSTOM * 10,
  20,
  "regular scene usable factor contributes at most 20 rating points"
);
assert.deepEqual(SCENE_ORGASM_QUALITY_CHOICES_CUSTOM, [
  {
    value: 0,
    label: "Absent/bad orgasms",
    description:
      "No orgasm, very obviously fake, or it is actively bad, off camera, or off-putting.",
  },
  {
    value: 1,
    label: "Below average orgasms",
    description:
      "The orgasms are there, but they are weak, barely there, or unimpressive.",
  },
  {
    value: 2,
    label: "Standard orgasms",
    description: "A solid orgasm. Hot, just not legendary.",
  },
  {
    value: 3,
    label: "Above average",
    description: "A hot nut or facial that gives the scene a real bump.",
  },
  {
    value: 4,
    label: "Outstanding orgasms",
    description: "That orgasm or facial is the damn highlight.",
  },
]);
assert.deepEqual(getSceneOrgasmQualityFilterChoicesCustom(), [
  { value: 0, label: "Absent/bad orgasms" },
  { value: 1, label: "Below average orgasms" },
  { value: 2, label: "Standard orgasms" },
  { value: 3, label: "Above average" },
  { value: 4, label: "Outstanding orgasms" },
]);

const choices = ratingAdvisorSixLevelChoicesCustom([
  { label: "Not Attractive", description: "No pull." },
  { label: "Some Appeal", description: "A little pull." },
  { label: "Decent", description: "Decent pull." },
  { label: "Attractive", description: "Clear pull." },
  { label: "Very Attractive", description: "Strong pull." },
  { label: "Perfect", description: "Maximum pull." },
]);

const faceMetric = {
  max: 5,
  weight: 0.6,
  choices,
};
const bottomMetric = {
  max: 5,
  weight: 0.2,
  choices,
};

assert.deepEqual(
  choices.map((choice) => choice.value),
  [0, 1, 2, 3, 4, 5]
);
assert.equal(getRatingAdvisorChoiceScoreCustom(faceMetric, 5) * 10, 30);
assert.equal(getRatingAdvisorChoiceScoreCustom(faceMetric, 4) * 10, 24);
assert.equal(getRatingAdvisorChoiceScoreCustom(bottomMetric, 5) * 10, 10);
assert.equal(normalizeRatingAdvisorScoreValueCustom(faceMetric, 4.6), 5);
assert.equal(normalizeRatingAdvisorScoreValueCustom(faceMetric, 3.2), 3);

const incomplete = getRatingAdvisorCompletionCustom(
  ["face", "body", "performance"],
  { face: 0, body: undefined, performance: 4 }
);
assert.deepEqual(incomplete, {
  rated: 2,
  total: 3,
  complete: false,
  percent: 67,
});
assert.equal(
  getRatingAdvisorCompletionCustom(["face"], { face: 0 }).complete,
  true,
  "an intentional zero counts as rated"
);

assert.deepEqual(
  Array.from({ length: 6 }, (_, index) =>
    getRatingAdvisorChoiceHeatLevelCustom(index, 6)
  ),
  [0, 1, 2, 3, 4, 5]
);
assert.deepEqual(
  Array.from({ length: 4 }, (_, index) =>
    getRatingAdvisorChoiceHeatLevelCustom(index, 4)
  ),
  [0, 2, 3, 5],
  "shorter scales still span the full gray-to-red range"
);

assert.deepEqual(getRatingAdvisorBarSummaryCustom(faceMetric), {
  fillPercent: 0,
  heatLevel: undefined,
  choice: undefined,
});
assert.deepEqual(getRatingAdvisorBarSummaryCustom(faceMetric, 0), {
  fillPercent: 0,
  heatLevel: 0,
  choice: choices[0],
});
assert.deepEqual(getRatingAdvisorBarSummaryCustom(faceMetric, 3.2), {
  fillPercent: 60,
  heatLevel: 3,
  choice: choices[3],
});
assert.deepEqual(getRatingAdvisorBarSummaryCustom(faceMetric, 5), {
  fillPercent: 100,
  heatLevel: 5,
  choice: choices[5],
});

assert.equal(
  getRatingAdvisorAdjustmentTooltipLabelCustom(
    "theme",
    "Theme / fantasy / uniform factor"
  ),
  "Uniform"
);
assert.equal(
  getRatingAdvisorAdjustmentTooltipLabelCustom(
    "production",
    "Production / visual quality"
  ),
  "Production"
);
assert.equal(
  getRatingAdvisorAdjustmentTooltipLabelCustom(
    "extremelyPolished",
    "Extremely polished penalty"
  ),
  "Extremely polished"
);
assert.equal(
  getRatingAdvisorAdjustmentTooltipLabelCustom("unknown", "Fallback"),
  "Fallback"
);
