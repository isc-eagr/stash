import assert from "node:assert/strict";

import {
  makeSceneStatsMarkerTagURL,
  sceneStatsVatoCountBuckets,
} from "../src/components/SceneStats/sceneStatsSummary_custom.ts";

assert.deepEqual(sceneStatsVatoCountBuckets([0, 1, 2, 3, 4, 7]), {
  zero: 1,
  unknown: 0,
  one: 1,
  standard: 1,
  threesome: 1,
  group: 2,
});

const url = makeSceneStatsMarkerTagURL({ id: "15", name: "orgasm" });
const encodedCriterion = new URLSearchParams(url.split("?")[1]).get("c");
assert.ok(encodedCriterion);
assert.deepEqual(JSON.parse(encodedCriterion), {
  type: "marker_performers",
  modifier: "INCLUDES_ALL",
  tag_ids: [{ id: "15", label: "orgasm" }],
  include_subtags: true,
  top_performer_ids: [],
  top_ethnicities: [],
  top_countries: [],
  top_rating: null,
  bottom_performer_ids: [],
  bottom_ethnicities: [],
  bottom_countries: [],
  bottom_rating: null,
});

assert.deepEqual(sceneStatsVatoCountBuckets([null, undefined, -1, 0]), {
  zero: 1,
  unknown: 3,
  one: 0,
  standard: 0,
  threesome: 0,
  group: 0,
});
