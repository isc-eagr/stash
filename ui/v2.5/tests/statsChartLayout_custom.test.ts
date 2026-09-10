import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sceneStatsSource = readFileSync(
  new URL("../src/components/SceneStats/SceneStats.tsx", import.meta.url),
  "utf8"
);
const sceneStatsStyles = readFileSync(
  new URL("../src/components/SceneStats/SceneStats.scss", import.meta.url),
  "utf8"
);
const vatoStatsSource = readFileSync(
  new URL("../src/components/VatoStats/VatoStats.tsx", import.meta.url),
  "utf8"
);
const vatoStatsStyles = readFileSync(
  new URL("../src/components/VatoStats/VatoStats.scss", import.meta.url),
  "utf8"
);

assert.match(
  sceneStatsSource,
  /scenestats-chart-grid scenestats-chart-grid--compact/,
  "Scene Stats should render a dedicated compact chart grid"
);
assert.match(
  sceneStatsSource,
  /scenestats-chart-grid scenestats-chart-grid--facial[\s\S]*?Has Facial[\s\S]*?By Number of Facial[\s\S]*?By Number of Really Hot Facial/,
  "Scene Stats should keep the related facial charts together"
);
assert.match(
  sceneStatsSource,
  /scenestats-chart-grid scenestats-chart-grid--compact[\s\S]*?By Metallic Rating[\s\S]*?Scene Type[\s\S]*?By Resolution/,
  "Scene Stats compact grid should contain the remaining stable charts"
);
assert.match(
  sceneStatsStyles,
  /\.scenestats-chart-grid--compact\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/,
  "Scene Stats compact charts should use responsive columns"
);
assert.match(
  sceneStatsStyles,
  /\.scenestats-chart-grid--compact[\s\S]*?\.scenestats-bar-cell\s*\{[\s\S]*?flex:\s*1 1 0;/,
  "Scene Stats compact bars should flex into the panel width"
);
assert.match(
  sceneStatsStyles,
  /\.scenestats-chart-grid--compact[\s\S]*?\.scenestats-bars\s*\{[\s\S]*?justify-content:\s*flex-start;[\s\S]*?\.scenestats-chart-grid--facial[\s\S]*?\.scenestats-bars\s*\{[\s\S]*?justify-content:\s*flex-start;/,
  "Scene Stats overflowing chart bars should keep the scroll origin reachable"
);
assert.match(
  sceneStatsStyles,
  /\.scenestats-chart-grid--facial\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/,
  "Scene Stats facial charts should share one desktop row"
);

assert.match(
  vatoStatsSource,
  /compactChartCategories[\s\S]*?"metallic_rating"[\s\S]*?"circumcised"/,
  "Vato Stats should identify stable low-cardinality chart categories"
);
assert.match(
  vatoStatsSource,
  /vatostats-chart-grid vatostats-chart-grid--compact/,
  "Vato Stats should render a dedicated compact chart grid"
);
assert.match(
  vatoStatsStyles,
  /\.vatostats-chart-grid--compact\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/,
  "Vato Stats compact charts should use responsive columns"
);
assert.match(
  vatoStatsStyles,
  /\.vatostats-chart-grid--compact[\s\S]*?\.vatostats-bar-cell\s*\{[\s\S]*?flex:\s*1 1 0;/,
  "Vato Stats compact bars should flex into the panel width"
);
assert.match(
  vatoStatsStyles,
  /\.vatostats-chart-grid--compact[\s\S]*?\.vatostats-bars\s*\{[\s\S]*?justify-content:\s*flex-start;/,
  "Vato Stats overflowing chart bars should keep the scroll origin reachable"
);
