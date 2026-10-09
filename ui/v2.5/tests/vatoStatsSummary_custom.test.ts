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
const nutStatsSource = readFileSync(
  new URL(
    "../src/components/MarkerEventStats/MarkerEventStats.tsx",
    import.meta.url
  ),
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
  ["Total Vatos", "Meters of Pito"],
  "nut totals moved to Nut Stats"
);
assert.doesNotMatch(primarySummary, /<details|Fun stats/);
assert.match(primarySummary, /summary\.totalPenisMeters/);
assert.match(
  primarySummary,
  /title:.*summary\.assumedCount.*estimated at 17 cm/
);
assert.doesNotMatch(vatoStatsSource, /sceneOrgasmCount|totalOrgasmTime/);
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
  /\.vatostats-summary-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
  "the summary should use an even two-column desktop layout"
);
assert.match(nutStatsSource, /countLabel: "Total Nuts"/);
assert.match(nutStatsSource, /timeLabel: "Total Nut Time"/);
assert.match(nutStatsSource, /label: "Estimated Liters"/);
assert.match(nutStatsSource, /title: "Total Nuts × 3 mL"/);
assert.match(nutStatsSource, /countLabel: "Total Facials"/);
assert.match(nutStatsSource, /timeLabel: "Total Facial Time"/);
assert.doesNotMatch(
  sceneStatsSource,
  /Total Nuts|Total Nut Time|Total Facials|Total Facial Time|sceneOrgasmCount\(|sceneFacialCount\(/,
  "nut and facial totals moved to Nut Stats and Facial Stats"
);
assert.doesNotMatch(
  sceneStatsSource,
  /Total orgasms|Total orgasm time/,
  "the prior Scene Stats orgasm labels should not remain"
);

console.log("Vato Stats summary tests passed.");
