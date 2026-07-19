import assert from "node:assert/strict";

import {
  getTagItemCount,
  getTrackerProgress,
  normalizeProgressTrackers,
  reorderProgressTrackers,
  toggleProgressTrackerWorkingOn,
} from "../src/components/taskProgress_custom.ts";

const legacy = normalizeProgressTrackers([
  {
    id: "legacy",
    name: "Legacy tracker",
    initialValue: 12,
    tagId: "tag-1",
    tagName: "Inbox",
  },
]);

assert.deepEqual(
  legacy[0],
  {
    id: "legacy",
    title: "Legacy tracker",
    description: "",
    goal: 12,
    tagId: "tag-1",
    tagName: "Inbox",
    isWorkingOn: false,
  },
  "legacy trackers migrate to the title, description, and fixed goal shape"
);

assert.equal(
  normalizeProgressTrackers([
    {
      id: "active",
      title: "Active",
      goal: 5,
      tagId: "tag-2",
      isWorkingOn: true,
    },
  ])[0].isWorkingOn,
  true,
  "the persisted working-on state is restored"
);

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

const trackers = normalizeProgressTrackers([
  { id: "a", title: "A", goal: 1, tagId: "1" },
  { id: "b", title: "B", goal: 2, tagId: "2" },
  { id: "c", title: "C", goal: 3, tagId: "3" },
]);

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
