import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const statsSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneStatsPanel.tsx",
    import.meta.url
  ),
  "utf8"
);
const matrixSource = readFileSync(
  new URL(
    "../src/components/Scenes/OutstandingActivityMatrix_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const matrixStyles = readFileSync(
  new URL(
    "../src/components/Scenes/outstandingActivityMatrix_custom.scss",
    import.meta.url
  ),
  "utf8"
);

const compactPanel = statsSource.indexOf("scene-stats-overview-grid");
const detailsModal = statsSource.indexOf("<ModalComponent", compactPanel);
const matrixTable = statsSource.indexOf(
  "<OutstandingActivityMatrixTable",
  detailsModal
);

assert.ok(compactPanel >= 0 && detailsModal > compactPanel);
assert.ok(
  matrixTable > detailsModal,
  "the activity matrix should render inside the Detailed Stats modal"
);
assert.match(
  statsSource,
  />\s*Activity Matrix\s*<\/Button>/,
  "Detailed Stats should expose a dedicated Activity Matrix view"
);
assert.match(
  matrixSource,
  /backgroundImage: column\.imagePath/,
  "matrix performer headers should render performer pictures"
);
assert.match(
  matrixSource,
  /<span>\{column\.name\}<\/span>/,
  "matrix performer headers should retain performer names"
);
assert.doesNotMatch(
  matrixSource,
  /Time and marker occurrences by performer/,
  "the activity matrix should not render redundant helper copy"
);
assert.match(
  matrixStyles,
  /\.outstanding-activity-performer-image\s*\{[\s\S]*?aspect-ratio:\s*2 \/ 3;[\s\S]*?border-radius:\s*0\.25rem;[\s\S]*?width:\s*6\.25rem;/,
  "activity headers should match the Interaction Matrix portrait geometry"
);
