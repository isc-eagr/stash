import assert from "node:assert/strict";
import type * as GQL from "../src/core/generated-graphql";
import { scenePlayerGalleryIDsCustom } from "../src/components/ScenePlayer/scenePlayerGalleryIDs_custom.ts";

const scene = {
  galleries: [{ id: "main" }],
  releases: [{ galleries: [{ id: "release" }] }],
} as GQL.SceneDataFragment;
assert.deepEqual(scenePlayerGalleryIDsCustom(scene), ["main", "release"]);
assert.deepEqual(scenePlayerGalleryIDsCustom(scene, "selected-release"), [
  "main",
]);
