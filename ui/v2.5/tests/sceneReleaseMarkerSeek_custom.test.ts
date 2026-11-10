import assert from "node:assert/strict";
import { isReleaseMarkerSeekableCustom } from "../src/components/Scenes/SceneDetails/sceneReleaseMarkerSeek_custom.ts";

assert.equal(isReleaseMarkerSeekableCustom(12.5, 20), true);
assert.equal(isReleaseMarkerSeekableCustom(20, 20), true);
assert.equal(isReleaseMarkerSeekableCustom(21, 20), false);
assert.equal(isReleaseMarkerSeekableCustom(-1, 20), false);
assert.equal(isReleaseMarkerSeekableCustom(Number.NaN, 20), false);
assert.equal(isReleaseMarkerSeekableCustom(100), true);
