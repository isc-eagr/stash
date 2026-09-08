import assert from "node:assert/strict";

import { partitionOStatsMarkerTagCountsCustom } from "../src/components/OStats/oStatsMarkerTagCharts_custom.ts";

const counts = [
  { tag_id: "sex", tag_name: "Sex", count: 12 },
  { tag_id: "oral", tag_name: "Oral", count: 10 },
  { tag_id: "solo", tag_name: "Solo", count: 8 },
  { tag_id: "facial", tag_name: "Facial", count: 6 },
  { tag_id: "hidden", tag_name: "Hidden", count: 4 },
];

const partitioned = partitionOStatsMarkerTagCountsCustom(
  counts,
  {
    sexTagId: "sex",
    oralTagId: "oral",
    soloTagId: "solo",
  },
  ["hidden", "sex"]
);

assert.deepEqual(
  partitioned.activityTypeCounts.map((item) => item.tag_id),
  ["sex", "oral", "solo"],
  "configured activity tags should remain visible even if also excluded from marker tags"
);
assert.deepEqual(
  partitioned.markerTagCounts.map((item) => item.tag_id),
  ["facial"],
  "activity and explicitly excluded tags should not appear in By Marker Tag"
);

const partiallyConfigured = partitionOStatsMarkerTagCountsCustom(counts, {
  oralTagId: "oral",
});

assert.deepEqual(
  partiallyConfigured.activityTypeCounts.map((item) => item.tag_id),
  ["oral"]
);
assert.deepEqual(
  partiallyConfigured.markerTagCounts.map((item) => item.tag_id),
  ["sex", "solo", "facial", "hidden"]
);
