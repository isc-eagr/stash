import assert from "node:assert/strict";
import type * as GQL from "../src/core/generated-graphql";
import { getSceneReleasePlaybackContextCustom } from "../src/components/Scenes/SceneDetails/sceneReleasePlaybackContext_custom.ts";

const scene = {
  id: "1",
  title: "Main",
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
      files: [{ id: "release-file" }],
      streams: [{ url: "/release" }],
      paths: { screenshot: null, preview: null, vtt: null },
      scene_markers: [{ id: "release-marker" }],
      negative_markers: [{ id: "release-skip" }],
      multi_segment_loop_presets: [{ id: "release-loop" }],
      play_history: ["release-play"],
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
assert.equal(selected?.scene.multi_segment_loop_presets[0]?.id, "release-loop");
assert.deepEqual(selected?.scene.play_history, ["release-play"]);
assert.deepEqual(selected?.scene.o_history, ["release-o"]);
assert.equal(getSceneReleasePlaybackContextCustom(scene, "missing"), undefined);

const emptyRelease = {
  ...scene,
  releases: [{ ...scene.releases[0], files: [] }],
};
const empty = getSceneReleasePlaybackContextCustom(emptyRelease, "2");
assert.equal(empty?.ownerKey, "release:2:empty");
assert.deepEqual(empty?.scene.files, []);
