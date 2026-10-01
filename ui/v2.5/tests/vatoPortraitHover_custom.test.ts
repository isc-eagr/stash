import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(`../src/components/${path}`, import.meta.url), "utf8");

const statsPanel = read("Scenes/SceneDetails/SceneStatsPanel.tsx");
const markersPanel = read(
  "Scenes/SceneDetails/SceneMarkersChronologicalPanel.tsx"
);
const markerTile = read(
  "Scenes/SceneDetails/sceneMarkerHoverPopover_custom.tsx"
);
const activityMatrix = read("Scenes/OutstandingActivityMatrix_custom.tsx");
const overview = read(
  "Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.tsx"
);
const sceneStyles = read("Scenes/styles.scss");
const overviewStyles = read(
  "Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.scss"
);

assert.equal(
  statsPanel.match(/<VatoPortraitHover/g)?.length,
  7,
  "Performer Explorer, ribbon, partner table, and matrix portraits hover large"
);
assert.equal(
  markersPanel.match(/hoverPortrait\n/g)?.length,
  2,
  "Markers tab top and bottom tiles opt into the hover portrait"
);
assert.match(
  markerTile,
  /hoverPortrait \? \(\s*<VatoPortraitHover/,
  "only opted-in marker tiles wrap the portrait"
);
assert.match(activityMatrix, /<VatoPortraitHover/);
assert.match(
  overview,
  /<VatoPortraitHover[\s\S]*?scene-performer-overview-interaction-image/,
  "In This Scene portraits hover large"
);
assert.match(
  sceneStyles,
  /\.scene-marker-activity-performer-image \{[\s\S]*?width: 3\.5rem;/,
  "Markers tab portraits are compact"
);
assert.match(
  sceneStyles,
  /\.scene-stats-matrix \.scene-stats-matrix-performer-image \{[\s\S]*?width: 3rem;/,
  "Interaction Matrix portraits are compact"
);
assert.match(
  overviewStyles,
  /\.scene-performer-overview-interaction-partners \{[\s\S]*?repeat\(auto-fill, 4\.5rem\)/,
  "In This Scene portraits are compact"
);
