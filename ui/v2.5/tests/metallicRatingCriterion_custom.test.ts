import assert from "node:assert/strict";

import { CriterionModifier } from "../src/core/generated-graphql.ts";
import {
  MetallicRatingCriterionOption,
  formatMetallicRatingOptionLabel,
  metallicRatingIncludeNonMetallicValue,
  metallicRatingNoTierValue,
} from "../src/models/list-filter/criteria/metallic-rating_custom.ts";

// No Tier leads the choices, below Bronze.
assert.equal(
  MetallicRatingCriterionOption.options?.[0],
  metallicRatingNoTierValue
);
assert.equal(
  formatMetallicRatingOptionLabel(metallicRatingNoTierValue),
  "No Tier"
);

type CriterionInput = { value: string[]; excludes: string[] };
const toInput = (modifier: CriterionModifier, value: string[]) => {
  const criterion = MetallicRatingCriterionOption.makeCriterion();
  criterion.modifier = modifier;
  criterion.value = value;
  return (
    criterion as unknown as { toCriterionInput(): CriterionInput }
  ).toCriterionInput();
};

assert.deepEqual(
  toInput(CriterionModifier.Includes, [metallicRatingNoTierValue, "gold"])
    .value,
  [metallicRatingNoTierValue, "gold"]
);
// Excluding No Tier while keeping non-metallic cards sends both to the server.
assert.deepEqual(
  toInput(CriterionModifier.Excludes, [
    metallicRatingNoTierValue,
    metallicRatingIncludeNonMetallicValue,
  ]),
  {
    value: [metallicRatingNoTierValue, metallicRatingIncludeNonMetallicValue],
    modifier: CriterionModifier.Excludes,
    excludes: [metallicRatingIncludeNonMetallicValue],
  }
);
