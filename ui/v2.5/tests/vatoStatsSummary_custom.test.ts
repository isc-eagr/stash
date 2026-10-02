import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vatoStatsSource = readFileSync(
  new URL("../src/components/VatoStats/VatoStats.tsx", import.meta.url),
  "utf8"
);
const vatoStatsStyles = readFileSync(
  new URL("../src/components/VatoStats/VatoStats.scss", import.meta.url),
  "utf8"
);
const sceneStatsSource = readFileSync(
  new URL("../src/components/SceneStats/SceneStats.tsx", import.meta.url),
  "utf8"
);

const summaryStart = vatoStatsSource.indexOf("const VatoStatsSummary");
const summaryEnd = vatoStatsSource.indexOf(
  "export const VatoStatsDashboard",
  summaryStart
);
const summarySource = vatoStatsSource.slice(summaryStart, summaryEnd);
const primarySummary = summarySource.slice(
  0,
  summarySource.indexOf("</section>")
);
assert.deepEqual(
  [...primarySummary.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]),
  [
    "Total Vatos",
    "Meters of Pito",
    "Total Nuts",
    "Total Nut Time",
    "Estimated Liters",
  ],
  "all five totals should remain visible in their original order"
);
assert.doesNotMatch(primarySummary, /<details|Fun stats/);
assert.match(primarySummary, /summary\.totalPenisMeters/);
assert.match(primarySummary, /summary\.estimatedLiters/);
assert.match(
  primarySummary,
  /title:.*summary\.assumedCount.*estimated at 17 cm/
);
assert.match(primarySummary, /title: "Total Nuts × 3 mL"/);
assert.doesNotMatch(
  vatoStatsSource,
  /o_per_scene|O's per Scene|metricIncludesPerformer/
);
assert.doesNotMatch(
  summarySource,
  /One Scene Vatos/,
  "One Scene Vatos should no longer be a summary card"
);
assert.doesNotMatch(
  vatoStatsSource,
  /className="vatostats-total"/,
  "the duplicate total should not appear under the Vato Stats title"
);
assert.match(
  vatoStatsStyles,
  /\.vatostats-summary-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/,
  "the summary should use an even five-column desktop layout"
);
assert.match(
  sceneStatsSource,
  /scenestats-summary-label">Total Nuts<\/div>/,
  "Scene Stats should call the orgasm total Total Nuts"
);
assert.match(
  sceneStatsSource,
  /scenestats-summary-label">\s*Total Nut Time\s*<\/div>/,
  "Scene Stats should call the orgasm duration Total Nut Time"
);
assert.doesNotMatch(
  sceneStatsSource,
  /Total orgasms|Total orgasm time/,
  "the prior Scene Stats orgasm labels should not remain"
);

console.log("Vato Stats summary tests passed.");
