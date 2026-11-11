import assert from "node:assert/strict";
import test from "node:test";

import {
  ISceneOwnerCopyViewCustom,
  sceneOwnerCopyCountsCustom,
  sceneOwnerCopyItemsInputCustom,
  sceneOwnerCopySourcesCustom,
  sceneOwnerCopyToastCustom,
  sceneOwnerToScrapedCustom,
} from "../src/components/Scenes/SceneDetails/sceneOwnerCopyFields_custom.ts";

const scene = {
  id: "10",
  releases: [
    { id: "1", title: "Directors Cut" },
    { id: "2", title: null },
    { id: "3", title: "  " },
  ],
};

test("a scene lists each release as a source", () => {
  assert.deepEqual(sceneOwnerCopySourcesCustom(scene, null), [
    { key: "release:1", label: "Directors Cut", owner: { releaseId: "1" } },
    { key: "release:2", label: "Untitled Release", owner: { releaseId: "2" } },
    { key: "release:3", label: "Untitled Release", owner: { releaseId: "3" } },
  ]);
});

test("a release lists the scene first, then sibling releases", () => {
  const sources = sceneOwnerCopySourcesCustom(scene, "2");
  assert.deepEqual(
    sources.map((s) => s.key),
    ["scene", "release:1", "release:3"]
  );
  assert.equal(sources[0].label, "Scene");
  assert.deepEqual(sources[0].owner, { sceneId: "10" });
});

test("a scene without releases has no sources", () => {
  assert.deepEqual(sceneOwnerCopySourcesCustom({ id: "1", releases: [] }), []);
});

const view = (
  overrides: Partial<ISceneOwnerCopyViewCustom> = {}
): ISceneOwnerCopyViewCustom => ({
  title: "Title",
  code: "C-1",
  date: "2024-01-02",
  production_date: "2023-12-01",
  director: "Dir",
  details: "Details",
  urls: ["https://a.example"],
  studio: { id: "5", name: "Studio" },
  performers: [{ id: "7", name: "Perf" }],
  tags: [{ id: "8", name: "Tag" }],
  groups: [{ group: { id: "9", name: "Group" } }],
  scene_markers: [{}, {}],
  negative_markers: [{}],
  multi_segment_loop_presets: [],
  ...overrides,
});

test("owner converts to the scrape shape with stored IDs", () => {
  const scraped = sceneOwnerToScrapedCustom(view(), false);
  assert.equal(scraped.title, "Title");
  assert.equal(scraped.production_date, "2023-12-01");
  assert.deepEqual(scraped.studio, { stored_id: "5", name: "Studio" });
  assert.deepEqual(scraped.performers, [{ stored_id: "7", name: "Perf" }]);
  assert.deepEqual(scraped.tags, [{ stored_id: "8", name: "Tag" }]);
  assert.deepEqual(scraped.groups, [{ stored_id: "9", name: "Group" }]);
  assert.deepEqual(scraped.urls, ["https://a.example"]);
});

test("production date is dropped for a release target", () => {
  assert.equal(sceneOwnerToScrapedCustom(view(), true).production_date, null);
});

test("empty source values scrape as nothing", () => {
  const scraped = sceneOwnerToScrapedCustom(
    view({ title: "", urls: [], studio: null }),
    false
  );
  assert.equal(scraped.title, null);
  assert.equal(scraped.urls, null);
  assert.equal(scraped.studio, null);
});

test("source counts", () => {
  assert.deepEqual(sceneOwnerCopyCountsCustom(view()), {
    markers: 2,
    negative_markers: 1,
    loop_presets: 0,
  });
});

const kinds = { markers: true, negative_markers: false, loop_presets: true };

test("copy input: scene to release", () => {
  assert.deepEqual(
    sceneOwnerCopyItemsInputCustom(
      "10",
      { sceneId: "10" },
      { releaseId: "1" },
      kinds
    ),
    {
      from_scene_id: "10",
      to_release_id: "1",
      markers: true,
      negative_markers: false,
      loop_presets: true,
    }
  );
});

test("copy input: release to scene", () => {
  assert.deepEqual(
    sceneOwnerCopyItemsInputCustom(
      "10",
      { releaseId: "1" },
      { sceneId: "10" },
      kinds
    ),
    {
      from_release_id: "1",
      to_scene_id: "10",
      markers: true,
      negative_markers: false,
      loop_presets: true,
    }
  );
});

test("copy input: release to sibling release", () => {
  const input = sceneOwnerCopyItemsInputCustom(
    "10",
    { releaseId: "1" },
    { releaseId: "3" },
    kinds
  );
  assert.equal(input.from_release_id, "1");
  assert.equal(input.to_release_id, "3");
  assert.equal(Object.hasOwn(input, "from_scene_id"), false);
  assert.equal(Object.hasOwn(input, "to_scene_id"), false);
});

test("toast text", () => {
  assert.equal(
    sceneOwnerCopyToastCustom({
      markers: 5,
      negative_markers: 2,
      loop_presets: 0,
    }),
    "Copied 5 markers, 2 skip ranges"
  );
  assert.equal(
    sceneOwnerCopyToastCustom({
      markers: 1,
      negative_markers: 1,
      loop_presets: 1,
    }),
    "Copied 1 marker, 1 skip range, 1 loop preset"
  );
  assert.equal(
    sceneOwnerCopyToastCustom({
      markers: 0,
      negative_markers: 0,
      loop_presets: 0,
    }),
    "Nothing new to copy"
  );
});
