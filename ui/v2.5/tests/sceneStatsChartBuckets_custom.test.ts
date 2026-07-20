import assert from "node:assert/strict";

import {
  sceneStatsActivityType,
  sceneStatsPositiveCount,
  sceneStatsRatingBucket,
  sceneStatsReleaseDay,
  sceneStatsReleaseMonth,
  sceneStatsReleaseYear,
} from "../src/components/SceneStats/sceneStatsChartBuckets_custom.ts";

assert.equal(sceneStatsPositiveCount(0), undefined);
assert.equal(sceneStatsPositiveCount(null), undefined);
assert.equal(sceneStatsPositiveCount(3), 3);

assert.equal(sceneStatsRatingBucket(0), undefined);
assert.equal(sceneStatsRatingBucket(null), undefined);
assert.equal(sceneStatsRatingBucket(61), "60-64");

assert.equal(sceneStatsActivityType(false, false, false), undefined);
assert.equal(sceneStatsActivityType(false, true, true), "oral");
assert.equal(sceneStatsActivityType(true, true, true), "sex");

assert.equal(sceneStatsReleaseYear(undefined), undefined);
assert.equal(sceneStatsReleaseYear("9999-01-01"), undefined);
assert.equal(sceneStatsReleaseYear("2026"), 2026);
assert.equal(sceneStatsReleaseMonth("2026"), undefined);
assert.equal(sceneStatsReleaseMonth("2026-00-01"), undefined);
assert.equal(sceneStatsReleaseMonth("2026-12"), 12);
assert.equal(sceneStatsReleaseDay("2026-12"), undefined);
assert.equal(sceneStatsReleaseDay("2026-02-29"), undefined);
assert.equal(sceneStatsReleaseDay("2024-02-29"), 29);
