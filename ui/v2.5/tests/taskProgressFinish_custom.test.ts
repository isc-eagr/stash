import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import {
  readTaskProgressFinishPlan,
  saveTaskProgressFinishPlan,
  taskProgressDaysUntil,
  taskProgressFinishEstimate,
} from "../src/components/TaskProgress/taskProgressFinish_custom.ts";
import {
  TaskProgressFinishLabel,
  TaskProgressForecast,
} from "../src/components/TaskProgress/TaskProgressForecast.tsx";
import { sortTaskProgressTrackers } from "../src/components/TaskProgress/taskProgressSort_custom.ts";

const storage = new Map<string, string>();
const events: string[] = [];
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
  window: {
    dispatchEvent: (event: CustomEvent) => events.push(String(event.detail)),
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  CustomEvent: class<T> {
    detail: T;
    constructor(_: string, init: { detail: T }) {
      this.detail = init.detail;
    }
  },
});

const today = "2026-10-19";
const history = [10, 11, 12, 13, 14, 15, 16, 17, 18].map((day) => ({
  date: `2026-10-${day}`,
  completed: 4,
  incoming: 0,
  remaining: 100,
}));

assert.deepEqual(
  readTaskProgressFinishPlan("plan-a", 20),
  { mode: "auto", rate: 20 },
  "a new plan follows the current pace with the default rate"
);
saveTaskProgressFinishPlan("plan-a", { mode: "custom", rate: 5 });
assert.deepEqual(readTaskProgressFinishPlan("plan-a"), {
  mode: "custom",
  rate: 5,
});
assert.deepEqual(events, ["plan-a"], "saving tells displays to refresh");

const auto = taskProgressFinishEstimate(
  { history, remaining: 100 },
  { mode: "auto", rate: 5 },
  today
);
assert.equal(
  auto.date,
  "2026-11-13",
  "4 completed a day finishes 100 in 25 days"
);
assert.equal(auto.manual, false);
const mine = taskProgressFinishEstimate(
  { history, remaining: 100 },
  { mode: "custom", rate: 10 },
  today
);
assert.equal(mine.date, "2026-10-29");
assert.equal(mine.assumesNoIncoming, true);
assert.equal(
  taskProgressFinishEstimate(
    { history, remaining: 0 },
    { mode: "auto", rate: 1 },
    today
  ).date,
  today
);
assert.equal(taskProgressDaysUntil("2026-10-29", today), 10);

const render = (element: React.ReactElement) =>
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(IntlProvider, { locale: "en", messages: {} }, element)
  );
const planner = render(
  React.createElement(TaskProgressForecast, {
    storageKey: "plan-a",
    history,
    remaining: 100,
  })
);
assert.match(planner, /Estimated finish/);
assert.match(planner, /aria-pressed="true">My pace</);
assert.match(planner, /<label[^>]*>My pace<\/label>/);
assert.match(planner, /items\/day/);
assert.match(planner, /Assumes no new items arrive/);
const label = render(
  React.createElement(TaskProgressFinishLabel, {
    storageKey: "plan-a",
    history,
    remaining: 100,
  })
);
assert.doesNotMatch(
  label,
  /Forecast basis|<input|<button/,
  "the label is read-only"
);
assert.equal(
  render(
    React.createElement(TaskProgressFinishLabel, {
      storageKey: "plan-a",
      history,
      remaining: 0,
    })
  ),
  "",
  "finished work shows no finish date"
);

const tracker = (id: string, remaining: number) => ({
  id,
  mode: "BACKLOG",
  goal: 0,
  completed_count: 10,
  current_count: remaining,
  history,
  status: "ACTIVE",
  started_on: "2026-10-01",
});
saveTaskProgressFinishPlan("task-progress-tracker-plan-slow", {
  mode: "custom",
  rate: 1,
});
assert.deepEqual(
  sortTaskProgressTrackers(
    [
      tracker("done", 0),
      tracker("slow", 20),
      tracker("big", 200),
      tracker("small", 8),
    ],
    "finish",
    today
  ).map((item) => item.id),
  ["small", "slow", "big", "done"],
  "estimated finish sorts soonest first using each tracker's saved plan"
);

Reflect.deleteProperty(globalThis, "localStorage");
Reflect.deleteProperty(globalThis, "window");
Reflect.deleteProperty(globalThis, "CustomEvent");
