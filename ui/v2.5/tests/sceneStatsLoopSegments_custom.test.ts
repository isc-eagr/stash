import assert from "node:assert/strict";

import {
  buildIntervalLoopSegments,
  isSelectableLoopSegmentInterval,
} from "../src/components/Scenes/SceneDetails/sceneStatsLoopSegments_custom.ts";

assert.equal(
  isSelectableLoopSegmentInterval({ start: 10, end: 10.001 }),
  false,
  "one-millisecond closed gaps are not selectable loop segments"
);

assert.equal(
  isSelectableLoopSegmentInterval({ start: 10, end: 10.002 }),
  true,
  "intervals longer than one millisecond are selectable"
);

assert.deepEqual(
  buildIntervalLoopSegments("STANDARD", [
    { start: 1, end: 1.001 },
    { start: 5, end: 7 },
  ]),
  [
    {
      start: 5,
      end: 7,
      title: "STANDARD",
    },
  ]
);
