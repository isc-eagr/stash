import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getRatingCardClass } from "../src/utils/ratingCardStyles_custom.ts";

const popoverSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneCardPerformerPopover_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const sceneFragmentSource = readFileSync(
  new URL("../graphql/data/scene-slim.graphql", import.meta.url),
  "utf8"
);
const sceneStyles = readFileSync(
  new URL("../src/components/Scenes/styles.scss", import.meta.url),
  "utf8"
);
const markerHoverSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/sceneMarkerHoverPopover_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const ratingCardStyles = readFileSync(
  new URL(
    "../src/components/Shared/ratingCardStyles_custom.scss",
    import.meta.url
  ),
  "utf8"
);

const thresholds = {
  performer: {
    bronze: 60,
    silver: 73,
    gold: 84,
    royalSapphire: 90,
  },
};

assert.deepEqual(
  [60, 73, 84, 90].map((rating) =>
    getRatingCardClass({
      rating,
      theme: "premium",
      thresholds,
      thresholdEntity: "performer",
    })
  ),
  [
    "rating-card-theme-premium rating-3-stars",
    "rating-card-theme-premium rating-4-stars",
    "rating-card-theme-premium rating-5-stars",
    "rating-card-theme-premium rating-royal-sapphire",
  ],
  "scene-card hover portraits use all four configured performer rating tiers"
);

assert.equal(
  getRatingCardClass({
    rating: 10,
    tags: [{ id: "royal" }],
    theme: "classic",
    thresholds,
    thresholdEntity: "performer",
    overrideTagIds: { royalSapphireTagId: "royal" },
  }),
  "rating-card-theme-classic rating-royal-sapphire",
  "performer override tags retain precedence over numeric ratings"
);

assert.match(
  sceneFragmentSource,
  /performers\s*\{[\s\S]*?rating100[\s\S]*?rating_tier_tags:\s*tags\s*\{\s*id\s*\}/,
  "slim scene cards request performer ratings and override tags"
);

assert.match(
  popoverSource,
  /getRatingCardClass\(\{[\s\S]*?thresholdEntity:\s*"performer"[\s\S]*?\}\)/,
  "the scene-card hover evaluates each portrait with performer thresholds"
);
assert.match(
  popoverSource,
  /markerSummary\s*\?\s*\{\s*\.\.\.markerSummary,\s*performer\s*\}/,
  "marker role summaries are reattached to the full rated performer record"
);
assert.match(
  popoverSource,
  /imageClassName=\{\s*ratingClass\s*\?\s*cx\("performer-card",\s*ratingClass\)\s*:\s*undefined\s*\}/,
  "tiered portraits use the exact performer-card skin classes"
);
assert.match(
  ratingCardStyles,
  /:is\([\s\S]*?\.performer-card[\s\S]*?\)\.rating-card-theme-premium\.rating-5-stars/,
  "the reused performer-card class resolves to the shared premium skin"
);
assert.match(
  ratingCardStyles,
  /:is\([\s\S]*?\.performer-card[\s\S]*?\)\.rating-card-theme-classic\.rating-5-stars/,
  "the reused performer-card class resolves to the shared classic skin"
);
assert.doesNotMatch(
  sceneStyles,
  /scene-card-performer-tier-rgb/,
  "scene cards do not maintain a second metallic color palette"
);

assert.match(
  popoverSource,
  /imageAccessory=\{[\s\S]*?rating\s*!==\s*undefined\s*&&\s*rating\s*!==\s*null[\s\S]*?className="scene-card-performer-rating"[\s\S]*?<Icon\s+icon=\{faStar\}[\s\S]*?<span>\{rating\}<\/span>/,
  "every set performer rating renders as a compact star-and-number accessory"
);
assert.match(
  markerHoverSource,
  /\{imageAccessory\}[\s\S]*?scene-marker-activity-performer-name/,
  "the rating accessory sits in normal flow between the portrait and name"
);

const ratingBadgeStyles = sceneStyles.match(
  /CUSTOM: begin - compact, non-overlaying vato rating[\s\S]*?CUSTOM: end/
)?.[0];
assert.ok(ratingBadgeStyles, "the compact rating badge styles are defined");
assert.match(ratingBadgeStyles, /font-size:\s*0\.68rem/);
assert.match(ratingBadgeStyles, /display:\s*inline-flex/);
assert.doesNotMatch(
  ratingBadgeStyles,
  /position:\s*absolute/,
  "the compact rating never overlays the portrait"
);
