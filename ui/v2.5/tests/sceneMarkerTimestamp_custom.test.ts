import assert from "node:assert/strict";

import {
  formatSceneMarkerDuration,
  toMarkerMilliseconds,
} from "../src/components/Scenes/SceneDetails/sceneMarkerTimestamp_custom.ts";

for (const [duration, expected] of [
  [0, "0s"],
  [0.001, "0.001s"],
  [2.573, "2.573s"],
  [3, "3s"],
  [20, "20s"],
  [59.999, "59.999s"],
  [60, "1m"],
  [62.573, "1m 2.573s"],
  [3600, "1h"],
  [3661.001, "1h 1m 1.001s"],
  [602.573 - 600, "2.573s"],
] as const) {
  assert.equal(formatSceneMarkerDuration(duration), expected);
}

assert.equal(
  toMarkerMilliseconds(624.76849),
  624.768,
  "new marker timestamps retain millisecond precision from the player"
);

assert.equal(
  toMarkerMilliseconds(624.7685),
  624.769,
  "new marker timestamps round to the nearest millisecond"
);

assert.equal(
  toMarkerMilliseconds(undefined),
  0,
  "an unavailable player timestamp defaults to zero"
);
