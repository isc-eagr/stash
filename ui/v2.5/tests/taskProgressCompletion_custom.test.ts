import assert from "node:assert/strict";
import {
  showTaskProgressCurrentPeriods,
  taskProgressLastDataDate,
  taskProgressNextDayDelay,
} from "../src/components/TaskProgress/taskProgressCompletion_custom.ts";
import { progressToday } from "../src/components/TaskProgress/progressMath_custom.ts";

const history = [
  { date: "2026-10-07", completed: 1, incoming: 0, remaining: 0 },
  { date: "2026-10-06", completed: 2, incoming: 0, remaining: 1 },
];
assert.equal(taskProgressLastDataDate(history), "2026-10-07");
assert.equal(taskProgressLastDataDate([]), undefined);
assert.equal(
  showTaskProgressCurrentPeriods("COMPLETED", history, "2026-10-07"),
  true
);
assert.equal(
  showTaskProgressCurrentPeriods("COMPLETED", history, "2026-10-08"),
  false
);
assert.equal(
  showTaskProgressCurrentPeriods("COMPLETED", [], "2026-10-07"),
  false
);
assert.equal(showTaskProgressCurrentPeriods("ACTIVE", [], "2026-10-08"), true);
assert.equal(
  showTaskProgressCurrentPeriods("PAUSED", history, "2026-10-08"),
  true
);
assert.equal(progressToday(new Date("2026-10-08T05:59:59Z")), "2026-10-07");
assert.equal(progressToday(new Date("2026-10-08T06:00:00Z")), "2026-10-08");

assert.equal(taskProgressNextDayDelay(new Date("2026-10-08T05:59:59Z")), 1000);
assert.equal(
  taskProgressNextDayDelay(new Date("2026-10-08T06:00:00Z")),
  86400000
);
