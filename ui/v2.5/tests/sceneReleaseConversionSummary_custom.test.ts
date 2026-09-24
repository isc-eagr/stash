import assert from "node:assert/strict";
import {
  summarizeReleaseConversionCustom,
  summarizeSceneConversionCustom,
} from "../src/components/Scenes/SceneDetails/sceneReleaseConversionSummary_custom.ts";

const scene = {
  files: [1, 2],
  play_history: [1],
  o_history: [1, 2],
  releases: [
    { files: [3], play_history: [1, 2], o_history: [] },
    { files: [4, 5], play_history: [], o_history: [3] },
  ],
};
assert.deepEqual(summarizeSceneConversionCustom(scene), {
  files: 5,
  plays: 3,
  oEvents: 3,
});
assert.deepEqual(summarizeReleaseConversionCustom(scene.releases[0]), {
  files: 1,
  plays: 2,
  oEvents: 0,
});
