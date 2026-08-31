import assert from "node:assert/strict";

import { CriterionModifier } from "../src/core/generated-graphql.ts";
import {
  RatingCriteriaCriterion,
  SceneRatingCriteriaCriterionOption,
  ratingCriteriaModifierOptions,
} from "../src/models/list-filter/criteria/rating-criteria_custom.ts";

const sceneCriteria = SceneRatingCriteriaCriterionOption.criteria;
const sceneBonusValues = SceneRatingCriteriaCriterionOption.bonusValues;
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
  ["groupTopAttractiveness", "groupEnergy", "groupPayoff", "groupUsability"]
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
assert.equal(
  sceneBonuses.find((definition) => definition.key === "unlikelyTop")?.label,
  "Standard Unlikely Top Bonus"
);
assert.deepEqual(sceneBonusValues, [
  {
    key: "goatElement",
    label: "GOAT Element Bonus Amount",
    choices: [
      { value: 0.5, label: "GOAT +5" },
      { value: 1, label: "GOAT +10" },
      { value: 1.5, label: "GOAT +15" },
      { value: 2, label: "GOAT +20" },
    ],
    showRawValue: false,
  },
]);
assert.equal(
  sceneBonuses.some((definition) => definition.key === "goatElement"),
  true
);
assert.equal(
  sceneBonuses.some(
    (definition) => definition.key === "outstandingPerformance"
  ),
  false
);
assert.deepEqual(
  scenePenalties.map((definition) => definition.key),
  ["noOrgasm", "production", "extremelyPolished"]
);

assert.deepEqual(
  sceneCriteria
    .filter((definition) => definition.key.startsWith("solo"))
    .map((definition) => definition.key),
  ["soloPerformerAppeal", "soloPerformance", "soloUsability"]
);
assert.deepEqual(
  sceneCriteria.find((definition) => definition.key === "standout")?.choices,
  [
    { value: 0, label: "Mostly unusable" },
    { value: 1, label: "Limited use" },
    { value: 2, label: "Standard or mixed" },
    { value: 3, label: "Highly usable" },
    { value: 4, label: "Nearly unskippable" },
  ]
);
const orgasmQualityChoices = [
  { value: 0, label: "Absent/bad orgasms" },
  { value: 1, label: "Below average orgasms" },
  { value: 2, label: "Standard orgasms" },
  { value: 3, label: "Above average" },
  { value: 4, label: "Outstanding orgasms" },
];
assert.deepEqual(
  sceneCriteria.find((definition) => definition.key === "payoff")?.choices,
  orgasmQualityChoices
);
assert.deepEqual(
  sceneCriteria.find((definition) => definition.key === "groupPayoff")?.choices,
  orgasmQualityChoices
);

const criterion = new RatingCriteriaCriterion(
  SceneRatingCriteriaCriterionOption
);
criterion.value = {
  criteria: {
    groupUsability: {
      modifier: CriterionModifier.Between,
      value: { value: 2, value2: 4 },
    },
  },
  bonusValues: {
    goatElement: {
      modifier: CriterionModifier.Equals,
      value: { value: 1.5, value2: undefined },
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
      key: "groupUsability",
      value: {
        modifier: CriterionModifier.Between,
        value: 2,
        value2: 4,
      },
    },
  ],
  bonus_values: [
    {
      key: "goatElement",
      value: {
        modifier: CriterionModifier.Equals,
        value: 1.5,
        value2: undefined,
      },
    },
  ],
  bonuses: [
    { key: "groupBottomAttractiveness", value: true },
    { key: "groupOralOnly", value: false },
  ],
  penalties: [{ key: "production", value: true }],
});
