import assert from "node:assert/strict";

import { toMarkerMilliseconds } from "../src/components/Scenes/SceneDetails/sceneMarkerTimestamp_custom.ts";

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
