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

assert.match(
  summarySource,
  /label: "Total Vatos",\s*value: totalVatos\.toLocaleString\(\),[\s\S]*?label: "Meters Of Pito"/,
  "Total Vatos should be the first Vato Stats summary card"
);
assert.match(
  summarySource,
  /label: "Total Nuts",\s*value: totalNuts\.toLocaleString\(\)/,
  "Total Nuts should show the total recorded O events"
);
assert.match(
  summarySource,
  /label: "Total Nut Time",\s*value: formatDuration\(totalNutTime\)/,
  "Total Nut Time should show the total recorded O-event duration"
);
assert.match(
  summarySource,
  /label: "Total Nut Time"[\s\S]*?label: "Estimated Liters"/,
  "Estimated Liters should be the final Vato Stats summary card"
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
  "summary cards should use an even five-column desktop layout"
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
