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
  /<Tooltip id=\{`scene-insight-/,
  "individual chips should retain their hover tooltips"
);
assert.match(
  insightsSource,
  /insight\.key === "outstanding-activity" \|\| insight\.key === "feet"/,
  "both the activity and Feet chips should open the activity matrix"
);
assert.doesNotMatch(
  insightsSource,
  /scene-card-insights-popup-detail/,
  "the all-insights popup should contain flowing chips without inline helper text"
);
