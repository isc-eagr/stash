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
  /: showZeroTiles\s*\? safeRolesToShow\.filter\(\s*\(role\) =>\s*role\.category === "facial" && isRoleSortHighlighted\("facial_count"\)\s*\)/,
  "totals leave Facial to Versatility unless sorted by Facial Count"
);
assert.match(
  strip,
  /const countTiles =\s*tiles && showZeroTiles \?[\s\S]*?<SceneTypeTiles[\s\S]*?performer-count-tiles__divider[\s\S]*?\{strip\}/,
  "totals show Scene Types tiles, a divider, then Nut/Feet"
);

// Scene Types tiles: shared by performer totals and studios.
const sceneTypeTiles = read("Shared/SceneTypeTiles_custom.tsx");
assert.match(
  sceneTypeTiles,
  /const url = row\.count > 0 \? getUrl\(row\.key, row\.label\) : undefined;/,
  "zero scene types render without a link"
);
assert.match(
  sceneTypeTiles,
  /title=\{`\$\{row\.label\}: \$\{row\.count\} scene\$\{[\s\S]*?\(\$\{Math\.round\(row\.percent\)\}%\)`\}/,
  "each tile's tooltip carries its share of scenes"
);
assert.match(
  read("Performers/PerformerDetails/performerRoleTiles_custom.scss"),
  /@each \$key in sex, oral, solo \{[\s\S]*?role-badge-item--#\{\$key\}[\s\S]*?rgba\(var\(--semantic-#\{\$key\}-rgb\), 0\.12\)/,
  "Sex/Oral/Solo tiles are tinted with their scene-type colors"
);
assert.match(
  read("Studios/StudioSceneTypeTiles_custom.tsx"),
  /counts\.sex_scene_count \+ counts\.oral_scene_count \+ counts\.solo_scene_count >\s*0 \?/,
  "studio tiles hide when every scene type is zero"
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
