import assert from "node:assert/strict";
import {
  milestoneForecast,
  milestoneFromSearch,
  milestoneSearch,
  milestoneTargetProgress,
  milestoneTrackerPace,
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
assert.equal(
  milestoneTrackerPace(
    {
      started_on: "2026-09-23",
      history: [
        { date: "2026-09-23", completed: 5, incoming: 0, remaining: 9 },
      ],
    } as Parameters<typeof milestoneTrackerPace>[0],
    "2026-09-23"
  ),
  5,
  "a new tracker shows today's provisional pace"
);
assert.equal(
  milestoneTrackerPace(
    { history: [] } as unknown as Parameters<typeof milestoneTrackerPace>[0],
    "2026-09-23"
  ),
  undefined
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
