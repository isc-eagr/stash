import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../src/components/InsightStats/InsightStats.tsx", import.meta.url),
  "utf8"
);
const hook = readFileSync(
  new URL(
    "../src/components/InsightStats/useInsightStats_custom.ts",
    import.meta.url
  ),
  "utf8"
);
const styles = readFileSync(
  new URL("../src/components/InsightStats/InsightStats.scss", import.meta.url),
  "utf8"
);
const insightThresholdControl = readFileSync(
  new URL(
    "../src/components/InsightStats/InsightThresholdControl.tsx",
    import.meta.url
  ),
  "utf8"
);
const ratingThresholdControl = readFileSync(
  new URL(
    "../src/components/InsightStats/RatingThresholdControl.tsx",
    import.meta.url
  ),
  "utf8"
);

test("rating preview identifies mutable columns and rated percentages", () => {
  assert.match(component, /label: "Numeric rating", previewChanges: true/);
  assert.match(component, /label: "GOAT marker", previewChanges: false/);
  assert.match(component, /label: "Tag override", previewChanges: false/);
  assert.match(component, /label: "Advisor Sapphire bonus"/);
  assert.match(component, /Current Percentage/);
  assert.match(component, /Projected Percentage/);
  assert.match(component, /label: "No Metallic Tier"/);
  assert.doesNotMatch(component, /→/);
});

test("chip and rating previews expose separate spinner states", () => {
  assert.match(component, /updatingRatings/);
  assert.match(component, /Updating tier preview…/);
  assert.match(component, /updatingChips/);
  assert.match(component, /Updating chip preview…/);
  assert.match(component, /<Spinner animation="border" size="sm"/);
  assert.match(hook, /updatingChips: updatingPreview\.chips/);
  assert.match(hook, /updatingRatings: updatingPreview\.ratings/);
});

test("rating preview uses readable component and table sizing", () => {
  assert.ok(styles.includes(".insight-stats-rating-tiers"));
  assert.ok(styles.includes(".insight-stats-rating-tier-table"));
  assert.ok(styles.includes("font-size: 1rem;"));
});

test("threshold controls use numeric inputs without sliders", () => {
  assert.match(insightThresholdControl, /type="number"/);
  assert.match(ratingThresholdControl, /type="number"/);
  assert.doesNotMatch(insightThresholdControl, /type="range"|slider/);
  assert.doesNotMatch(ratingThresholdControl, /type="range"|slider/);
  assert.match(component, /insight-stats-rating-thresholds/);
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles, /input\[type="range"\]|insight-stats-sliders/);
});

test("scene and vato tiers render in separate focused tables", () => {
  assert.ok(component.includes("insight-stats-rating-tier-panels"));
  assert.ok(component.includes("RatingTierTable"));
  assert.doesNotMatch(component, /rowSpan|colSpan/);
});

test("tiers descend and actual values provide exact entity drilldowns", () => {
  assert.ok(
    component.indexOf('tier: "royalSapphire"') <
      component.indexOf('tier: "gold"')
  );
  assert.ok(
    component.indexOf('tier: "gold"') < component.indexOf('tier: "silver"')
  );
  assert.ok(
    component.indexOf('tier: "silver"') < component.indexOf('tier: "bronze"')
  );
  assert.ok(
    component.indexOf('tier: "bronze"') < component.indexOf('tier: "none"')
  );
  assert.match(component, /openInsightEntityLink/);
  assert.match(component, /sourceIds\[source\]/);
  assert.match(component, /ratedIds/);
  assert.match(component, />Current Count<\/th>/);
  assert.match(component, />Projected Count<\/th>/);
  assert.match(component, />Current Percentage<\/th>/);
  assert.match(component, />Projected Percentage<\/th>/);
  assert.match(component, />Numeric Rating<\/th>/);
  assert.match(component, /insight-stats-rating-tier-projection-increase/);
  assert.match(component, /insight-stats-rating-tier-projection-decrease/);
  assert.match(styles, /insight-stats-rating-tier-projection-increase/);
  assert.match(styles, /insight-stats-rating-tier-projection-decrease/);
  assert.doesNotMatch(component, /Actual count|Projected count/);
});
