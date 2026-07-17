import assert from "node:assert/strict";

import {
  getRatingAdvisorBarSummaryCustom,
  getRatingAdvisorAdjustmentTooltipLabelCustom,
  getRatingAdvisorCompletionCustom,
  getRatingAdvisorChoiceHeatLevelCustom,
  getRatingAdvisorChoiceScoreCustom,
  normalizeRatingAdvisorScoreValueCustom,
  ratingAdvisorSixLevelChoicesCustom,
  SCENE_ENERGY_WEIGHT_CUSTOM,
  SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
  SCENE_NO_ORGASM_PENALTY_CUSTOM,
  SCENE_USABLE_FACTOR_MAX_CUSTOM,
  SCENE_USABLE_FACTOR_WEIGHT_CUSTOM,
} from "../src/components/Shared/ratingAdvisorScales_custom.ts";

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
  getRatingAdvisorAdjustmentTooltipLabelCustom("unknown", "Fallback"),
  "Fallback"
);
