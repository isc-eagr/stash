import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/OStats/OStats.tsx", import.meta.url),
  "utf8"
);

assert.match(
  source,
  /<Link\s+className="ostats-bar-cell"[\s\S]*?to=\{item\.path\}[\s\S]*?aria-label=/,
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
    /to="\/ostats\//,
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
