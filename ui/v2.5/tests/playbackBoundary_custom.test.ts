import assert from "node:assert/strict";

import {
  findContainingOrNextPlaybackRange,
  getPlaybackBoundaryDelayMs,
  isPlaybackBoundaryDue,
  mergePlaybackRanges,
} from "../src/components/ScenePlayer/playbackBoundary_custom.ts";

assert.equal(
  getPlaybackBoundaryDelayMs(10, 11, 1),
  1000,
  "normal playback schedules the exact remaining media time"
);
assert.equal(
  getPlaybackBoundaryDelayMs(10, 11, 2),
  500,
  "boundary scheduling accounts for playback rate"
);
assert.equal(
  getPlaybackBoundaryDelayMs(12, 11, 1),
  0,
  "an overdue boundary runs immediately"
);

assert.equal(
  isPlaybackBoundaryDue(9.997, 10),
  true,
  "the timer tolerates millisecond-level currentTime rounding"
);
assert.equal(
  isPlaybackBoundaryDue(9.99, 10),
  false,
  "the timer does not cut a materially early frame"
);

const mergedRanges = mergePlaybackRanges([
  { start: 20, end: 30 },
  { start: 10, end: 15 },
  { start: 14, end: 22 },
  { start: 30, end: 31 },
  { start: 50, end: 50 },
]);
assert.deepEqual(
  mergedRanges,
  [{ start: 10, end: 31 }],
  "overlapping and touching negative ranges become one uninterrupted skip"
);
assert.deepEqual(
  findContainingOrNextPlaybackRange(mergedRanges, 12),
  { start: 10, end: 31 },
  "a range containing the current time is returned"
);
assert.equal(
  findContainingOrNextPlaybackRange(mergedRanges, 31),
  undefined,
  "the end boundary is playable and is not treated as inside the range"
);
