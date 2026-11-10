import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STATS_CATEGORY_COLORS } from "../src/utils/statsChartColors_custom.ts";

// The copper accent marks actions (hover, active, selected, focus). Data with
// no meaning of its own is steel; data with a meaning uses its semantic color.
const read = (path: string) =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const rule = (source: string, selector: string) => {
  const start = source.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} exists`);
  return source.slice(start, source.indexOf("}", start));
};
const COPPER = /#(?:aa6337|ca8757|704025|9b5a32|f0c08f|5a3320|8a4f2c)\b/i;

test("both themes define the data tokens beside the accent", () => {
  for (const path of [
    "styles/themeTokens_custom.scss",
    "styles/applicationTheme_custom.scss",
  ]) {
    const source = read(path);
    assert.match(source, /--app-accent:/);
    assert.match(source, /--app-data:\s*#[0-9a-f]{6};/i);
    assert.match(source, /--app-data-strong:\s*#[0-9a-f]{6};/i);
    // Blued steel, not a lifeless gray: blue leads red and green.
    const data = source.match(
      /--app-data:\s*#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2});/i
    )!;
    const [r, g, b] = data.slice(1).map((v) => parseInt(v, 16));
    assert.ok(b > g && g > r, `${path} data color is blued steel`);
  }
  assert.match(
    read("components/statsBarChart_custom.scss"),
    /--stats-data:\s*var\(--app-data\);\s*--stats-peak:\s*var\(--app-data-strong\);/
  );
});

test("plain stats marks are steel, not the accent", () => {
  const bars = read("components/statsBarChart_custom.scss");
  const charts = read("components/statsCharts_custom.scss");
  assert.match(rule(bars, ".stats-bar-chart-fill"), /var\(--stats-data\)/);
  assert.match(rule(charts, ".stats-criteria-fill"), /var\(--stats-data\)/);
  assert.match(rule(charts, ".stats-pair-grid-cell"), /var\(--stats-data\)/);
  for (const selector of [
    ".stats-bar-chart-fill",
    ".stats-criteria-fill",
    ".stats-pair-grid-cell",
    ".stats-diverging-side--left .stats-diverging-fill",
  ]) {
    assert.doesNotMatch(
      rule(selector.startsWith(".stats-bar") ? bars : charts, selector),
      /stats-accent/,
      `${selector} leaves the accent to actions`
    );
  }

  const oStats = read("components/OStats/OStats.scss");
  for (const level of [1, 2, 3, 4]) {
    assert.doesNotMatch(
      rule(oStats, `.ostats-calendar-level-${level}`),
      COPPER,
      "the O Calendar is a steel ramp"
    );
  }
  assert.ok(
    STATS_CATEGORY_COLORS.every(
      (color) => !COPPER.test(color) && !color.includes("accent")
    ),
    "decorative categories carry no copper"
  );
  assert.equal(
    new Set(STATS_CATEGORY_COLORS).size,
    STATS_CATEGORY_COLORS.length
  );
});

test("the accent still marks stats actions", () => {
  const bars = read("components/statsBarChart_custom.scss");
  const charts = read("components/statsCharts_custom.scss");
  assert.match(
    bars,
    /&:hover,\s*&:focus-visible \{\s*border-color: var\(--stats-accent\)/
  );
  assert.match(
    charts,
    /^\.stats-kpi-action \{\s*color: var\(--stats-accent\)/m
  );
});

test("progress, averages and insights borrow no accent or semantic hue", () => {
  const score = read(
    "components/TaskProgress/taskProgressScoreboard_custom.scss"
  );
  // Medal bars are inherently metal: the medal being worked toward.
  assert.match(rule(score, ".progress-medal-fill"), /var\(--checkpoint-metal/);
  assert.doesNotMatch(rule(score, ".progress-medal-fill"), /score-accent/);
  assert.match(
    read("components/TaskProgress/TaskProgressMedalBar.tsx"),
    /progress-medal-bar milestone-checkpoint-\$\{metal\}/
  );
  assert.doesNotMatch(
    rule(score, ".progress-score-streak"),
    /accent|170, 99, 55/
  );

  const advisor = read("components/Shared/ratingAdvisor_custom.scss");
  for (const panel of ["vato", "scenes"]) {
    assert.doesNotMatch(
      rule(advisor, `.rating-panel.rating-panel--${panel}`),
      /#ffd34d|90, 169, 255/i,
      `${panel} averages are framed in neutral`
    );
  }
  assert.match(
    read("components/Scenes/styles.scss"),
    /--scene-insight-rgb: 193, 198, 201;/,
    "insight notes are not Oral teal"
  );
});
