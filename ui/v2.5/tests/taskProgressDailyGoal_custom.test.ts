import assert from "node:assert/strict";

import { taskProgressDailyGoalState } from "../src/components/TaskProgress/progressView_custom.ts";

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
