import assert from "node:assert/strict";
import {
  milestoneForecast,
  milestoneFromSearch,
  milestoneItemProgress,
  milestoneSearch,
  milestonesRemaining,
  milestoneTargetProgress,
} from "../src/components/TaskProgress/milestoneView_custom.ts";
import { readFinishCalculatorPlan } from "../src/components/TaskProgress/TaskProgressFinishCalculator.tsx";
import { taskProgressCheckpoints } from "../src/components/TaskProgress/taskProgressCheckpoints_custom.ts";

assert.equal(milestoneFromSearch("?view=milestones&milestone=12"), "12");
assert.equal(
  milestoneSearch("?status=ALL", "12"),
  "?status=ALL&view=milestones&milestone=12"
);
assert.equal(
  milestoneSearch("?view=milestones&milestone=12", undefined, "trackers"),
  ""
);

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
  taskProgressCheckpoints(milestone.history, 30, "2026-09-23"),
  [
    { threshold: 25, date: "2026-09-22", reached: true },
    { threshold: 50, date: undefined, reached: false },
    { threshold: 75, date: undefined, reached: false },
    { threshold: 100, date: undefined, reached: false },
  ],
  "checkpoints record the first day history crossed them"
);
assert.equal(
  taskProgressCheckpoints(milestone.history, 60, "2026-09-23")[1].reached,
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

assert.equal(
  milestonesRemaining([
    {
      trackers: [
        { id: "1", current_count: 5 },
        { id: "2", current_count: 3 },
      ],
    },
    {
      trackers: [
        { id: "2", current_count: 3 },
        { id: "3", current_count: 4 },
      ],
    },
  ]),
  12,
  "a tracker shared by two milestones counts once"
);
assert.equal(milestonesRemaining([]), 0);

const calculatorStorage = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => calculatorStorage.get(key) ?? null,
    setItem: (key: string, value: string) => calculatorStorage.set(key, value),
  },
});
const calculatorMilestones = [
  { id: "1", current_count: 4 },
  { id: "2", current_count: 0 },
  { id: "3", current_count: 7 },
];
assert.deepEqual(
  readFinishCalculatorPlan(calculatorMilestones),
  { ids: ["1", "3"], rate: 10 },
  "defaults to every unfinished milestone at 10/day"
);
calculatorStorage.set(
  "task-progress-milestone-finish-calculator",
  JSON.stringify({ ids: [2], rate: 25 })
);
assert.deepEqual(readFinishCalculatorPlan(calculatorMilestones), {
  ids: ["2"],
  rate: 25,
});
calculatorStorage.set("task-progress-milestone-finish-calculator", "{bad");
assert.deepEqual(readFinishCalculatorPlan(calculatorMilestones), {
  ids: ["1", "3"],
  rate: 10,
});
