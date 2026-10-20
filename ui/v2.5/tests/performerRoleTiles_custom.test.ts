import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isZeroRoleTile,
  showsZeroRoleTiles,
} from "../src/components/Performers/PerformerDetails/performerRoleTiles_custom.ts";

const read = (path: string) =>
  readFileSync(new URL(`../src/components/${path}`, import.meta.url), "utf8");

// Totals show every role; scene strips keep only what happened in the scene.
assert.equal(showsZeroRoleTiles("full", undefined), true);
assert.equal(showsZeroRoleTiles("compact", undefined), true);
assert.equal(showsZeroRoleTiles("compact", "12"), false);
assert.equal(showsZeroRoleTiles(undefined, undefined), false);

assert.equal(isZeroRoleTile(true, 0), true);
assert.equal(isZeroRoleTile(true, 3), false);
assert.equal(isZeroRoleTile(true, undefined), false, "scene solo has no count");
assert.equal(isZeroRoleTile(false, 0), false);

const strip = read("Performers/PerformerDetails/PerformerCategoryStrip.tsx");
assert.match(
  strip,
  /badge\.url && !sceneId && !isZero \?/,
  "zero tiles render without a link"
);
assert.match(
  strip,
  /: !!role\.count \|\|\s*!!role\.partnerTopCount \|\|\s*!!role\.partnerBottomCount/,
  "zero-only roles stay out of the card versatility rows"
);

assert.match(
  strip,
  /: showZeroTiles\s*\? safeRolesToShow\.filter\(\(role\) => role\.category === "facial"\)/,
  "totals keep only the Facial tile; Sex/Oral/Solo move to the Scene Types bar"
);
assert.match(
  strip,
  /\{showZeroTiles && \(\s*<SceneTypesBar[\s\S]*?showEmpty/,
  "totals always show the Scene Types bar"
);

const globalRoles = strip.slice(strip.indexOf("// Global context"));
assert.ok(
  globalRoles.indexOf('category: "oral"') <
    globalRoles.indexOf('category: "solo"') &&
    globalRoles.indexOf('category: "solo"') <
      globalRoles.indexOf('category: "facial"'),
  "Solo sits between Oral and Facial"
);

assert.match(
  read("Performers/PerformerDetails/Performer.tsx"),
  /<PerformerCategoryStrip[\s\S]*?tiles="full"/,
  "Performer Detail uses full tiles"
);
for (const path of [
  "Performers/PerformerCard.tsx",
  "Scenes/SceneCardPerformerPopover_custom.tsx",
  "Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.tsx",
]) {
  assert.match(
    read(path),
    /<PerformerCategoryStrip[\s\S]*?tiles="compact"/,
    `${path} uses compact tiles`
  );
}
