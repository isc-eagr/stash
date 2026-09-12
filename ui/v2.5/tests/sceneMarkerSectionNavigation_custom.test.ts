import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getSceneMarkerSectionAnchorId,
  isSceneMarkerJumpSection,
  scrollToSceneMarkerSection,
} from "../src/components/Scenes/SceneDetails/sceneMarkerSectionNavigation_custom.ts";

const chronologicalPanelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneMarkersChronologicalPanel.tsx",
    import.meta.url
  ),
  "utf8"
);
const markerPanelStyles = readFileSync(
  new URL("../src/components/Scenes/styles.scss", import.meta.url),
  "utf8"
);
const blackSteelStyles = readFileSync(
  new URL("../src/styles/applicationTheme_custom.scss", import.meta.url),
  "utf8"
);

assert.match(
  chronologicalPanelSource,
  /scene-marker-section-navigation|getSceneMarkerSectionAnchorId/,
  "marker panels retain non-Feet section anchors and jump controls"
);
assert.doesNotMatch(
  chronologicalPanelSource,
  /key:\s*"feet"/,
  "marker panels no longer render a Feet section"
);
assert.match(
  `${markerPanelStyles}\n${blackSteelStyles}`,
  /scene-marker-section-navigation/,
  "non-Feet section navigation retains its styling"
);
assert.equal(isSceneMarkerJumpSection("feet"), false);
assert.equal(isSceneMarkerJumpSection("oral"), true);
assert.equal(
  getSceneMarkerSectionAnchorId("oral"),
  "scene-marker-section-oral"
);
let scrolled = false;
assert.equal(
  scrollToSceneMarkerSection("oral", {
    getElementById: () => ({
      scrollIntoView: () => {
        scrolled = true;
      },
    }),
  }),
  true
);
assert.equal(scrolled, true, "non-Feet section anchors can still be used");
assert.match(
  markerPanelStyles,
  /\.scene-marker-activity-group-header\s*\{[\s\S]*?box-shadow:\s*inset 0 0\.18rem 0 #48aff0/,
  "default section headers keep their horizontal top accent"
);
assert.match(
  blackSteelStyles,
  /\.scene-marker-activity-group-header\s*\{[\s\S]*?box-shadow:\s*inset 0 0\.18rem 0 var\(--black-steel-accent\)/,
  "Black Steel section headers keep their horizontal copper top accent"
);
