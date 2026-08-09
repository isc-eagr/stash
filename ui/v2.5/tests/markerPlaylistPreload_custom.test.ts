import assert from "node:assert/strict";

import {
  getNextSceneMarkerIndexCustom,
  markerPreloadMatchesCustom,
} from "../src/components/Scenes/markerPlaylistPreload_custom.ts";

const markers = [
  { id: "1", sceneId: "scene-a" },
  { id: "2", sceneId: "scene-a" },
  { id: "3", sceneId: "scene-b" },
  { id: "4", sceneId: "scene-c" },
];

assert.equal(
  getNextSceneMarkerIndexCustom(markers, 0, true, null),
  2,
  "preloading skips cheap same-scene seeks and warms the next source change"
);
assert.equal(
  getNextSceneMarkerIndexCustom(markers, 3, true, null),
  0,
  "looping playlists preload the first different scene before wrapping"
);
assert.equal(
  getNextSceneMarkerIndexCustom(markers, 3, false, null),
  undefined,
  "non-looping playlists do not preload past the end"
);
assert.equal(
  getNextSceneMarkerIndexCustom(markers, 0, true, "1"),
  undefined,
  "single-marker loops do not spend bandwidth preloading another scene"
);
assert.equal(
  getNextSceneMarkerIndexCustom(
    [
      { id: "1", sceneId: "scene-a" },
      { id: "2", sceneId: "scene-a" },
    ],
    0,
    true,
    null
  ),
  undefined,
  "a same-scene playlist needs no second video source"
);

assert.equal(
  markerPreloadMatchesCustom({ markerId: "3", sceneId: "scene-b" }, markers[2]),
  true,
  "a warmed slot is reusable only for its exact marker"
);
assert.equal(
  markerPreloadMatchesCustom(
    { markerId: "3", sceneId: "scene-b" },
    { id: "5", sceneId: "scene-b" }
  ),
  false,
  "a different marker in the same scene still requires a new seek"
);
