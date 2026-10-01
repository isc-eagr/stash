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
  /<PerformerCategoryStrip[\s\S]*?\n\s*versatilityCard\n/,
  "performer cards use versatility strips inside and outside scenes"
);
assert.match(
  readFileSync(
    new URL(
      "../src/components/Scenes/SceneCardPerformerPopover_custom.tsx",
      import.meta.url
    ),
    "utf8"
  ),
  /<PerformerCategoryStrip[\s\S]*?sceneId=\{scene\.id\}[\s\S]*?versatilityCard/,
  "the scene card performer-count popover uses scene-only versatility strips"
);
assert.doesNotMatch(
  detailSource,
  /versatilityCard/,
  "the performer detail header keeps the full role strip"
);
assert.doesNotMatch(
  detailSource,
  /PerformerActivityTime/,
  "the performer detail header shows only the versatility bars"
);
assert.match(
  detailSource,
  /<PerformerVersatility\s+className="performer-versatility--detail"/,
  "the header bars use the shared detail sizes"
);
assert.match(
  stripSource,
  /if \(versatilityCard && !inStrip && role\.category !== "solo"\)[\s\S]*?<PerformerCardVersatilityRow/,
  "sex, oral, and facial columns become versatility rows on cards"
);
assert.match(
  stripSource,
  /const stripRoles = safeRolesToShow;/,
  "every role icon stays in the strip with orgasm and feet below the rows"
);
assert.doesNotMatch(
  stripSource,
  /arrow-badge|faArrowUp|faArrowDown/,
  "the role strip no longer renders Top/Bottom arrow badges"
);
assert.match(
  stripSource,
  /partnerTopCount: sceneFacialTopPartners[\s\S]*?partnerBottomCount: sceneFacialBottomPartners/,
  "scene card facial strips count facial partners in the scene"
);
assert.match(
  stripSource,
  /bottomUrl=\{sceneId \? undefined : bottomUrl\}[\s\S]*?topUrl=\{sceneId \? undefined : topUrl\}/,
  "scene card counts do not link to all-scenes results"
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
