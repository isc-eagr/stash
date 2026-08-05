import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getSceneMarkerSectionAnchorId,
  isSceneMarkerJumpSection,
  scrollToSceneMarkerSection,
} from "../src/components/Scenes/SceneDetails/sceneMarkerSectionNavigation_custom.ts";

["oral", "solo", "sex", "feet", "orgasm", "facial", "other-highlights"].forEach(
  (sectionKey) => {
    assert.equal(
      isSceneMarkerJumpSection(sectionKey),
      true,
      `${sectionKey} receives a compact marker-section jump control`
    );
  }
);

["unknown"].forEach((sectionKey) => {
  assert.equal(
    isSceneMarkerJumpSection(sectionKey),
    false,
    `${sectionKey} is not treated as a rendered marker section`
  );
});

assert.equal(
  getSceneMarkerSectionAnchorId("orgasm"),
  "scene-marker-section-orgasm",
  "section links and targets share a stable anchor ID"
);

let requestedSectionId: string | undefined;
let requestedScrollOptions: ScrollIntoViewOptions | undefined;
const didScroll = scrollToSceneMarkerSection("oral", {
  getElementById(id) {
    requestedSectionId = id;

    return {
      scrollIntoView(options) {
        requestedScrollOptions = options;
      },
    };
  },
});

assert.equal(didScroll, true, "an available section is scrolled into view");
assert.equal(
  requestedSectionId,
  "scene-marker-section-oral",
  "section jumps resolve the in-panel target without changing the URL"
);
assert.deepEqual(
  requestedScrollOptions,
  {
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  },
  "section jumps use smooth, sticky-header-aware scrolling"
);
assert.equal(
  scrollToSceneMarkerSection("facial", {
    getElementById: () => null,
  }),
  false,
  "a filtered-out section does not trigger navigation"
);

const markerPanelStyles = readFileSync(
  new URL("../src/components/Scenes/styles.scss", import.meta.url),
  "utf8"
);
const chronologicalPanelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneMarkersChronologicalPanel.tsx",
    import.meta.url
  ),
  "utf8"
);
const blackSteelStyles = readFileSync(
  new URL("../src/styles/applicationTheme_custom.scss", import.meta.url),
  "utf8"
);
const sectionNavigationSource =
  chronologicalPanelSource.match(/<nav[\s\S]*?<\/nav>/)?.[0];

assert.ok(sectionNavigationSource, "section navigation remains rendered");
assert.match(
  sectionNavigationSource,
  /className="scene-marker-section-navigation-button"[\s\S]*?onClick=\{\(\) => scrollToSceneMarkerSection\(section\.key\)\}/,
  "section navigation uses in-panel scroll buttons"
);
assert.doesNotMatch(
  sectionNavigationSource,
  /href=/,
  "section navigation does not hand router-owned hashes to an anchor"
);
assert.doesNotMatch(
  sectionNavigationSource,
  /scene-marker-section-navigation-label/,
  "the compact section controls do not show extra Jump verbiage"
);
assert.match(
  chronologicalPanelSource,
  /id=\{getSceneMarkerSectionAnchorId\(fallbackHighlightSectionKey\)\}/,
  "Other Highlights receives the same in-panel scroll target as activity sections"
);
assert.match(
  markerPanelStyles,
  /\.scene-marker-activity-group-header\s*\{[\s\S]*?box-shadow:\s*inset 0 0\.18rem 0 #48aff0/,
  "default section headers use a horizontal top accent"
);
assert.match(
  blackSteelStyles,
  /\.scene-marker-activity-group-header\s*\{[\s\S]*?box-shadow:\s*inset 0 0\.18rem 0 var\(--black-steel-accent\)/,
  "Black Steel section headers use a horizontal copper top accent"
);
assert.doesNotMatch(
  `${markerPanelStyles}\n${blackSteelStyles}`,
  /\.scene-marker-activity-group-header\s*\{[\s\S]*?inset 0\.38rem 0 0/,
  "section headers do not reuse the current-playback left rail"
);
