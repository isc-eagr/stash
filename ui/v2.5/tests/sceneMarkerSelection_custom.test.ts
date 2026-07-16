import assert from "node:assert/strict";

import {
  getSceneMarkerSelectionCounts,
  getSceneMarkerSelectionState,
} from "../src/components/Scenes/SceneDetails/sceneMarkerSelection_custom.ts";

assert.equal(
  getSceneMarkerSelectionState(["one", "two"], new Set()),
  "none",
  "an unselected scope reports no selection"
);

assert.equal(
  getSceneMarkerSelectionState(["one", "two"], new Set(["one"])),
  "some",
  "a partially selected scope reports an indeterminate selection"
);

assert.equal(
  getSceneMarkerSelectionState(["one", "two", "two"], new Set(["one", "two"])),
  "all",
  "duplicate layout marker IDs do not prevent an all-selected state"
);

assert.deepEqual(
  getSceneMarkerSelectionCounts(
    ["marker:one", "marker:two", "derived:one"],
    new Set(["marker:two", "derived:one"])
  ),
  { hidden: 1, total: 3, visible: 2 },
  "selection counts expose items hidden by active scene-local filters"
);
