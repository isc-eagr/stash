import assert from "node:assert/strict";
import test from "node:test";
import { getGallerySortMetricCustom } from "../src/components/Galleries/gallerySortMetric_custom.ts";
import { getGroupSortMetricCustom } from "../src/components/Groups/groupSortMetric_custom.ts";
import { getImageSortMetricCustom } from "../src/components/Images/imageSortMetric_custom.ts";
import { getPerformerSortMetricCustom } from "../src/components/Performers/performerSortMetric_custom.ts";
import { getSceneMarkerSortMetricCustom } from "../src/components/Scenes/sceneMarkerSortMetric_custom.ts";
import { getSceneSortMetricCustom } from "../src/components/Scenes/sceneSortMetric_custom.ts";
import { getTagSortMetricCustom } from "../src/components/Tags/tagSortMetric_custom.ts";

const scene = {
  id: "1",
  date: "2025-01-01",
  effective_date: "2024-12-31",
  files: [
    {
      path: "scene.mp4",
      size: 1024,
      duration: 120,
      width: 1920,
      height: 1080,
      frame_rate: 30,
      bit_rate: 6_000_000,
      fingerprints: [],
    },
  ],
  performers: [],
  groups: [],
  tags: [],
  scene_markers: [],
  negative_markers: [],
  rating_scores: [{ section: "bonus", key: "goatElement", raw_value: 1.5 }],
};

const performer = {
  name: "Vato",
  tags: [],
  activity_stats: { sex_percent: 42 },
};

const group = { name: "Group", scene_count: 12, tags: [] };
const image = {
  visual_files: [{ width: 1080, height: 1920, size: 2048, path: "image.jpg" }],
  tags: [],
  performers: [],
};
const gallery = {
  files: [],
  image_count: 24,
  tags: [],
  performers: [],
};
const tag = { name: "Tag", scene_count: 8 };
const marker = {
  title: "Marker",
  seconds: 10,
  end_seconds: 25,
  scene: { id: "4" },
};

test("catalog metrics stay hidden for each catalog's default sort", () => {
  assert.equal(
    getSceneSortMetricCustom("date", scene as never, "ASC" as never, {}),
    undefined
  );
  assert.equal(
    getPerformerSortMetricCustom("name", performer as never),
    undefined
  );
  assert.equal(getGroupSortMetricCustom("name", group as never), undefined);
  assert.equal(getImageSortMetricCustom("path", image as never), undefined);
  assert.equal(getGallerySortMetricCustom("path", gallery as never), undefined);
  assert.equal(
    getSceneMarkerSortMetricCustom("title", marker as never),
    undefined
  );
  assert.equal(getTagSortMetricCustom("name", tag as never), undefined);
});

test("each catalog resolves its active card metric and value", () => {
  assert.equal(
    getSceneSortMetricCustom("file_count", scene as never, "ASC" as never, {})
      ?.value,
    1
  );
  assert.equal(
    getSceneSortMetricCustom(
      "goat_element_bonus",
      scene as never,
      "DESC" as never,
      {}
    )?.value,
    "+15"
  );
  assert.equal(
    getPerformerSortMetricCustom("sex_activity_percent", performer as never)
      ?.value,
    42
  );
  assert.equal(
    getGroupSortMetricCustom("scenes_count", group as never)?.value,
    12
  );
  assert.equal(
    getImageSortMetricCustom("resolution", image as never)?.value,
    "1080\u00d71920"
  );
  assert.equal(
    getGallerySortMetricCustom("images_count", gallery as never)?.value,
    24
  );
  assert.equal(
    getSceneMarkerSortMetricCustom("duration", marker as never)?.value,
    15
  );
  assert.equal(getTagSortMetricCustom("scenes_count", tag as never)?.value, 8);
});

test("page-level aggregate values override unavailable card fields", () => {
  assert.equal(
    getGroupSortMetricCustom("sub_group_order", group as never, "3")?.value,
    "3"
  );
  assert.equal(
    getPerformerSortMetricCustom(
      "scenes_duration",
      performer as never,
      undefined,
      "3600"
    )?.value,
    "3600"
  );
  assert.equal(
    getTagSortMetricCustom("scenes_size", tag as never, "4096")?.value,
    "4096"
  );
});

test("plain and seeded random sorts hide the metric badge", () => {
  assert.equal(getTagSortMetricCustom("random", tag as never), undefined);
  assert.equal(getTagSortMetricCustom("random_123", tag as never), undefined);
  assert.equal(
    getSceneSortMetricCustom("random_456", scene as never, "ASC" as never, {}),
    undefined
  );
});
