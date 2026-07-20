import assert from "node:assert/strict";

import {
  getTagItemCount,
  getTrackerProgress,
  reorderProgressTrackers,
  toggleProgressTrackerWorkingOn,
} from "../src/components/taskProgress_custom.ts";
import type { IProgressTracker } from "../src/components/taskProgress_custom.ts";

assert.equal(
  getTagItemCount({
    scene_count: 1,
    scene_marker_count: 2,
    image_count: 3,
    gallery_count: 4,
    performer_count: 5,
    studio_count: 6,
    group_count: 7,
  }),
  28,
  "the fixed goal includes every directly tagged item type"
);

const tracker = (id: string, goal: number): IProgressTracker => ({
  id,
  title: id.toUpperCase(),
  description: "",
  goal,
  tagId: id,
  tagName: `Tag ${id}`,
  isWorkingOn: false,
});
const trackers = [tracker("a", 1), tracker("b", 2), tracker("c", 3)];

assert.deepEqual(
  reorderProgressTrackers(trackers, "c", "a").map((tracker) => tracker.id),
  ["c", "a", "b"],
  "dragging a tracker persists its new order"
);

const workingTrackers = toggleProgressTrackerWorkingOn(trackers, "b");
assert.deepEqual(
  workingTrackers.map((tracker) => tracker.isWorkingOn),
  [false, true, false],
  "a tracker can be marked as currently being worked on without changing the others"
);
assert.equal(
  toggleProgressTrackerWorkingOn(workingTrackers, "b")[1].isWorkingOn,
  false,
  "the working-on state can be cleared"
);

assert.deepEqual(
  getTrackerProgress(10, 4),
  { done: 6, remaining: 4, percentage: 60 },
  "progress uses the stored goal and the live tagged count"
);

assert.deepEqual(
  getTrackerProgress(10, 14),
  { done: 0, remaining: 14, percentage: 0 },
  "a growing tagged backlog does not mutate the fixed goal or show negative progress"
);

assert.deepEqual(
  getTrackerProgress(0, 0),
  { done: 0, remaining: 0, percentage: 100 },
  "a tracker created from an empty tag starts complete"
);
