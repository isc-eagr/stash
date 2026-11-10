import assert from "node:assert/strict";
import { summarizeReleaseConversionCustom } from "../src/components/Scenes/SceneDetails/sceneReleaseConversionSummary_custom.ts";

assert.deepEqual(
  summarizeReleaseConversionCustom({
    files: [3],
    play_history: [1, 2],
    o_history: [],
  }),
  { files: 1, plays: 2, oEvents: 0 }
);
