import assert from "node:assert/strict";

import {
  getNegativeMarkerSkipTargetCustom,
  getPlaybackBoundaryLeadCustom,
  reachesPlaybackBoundaryCustom,
} from "../src/components/ScenePlayer/playbackTiming_custom.ts";

assert.equal(
  reachesPlaybackBoundaryCustom(12.344, 12.345, 0.0009),
  false,
  "a boundary does not trigger before its measured frame window"
);
assert.equal(
  reachesPlaybackBoundaryCustom(12.344, 12.345, 0.001),
  true,
  "millisecond segment boundaries retain sub-second precision"
);
assert.equal(
  reachesPlaybackBoundaryCustom(12.245, 12.345, 1 / 30),
  false,
  "multi-segment playback no longer uses the old fixed 100ms margin"
);

assert.equal(
  getPlaybackBoundaryLeadCustom(1 / 60),
  1 / 60,
  "normal playback uses the measured presented-frame duration"
);
assert.equal(
  getPlaybackBoundaryLeadCustom(1 / 60, 2),
  1 / 30,
  "faster playback allows for the larger media-time step between frames"
);

const negativeMarkers = [
  { start_seconds: 20.125, end_seconds: 21.875 },
  { start_seconds: 21.8, end_seconds: 23.25 },
];

assert.equal(
  getNegativeMarkerSkipTargetCustom(20.124, 0.001, negativeMarkers),
  23.25,
  "the frame immediately before a negative marker seeks past overlapping ranges"
);
assert.equal(
  getNegativeMarkerSkipTargetCustom(20.5, 0, negativeMarkers),
  23.25,
  "seeking into a negative marker immediately exits the blocked range"
);
assert.equal(
  getNegativeMarkerSkipTargetCustom(20.123, 0.001, negativeMarkers),
  undefined,
  "clean playback outside the next frame window is not cut early"
);
assert.equal(
  getNegativeMarkerSkipTargetCustom(5, 0, [
    { start_seconds: 8.75, end_seconds: 5 },
  ]),
  8.75,
  "reversed negative-marker endpoints are normalized before playback"
);
