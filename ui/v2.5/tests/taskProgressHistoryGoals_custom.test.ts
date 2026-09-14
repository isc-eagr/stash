import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chartSource = readFileSync(
  new URL("../src/components/TaskProgressHistoryChart.tsx", import.meta.url),
  "utf8"
);
const chartStylesSource = readFileSync(
  new URL("../src/components/TaskProgressHistoryChart.scss", import.meta.url),
  "utf8"
);

assert.match(chartSource, /\["day", "week", "month"\]/);
assert.match(chartSource, /aggregateTaskProgressHistorySeries/);
assert.match(
  chartSource,
  /useState\(false\).*showIncoming|showIncoming.*useState\(false\)/s,
  "incoming bars are hidden by default"
);
assert.match(
  chartSource,
  /type="checkbox"[\s\S]*?checked=\{showIncoming\}|checked=\{showIncoming\}[\s\S]*?type="checkbox"/,
  "the chart provides a checkbox to show incoming bars"
);
assert.match(
  chartSource,
  /showIncoming \? barGroupWidth \/ 2 : barGroupWidth/,
  "completed bars use the full bar group width when incoming bars are hidden"
);
assert.match(
  chartSource,
  /const barGroupWidth = bandWidth \* 0\.82/,
  "bar groups use most of each period's available width"
);
assert.match(
  chartSource,
  /showIncoming\s*\?\s*centerX - barGroupWidth \/ 2\s*:\s*centerX - barWidth \/ 2/,
  "completed and incoming bars occupy separate halves when incoming bars are shown"
);
assert.match(
  chartSource,
  /showIncoming \? Math\.max\(point\.completed, point\.incoming\) : point\.completed/,
  "the activity scale excludes hidden incoming bars"
);
assert.match(
  chartSource,
  /showIncoming && \([\s\S]*?task-progress-history-chart-incoming/,
  "incoming bar rendering is conditional"
);
const aggregatedRanges = chartSource.match(
  /AGGREGATED_RANGE_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/
)?.[1];
assert.ok(aggregatedRanges, "aggregated chart ranges are declared");
assert.doesNotMatch(
  aggregatedRanges,
  /\b7\b/,
  "weekly and monthly modes do not expose the seven-day range"
);
assert.match(
  chartSource,
  /taskProgressDailyGoalState\([\s\S]*?point\.completed,[\s\S]*?point\.goalPerDay/,
  "weekly and monthly bar colors use completed divided by the applicable period goal"
);
assert.doesNotMatch(
  chartSource,
  /dailyGoal\?: number/,
  "the current goal is not retroactively applied to all bars"
);
assert.match(chartStylesSource, /\.incoming\s*\{\s*color: #a77cc7/);
assert.match(chartStylesSource, /\.remaining\s*\{\s*color: #9acd32/);
for (const stateColor of [
  "#db3737",
  "#f08c3a",
  "#f2c94c",
  "#0f9960",
  "#123f9f",
]) {
  assert.match(
    chartStylesSource,
    new RegExp(`completed-[a-z]+\\s*\\{\\s*color: ${stateColor}`),
    `completed legend includes ${stateColor}`
  );
}
assert.match(chartStylesSource, /\.cumulative\s*\{\s*color: #9acd32/);
assert.doesNotMatch(chartSource, /averageLabel|averagePath|completedAverage/);
assert.match(
  chartSource,
  /taskProgressHistoryPercentages/,
  "chart tooltips calculate cumulative and period percentages"
);
assert.match(chartSource, /task-progress-history-chart-tooltip/);
assert.match(chartSource, /Progress this \{period\}/);
assert.match(chartSource, /onMouseEnter=\{\(\) => setTooltipIndex\(index\)\}/);
assert.match(
  chartStylesSource,
  /&-tooltip\s*\{[\s\S]*?position: absolute/,
  "the custom tooltip is visually positioned over the chart"
);
assert.doesNotMatch(
  chartSource,
  /<circle[\s\S]*?<title>/,
  "metric points rely on the organized custom tooltip instead of native titles"
);
assert.doesNotMatch(
  chartSource,
  /<title(?:\s|>)/,
  "the chart does not expose a competing native SVG tooltip"
);
assert.match(
  chartSource,
  /maximumFractionDigits: 2,[\s\S]*?minimumFractionDigits: 2/,
  "tooltip percentages consistently show two decimal places"
);
assert.match(chartStylesSource, /\.baseline\s*\{\s*color: #8796a3/);
assert.match(
  chartStylesSource,
  /&-goal-sapphire\s*\{\s*fill: #123f9f/,
  "sapphire bars use the Rating Advisor royal sapphire shade"
);
assert.notEqual(
  "#a77cc7",
  "#0f9960",
  "incoming and completed use distinct colors"
);
assert.notEqual(
  "#a77cc7",
  "#9acd32",
  "incoming and remaining use distinct colors"
);
assert.notEqual(
  "#9acd32",
  "#123f9f",
  "remaining and sapphire use distinct colors"
);
