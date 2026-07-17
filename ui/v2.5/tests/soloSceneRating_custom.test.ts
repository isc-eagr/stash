import assert from "node:assert/strict";

import {
  getSoloSceneBaseMaximumCustom,
  SOLO_SCENE_RATING_KEYS_CUSTOM,
  SOLO_SCENE_WEIGHTS_CUSTOM,
} from "../src/components/Shared/soloSceneRating_custom.ts";

assert.equal(getSoloSceneBaseMaximumCustom() * 10, 100);
assert.equal(SOLO_SCENE_WEIGHTS_CUSTOM.attractiveness * 5 * 10, 50);
assert.equal(SOLO_SCENE_WEIGHTS_CUSTOM.performance * 4 * 10, 30);
assert.equal(SOLO_SCENE_WEIGHTS_CUSTOM.usability * 4 * 10, 20);
assert.deepEqual(Object.values(SOLO_SCENE_RATING_KEYS_CUSTOM), [
  "soloPerformerAppeal",
  "soloPerformance",
  "soloUsability",
]);
