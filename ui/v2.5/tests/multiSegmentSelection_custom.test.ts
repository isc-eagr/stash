import assert from "node:assert/strict";

import {
  selectedMultiSegmentIdsToDelete,
  unselectedMultiSegmentIdsToDelete,
} from "../src/components/ScenePlayer/multiSegmentSelection_custom.ts";

const segments = [{ id: "one" }, { id: "two" }, { id: "three" }];
const selected = new Set(["one", "three"]);

assert.deepEqual(selectedMultiSegmentIdsToDelete(segments, selected), [
  "one",
  "three",
]);

assert.deepEqual(unselectedMultiSegmentIdsToDelete(segments, selected), [
  "two",
]);

assert.deepEqual(selectedMultiSegmentIdsToDelete(segments, new Set()), []);
assert.deepEqual(unselectedMultiSegmentIdsToDelete(segments, new Set()), [
  "one",
  "two",
  "three",
]);
