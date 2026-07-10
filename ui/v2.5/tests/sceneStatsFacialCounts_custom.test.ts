import assert from "node:assert/strict";

import {
  facialCount,
  reallyHotFacialCount,
  type SceneStatsFacialScene,
} from "../src/components/SceneStats/sceneStatsFacialCounts_custom.ts";

const scene: SceneStatsFacialScene = {
  scene_markers: [
    {
      primary_tag: { id: "facial" },
      tags: [{ id: "really-hot" }],
    },
    {
      primary_tag: { id: "facial" },
      tags: [],
    },
    {
      primary_tag: { id: "really-hot" },
      tags: [{ id: "facial-child" }],
    },
    {
      primary_tag: { id: "really-hot" },
      tags: [],
    },
  ],
};

const roleTagIDs = {
  facial: new Set(["facial", "facial-child"]),
  reallyHot: new Set(["really-hot"]),
};

assert.equal(facialCount(scene, roleTagIDs.facial), 3);
assert.equal(reallyHotFacialCount(scene, roleTagIDs), 2);
assert.equal(
  facialCount(
    { scene_markers: [{ tag_ids: ["facial", "really-hot"] }] },
    roleTagIDs.facial
  ),
  1,
  "compact SceneStats marker tag IDs support facial counts"
);
assert.equal(
  reallyHotFacialCount(
    { scene_markers: [{ tag_ids: ["facial", "really-hot"] }] },
    roleTagIDs
  ),
  1,
  "compact SceneStats marker tag IDs support really-hot facial counts"
);
assert.equal(
  reallyHotFacialCount(scene, { facial: roleTagIDs.facial }),
  0,
  "really hot facial counts require the configurable really-hot tag"
);
