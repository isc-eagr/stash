import assert from "node:assert/strict";

import { sceneRetroactiveOCountCustom } from "../src/components/Scenes/SceneDetails/sceneRetroactiveO_custom.ts";

assert.equal(sceneRetroactiveOCountCustom(5, 3), 2);
assert.equal(sceneRetroactiveOCountCustom(3, 3), 0);
assert.equal(sceneRetroactiveOCountCustom(undefined, 0), 0);
// stale cache where history is ahead of the counter never goes negative
assert.equal(sceneRetroactiveOCountCustom(2, 3), 0);
