import assert from "node:assert/strict";

import {
  getSceneRatingModeChangeCustom,
  getSceneRatingModeCustom,
  GROUP_SCENE_BONUSES_CUSTOM,
  GROUP_SCENE_ENERGY_COORDINATION_CHOICES_CUSTOM,
  GROUP_SCENE_RATING_KEYS_CUSTOM,
  GROUP_SCENE_WEIGHTS_CUSTOM,
} from "../src/components/Shared/groupSceneRating_custom.ts";

assert.equal(getSceneRatingModeCustom(0, false), "default");
assert.equal(getSceneRatingModeCustom(1, false), "solo");
assert.equal(getSceneRatingModeCustom(1, true), "solo");
assert.equal(getSceneRatingModeCustom(2, false), "default");
assert.equal(getSceneRatingModeCustom(3, false), "default");
assert.equal(getSceneRatingModeCustom(3, true), "solo");
assert.equal(getSceneRatingModeCustom(4, false), "group");
assert.equal(getSceneRatingModeCustom(4, true), "group");
assert.deepEqual(getSceneRatingModeChangeCustom(3, 4, false), {
  from: "Standard",
  to: "Group",
});
assert.deepEqual(getSceneRatingModeChangeCustom(2, 1, false), {
  from: "Standard",
  to: "Solo",
});
assert.equal(
  getSceneRatingModeChangeCustom(2, 3, false),
  undefined,
  "two to three vatos stays on the standard rubric"
);
assert.equal(
  getSceneRatingModeChangeCustom(2, 3, true),
  undefined,
  "solo-marked scenes stay solo below the group size"
);
assert.equal(
  (5 * GROUP_SCENE_WEIGHTS_CUSTOM.topAttractiveness +
    5 * GROUP_SCENE_WEIGHTS_CUSTOM.energyCoordination +
    4 * GROUP_SCENE_WEIGHTS_CUSTOM.payoff +
    4 * GROUP_SCENE_WEIGHTS_CUSTOM.usability) *
    10,
  100
);
assert.equal(GROUP_SCENE_WEIGHTS_CUSTOM.topAttractiveness * 50, 30);
assert.equal(GROUP_SCENE_WEIGHTS_CUSTOM.energyCoordination * 50, 30);
assert.equal(GROUP_SCENE_BONUSES_CUSTOM.bottomAttractiveness * 10, 5);
assert.equal(GROUP_SCENE_BONUSES_CUSTOM.oralOnly * 10, 20);

assert.deepEqual(Object.values(GROUP_SCENE_RATING_KEYS_CUSTOM.criteria), [
  "groupTopAttractiveness",
  "groupEnergy",
  "groupPayoff",
  "groupUsability",
]);
const groupBonusKeys: readonly string[] = Object.values(
  GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses
);
assert.deepEqual(groupBonusKeys, [
  "groupBottomAttractiveness",
  "groupOralOnly",
]);
assert.ok(!groupBonusKeys.includes("largeGroup"));
assert.deepEqual(
  GROUP_SCENE_ENERGY_COORDINATION_CHOICES_CUSTOM.map(({ label }) => label),
  ["Disconnected", "Uneven", "Good", "Strong", "Excellent", "Perfect execution"]
);
