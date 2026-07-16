import assert from "node:assert/strict";

import { CriterionModifier } from "../src/core/generated-graphql.ts";
import {
  RatingCriteriaCriterion,
  SceneRatingCriteriaCriterionOption,
  ratingCriteriaModifierOptions,
} from "../src/models/list-filter/criteria/rating-criteria_custom.ts";

const sceneCriteria = SceneRatingCriteriaCriterionOption.criteria;
const sceneBonuses = SceneRatingCriteriaCriterionOption.bonuses;
const scenePenalties = SceneRatingCriteriaCriterionOption.penalties;

assert.deepEqual(ratingCriteriaModifierOptions, [
  CriterionModifier.Equals,
  CriterionModifier.GreaterThanEquals,
  CriterionModifier.LessThanEquals,
  CriterionModifier.Between,
]);

assert.deepEqual(
  sceneCriteria
    .filter((definition) => definition.key.startsWith("group"))
    .map((definition) => definition.key),
  [
    "groupTopAttractiveness",
    "groupEnergy",
    "groupParticipation",
    "groupPayoff",
    "groupStandout",
  ]
);
assert.deepEqual(
  sceneBonuses
    .filter((definition) => definition.key.startsWith("group"))
    .map((definition) => definition.key),
  ["groupBottomAttractiveness", "groupOralOnly"]
);
assert.equal(
  sceneBonuses.some((definition) => definition.key === "largeGroup"),
  false
);
assert.deepEqual(
  scenePenalties.map((definition) => definition.key),
  ["noOrgasm", "production"]
);

const criterion = new RatingCriteriaCriterion(
  SceneRatingCriteriaCriterionOption
);
criterion.value = {
  criteria: {
    groupParticipation: {
      modifier: CriterionModifier.Between,
      value: { value: 2, value2: 4 },
    },
  },
  bonuses: {
    groupBottomAttractiveness: true,
    groupOralOnly: false,
  },
  penalties: {
    production: true,
  },
};

const queryParams = criterion.toQueryParams();
const restoredFromURL = new RatingCriteriaCriterion(
  SceneRatingCriteriaCriterionOption
);
restoredFromURL.fromDecodedParams(queryParams);
assert.deepEqual(restoredFromURL.value, criterion.value);

const saved: Record<string, unknown> = {};
criterion.applyToSavedCriterion(saved);
const restoredFromSavedFilter = new RatingCriteriaCriterion(
  SceneRatingCriteriaCriterionOption
);
restoredFromSavedFilter.setFromSavedCriterion(saved.rating_criteria);
assert.deepEqual(restoredFromSavedFilter.value, criterion.value);

const input: Record<string, unknown> = {};
criterion.applyToCriterionInput(input);
assert.deepEqual(input.rating_criteria, {
  criteria: [
    {
      key: "groupParticipation",
      value: {
        modifier: CriterionModifier.Between,
        value: 2,
        value2: 4,
      },
    },
  ],
  bonuses: [
    { key: "groupBottomAttractiveness", value: true },
    { key: "groupOralOnly", value: false },
  ],
  penalties: [{ key: "production", value: true }],
});
