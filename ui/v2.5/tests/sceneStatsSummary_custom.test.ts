import assert from "node:assert/strict";

import {
  makeSceneStatsMarkerTagURL,
  makeSceneStatsVatoCountURL,
  sceneStatsVatoCountBuckets,
} from "../src/components/SceneStats/sceneStatsSummary_custom.ts";

assert.deepEqual(sceneStatsVatoCountBuckets([0, 1, 2, 3, 4, 7]), {
  one: 1,
  standard: 2,
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

const decodedVatoCriterion = (bucket: "one" | "standard" | "group") => {
  const bucketURL = makeSceneStatsVatoCountURL(bucket);
  const encoded = new URLSearchParams(bucketURL.split("?")[1]).get("c");
  assert.ok(encoded);
  return JSON.parse(encoded);
};

assert.deepEqual(decodedVatoCriterion("one"), {
  type: "performer_count",
  modifier: "EQUALS",
  value: { value: 1 },
});
assert.deepEqual(decodedVatoCriterion("standard"), {
  type: "performer_count",
  modifier: "BETWEEN",
  value: { value: 2, value2: 3 },
});
assert.deepEqual(decodedVatoCriterion("group"), {
  type: "performer_count",
  modifier: "GREATER_THAN",
  value: { value: 3 },
});
