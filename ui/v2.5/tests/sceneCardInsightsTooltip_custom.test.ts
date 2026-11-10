import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const insightsSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneCardInsights_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const orgasmReportSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneCardOrgasmReport_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const hoverPopoverSource = readFileSync(
  new URL("../src/components/Shared/HoverPopover.tsx", import.meta.url),
  "utf8"
);
const sceneStyles = readFileSync(
  new URL("../src/components/Scenes/styles.scss", import.meta.url),
  "utf8"
);

assert.match(
  insightsSource,
  /React\.forwardRef/,
  "scene insight chips should forward refs for their hover trigger"
);
assert.match(
  insightsSource,
  /\{\.\.\.triggerProps\}/,
  "scene insight chips should preserve hover-trigger event props"
);
assert.match(
  insightsSource,
  /ref=\{ref\}/,
  "scene insight chips should attach the hover-trigger ref"
);
assert.match(
  insightsSource,
  /getSceneCardChipInsightSets\(/,
  "scene cards and scene details share the same chip families"
);
assert.doesNotMatch(
  insightsSource,
  /getSceneCardInsightSets|opensActivityMatrix|OutstandingActivityMatrixModal/,
  "chips no longer open the activity matrix; it lives in the Stats tab"
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
  /<HoverPopover[\s\S]*?<SceneCardInsightPerformersPopover/,
  "every chip names vatos, so hovering shows their portraits"
);
assert.match(
  orgasmReportSource,
  /<SceneCardOrgasmFacialPopover events=\{events\} \/>/,
  "the orgasm report should render every orgasm and facial event"
);
assert.match(
  orgasmReportSource,
  /<HoverPopover[\s\S]*?estimatedContentHeight=\{520\}[\s\S]*?placement="bottom"[\s\S]*?popoverClassName=\{`scene-marker-highlight-popover scene-card-performer-popover scene-card-insight-event-popover/,
  "event details should use the persistent, viewport-aware hover popover"
);
assert.match(
  orgasmReportSource,
  /events\.length === 1[\s\S]*?"single"[\s\S]*?events\.length === 2[\s\S]*?"double"[\s\S]*?"multiple"/,
  "event popovers should select a width tier from their event count"
);
assert.match(
  orgasmReportSource,
  /data-hover-popover-measure="true"/,
  "event details should measure their full content before choosing a vertical placement"
);
assert.match(
  hoverPopoverSource,
  /onMouseEnter=\{handleMouseEnter\}[\s\S]*?onMouseLeave=\{handleMouseLeave\}/,
  "the event popover should stay open while the pointer is over its content"
);
assert.match(
  insightsSource,
  /role=\{isFacial \? "Top" : undefined\}[\s\S]*?role="Bottom"/,
  "facials should retain their top and bottom styling while orgasms stay unoutlined"
);
assert.match(
  insightsSource,
  /scene-card-event-quality-pill--\$\{/,
  "event details should display GOAT and Really Hot pills"
);
assert.match(
  sceneStyles,
  /\.scene-card-insight-event-popover\s*\{[^}]*width: min\(49rem, calc\(100vw - 1rem\)\)/,
  "large event details should claim the available horizontal popup space"
);
assert.match(
  sceneStyles,
  /\.scene-card-insight-event-popover-single\s*\{[^}]*width: min\(17rem, calc\(100vw - 1rem\)\)/,
  "a single event should use a compact popup"
);
assert.match(
  sceneStyles,
  /\.scene-card-insight-event-popover-double\s*\{[^}]*width: min\(32rem, calc\(100vw - 1rem\)\)/,
  "two events should use a medium popup"
);
assert.match(
  sceneStyles,
  /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 15rem\), 1fr\)\)/,
  "event cards should flow into multiple columns"
);
assert.doesNotMatch(
  insightsSource,
  /scene-card-insights-popup-detail/,
  "the all-insights popup should contain flowing chips without inline helper text"
);
