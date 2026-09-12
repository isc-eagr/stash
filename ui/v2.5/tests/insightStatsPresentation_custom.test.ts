import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const statsLinks = readFileSync(
  new URL("../src/components/StatsLinks_custom.tsx", import.meta.url),
  "utf8"
);
const playground = readFileSync(
  new URL("../src/components/Playground/Playground.tsx", import.meta.url),
  "utf8"
);
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
const sceneFilters = readFileSync(
  new URL(
    "../src/components/Playground/PlaygroundSceneFilters.tsx",
    import.meta.url
  ),
  "utf8"
);
const sceneTiers = readFileSync(
  new URL(
    "../src/components/Playground/PlaygroundSceneTiers.tsx",
    import.meta.url
  ),
  "utf8"
);
const statsPageStyles = readFileSync(
  new URL("../src/components/statsPage_custom.scss", import.meta.url),
  "utf8"
);

test("Insight Stats is the fourth Playground tab, not a standalone route or stats link", () => {
  assert.match(playground, /<Tab eventKey="scenes" title="Scene Explorer">/);
  assert.match(playground, /<Tab eventKey="scene-tiers" title="Scene Tiers">/);
  assert.match(playground, /<Tab eventKey="vatos" title="Vato Tiers">/);
  assert.match(playground, /<Tab eventKey="insights" title="Insight Stats">/);
  assert.match(playground, /import \{ InsightStats \}/);
  assert.doesNotMatch(app, /insightstats|InsightStats/);
  assert.doesNotMatch(statsLinks, /Insight Stats|\/insightstats/);
});

test("chip preview exposes a single pending state", () => {
  assert.match(component, /updatingChips/);
  assert.match(component, /Updating chip preview…/);
  assert.match(component, /<Spinner animation="border" size="sm"/);
  assert.match(hook, /updatingChips: updatingPreview/);
  assert.doesNotMatch(component, /updatingRatings|tier preview/);
  assert.doesNotMatch(hook, /updatingRatings|updatingPreview\.ratings/);
});

test("chip coverage keeps its temporary numeric thresholds without a rating-tier control", () => {
  assert.match(insightThresholdControl, /type="number"/);
  assert.doesNotMatch(insightThresholdControl, /type="range"|slider/);
  assert.match(component, /insight-stats-threshold-grid/);
  assert.match(component, /aria-label="Chip coverage"/);
  assert.match(component, /Current vs\. preview combinations/);
  assert.doesNotMatch(component, /RatingTierTable|rating-tier|Numeric Rating/);
  assert.doesNotMatch(styles, /insight-stats-rating|rating-tier/);
});

test("tier filters keep rating mode together and use directional projection colors", () => {
  assert.match(sceneTiers, /<PlaygroundSceneFilters[\s\S]*showMode/);
  assert.match(sceneFilters, /<Form\.Label>Rating Mode<\/Form\.Label>/);
  assert.doesNotMatch(sceneFilters, /Any selected value/);
  assert.match(component, /insight-stats-changed increase/);
  assert.match(component, /insight-stats-changed decrease/);
  assert.match(styles, /&\.increase/);
  assert.match(styles, /&\.decrease/);
  assert.match(statsPageStyles, /grid-template-columns: repeat\(4/);
});
