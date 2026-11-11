import assert from "node:assert/strict";
import type * as GQL from "../src/core/generated-graphql";
import { getSceneReleasePlaybackContextCustom } from "../src/components/Scenes/SceneDetails/sceneReleasePlaybackContext_custom.ts";

const scene = {
  id: "1",
  title: "Main",
  code: "MAIN",
  rating100: 80,
  rating_scores: [{ id: "score" }],
  release_o_counter: 5,
  release_stashdb_matches: 9,
  release_last_o_at: "2024-01-01T00:00:00Z",
  effective_date: "2020-01-01",
  date: "2020-01-01",
  organized: true,
  files: [{ id: "main-file" }],
  sceneStreams: [{ url: "/main" }],
  paths: { screenshot: "/main.jpg", preview: "/main.mp4", vtt: "/main.vtt" },
  scene_markers: [{ id: "main-marker" }],
  negative_markers: [{ id: "main-skip" }],
  multi_segment_loop_presets: [{ id: "main-loop" }],
  play_history: ["main-play"],
  o_history: ["main-o"],
  releases: [
    {
      id: "2",
      title: "Alternate",
      code: "ALT",
      details: "release details",
      director: "release director",
      urls: ["https://example.com/r"],
      date: "2022-02-02",
      studio: { id: "s2" },
      groups: [{ group: { id: "g2" }, scene_index: 1 }],
      stash_ids: [{ endpoint: "e", stash_id: "x" }],
      stashdb_matches: 3,
      custom_fields: { a: 1 },
      created_at: "2022-03-03T00:00:00Z",
      updated_at: "2022-04-04T00:00:00Z",
      files: [{ id: "release-file" }],
      streams: [{ url: "/release" }],
      paths: { screenshot: null, preview: null, vtt: null },
      scene_markers: [{ id: "release-marker" }],
      scene_marker_tag_ancestors: [{ tag_id: "t1", ancestor_ids: ["t0"] }],
      negative_markers: [{ id: "release-skip" }],
      multi_segment_loop_presets: [{ id: "release-loop" }],
      play_history: ["2023-01-01T00:00:00Z", "2023-06-01T00:00:00Z"],
      o_history: ["release-o"],
      o_timestamps: [7],
      performers: [],
      tags: [],
      galleries: [],
      captions: [],
    },
  ],
} as unknown as GQL.SceneDataFragment;

const main = getSceneReleasePlaybackContextCustom(scene, null);
assert.equal(main?.scene, scene);
assert.equal(main?.ownerKey, "scene:1:main-file");

const selected = getSceneReleasePlaybackContextCustom(scene, "2");
assert.equal(selected?.ownerKey, "release:2:release-file");
assert.equal(selected?.scene.files[0]?.id, "release-file");
assert.equal(selected?.scene.sceneStreams[0]?.url, "/release");
assert.equal(selected?.scene.paths.preview, null);
assert.equal(selected?.scene.paths.vtt, null);
assert.equal(selected?.scene.scene_markers[0]?.id, "release-marker");
assert.equal(selected?.scene.negative_markers[0]?.id, "release-skip");
assert.deepEqual(selected?.scene.scene_marker_tag_ancestors, [
  { tag_id: "t1", ancestor_ids: ["t0"] },
]);
assert.equal(selected?.scene.multi_segment_loop_presets[0]?.id, "release-loop");
assert.deepEqual(selected?.scene.play_history, [
  "2023-01-01T00:00:00Z",
  "2023-06-01T00:00:00Z",
]);
assert.equal(selected?.scene.last_played_at, "2023-06-01T00:00:00Z");
assert.deepEqual(selected?.scene.o_history, ["release-o"]);
assert.equal(getSceneReleasePlaybackContextCustom(scene, "missing"), undefined);

const emptyRelease = {
  ...scene,
  releases: [{ ...scene.releases[0], files: [] }],
};
const empty = getSceneReleasePlaybackContextCustom(emptyRelease, "2");
assert.equal(empty?.ownerKey, "release:2:empty");
assert.deepEqual(empty?.scene.files, []);
assert.equal(empty?.scene.sceneStreams.length, 1); // streams follow the release
assert.equal(empty?.scene.id, "1");

// Release-owned fields follow the release; the id, ratings, and organized flag
// stay the parent's.
assert.equal(selected?.scene.id, "1");
assert.equal(selected?.scene.code, "ALT");
assert.equal(selected?.scene.details, "release details");
assert.equal(selected?.scene.director, "release director");
assert.deepEqual(selected?.scene.urls, ["https://example.com/r"]);
assert.equal(selected?.scene.date, "2022-02-02");
assert.equal(selected?.scene.effective_date, "2022-02-02");
assert.equal(selected?.scene.studio?.id, "s2");
assert.equal(selected?.scene.groups[0]?.group.id, "g2");
assert.equal(selected?.scene.stash_ids[0]?.stash_id, "x");
assert.equal(selected?.scene.stashdb_matches, 3);
assert.deepEqual(selected?.scene.custom_fields, { a: 1 });
assert.equal(selected?.scene.organized, true); // the parent's
assert.equal(selected?.scene.created_at, "2022-03-03T00:00:00Z");
assert.equal(selected?.scene.updated_at, "2022-04-04T00:00:00Z");
assert.equal(selected?.scene.rating100, 80);
assert.equal(selected?.scene.rating_scores, scene.rating_scores);
assert.equal(selected?.scene.release_o_counter, 0);
assert.equal(selected?.scene.release_stashdb_matches, null);
assert.equal(selected?.scene.release_last_o_at, null);
assert.equal(selected?.scene.releases, scene.releases);

// A release with no activity has no last played time.
const quiet = getSceneReleasePlaybackContextCustom(
  { ...scene, releases: [{ ...scene.releases[0], play_history: [] }] },
  "2"
);
assert.equal(quiet?.scene.last_played_at, null);
