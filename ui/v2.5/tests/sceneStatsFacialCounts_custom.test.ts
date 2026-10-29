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

assert.equal(facialCount(scene, roleTagIDs), 3);
assert.equal(reallyHotFacialCount(scene, roleTagIDs), 2);
assert.equal(
  facialCount(
    { scene_markers: [{ tag_ids: ["facial", "really-hot"] }] },
    roleTagIDs
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

const withSecondCamera = {
  ...roleTagIDs,
  secondCamera: new Set(["second-camera", "second-camera-child"]),
};
const secondCameraScene: SceneStatsFacialScene = {
  scene_markers: [
    { tag_ids: ["facial", "really-hot"] },
    { tag_ids: ["facial", "really-hot", "second-camera"] },
    {
      primary_tag: { id: "facial-child" },
      tags: [{ id: "second-camera-child" }],
    },
  ],
};
assert.equal(
  facialCount(secondCameraScene, withSecondCamera),
  1,
  "2nd Camera facial markers do not count"
);
assert.equal(
  reallyHotFacialCount(secondCameraScene, withSecondCamera),
  1,
  "2nd Camera really hot facials do not count"
);
assert.equal(
  facialCount(secondCameraScene, roleTagIDs),
  3,
  "without a 2nd Camera tag every facial marker counts"
);

const scenesByFacialCount = [
  {
    title: "One facial",
    scene_markers: [{ tag_ids: ["facial"] }],
  },
  {
    title: "Three facials",
    scene_markers: [
      { tag_ids: ["facial"] },
      { tag_ids: ["facial-child"] },
      { tag_ids: ["facial", "really-hot"] },
    ],
  },
  {
    title: "Two facials",
    scene_markers: [{ tag_ids: ["facial"] }, { tag_ids: ["facial-child"] }],
  },
].sort((a, b) => facialCount(b, roleTagIDs) - facialCount(a, roleTagIDs));

assert.deepEqual(
  scenesByFacialCount.map(({ title }) => title),
  ["Three facials", "Two facials", "One facial"],
  "facial count podium mode ranks scenes by matching marker count"
);
