import assert from "node:assert/strict";

import { shouldEnableSceneOHotkeyCustom } from "../src/components/Scenes/SceneDetails/sceneOHotkeyPreference_custom.ts";

assert.equal(shouldEnableSceneOHotkeyCustom(), true);
assert.equal(shouldEnableSceneOHotkeyCustom({}), true);
assert.equal(
  shouldEnableSceneOHotkeyCustom({ enableSceneOHotkey: false }),
  false
);
