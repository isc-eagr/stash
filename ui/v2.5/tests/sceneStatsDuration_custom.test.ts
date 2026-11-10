import assert from "node:assert/strict";

import { durationBucketForMinutes } from "../src/components/SceneStats/sceneStatsDuration_custom.ts";

assert.deepEqual(durationBucketForMinutes(0), {
  key: "0-4",
  label: "0-4m",
  sortValue: 0,
});

assert.equal(durationBucketForMinutes(4).key, "0-4");
assert.deepEqual(durationBucketForMinutes(5), {
  key: "5",
  label: "5m",
  sortValue: 5,
});
assert.deepEqual(durationBucketForMinutes(45), {
  key: "45",
  label: "45m",
  sortValue: 45,
});
assert.deepEqual(durationBucketForMinutes(46), {
  key: "46-50",
  label: "46-50m",
  sortValue: 46,
});
assert.equal(durationBucketForMinutes(50).key, "46-50");
assert.deepEqual(durationBucketForMinutes(51), {
  key: "51-55",
  label: "51-55m",
  sortValue: 51,
});
