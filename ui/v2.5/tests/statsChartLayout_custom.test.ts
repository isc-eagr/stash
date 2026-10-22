import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sceneStatsSource = readFileSync(
  new URL("../src/components/SceneStats/SceneStats.tsx", import.meta.url),
  "utf8"
);
const vatoStatsSource = readFileSync(
  new URL("../src/components/VatoStats/VatoStats.tsx", import.meta.url),
  "utf8"
);
const oStatsSource = readFileSync(
  new URL("../src/components/OStats/OStats.tsx", import.meta.url),
  "utf8"
);
const groupStyles = readFileSync(
  new URL("../src/components/statsCharts_custom.scss", import.meta.url),
  "utf8"
);
const chartStyles = readFileSync(
  new URL("../src/components/statsBarChart_custom.scss", import.meta.url),
  "utf8"
);

for (const [name, source] of [
  ["Scene Stats", sceneStatsSource],
  ["Vato Stats", vatoStatsSource],
  ["O Stats", oStatsSource],
] as const) {
  assert.match(
    source,
    /<StatsBarChart\b/,
    `${name} should render the shared stats bar chart`
  );
  assert.doesNotMatch(
    source,
    /const (Scene|Vato|O)StatsChart: React\.FC<\{\s*actions\?/,
    `${name} should not keep its own bar chart implementation`
  );
  assert.match(
    source,
    /<StatsDateRangeFilter\b/,
    `${name} should offer the shared date range filter`
  );
}

// Charts sit in topic groups instead of chart-type panels.
for (const [name, source] of [
  ["Scene Stats", sceneStatsSource],
  ["Vato Stats", vatoStatsSource],
  ["O Stats", oStatsSource],
] as const) {
  assert.doesNotMatch(
    source,
    /<StatsComposition\b|<StatsInlineComposition\b/,
    `${name} should chart its splits as bars, not composition rows`
  );
  assert.doesNotMatch(
    source,
    /"Distribution"|"Breakdown"/,
    `${name} should group charts by topic, not by chart type`
  );
  assert.doesNotMatch(
    source,
    /stats-chart-grid|<StatsSplitBar\b/,
    `${name} should not use the old grids or standalone split cards`
  );
}
assert.match(
  sceneStatsSource,
  /title="The Scene"[\s\S]*?"By Release Year"[\s\S]*?title="Duration"[\s\S]*?title="Rating"[\s\S]*?title="Metallic Rating"[\s\S]*?title="Resolution"[\s\S]*?title="Scene Type"[\s\S]*?title="The Vatos"[\s\S]*?title="Vato Count"[\s\S]*?title="Vato Ethnicity"[\s\S]*?title="Vato Country"[\s\S]*?title="O's, Nuts & Facials"/,
  "Scene Stats groups scene, vato, and O charts"
);
assert.doesNotMatch(
  sceneStatsSource,
  /coverage=|title: "Coverage"/,
  "Coverage was redundant with Scene type"
);
assert.match(
  sceneStatsSource,
  /title="Rating"[\s\S]*?\/>\s*<StatsBarChart\s+className="stats-small"\s+title="Metallic Rating"/,
  "Metallic Rating sits right after the Rating columns"
);
assert.match(
  sceneStatsSource,
  /title="O's, Nuts & Facials"[\s\S]*?title="O Count"[\s\S]*?title="Nuts Per Scene"[\s\S]*?title="Facials Per Scene"[\s\S]*?unknown=\{unorganizedUnknown\}/,
  "Scene Stats shows O Count, then nuts and facials per scene with an Unknown pill for unorganized scenes"
);
assert.match(
  vatoStatsSource,
  /title: "The Vatos"[\s\S]*?title: "Roles & Scenes"[\s\S]*?title: "O's & Facials"[\s\S]*?title="Ratings"/,
  "Vato Stats groups looks, roles, O's, and ratings"
);
assert.match(
  oStatsSource,
  /title="The Scene"[\s\S]*?title="The Vatos"[\s\S]*?title="The Action"/,
  "O Stats groups scene, vato, and action charts"
);
assert.match(
  groupStyles,
  /\.stats-group-grid\s*\{[\s\S]*?repeat\(6, minmax\(0, 1fr\)\)[\s\S]*?grid-column: span 3;[\s\S]*?> \.stats-small\s*\{\s*grid-column: span 2;[\s\S]*?> \.stats-wide\s*\{\s*grid-column: 1 \/ -1;/,
  "a row holds three small, two medium, or one wide chart"
);
assert.doesNotMatch(
  sceneStatsSource,
  /title="Has Facial"|title="By Really Hot Facial Count"/,
  "the separate facial charts should be merged"
);
assert.match(
  vatoStatsSource,
  /<StatsDivergingChart\b[\s\S]*?leftLabel="Bottoms"[\s\S]*?rightLabel="Tops"[\s\S]*?leftColor=\{STATS_BOTTOM_COLOR\}[\s\S]*?rightColor=\{STATS_TOP_COLOR\}/,
  "Vato Stats roles put bottoms (green) left and tops (blue) right"
);

assert.match(
  chartStyles,
  /\.stats-page\s*\{[\s\S]*?--stats-accent:\s*var\(--app-accent/,
  "stats charts follow the Black Steel copper accent"
);
assert.match(
  chartStyles,
  /\.stats-bar-chart-fill\s*\{[\s\S]*?&\.peak\s*\{/,
  "the tallest column stands out"
);

// Ranked image cards replace the three-slot podiums everywhere.
for (const [name, source] of [
  ["Scene Stats", sceneStatsSource],
  ["Vato Stats", vatoStatsSource],
  ["O Stats", oStatsSource],
] as const) {
  assert.match(
    source,
    /<StatsTopCards\b/,
    `${name} should rank with image cards`
  );
  assert.doesNotMatch(
    source,
    /Podium metric/,
    `${name} should not keep the podium label`
  );
}
assert.match(
  vatoStatsSource,
  /<StatsTopCards\s+title=\{podiumDescriptor\}[\s\S]*?rankBy=\{\{/,
  "Vato Stats keeps the Best pitos title and ranks by chips"
);
assert.match(
  sceneStatsSource,
  /title="Top Scenes"[\s\S]*?rankBy=\{\{[\s\S]*?view=\{showList \? "table" : "cards"\}/,
  "Scene Stats ranks by chips and keeps the table view in the URL"
);

console.log("Stats chart layout tests passed.");

// Quality charts use the canonical palette.
const colorSource = readFileSync(
  new URL("../src/utils/statsChartColors_custom.ts", import.meta.url),
  "utf8"
);
assert.match(
  colorSource,
  /STATS_QUALITY_COLORS[\s\S]*?really_hot: colors.reallyHot[\s\S]*?goat: colors.goat/,
  "Really Hot is gold and GOAT is sapphire"
);

// Facial Stats: the giver → receiver matrix sits right under the cards.
const markerEventSource = readFileSync(
  new URL(
    "../src/components/MarkerEventStats/MarkerEventStats.tsx",
    import.meta.url
  ),
  "utf8"
);
assert.match(
  markerEventSource,
  /<MarkerEventCards[\s\S]*?\/>\s*\{\/\* CUSTOM: the giver → receiver matrix sits right under the cards\. \*\/\}\s*\{charts\s*\.filter\(\(chart\) => chart\.display === "grid"\)/,
  "the matrix follows the marker cards"
);
