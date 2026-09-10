import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const insightsSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneCardInsights_custom.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.match(
  insightsSource,
  /React\.forwardRef/,
  "scene insight chips should forward refs for OverlayTrigger"
);
assert.match(
  insightsSource,
  /\{\.\.\.triggerProps\}/,
  "scene insight chips should preserve OverlayTrigger event props"
);
assert.match(
  insightsSource,
  /ref=\{ref\}/,
  "scene insight chips should attach the hover-trigger ref"
);
assert.match(
  insightsSource,
  /getSceneCardInsightSets/,
  "the insight strip should retain both visible and complete insight sets"
);
assert.match(
  insightsSource,
  /setAllInsightsTarget\(event\.currentTarget\)/,
  "the complete insight report should anchor to its explicit plus control"
);
assert.match(
  insightsSource,
  /getSceneCardInsightsPopoverPlacement\(\s*event\.currentTarget\.getBoundingClientRect\(\)\.bottom,\s*window\.innerHeight/,
  "the complete insight report should open above its trigger when space below is limited"
);
assert.match(
  insightsSource,
  /placement=\{allInsightsPlacement\}/,
  "the complete insight report should use the calculated vertical placement"
);
assert.match(
  insightsSource,
  /\{hasOverflow && \(\s*<button/,
  "the plus control should render only when the complete set exceeds the visible limit"
);
assert.match(
  insightsSource,
  /className="scene-card-insights-more"/,
  "the plus should be the dedicated full-insights trigger"
);
const stripStart = insightsSource.indexOf("className={`scene-card-insights");
const visibleChips = insightsSource.indexOf(
  "{insightSets.visible.map(renderInsightChip)}",
  stripStart
);
assert.ok(stripStart >= 0 && visibleChips > stripStart);
assert.doesNotMatch(
  insightsSource.slice(stripStart, visibleChips),
  /onClick=/,
  "the insight strip itself should not be clickable"
);
assert.match(
  insightsSource,
  /<Tooltip[\s\S]*?id=\{`scene-insight-/,
  "individual chips should retain their hover tooltips"
);
assert.match(
  insightsSource,
  /insight\.key === "orgasm-report" && insight\.performers !== undefined/,
  "orgasm report tooltips should use their finisher performer data"
);
assert.match(
  insightsSource,
  /<PerformerPopoverContent performers=\{insight\.performers \?\? \[\]\}/,
  "orgasm report tooltips should reuse the performer portrait grid"
);
assert.match(
  insightsSource,
  /insight\.key === "outstanding-activity" \|\|\s+insight\.key === "outstanding-activity-presence" \|\|\s+insight\.key === "feet" \|\|\s+insight\.key\.startsWith\("goat-"\)/,
  "Outstanding Activity, Feet, and GOAT chips should open the activity matrix"
);
assert.doesNotMatch(
  insightsSource,
  /scene-card-insights-popup-detail/,
  "the all-insights popup should contain flowing chips without inline helper text"
);
