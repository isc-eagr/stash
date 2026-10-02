import assert from "node:assert/strict";
import {
  milestoneCheckpoints,
  milestoneForecast,
  milestoneFromSearch,
  milestoneItemProgress,
  milestoneSearch,
  milestoneTargetProgress,
  milestoneTrackerIdle,
  milestoneTrackerPeriods,
  resolveMilestoneSelection,
} from "../src/components/TaskProgress/milestoneView_custom.ts";

assert.equal(milestoneFromSearch("?view=milestones&milestone=12"), "12");
assert.equal(
  milestoneSearch("?status=ALL", "12"),
  "?status=ALL&view=milestones&milestone=12"
);
assert.equal(
  milestoneSearch("?view=milestones&milestone=12", undefined, "trackers"),
  ""
);
assert.equal(
  milestoneSearch("?view=milestones&milestone=12", undefined, "reports"),
  "?view=reports",
  "the Reports tab keeps its own URL and clears milestone selection"
);
assert.equal(
  resolveMilestoneSelection(["1", "2"], "missing", "2"),
  "missing",
  "invalid direct links remain explicit"
);
assert.equal(resolveMilestoneSelection(["1", "2"], undefined, "2"), "2");
assert.equal(resolveMilestoneSelection(["1", "2"], undefined, "deleted"), "1");

const milestone = {
  target_date: "2026-09-26",
  current_count: 9,
  history: [
    { date: "2026-09-19", completed: 0, incoming: 0, remaining: 15 },
    { date: "2026-09-20", completed: 1, incoming: 0, remaining: 14 },
    { date: "2026-09-21", completed: 1, incoming: 1, remaining: 14 },
    { date: "2026-09-22", completed: 2, incoming: 0, remaining: 12 },
  ],
} as Parameters<typeof milestoneForecast>[0];
const forecast = milestoneForecast(milestone, "2026-09-23");
assert.equal(forecast.days, 4);
assert.equal(forecast.netRate, 0.75);
assert.equal(forecast.observed, "2026-10-05");
assert.equal(forecast.assumesNoIncoming, false);
const incomingOutpacesCompletion = {
  ...milestone,
  history: milestone.history.map((day) =>
    day.date === "2026-09-22" ? { ...day, incoming: 10 } : day
  ),
};
const grossFallback = milestoneForecast(
  incomingOutpacesCompletion,
  "2026-09-23"
);
assert.equal(grossFallback.netRate, -1.75);
assert.equal(grossFallback.observed, "2026-10-02");
assert.equal(grossFallback.assumesNoIncoming, true);
assert.equal(
  milestoneForecast({ ...milestone, current_count: 0 }, "2026-09-23")
    .assumesNoIncoming,
  false
);
const trackerPeriods = milestoneTrackerPeriods(
  {
    history: [
      { date: "2026-08-31", completed: 0, incoming: 0, remaining: 20 },
      { date: "2026-09-21", completed: 4, incoming: 0, remaining: 16 },
      { date: "2026-09-22", completed: 2, incoming: 0, remaining: 14 },
      { date: "2026-09-23", completed: 4, incoming: 0, remaining: 10 },
    ],
  } as unknown as Parameters<typeof milestoneTrackerPeriods>[0],
  "2026-09-23"
);
assert.deepEqual(
  [
    trackerPeriods.day.completed,
    trackerPeriods.week.completed,
    trackerPeriods.month.completed,
  ],
  [4, 10, 10],
  "weeks start on Monday and months on the first"
);
assert.equal(trackerPeriods.day.percent, 20);
assert.equal(trackerPeriods.week.percent, 50);
assert.equal(trackerPeriods.month.percent, 50);
assert.deepEqual(
  milestoneTrackerPeriods(
    { history: [] } as unknown as Parameters<typeof milestoneTrackerPeriods>[0],
    "2026-09-23"
  ).day,
  { completed: 0, percent: 0 }
);
assert.deepEqual(
  milestoneTargetProgress(milestone, forecast.netRate, "2026-09-23"),
  {
    state: "behind",
    requiredRate: 3,
  }
);
assert.deepEqual(
  milestoneTargetProgress(
    { ...milestone, target_date: "2026-09-23" },
    9,
    "2026-09-23"
  ),
  {
    state: "on_track",
    requiredRate: 9,
  }
);
assert.equal(
  milestoneTargetProgress(
    { ...milestone, target_date: "2026-09-22" },
    0,
    "2026-09-23"
  )?.state,
  "overdue"
);
assert.equal(
  milestoneTargetProgress({ ...milestone, current_count: 0 }, 0, "2026-09-23")
    ?.state,
  "complete"
);
assert.equal(
  milestoneTargetProgress(milestone, 0, "2026-09-23")?.state,
  "unavailable"
);

assert.deepEqual(
  milestoneCheckpoints(milestone.history, 30, "2026-09-23"),
  [
    { threshold: 25, date: "2026-09-22", reached: true },
    { threshold: 50, date: undefined, reached: false },
    { threshold: 75, date: undefined, reached: false },
    { threshold: 100, date: undefined, reached: false },
  ],
  "checkpoints record the first day history crossed them"
);
assert.equal(
  milestoneCheckpoints(milestone.history, 60, "2026-09-23")[1].reached,
  true,
  "progress earned before history began still counts"
);
assert.deepEqual(
  milestoneItemProgress({
    item_counts: [
      { item_type: "scene", count: 9 },
      { item_type: "image", count: 0 },
      { item_type: "gallery", count: 0 },
    ],
    completed_item_counts: [
      { item_type: "scene", count: 6 },
      { item_type: "image", count: 2 },
    ],
  }),
  [
    { itemType: "scene", completed: 6, total: 15 },
    { itemType: "image", completed: 2, total: 2 },
  ]
);

const recentHistory = {
  history: [{ date: "2026-09-02", completed: 3, incoming: 0, remaining: 5 }],
} as Parameters<typeof milestoneTrackerIdle>[0];
assert.equal(
  milestoneTrackerIdle(recentHistory, "2026-10-01"),
  false,
  "completions in the last 30 days keep a tracker active across month boundaries"
);
assert.equal(milestoneTrackerIdle(recentHistory, "2026-10-02"), true);
