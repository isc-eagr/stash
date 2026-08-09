import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scrubberSource = readFileSync(
  new URL(
    "../src/components/ScenePlayer/ScenePlayerScrubber.tsx",
    import.meta.url
  ),
  "utf8"
);
const scrubberStyles = readFileSync(
  new URL("../src/components/ScenePlayer/styles.scss", import.meta.url),
  "utf8"
);
const timelineMarkerSource = readFileSync(
  new URL("../src/components/ScenePlayer/markers.ts", import.meta.url),
  "utf8"
);
const markerPanelStyles = readFileSync(
  new URL("../src/components/Scenes/styles.scss", import.meta.url),
  "utf8"
);

assert.match(
  scrubberSource,
  /className=\{cx\(\s*"scrubber-tag-popover-trigger",\s*getMarkerRatingCardClass\(marker\)\s*\)\}/,
  "scrubber marker tags receive the shared GOAT/Royal Sapphire rating class"
);

assert.match(
  scrubberStyles,
  /\.scrubber-tag-popover-trigger[\s\S]*?\.rating-royal-sapphire[\s\S]*?background:\s*linear-gradient\(135deg,\s*#102a68,\s*#1d4ed8/,
  "Royal Sapphire scrubber tags have a persistent sapphire treatment"
);

assert.equal(
  timelineMarkerSource.match(/classList\.add\("vjs-marker-royal-sapphire"\)/g)
    ?.length,
  2,
  "both timeline dots and timeline ranges receive the Royal Sapphire class"
);

assert.match(
  timelineMarkerSource,
  /card\.className = `scene-marker-highlight-popover-card \$\{[\s\S]*?ratingCardClass/,
  "timeline hover cards receive the marker's shared Royal Sapphire rating class"
);

assert.match(
  scrubberStyles,
  /\.vjs-marker-tooltip-with-performer-card[\s\S]*?\.scene-marker-highlight-popover-card:is\([\s\S]*?\)\.rating-royal-sapphire/,
  "GOAT timeline hover cards define the Royal Sapphire card treatment"
);

assert.match(
  scrubberStyles,
  /\.vjs-marker\s*\{[\s\S]*?&\.vjs-marker-royal-sapphire\s*\{[\s\S]*?background-color:\s*#05080d;[\s\S]*?border:\s*1px solid rgba\(18,\s*63,\s*159,\s*0\.96\);[\s\S]*?box-shadow:\s*0 0 4px rgba\(56,\s*189,\s*248,\s*0\.38\),[\s\S]*?0 0 8px rgba\(18,\s*63,\s*159,\s*0\.5\)/,
  "timeline dots use the marker panel's Royal Sapphire border and compact glow"
);

assert.match(
  scrubberStyles,
  /\.vjs-marker-range\s*\{[\s\S]*?&\.vjs-marker-royal-sapphire\s*\{[\s\S]*?background-color:\s*#05080d;[\s\S]*?border:\s*1px solid rgba\(18,\s*63,\s*159,\s*0\.96\);[\s\S]*?box-shadow:\s*0 0 4px rgba\(56,\s*189,\s*248,\s*0\.38\),[\s\S]*?0 0 8px rgba\(18,\s*63,\s*159,\s*0\.5\)/,
  "timeline ranges use the marker panel's Royal Sapphire border and compact glow"
);

assert.match(
  scrubberStyles,
  /\.vjs-marker-range\s*\{[\s\S]*?&:not\(\.vjs-negative-marker-range\)[\s\S]*?&:hover\s*\{[\s\S]*?box-shadow:\s*0 0 0 1px rgba\(255,\s*255,\s*255,\s*0\.78\),[\s\S]*?0 0 0 2px rgba\(126,\s*205,\s*255,\s*0\.28\)/,
  "hovered timeline ranges use a neutral contrast rim to separate same-color neighbors"
);

assert.match(
  scrubberStyles,
  /&\.vjs-negative-marker-range\s*\{[\s\S]*?z-index:\s*102;/,
  "negative timeline ranges remain above hovered positive ranges"
);

assert.doesNotMatch(
  scrubberStyles,
  /&\.vjs-marker-royal-sapphire\s*\{[\s\S]*?background-image:\s*linear-gradient/,
  "Royal Sapphire timeline markers avoid the busy metallic gradient"
);

const focusGlow = markerPanelStyles.match(
  /@keyframes scene-marker-focus-glow\s*\{[\s\S]*?\n\}/
)?.[0];

assert.ok(focusGlow, "the clicked-marker focus animation remains defined");
assert.match(
  focusGlow,
  /rgba\(217,\s*70,\s*239,/,
  "the clicked-marker aura uses a fuchsia interaction color"
);
assert.doesNotMatch(
  focusGlow,
  /rgba\(72,\s*175,\s*240,/,
  "the clicked-marker aura no longer competes with Royal Sapphire blue"
);
