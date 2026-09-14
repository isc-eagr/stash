import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vatoStatsSource = readFileSync(
  new URL("../src/components/VatoStats/VatoStats.tsx", import.meta.url),
  "utf8"
);
const sceneStatsSource = readFileSync(
  new URL("../src/components/SceneStats/SceneStats.tsx", import.meta.url),
  "utf8"
);

const vatoMetricGraphs = [
  ["scene_o_count", "O Count"],
  ["scene_count", "Total Scenes"],
  ["sex_top_count", "Sex Top Scenes"],
  ["sex_bottom_count", "Sex Bottom Scenes"],
  ["oral_top_count", "Oral Top Scenes"],
  ["oral_bottom_count", "Oral Bottom Scenes"],
  ["facial_given_count", "Facials Given"],
  ["facial_received_count", "Facials Received"],
] as const;

const zeroExcludedVatoMetricGraphs = vatoMetricGraphs.filter(
  ([metric]) => metric !== "scene_count"
);

for (const [metric, label] of vatoMetricGraphs) {
  assert.match(
    vatoStatsSource,
    new RegExp(`\\{ key: "${metric}", label: "${label}" \\}`),
    `${label} should be available as a Vato Stats graph`
  );
  assert.match(
    vatoStatsSource,
    new RegExp(`case "${metric}":`),
    `${label} graph should use the existing podium metric data`
  );
}

for (const [metric, label] of zeroExcludedVatoMetricGraphs) {
  assert.match(
    vatoStatsSource,
    new RegExp(`excludeZeroCountFromChart[\\s\\S]*?case "${metric}":`),
    `${label} should exclude zero-count vatos rather than show an Unknown badge`
  );
}

assert.match(
  vatoStatsSource,
  /case "scene_count":\s*return nonNegativeNumericValueLabel\(performer\.scene_count\);/,
  "Total Scenes should retain its zero-count bar"
);

assert.match(
  vatoStatsSource,
  /if \(!value\) \{\s*if \(!excludeZeroCountFromChart\(category\)\) unknownCount \+= 1;/,
  "Vato metric graphs should not count zero-scene vatos as Unknown"
);

assert.match(
  sceneStatsSource,
  /o_count: "O Count"[\s\S]*?category: "o_count"[\s\S]*?label="By O Count"/,
  "Scene Stats should bucket O counts and render a drill-down graph"
);

console.log("Stats metric graph tests passed.");
