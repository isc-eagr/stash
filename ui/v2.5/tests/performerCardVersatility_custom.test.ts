import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cardSource = readFileSync(
  new URL("../src/components/Performers/PerformerCard.tsx", import.meta.url),
  "utf8"
);
const stripSource = readFileSync(
  new URL(
    "../src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx",
    import.meta.url
  ),
  "utf8"
);
const detailSource = readFileSync(
  new URL(
    "../src/components/Performers/PerformerDetails/Performer.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.match(
  cardSource,
  /versatilityCard=\{!sceneId\}/,
  "performer cards use versatility strips only outside scene context"
);
assert.doesNotMatch(
  detailSource,
  /versatilityCard/,
  "the performer detail header keeps the full role strip"
);
assert.match(
  stripSource,
  /if \(versatilityCard && role\.category !== "solo"\)[\s\S]*?<PerformerCardVersatilityRow/,
  "sex, oral, and facial columns become versatility rows on cards"
);
assert.match(
  stripSource,
  /const stripRoles = versatilityCard\s*\? safeRolesToShow\.filter\(\(role\) => role\.category === "solo"\)/,
  "jerk stays in the icon strip with orgasm and feet below the rows"
);

assert.match(
  detailSource,
  /<PerformerVersatility[\s\S]*?facialBottomedPartners=\{\s*roleStats\.facial_with_bottom_count\s*\}[\s\S]*?facialToppedPartners=\{\s*roleStats\.facial_with_top_count\s*\}/,
  "the header shows the facial versatility bar from unique facial partners"
);
assert.match(
  stripSource,
  /const cardFacialPartners = \{[\s\S]*?facial_with_top_count/,
  "card facial strips count unique partners like sex and oral"
);

const ratingCardStyles = readFileSync(
  new URL(
    "../src/components/Shared/ratingCardStyles_custom.scss",
    import.meta.url
  ),
  "utf8"
);
assert.equal(
  ratingCardStyles.match(
    /\.performer-card-versatility-count\.is-bottom \{\s*color: #28a745 !important;/g
  )?.length,
  3,
  "every metallic card theme keeps the green bottom counts"
);

const overviewSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const overviewStyles = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.scss",
    import.meta.url
  ),
  "utf8"
);
assert.match(
  overviewSource,
  /<PerformerActivityTime[\s\S]*?<PerformerVersatility[\s\S]*?facialToppedPartners=\{roleStats\.facial_with_top_count\}/,
  "the scene Vato Overview drawer shows the full versatility bars below Activity Time"
);
assert.match(
  overviewSource,
  /if \(!performerId\) return;\s*document\.body\.classList\.add\(SCENE_PERFORMER_OVERVIEW_OPEN_CLASS\);[\s\S]*?classList\.remove\(SCENE_PERFORMER_OVERVIEW_OPEN_CLASS\)/,
  "the drawer flags the page while it is on screen, including the close slide"
);
assert.match(
  overviewStyles,
  /body\.scene-performer-overview-drawer-shown \.scene-player-record-o-overlay \{[\s\S]*?visibility: hidden;/,
  "the player's record-O button hides while the drawer is shown"
);

console.log("Performer card versatility tests passed.");
