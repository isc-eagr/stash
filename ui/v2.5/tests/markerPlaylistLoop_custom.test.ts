import assert from "node:assert/strict";

import { getToggledMarkerPlaylistLoopIdCustom } from "../src/components/Scenes/markerPlaylistLoop_custom.ts";

assert.equal(
  getToggledMarkerPlaylistLoopIdCustom(null, "marker-1"),
  "marker-1",
  "enabling the control loops the current marker"
);
assert.equal(
  getToggledMarkerPlaylistLoopIdCustom("marker-1", "marker-1"),
  null,
  "pressing the active control disables the current marker loop"
);
assert.equal(
  getToggledMarkerPlaylistLoopIdCustom("marker-1", "marker-2"),
  "marker-2",
  "enabling another marker switches the single-marker loop target"
);
