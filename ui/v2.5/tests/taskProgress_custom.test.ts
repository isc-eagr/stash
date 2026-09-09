import assert from "node:assert/strict";

import {
  buildTaskProgressHistorySeries,
  filterTaskProgressHistoryActivityPoints,
  formatTaskProgressDate,
  getTagItemCount,
  getTrackerProgress,
  parseTaskProgressDate,
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
  startedOn: "2026-07-21",
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

assert.equal(
  formatTaskProgressDate("2026-07-09"),
  "09/07/2026",
  "stored task dates display in DD/MM/YYYY format"
);

assert.equal(
  formatTaskProgressDate(new Date(2026, 0, 2)),
  "02/01/2026",
  "completion estimates display in DD/MM/YYYY format"
);

assert.equal(
  parseTaskProgressDate("29/02/2024"),
  "2024-02-29",
  "valid leap-day Started On values are persisted as calendar dates"
);

assert.equal(
  parseTaskProgressDate("29/02/2023"),
  undefined,
  "invalid Started On dates are rejected"
);

const history = buildTaskProgressHistorySeries(
  [
    {
      date: "2026-09-01",
      completed: 1,
      incoming: 0,
      remaining: 9,
      baselineCount: 10,
    },
    {
      date: "2026-09-03",
      completed: 2,
      incoming: 0,
      remaining: 7,
    },
    {
      date: "2026-09-05",
      completed: 0,
      incoming: 1,
      remaining: 8,
    },
  ],
  "all",
  "2026-09-07"
);

assert.deepEqual(
  history.map(({ date, completed, incoming, remaining }) => ({
    date,
    completed,
    incoming,
    remaining,
  })),
  [
    { date: "2026-09-01", completed: 1, incoming: 0, remaining: 9 },
    { date: "2026-09-02", completed: 0, incoming: 0, remaining: 9 },
    { date: "2026-09-03", completed: 2, incoming: 0, remaining: 7 },
    { date: "2026-09-04", completed: 0, incoming: 0, remaining: 7 },
    { date: "2026-09-05", completed: 0, incoming: 1, remaining: 8 },
    { date: "2026-09-06", completed: 0, incoming: 0, remaining: 8 },
    { date: "2026-09-07", completed: 0, incoming: 0, remaining: 8 },
  ],
  "history fills missing calendar days and carries the remaining count"
);

assert.equal(
  history.at(-1)?.completedAverage,
  3 / 7,
  "the completion trend uses a trailing seven-calendar-day average"
);

assert.deepEqual(
  history.map((entry) => entry.cumulativeCompleted),
  [1, 1, 3, 3, 3, 3, 3],
  "cumulative completions include completed work from every visible day"
);

assert.equal(
  history[0].baselineCount,
  10,
  "baseline markers remain attached to their recorded calendar day"
);

assert.deepEqual(
  buildTaskProgressHistorySeries(history, 7, "2026-09-10").map(
    (entry) => entry.date
  ),
  [
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
  ],
  "a seven-day view remains bounded to the latest seven calendar days"
);

const thirtyDayHistory = buildTaskProgressHistorySeries(
  history,
  30,
  "2026-10-15"
);
assert.equal(
  thirtyDayHistory.length,
  30,
  "the thirty-day view contains thirty inclusive calendar days"
);
assert.equal(thirtyDayHistory[0].date, "2026-09-16");
assert.equal(thirtyDayHistory.at(-1)?.date, "2026-10-15");
assert.equal(
  thirtyDayHistory[0].cumulativeCompleted,
  3,
  "a bounded view retains completions recorded before its first visible day"
);

assert.deepEqual(
  buildTaskProgressHistorySeries(
    [
      { date: "2026-09-07", completed: 1, incoming: 2, remaining: 11 },
      { date: "2026-09-07", completed: 3, incoming: 4, remaining: 12 },
      { date: "invalid", completed: 100, incoming: 100, remaining: 100 },
      { date: "2026-09-08", completed: 100, incoming: 100, remaining: 100 },
    ],
    "all",
    "2026-09-07"
  )[0],
  {
    date: "2026-09-07",
    completed: 4,
    incoming: 6,
    remaining: 12,
    baselineCount: undefined,
    completedAverage: 4,
    cumulativeCompleted: 4,
  },
  "same-day rows are combined while invalid and future rows are ignored"
);

assert.deepEqual(
  filterTaskProgressHistoryActivityPoints([
    {
      date: "2026-09-07",
      completed: 0,
      incoming: 0,
      remaining: 4,
      completedAverage: 0,
      cumulativeCompleted: 0,
    },
    {
      date: "2026-09-08",
      completed: 2,
      incoming: 0,
      remaining: 2,
      completedAverage: 1,
      cumulativeCompleted: 2,
    },
    {
      date: "2026-09-09",
      completed: 0,
      incoming: 0,
      remaining: 2,
      baselineCount: 2,
      completedAverage: 0,
      cumulativeCompleted: 2,
    },
  ]).map((point) => point.date),
  ["2026-09-08"],
  "daily data omits inactive zero days"
);
