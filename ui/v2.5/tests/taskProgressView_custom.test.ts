import assert from "node:assert/strict";
import {
  plannedTaskProgressFinishDate,
  overallProgressPercentage,
  progressForecast,
  progressPercentage,
  progressToday,
  taskProgressCompletedCount,
} from "../src/components/TaskProgress/progressMath_custom.ts";

assert.equal(
  progressToday(new Date("2026-09-08T02:00:00Z")),
  "2026-09-07",
  "reporting day stays in Mexico City across UTC midnight"
);
assert.equal(
  progressPercentage({
    mode: "BACKLOG",
    goal: 100,
    completed_count: 20,
    current_count: 110,
  }),
  (20 / 130) * 100,
  "incoming work cannot erase recorded completions"
);
assert.equal(
  progressPercentage({
    mode: "FIXED",
    goal: 100,
    completed_count: 40,
    current_count: 80,
  }),
  20,
  "reopening and completing twice does not inflate fixed-batch percentage"
);
assert.equal(
  taskProgressCompletedCount({
    mode: "FIXED",
    goal: 100,
    completed_count: 90,
    current_count: 40,
  }),
  60,
  "fixed-batch summaries count completed baseline items instead of activity events"
);
assert.equal(
  overallProgressPercentage(80, 20),
  25,
  "overall progress reports the organized percentage"
);
assert.equal(
  overallProgressPercentage(0, 0),
  0,
  "overall progress stays determinate when there are no scenes"
);
assert.equal(
  overallProgressPercentage(10, 14),
  100,
  "overall progress never exceeds a complete percentage"
);
const tracker = {
  started_on: "2026-09-07",
  status: "ACTIVE",
  current_count: 20,
  history: [
    { date: "2026-09-07", completed: 10, incoming: 1, remaining: 20 },
    { date: "2026-09-10", completed: 100, incoming: 0, remaining: 0 },
  ],
};
const forecast = progressForecast(tracker, "2026-09-10");
assert.equal(forecast.days, 3);
assert.equal(
  forecast.netRate,
  3,
  "zero days count and today's partial day is excluded"
);
assert.equal(forecast.observed, "2026-09-17");
assert.equal(
  plannedTaskProgressFinishDate(tracker.current_count, 5, "2026-09-10"),
  "2026-09-14",
  "planned finishes are calculated locally from the graph input"
);
assert.equal(
  progressForecast(
    {
      ...tracker,
      history: [
        { date: "2026-09-07", completed: 10, incoming: 12, remaining: 20 },
      ],
    },
    "2026-09-10"
  ).observed,
  undefined,
  "growing backlog has no finish forecast"
);
assert.equal(
  progressForecast({ ...tracker, status: "PAUSED" }, "2026-09-10").observed,
  undefined
);
assert.equal(
  progressForecast(tracker, "2026-09-08").observed,
  undefined,
  "insufficient history is not a forecast"
);
