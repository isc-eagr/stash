import assert from "node:assert/strict";

import {
  getRatingAdvisorChoiceScoreCustom,
  normalizeRatingAdvisorScoreValueCustom,
  ratingAdvisorSixLevelChoicesCustom,
} from "../src/components/Shared/ratingAdvisorScales_custom.ts";

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
