import assert from "node:assert/strict";

import { getSceneNegativeMarkerTotalDuration } from "../src/components/Scenes/SceneDetails/sceneNegativeMarkerDuration_custom.ts";

assert.equal(
  getSceneNegativeMarkerTotalDuration([
    { start_seconds: 0, end_seconds: 20 },
    { start_seconds: 10, end_seconds: 30 },
    { start_seconds: 45, end_seconds: 60 },
  ]),
  45,
  "overlapping negative markers count their unique covered time"
);

assert.equal(
  getSceneNegativeMarkerTotalDuration(
    [
      { start_seconds: -10, end_seconds: 20 },
      { start_seconds: 90, end_seconds: 120 },
      { start_seconds: 80, end_seconds: 70 },
    ],
    100
  ),
  30,
  "negative marker time is bounded to the video and invalid ranges are ignored"
);

assert.equal(
  getSceneNegativeMarkerTotalDuration([{ start_seconds: 10, end_seconds: 20 }]),
  10,
  "valid marker time is still counted when no video duration is available"
);
