import assert from "node:assert/strict";
import test from "node:test";
import {
  getStudioSortMetricCustom,
  getStudioSortMetricDefinitionCustom,
  studioSortMetricNeedsBackendCustom,
} from "../src/components/Studios/studioSortMetric_custom.ts";

const source = {
  studio: {
    child_studios: [{ id: "2" }],
    rating100: 88,
    tags: [{ id: "10" }, { id: "11" }],
  },
  stats: {
    active_sort_value: "7",
    gallery_count: 3,
    image_count: 4,
    o_counter: 5,
    scene_count: 6,
    unique_performer_count: 2,
    studio_activity_stats: {
      oral_percent: 20,
      other_percent: 10,
      outstanding_percent: 15,
      sex_percent: 40,
      solo_percent: 30,
      standard_percent: 75,
      unusable_percent: 10,
    },
    studio_role_counts: {
      facial_scene_count: 1,
      oral_scene_count: 2,
      sex_scene_count: 3,
      solo_scene_count: 4,
    },
  },
};

test("Studio sort metric is hidden only for the default name sort", () => {
  assert.equal(getStudioSortMetricCustom(undefined, source), undefined);
  assert.equal(getStudioSortMetricCustom("name", source), undefined);
  assert.equal(getStudioSortMetricCustom("random", source), undefined);
  assert.equal(getStudioSortMetricCustom("random_1234", source), undefined);
});

test("metallic Studio scene sorts use the exact backend value", () => {
  const expected = [
    ["royal_sapphire_scenes_count", "royal_sapphire_scene_count"],
    ["gold_scenes_count", "gold_scene_count"],
    ["silver_scenes_count", "silver_scene_count"],
    ["bronze_scenes_count", "bronze_scene_count"],
    ["no_metallic_scenes_count", "no_metallic_scene_count"],
  ];

  expected.forEach(([sortBy, messageID]) => {
    assert.deepEqual(getStudioSortMetricCustom(sortBy, source), {
      sortBy,
      messageID,
      format: "count",
      value: "7",
    });
  });
});

test("facial-variant Studio sorts use the exact backend value", () => {
  const expected = [
    ["standard_facial_count", "standard_facial_count"],
    ["really_hot_facial_count", "really_hot_facial_count"],
  ];

  expected.forEach(([sortBy, messageID]) => {
    assert.deepEqual(getStudioSortMetricCustom(sortBy, source), {
      sortBy,
      messageID,
      format: "count",
      value: "7",
    });
  });
});

test("existing Studio card aggregates resolve before inline highlighting", () => {
  assert.deepEqual(getStudioSortMetricCustom("scenes_count", source), {
    sortBy: "scenes_count",
    messageID: "scene_count",
    format: "count",
    value: 6,
  });
  assert.deepEqual(getStudioSortMetricCustom("sex_activity_percent", source), {
    sortBy: "sex_activity_percent",
    messageID: "sex_activity_percent",
    format: "percent",
    value: 40,
  });
  assert.deepEqual(
    getStudioSortMetricCustom("unclassified_activity_percent", source),
    {
      sortBy: "unclassified_activity_percent",
      messageID: "unclassified_activity_percent",
      format: "percent",
      value: 10,
    }
  );
  assert.deepEqual(getStudioSortMetricCustom("o_count", source), {
    sortBy: "o_count",
    messageID: "o_count",
    format: "count",
    value: "7",
  });
});

test("list table metric values take precedence over the active sort value", () => {
  const tableSource = {
    ...source,
    metricValues: { scenes_duration: "3600", gold_scenes_count: null },
  };
  assert.equal(
    getStudioSortMetricCustom("scenes_duration", tableSource)?.value,
    "3600"
  );
  assert.equal(
    getStudioSortMetricCustom("gold_scenes_count", tableSource)?.value,
    null
  );
  // Missing keys must not borrow the active sort's value.
  assert.equal(
    getStudioSortMetricCustom("silver_scenes_count", tableSource)?.value,
    undefined
  );
  // Page payload metrics still come from the stats.
  assert.equal(
    getStudioSortMetricCustom("scenes_count", tableSource)?.value,
    6
  );
});

test("only backend-only Studio metrics are requested from the metrics query", () => {
  for (const sortBy of [
    "scenes_duration",
    "latest_scene",
    "o_count",
    "no_metallic_scenes_count",
    "average_performer_rating",
    "average_overall_scene_rating",
  ]) {
    assert.equal(studioSortMetricNeedsBackendCustom(sortBy), true, sortBy);
  }
  for (const sortBy of [
    "scenes_count",
    "sex_activity_percent",
    "tag_count",
    "name",
    "unknown",
  ]) {
    assert.equal(studioSortMetricNeedsBackendCustom(sortBy), false, sortBy);
  }
  assert.deepEqual(getStudioSortMetricDefinitionCustom("scenes_duration"), {
    messageID: "scenes_duration",
    format: "duration",
  });
  assert.equal(getStudioSortMetricDefinitionCustom("unknown"), undefined);
});
