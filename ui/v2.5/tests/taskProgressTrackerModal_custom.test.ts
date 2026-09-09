import assert from "node:assert/strict";
import {
  taskProgressStatusLabel,
  taskProgressStatusVariant,
  taskProgressStatuses,
  visibleTaskProgressItemCounts,
} from "../src/components/TaskProgress/progressView_custom.ts";

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
