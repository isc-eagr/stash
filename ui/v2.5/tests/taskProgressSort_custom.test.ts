import assert from "node:assert/strict";
import test from "node:test";
import { sortTaskProgressTrackers } from "../src/components/TaskProgress/taskProgressSort_custom";

const trackers = [
  {
    id: "large",
    mode: "BACKLOG",
    goal: 100,
    completed_count: 50,
    current_count: 950,
  },
  {
    id: "fixed",
    mode: "FIXED",
    goal: 10,
    completed_count: 9,
    current_count: 8,
  },
  {
    id: "small",
    mode: "BACKLOG",
    goal: 10,
    completed_count: 8,
    current_count: 2,
  },
  {
    id: "equal",
    mode: "BACKLOG",
    goal: 100,
    completed_count: 20,
    current_count: 80,
  },
  {
    id: "empty",
    mode: "BACKLOG",
    goal: 0,
    completed_count: 0,
    current_count: 0,
  },
];
const ids = (values: readonly { id: string }[]) =>
  values.map((value) => value.id);

test("progress sorts by completion percentage rather than completed count", () => {
  assert.deepEqual(ids(sortTaskProgressTrackers(trackers, "progress_desc")), [
    "empty",
    "small",
    "fixed",
    "equal",
    "large",
  ]);
  assert.deepEqual(ids(sortTaskProgressTrackers(trackers, "progress_asc")), [
    "large",
    "fixed",
    "equal",
    "small",
    "empty",
  ]);
});

test("percentage sorting preserves manual order and equal-percentage ties", () => {
  const original = ids(trackers);
  sortTaskProgressTrackers(Object.freeze([...trackers]), "progress_desc");
  sortTaskProgressTrackers(trackers, "progress_asc");
  assert.deepEqual(ids(trackers), original);
  assert.deepEqual(ids(sortTaskProgressTrackers(trackers, "manual")), original);
  assert.deepEqual(sortTaskProgressTrackers([], "progress_desc"), []);
});

test("progress sorting uses the full percentage before display rounding", () => {
  const close = [
    {
      id: "lower",
      mode: "BACKLOG",
      goal: 100000,
      completed_count: 10000,
      current_count: 90000,
    },
    {
      id: "higher",
      mode: "BACKLOG",
      goal: 100000,
      completed_count: 10001,
      current_count: 89999,
    },
  ];
  assert.deepEqual(ids(sortTaskProgressTrackers(close, "progress_desc")), [
    "higher",
    "lower",
  ]);
});

test("closest-to-next-medal sorts by items still needed", () => {
  const medals = [
    // 50 of 1000: Bronze needs 200 more.
    {
      id: "far",
      mode: "BACKLOG",
      goal: 0,
      completed_count: 50,
      current_count: 950,
    },
    // 48 of 100: Silver needs 2 more.
    {
      id: "near",
      mode: "BACKLOG",
      goal: 0,
      completed_count: 48,
      current_count: 52,
    },
    // Every medal earned sorts last.
    {
      id: "done",
      mode: "BACKLOG",
      goal: 0,
      completed_count: 10,
      current_count: 0,
    },
    // 5 of 10: Gold needs 3 more.
    {
      id: "mid",
      mode: "BACKLOG",
      goal: 0,
      completed_count: 5,
      current_count: 5,
    },
  ];
  assert.deepEqual(ids(sortTaskProgressTrackers(medals, "next_medal")), [
    "near",
    "mid",
    "far",
    "done",
  ]);
});
