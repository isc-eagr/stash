import assert from "node:assert/strict";

import {
  isSceneStatsUnknownValue,
  type SceneStatsUnknownValues,
} from "../src/components/SceneStats/sceneStatsUnknownFilters_custom.ts";
import {
  sceneStatsRatingBucket,
  sceneStatsReleaseDay,
  sceneStatsReleaseMonth,
  sceneStatsReleaseYear,
} from "../src/components/SceneStats/sceneStatsChartBuckets_custom.ts";
import { metallicRatingChartBucket } from "../src/utils/metallicRatingChart_custom.ts";

for (const [category, key] of [
  ["ethnicity", "ethnicities"],
  ["country", "countries"],
] as const) {
  for (const values of [undefined, [], [null, undefined, " ", " <NiL> "]]) {
    assert.equal(isSceneStatsUnknownValue(category, { [key]: values }), true);
  }
  // An incomplete performer demographic does not make a partially known scene
  // count in the Unknown group: charts count scenes, not missing performers.
  assert.equal(
    isSceneStatsUnknownValue(category, { [key]: ["", "<nil>", "known"] }),
    false
  );
}

for (const [category, key] of [
  ["performer_count", "performerCount"],
  ["facial_count", "facialCount"],
  ["really_hot_facial_count", "reallyHotFacialCount"],
] as const) {
  for (const value of [undefined, null, 0, -1, NaN]) {
    assert.equal(isSceneStatsUnknownValue(category, { [key]: value }), true);
  }
  assert.equal(isSceneStatsUnknownValue(category, { [key]: 1 }), false);
}

for (const rating of [undefined, null, 0]) {
  assert.equal(
    isSceneStatsUnknownValue("rating", {
      ratingBucket: sceneStatsRatingBucket(rating),
    }),
    true
  );
}
assert.equal(
  isSceneStatsUnknownValue("rating", {
    ratingBucket: sceneStatsRatingBucket(61),
  }),
  false
);

// Explicit metallic overrides remain known even with no numeric rating.
for (const [rating, override, expectedUnknown] of [
  [null, null, true],
  [undefined, undefined, true],
  [null, "gold", false],
  [null, "royal_sapphire", false],
  [0, undefined, false],
  [59, undefined, false],
] as const) {
  assert.equal(
    isSceneStatsUnknownValue("metallic_rating", {
      metallicRatingBucket: metallicRatingChartBucket(rating, override)?.key,
    }),
    expectedUnknown
  );
}

function releaseValues(date?: string): SceneStatsUnknownValues {
  return {
    releaseYear: sceneStatsReleaseYear(date),
    releaseMonth: sceneStatsReleaseMonth(date),
    releaseDay: sceneStatsReleaseDay(date),
  };
}

assert.equal(isSceneStatsUnknownValue("release_day", releaseValues()), true);
assert.equal(
  isSceneStatsUnknownValue("release_day", releaseValues("9999-01-01")),
  true
);
for (const [date, unknownYear, unknownMonth, unknownDay] of [
  ["2026", false, true, true],
  ["2026-09", false, false, true],
  ["2026-09-07", false, false, false],
  ["2026-02-29", false, false, true],
] as const) {
  const values = releaseValues(date);
  assert.equal(isSceneStatsUnknownValue("release_day", values), unknownYear);
  assert.equal(
    isSceneStatsUnknownValue("release_day", values, "month"),
    unknownMonth
  );
  assert.equal(
    isSceneStatsUnknownValue("release_day", values, "day"),
    unknownDay
  );
}

for (const [category, key, known] of [
  ["scene_type", "sceneType", "solo"],
  ["resolution", "resolution", "1080p"],
] as const) {
  for (const value of [undefined, null, ""]) {
    assert.equal(isSceneStatsUnknownValue(category, { [key]: value }), true);
  }
  assert.equal(isSceneStatsUnknownValue(category, { [key]: known }), false);
}

for (const category of ["facial_status", "duration", "invalid_category"]) {
  assert.equal(isSceneStatsUnknownValue(category, {}), false);
}

console.log("Scene Stats unknown filter tests passed.");
