import assert from "node:assert/strict";

import {
  getRatingCardClass,
  hasRoyalSapphireSceneBonus,
  isRoyalSapphireSceneBonus,
} from "../src/utils/ratingCardStyles_custom.ts";

for (const rawValue of [0.5, 1, 1.5, 2]) {
  assert.equal(
    isRoyalSapphireSceneBonus("goatElement", rawValue),
    true,
    `GOAT element ${rawValue * 10 > 0 ? "+" : ""}${rawValue * 10} qualifies`
  );
}

assert.equal(isRoyalSapphireSceneBonus("godTierOrgasm", 1), true);
assert.equal(isRoyalSapphireSceneBonus("godTierOrgasm", 0), false);
assert.equal(isRoyalSapphireSceneBonus("goatElement", 0), false);
assert.equal(isRoyalSapphireSceneBonus("otherBonus", 2), false);

assert.equal(
  hasRoyalSapphireSceneBonus([
    { section: "criterion", key: "goatElement", raw_value: 2 },
    { section: "bonus", key: "godTierOrgasm", raw_value: 1 },
  ]),
  true,
  "a qualifying persisted scene bonus is detected"
);

assert.equal(
  getRatingCardClass({
    rating: 20,
    tags: [{ id: "bronze" }],
    overrideTagIds: { bronzeTagId: "bronze" },
    ratingScores: [{ section: "bonus", key: "goatElement", raw_value: 0.5 }],
    theme: "premium",
  }),
  "rating-card-theme-premium rating-royal-sapphire",
  "scene bonuses take precedence over ratings and lower-tier override tags"
);

assert.equal(
  getRatingCardClass({
    rating: 20,
    ratingScores: [{ section: "bonus", key: "godTierOrgasm", raw_value: 1 }],
    thresholdEntity: "performer",
    theme: "premium",
  }),
  "",
  "scene-only bonuses never promote performer cards"
);
