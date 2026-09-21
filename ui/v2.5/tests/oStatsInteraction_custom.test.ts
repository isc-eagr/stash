import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/OStats/OStats.tsx", import.meta.url),
  "utf8"
);

assert.match(
  source,
  /<Link\s+className="ostats-bar-cell"[\s\S]*?to=\{addOStatsStudioScopeToPath\(item\.path, studioScope\)\}[\s\S]*?aria-label=/,
  "chart destinations must be keyboard-accessible links with descriptive names"
);
assert.doesNotMatch(
  source,
  /role="listitem"/,
  "chart controls must retain their native interactive semantics"
);

const unknownLinks = [
  ...source.matchAll(/<Link\s+className="ostats-unknown-count"([^>]+)>/g),
];
assert.equal(
  unknownLinks.length,
  7,
  "all Unknown groups should open event views"
);
for (const [, attributes] of unknownLinks) {
  assert.match(
    attributes,
    /to=\{addOStatsStudioScopeToPath\(\s*"\/ostats\//,
    "Unknown groups need a destination"
  );
  assert.match(
    attributes,
    /title="View O events with an unknown [^"]+"/,
    "Unknown links should explain which missing field they represent"
  );
}

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

assert.match(
  source,
  /MOST_OS_IN_DAY,[\s\S]*?skip: isDetailPage \|\| embedded/,
  "embedded Studio O Stats should not query the global daily record"
);
assert.match(
  source,
  /LONGEST_PERIOD_WITHOUT_O,[\s\S]*?skip: isDetailPage \|\| embedded/,
  "embedded Studio O Stats should not query the global dry-spell record"
);
assert.match(
  source,
  /!embedded && !error && !loading && !showTimeline && !selectedYear && \([\s\S]*?<h2>By Studio<\/h2>/,
  "the By Studio breakdown should remain global-only"
);
