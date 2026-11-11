import assert from "node:assert/strict";
import { getSceneOwnerChipsCustom } from "../src/components/Scenes/SceneDetails/sceneOwnerChips_custom.ts";

const chips = getSceneOwnerChipsCustom([
  { id: "3", title: "Third", play_order: 2 },
  { id: "1", title: "  ", play_order: 0 },
  { id: "2", title: "Second", play_order: 0 },
  { id: "4", title: null, play_order: 1 },
]);

assert.deepEqual(
  chips.map((chip) => chip.releaseId),
  [null, "1", "2", "4", "3"]
);
assert.deepEqual(
  chips.map((chip) => chip.label),
  ["Scene", "Untitled Release", "Second", "Untitled Release", "Third"]
);
assert.deepEqual(getSceneOwnerChipsCustom([]), [
  { releaseId: null, label: "Scene" },
]);
