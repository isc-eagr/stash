import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const overallSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressOverall.tsx",
    import.meta.url
  ),
  "utf8"
);
const modalSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressOverallModal.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.doesNotMatch(
  overallSource,
  /<TaskProgressHistoryChart/,
  "the Overall Progress card does not render its history chart inline"
);
assert.match(
  overallSource,
  /onClick=\{\(\) => setShowDetails\(true\)\}/,
  "the Overall Progress card exposes its history through a Details action"
);
assert.match(overallSource, /\{t\("Details"\)\}/);
assert.match(
  modalSource,
  /<TaskProgressHistoryChart/,
  "the Overall Progress modal reuses the shared tracker history chart"
);
assert.match(modalSource, /size="xl"/);
assert.match(modalSource, /\{t\("Overall Progress"\)\}/);
