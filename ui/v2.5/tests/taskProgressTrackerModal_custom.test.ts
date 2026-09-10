import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  taskProgressStatusLabel,
  taskProgressStatusVariant,
  taskProgressStatuses,
  visibleTaskProgressItemCounts,
} from "../src/components/TaskProgress/progressView_custom.ts";

const modalSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressTrackerModal.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.deepEqual(taskProgressStatuses, [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]);
assert.equal(taskProgressStatusVariant("ACTIVE"), "success");
assert.equal(taskProgressStatusVariant("PAUSED"), "warning");
assert.equal(taskProgressStatusVariant("COMPLETED"), "info");
assert.equal(taskProgressStatusLabel("CURRENT"), "Current");
assert.equal(taskProgressStatusLabel("ACTIVE"), "Active");
assert.deepEqual(
  visibleTaskProgressItemCounts([
    { item_type: "scene", count: 4 },
    { item_type: "image", count: 0 },
  ]),
  [{ item_type: "scene", count: 4 }],
  "zero-count item types stay hidden from the tracker modal"
);
assert.match(modalSource, /<TaskProgressAtAGlance tracker=\{tracker\} \/>/);
assert.match(modalSource, /\{t\("Started on"\)\}: \{tracker\.started_on\}/);
assert.doesNotMatch(
  modalSource,
  /Fixed batch|Backlog/,
  "tracker details omit the mode label from the start-date metadata"
);
