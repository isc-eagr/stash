import assert from "node:assert/strict";
import test from "node:test";
import { getStudioSortMetricCustom } from "../src/components/Studios/studioSortMetric_custom.ts";

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

test("existing Studio card aggregates back the current-sort strip", () => {
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
  assert.deepEqual(getStudioSortMetricCustom("o_count", source), {
    sortBy: "o_count",
    messageID: "o_count",
    format: "count",
    value: "7",
  });
});
