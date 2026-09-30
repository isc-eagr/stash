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

assert.match(
  sceneStatsSource,
  /stats-chart-grid stats-chart-grid--thirds[\s\S]*?title="Has Facial"[\s\S]*?title="By Facial Count"[\s\S]*?title="By Really Hot Facial Count"/,
  "Scene Stats should keep the related facial charts together"
);
assert.match(
  sceneStatsSource,
  /stats-chart-grid stats-chart-grid--compact[\s\S]*?title="By Metallic Rating"[\s\S]*?title="Scene Type"[\s\S]*?title="By Resolution"/,
  "Scene Stats compact grid should contain the remaining stable charts"
);
assert.match(
  vatoStatsSource,
  /compactChartCategories[\s\S]*?"metallic_rating"[\s\S]*?"circumcised"/,
  "Vato Stats should identify stable low-cardinality chart categories"
);
assert.match(
  vatoStatsSource,
  /stats-chart-grid stats-chart-grid--compact/,
  "Vato Stats should render a dedicated compact chart grid"
);

assert.match(
  chartStyles,
  /\.stats-chart-grid--compact\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/,
  "compact charts should use responsive columns"
);
assert.match(
  chartStyles,
  /\.stats-chart-grid--thirds\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/,
  "facial charts should share one desktop row"
);
assert.match(
  chartStyles,
  /\.stats-chart-grid--compact,\s*\.stats-chart-grid--thirds\s*\{[\s\S]*?\.stats-bar-chart-bars\s*\{[\s\S]*?justify-content:\s*flex-start;[\s\S]*?\.stats-bar-chart-cell\s*\{[\s\S]*?flex:\s*1 1 0;/,
  "compact bars should flex into the panel and keep the scroll origin reachable"
);
assert.match(
  chartStyles,
  /\.scenestats-page \.stats-bar-chart\s*\{[\s\S]*?--stats-chart-fill:/,
  "Scene Stats keeps its gold chart theme through custom properties"
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
  /<StatsTopCards\s+title=\{podiumDescriptor\}[\s\S]*?<Form\.Label>Rank by<\/Form\.Label>/,
  "Vato Stats keeps the Best pitos title and ranks by a selectable metric"
);
assert.match(
  sceneStatsSource,
  /title="Top Scenes"[\s\S]*?<Form\.Label>Rank by<\/Form\.Label>/,
  "Scene Stats ranks by a selectable metric"
);

console.log("Stats chart layout tests passed.");
