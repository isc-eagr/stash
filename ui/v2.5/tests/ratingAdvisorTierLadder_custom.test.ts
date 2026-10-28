import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.js";
import { RatingAdvisorTierLadderCustom } from "../src/components/Shared/RatingAdvisorTierLadder_custom.tsx";
import { getRatingAdvisorTierCustom } from "../src/components/Shared/ratingAdvisorScales_custom.ts";

const thresholds = { bronze: 65, silver: 75, gold: 85, royalSapphire: 95 };
const renderLadder = (
  rating100: number,
  previewRating100?: number,
  royalSapphireOverride = false
) =>
  renderToStaticMarkup(
    React.createElement(RatingAdvisorTierLadderCustom, {
      rating100,
      thresholds,
      previewRating100,
      previewTier:
        previewRating100 === undefined
          ? undefined
          : getRatingAdvisorTierCustom(
              previewRating100,
              thresholds,
              royalSapphireOverride
            ).tier,
    })
  );

const previewZones = (html: string) =>
  html.match(/<span\b[^>]*data-preview="true"[^>]*>/g) ?? [];

const bronzePreview = renderLadder(61, 69);
assert.equal(previewZones(bronzePreview).length, 1);
assert.match(previewZones(bronzePreview)[0], /color:var\(--semantic-bronze\)/);
assert.match(previewZones(bronzePreview)[0], /data-reached="false"/);
assert.match(bronzePreview, /<i style="left:69%"/);

// Highlight exactly the projected tier, across boundaries and in either direction.
for (const [score, color] of [
  [64, "no-tier"],
  [65, "bronze"],
  [75, "silver"],
  [85, "gold"],
  [95, "royal-sapphire"],
] as const) {
  for (const current of [20, 99]) {
    const zones = previewZones(renderLadder(current, score));
    assert.equal(zones.length, 1);
    assert.ok(zones[0].includes(`color:var(--semantic-${color})`));
  }
}

const bonusPreview = renderLadder(61, 69, true);
assert.equal(previewZones(bonusPreview).length, 1);
assert.match(
  previewZones(bonusPreview)[0],
  /color:var\(--semantic-royal-sapphire\)/,
  "bonus overrides highlight the actual tier even below its numeric threshold"
);
assert.match(bonusPreview, /<i style="left:69%"/);

const clearedPreview = renderLadder(61);
assert.deepEqual(previewZones(clearedPreview), []);
assert.match(clearedPreview, /<i style="left:61%"/);
assert.match(renderLadder(61, -5), /<i style="left:0%"/);
assert.match(renderLadder(61, 105), /<i style="left:100%"/);
