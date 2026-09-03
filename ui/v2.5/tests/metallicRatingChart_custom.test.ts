import assert from "node:assert/strict";

import { metallicRatingChartBucket } from "../src/utils/metallicRatingChart_custom.ts";

assert.deepEqual(metallicRatingChartBucket(59, null), {
  key: "none",
  label: "None",
  sortValue: 0,
});
assert.deepEqual(metallicRatingChartBucket(0, undefined), {
  key: "none",
  label: "None",
  sortValue: 0,
});
assert.equal(metallicRatingChartBucket(null, null), undefined);
assert.equal(metallicRatingChartBucket(undefined, undefined), undefined);
assert.deepEqual(metallicRatingChartBucket(73, "silver"), {
  key: "silver",
  label: "Silver",
  sortValue: 2,
});
assert.deepEqual(metallicRatingChartBucket(null, "gold"), {
  key: "gold",
  label: "Gold",
  sortValue: 3,
});
assert.deepEqual(metallicRatingChartBucket(null, "royal_sapphire"), {
  key: "royal_sapphire",
  label: "Royal Sapphire",
  sortValue: 4,
});
