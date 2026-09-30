import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/OStats/OStats.tsx", import.meta.url),
  "utf8"
);
const chartSource = readFileSync(
  new URL("../src/components/StatsBarChart_custom.tsx", import.meta.url),
  "utf8"
);

// Shared chart: link bars keep native link semantics and descriptive names.
assert.match(
  chartSource,
  /<Link\s+className="stats-bar-chart-cell"[\s\S]*?to=\{datum\.to\}[\s\S]*?aria-label=\{label\}/,
  "chart destinations must be keyboard-accessible links with descriptive names"
);
assert.doesNotMatch(
  source + chartSource,
  /role="listitem"/,
  "chart controls must retain their native interactive semantics"
);

// Every event link keeps the studio scope and the date range.
assert.match(
  source,
  /const withScope = \(path: string\) =>\s*addStatsDateRangeToPath\(\s*addOStatsStudioScopeToPath\(path, studioScope\),\s*location\.search\s*\)/,
  "O Stats links should carry the studio scope and date range"
);
assert.match(
  source,
  /to: withScope\(datum\.path\)/,
  "chart bars should navigate through the scoped path helper"
);

const unknownDestinations = [
  ...source.matchAll(
    /to: withScope\(\s*[`"]\/ostats\/(unknown\/[a-z-]+|ethnicity\/Unknown|country\/Unknown|rating\/\$\{O_STATS_UNKNOWN_BUCKET\}|tier\/\$\{O_STATS_UNKNOWN_BUCKET\})[`"]\s*\)/g
  ),
].map((match) => match[1]);
assert.deepEqual(
  unknownDestinations.sort(),
  [
    "country/Unknown",
    "ethnicity/Unknown",
    "rating/${O_STATS_UNKNOWN_BUCKET}",
    "tier/${O_STATS_UNKNOWN_BUCKET}",
    "unknown/date",
    "unknown/marker-tag",
    "unknown/performer-age",
    "unknown/release-year",
    "unknown/studio",
  ].sort(),
  "all Unknown groups should open event views"
);

assert.match(
  source,
  /item\.path \? \([\s\S]*?<Link[\s\S]*?aria-current=[\s\S]*?: \(\s*<Button key=\{item\.label\} disabled/,
  "available date views should be links; unavailable date views must be disabled buttons"
);
assert.doesNotMatch(
  source,
  />\s*Back\s*<\//,
  "return navigation should name its destination instead of implying browser history"
);

// Embedded Studio O Stats omits the global records and By Studio chart.
assert.match(
  source,
  /mostOsInDay\(\$\{SCOPE_ARGUMENTS\}\) @include\(if: \$includeGlobal\)/,
  "embedded Studio O Stats should not query the global daily record"
);
assert.match(
  source,
  /longestPeriodWithoutO\(\$\{SCOPE_ARGUMENTS\}\) @include\(if: \$includeGlobal\)/,
  "embedded Studio O Stats should not query the global dry-spell record"
);
assert.match(
  source,
  /includeGlobal: !embedded/,
  "records are included only outside the embedded Studio view"
);
assert.match(
  source,
  /\{!embedded && overview\.byStudio && \([\s\S]*?title="By Studio"/,
  "the By Studio breakdown should remain global-only"
);

console.log("O Stats interaction tests passed.");
