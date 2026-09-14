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
const formSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressForm.tsx",
    import.meta.url
  ),
  "utf8"
);
const detailsSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressDetails.tsx",
    import.meta.url
  ),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../src/components/TaskProgress.tsx", import.meta.url),
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
assert.match(modalSource, /progress-tracker-modal-context/);
assert.match(modalSource, /<small>\{t\("Started on"\)\}<\/small>/);
assert.match(
  modalSource,
  /<strong>\{formatTaskProgressDate\(tracker\.started_on\)\}<\/strong>/
);
assert.match(modalSource, /\{t\("Estimated pace"\)\}/);
assert.match(modalSource, /\{t\("Estimated finish"\)\}/);
assert.match(
  modalSource,
  /<TaskProgressAtAGlance tracker=\{tracker\} \/>\s*\{forecast\.days >= 3/
);
assert.match(modalSource, /progress-tracker-modal-history/);
assert.match(modalSource, /\{t\("Activity progression"\)\}/);
assert.doesNotMatch(
  modalSource,
  /progress-tracker-modal-meta/,
  "the modal replaces the loose metadata row with a structured context header"
);
assert.doesNotMatch(
  modalSource,
  /Fixed batch|Backlog/,
  "tracker details omit the mode label from the start-date metadata"
);
assert.doesNotMatch(
  modalSource,
  /onEdit:|onDelete:|<Modal\.Footer/,
  "tracker Details provides no edit, delete, or bottom close actions"
);
assert.doesNotMatch(
  detailsSource,
  /<Modal\.Footer/,
  "activity Details has only its top-right close control"
);
assert.match(formSource, /Delete tracker/);
assert.match(formSource, /Archive tracker/);
assert.match(formSource, /I understand, continue/);
assert.match(formSource, /Permanently delete tracker/);
assert.match(formSource, /deleteAcknowledged/);
assert.match(
  formSource,
  /Deleting permanently removes this tracker, its event history, its tracked items, and its goal history\. This cannot be undone\./
);
assert.doesNotMatch(pageSource, /Undo delete/);
