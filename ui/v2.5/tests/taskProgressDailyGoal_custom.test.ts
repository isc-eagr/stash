import assert from "node:assert/strict";

import {
  taskProgressDailyGoal,
  taskProgressDailyGoalState,
} from "../src/components/TaskProgress/progressView_custom.ts";

const tracker = (completed: number, status = "ACTIVE", goal = 3) => ({
  goal_per_day: goal,
  history: [{ date: "2026-09-10", completed }],
  status,
});

assert.deepEqual(
  [0, 25, 26, 50, 51, 80, 81, 100, 101].map((completed) =>
    taskProgressDailyGoalState(completed, 100)
  ),
  [
    "red",
    "red",
    "orange",
    "orange",
    "yellow",
    "yellow",
    "green",
    "green",
    "sapphire",
  ],
  "daily-goal colors use the requested percentage bands"
);
assert.equal(
  taskProgressDailyGoal(tracker(4, "PAUSED"), "2026-09-10"),
  undefined,
  "non-active trackers retain their existing presentation"
);
assert.equal(
  taskProgressDailyGoal(tracker(4, "ACTIVE", 0), "2026-09-10"),
  undefined,
  "trackers without a daily goal retain their existing presentation"
);
