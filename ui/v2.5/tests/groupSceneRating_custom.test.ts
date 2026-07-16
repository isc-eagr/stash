import assert from "node:assert/strict";

import {
  getGroupSceneBaseMaximumCustom,
  getSceneRatingModeCustom,
  GROUP_SCENE_BONUSES_CUSTOM,
  GROUP_SCENE_RATING_KEYS_CUSTOM,
} from "../src/components/Shared/groupSceneRating_custom.ts";

assert.equal(getSceneRatingModeCustom(3, false), "default");
assert.equal(getSceneRatingModeCustom(3, true), "solo");
assert.equal(getSceneRatingModeCustom(4, false), "group");
assert.equal(getSceneRatingModeCustom(4, true), "group");
assert.equal(getGroupSceneBaseMaximumCustom() * 10, 100);
assert.equal(GROUP_SCENE_BONUSES_CUSTOM.bottomAttractiveness * 10, 10);
assert.equal(GROUP_SCENE_BONUSES_CUSTOM.oralOnly * 10, 20);

assert.deepEqual(Object.values(GROUP_SCENE_RATING_KEYS_CUSTOM.criteria), [
  "groupTopAttractiveness",
  "groupEnergy",
  "groupParticipation",
  "groupPayoff",
  "groupStandout",
]);
const groupBonusKeys: readonly string[] = Object.values(
  GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses
);
assert.deepEqual(groupBonusKeys, [
  "groupBottomAttractiveness",
  "groupOralOnly",
]);
assert.ok(!groupBonusKeys.includes("largeGroup"));
