import assert from "node:assert/strict";

import { shouldShowOfficialSceneMarkerLayout } from "../src/components/Scenes/SceneDetails/sceneMarkerLayoutPreference_custom.ts";

assert.equal(
  shouldShowOfficialSceneMarkerLayout(undefined),
  false,
  "missing UI config keeps the custom chronological marker layout"
);

assert.equal(
  shouldShowOfficialSceneMarkerLayout({}),
  false,
  "missing marker layout setting keeps the custom chronological marker layout"
);

assert.equal(
  shouldShowOfficialSceneMarkerLayout({
    showOfficialSceneMarkerLayout: false,
  }),
  false,
  "disabled marker layout setting keeps the custom chronological marker layout"
);

assert.equal(
  shouldShowOfficialSceneMarkerLayout({
    showOfficialSceneMarkerLayout: true,
  }),
  true,
  "enabled marker layout setting shows the official grouped marker layout"
);
