import assert from "node:assert/strict";

import { getSceneMarkerStickyHeaderOffset } from "../src/components/Scenes/SceneDetails/sceneMarkerStickyHeader_custom.ts";

assert.equal(
  getSceneMarkerStickyHeaderOffset(68),
  "72px",
  "activity headers leave a small visual gap below the marker toolbar"
);

assert.equal(
  getSceneMarkerStickyHeaderOffset(68.1),
  "73px",
  "fractional toolbar heights round up so sticky headers cannot overlap it"
);

assert.equal(
  getSceneMarkerStickyHeaderOffset(-10),
  "4px",
  "invalid toolbar measurements cannot produce a negative sticky offset"
);
