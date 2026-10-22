import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { TaskProgressMilestoneGrowth } from "../src/components/TaskProgress/TaskProgressMilestoneGrowth.tsx";
import { TaskProgressMilestoneLedger } from "../src/components/TaskProgress/TaskProgressMilestoneLedger.tsx";
import { TaskProgressContributions } from "../src/components/TaskProgress/TaskProgressContributions.tsx";
import { TaskProgressPeriodProgress } from "../src/components/TaskProgress/TaskProgressPeriodProgress.tsx";
import { progressToday } from "../src/components/TaskProgress/progressMath_custom.ts";

const history = [
  {
    date: progressToday(),
    completed: 4,
    incoming: 0,
    remaining: 6,
    baseline_count: 10,
    goal_per_day: 2,
  },
];
const milestone: React.ComponentProps<
  typeof TaskProgressMilestoneLedger
>["milestones"][number] = {
  id: "1",
  name: "Organize collection",
  version: 1,
  goal_per_day: 2,
  target_date: "2026-12-31",
  tracker_ids: ["tracker-1"],
  total_count: 10,
  completed_count: 4,
  current_count: 6,
  incoming_count: 0,
  history,
  item_counts: [{ item_type: "scene", count: 6 }],
  completed_item_counts: [{ item_type: "scene", count: 4 }],
  trackers: [
    {
      id: "tracker-1",
      title: "Organize scenes",
      description: "",
      tag_id: "1",
      tag_name: "Pending",
      goal: 10,
      goal_per_day: 2,
      position: 0,
      started_on: history[0].date,
      history_started_on: history[0].date,
      status: "ACTIVE",
      mode: "BACKLOG",
      version: 1,
      item_types: ["scene"],
      current_count: 6,
      completed_count: 4,
      incoming_count: 0,
      history,
      item_counts: [{ item_type: "scene", count: 6 }],
      completed_item_counts: [{ item_type: "scene", count: 4 }],
    },
  ],
};
const noop = () => {};
const render = (component: React.ReactElement) =>
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(IntlProvider, { locale: "en", messages: {} }, component)
  );
const ledger = (milestones = [milestone], trackers = milestone.trackers) =>
  render(
    React.createElement(TaskProgressMilestoneLedger, {
      milestones,
      trackers,
      busy: false,
      onDetails: noop,
      onEdit: noop,
      onOpenTracker: noop,
    })
  );
const markup = ledger();
assert.match(markup, /Organize collection/);
assert.match(
  markup,
  /progress-score-row milestone-score-row/,
  "milestone rows share the tracker row style"
);
assert.match(markup, />40\.00%</);
assert.match(
  markup,
  /progress-score-done"><strong>4<\/strong> done<\/span><span><strong>6<\/strong> left/,
  "done and left counts stand out"
);
assert.match(markup, /1 tracker · /);
assert.match(markup, /31\/12\/2026/);
assert.equal(
  (markup.match(/class="progress-medal-coin /g) ?? []).length,
  4,
  "milestone rows carry the medal bar"
);
assert.match(markup, /1 to Silver/);
for (const label of ["Today", "Week", "Month", "Year"]) {
  assert.match(markup, new RegExp(`<span>${label}</span>`));
}
assert.match(
  markup,
  /progress-period-tile progress-period-tile-selected"><div class="progress-period-tile-heading"><span>Week</,
  "Week is selected by default"
);
assert.match(markup, />This week</, "the period navigator names the period");
assert.match(
  markup,
  /aria-label="Next period"[^>]*disabled=""|disabled=""[^>]*aria-label="Next period"/
);
assert.match(markup, /aria-pressed="false">Moved only</);
assert.match(
  markup,
  /aria-expanded="false"[^>]*aria-label="Tracker contributions"/
);
assert.doesNotMatch(
  markup,
  /progress-forecast|milestone-subrow|NaN|Infinity/,
  "the planner lives in Details and contributions stay collapsed"
);
assert.match(
  markup,
  /progress-score-percent-change"[^>]*><span>0\.00%<\/span><span aria-hidden="true">→<\/span><strong>40\.00%<\/strong>/,
  "without earlier history the period opens at the first recorded day"
);
const roundedNegativeZero = render(
  React.createElement(TaskProgressPeriodProgress, {
    snapshot: {
      completed: 100,
      total: 10000,
      percent: 1,
      previousPercent: 1.004,
      netCompletedGain: 0,
    },
    history: [],
    periodLabel: "this week",
  })
);
assert.match(
  roundedNegativeZero,
  /progress-score-gain">0\.00%<\/strong> this week/,
  "period progress does not show a negative zero percentage"
);
assert.doesNotMatch(roundedNegativeZero, /progress-score-loss|-0\.00%/);

const empty = ledger([
  {
    ...milestone,
    tracker_ids: [],
    trackers: [],
    total_count: 0,
    completed_count: 0,
    current_count: 0,
    history: [],
  },
]);
assert.match(empty, /Add trackers to see/);
assert.match(empty, /Details/);
assert.match(empty, /aria-label="Edit"/);
assert.doesNotMatch(empty, /NaN|Infinity/);

// Moved only is remembered per browser and hides milestones that completed nothing.
const storage = new Map<string, string>([
  ["task-progress-milestones-moved-only", "true"],
]);
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});
const idleMilestone = {
  ...milestone,
  id: "2",
  name: "Idle milestone",
  history: [{ ...history[0], date: "2026-01-05" }],
};
const moved = ledger(
  [milestone, idleMilestone],
  [
    ...milestone.trackers,
    { ...milestone.trackers[0], id: "tracker-2", title: "Loose tracker" },
  ]
);
assert.match(moved, /aria-pressed="true">Moved only</);
assert.match(moved, /Organize collection/);
assert.doesNotMatch(
  moved,
  /Idle milestone/,
  "milestones that did not move are hidden"
);
assert.doesNotMatch(
  moved,
  /Trackers that moved|Loose tracker/,
  "Moved only filters milestones without a separate tracker list"
);
Reflect.deleteProperty(globalThis, "localStorage");

const lastMonth = new Date(`${progressToday()}T00:00:00Z`);
lastMonth.setUTCDate(0);
const grown = {
  ...milestone,
  history: [
    {
      date: lastMonth.toISOString().slice(0, 10),
      completed: 3,
      incoming: 0,
      remaining: 7,
      baseline_count: 10,
      goal_per_day: 2,
    },
    { ...history[0], completed: 1 },
  ],
};
const growth = render(
  React.createElement(TaskProgressMilestoneGrowth, {
    milestones: [grown, { ...grown, id: "2", name: "Second" }],
  })
);
assert.match(growth, /Growth over time/);
assert.equal(
  (growth.match(/<polyline/g) ?? []).length,
  2,
  "one line per milestone"
);
assert.match(growth, /stroke="#c0703f"/, "series colors follow list order");
assert.match(growth, /stroke="#2f9f7f"/);
assert.match(growth, /Organize collection <strong>40\.0%<\/strong>/);
assert.match(growth, /% complete every two weeks/);
assert.match(
  growth,
  /top:0%">50%<\/span>/,
  "the scale tops out just above the data so small growth stays visible"
);
assert.doesNotMatch(growth, />100%<\/span>|milestone-checkpoint-50"/);
assert.match(
  growth,
  /milestone-growth-medal milestone-checkpoint-25/,
  "medals appear on the day they were won"
);
assert.equal(
  render(React.createElement(TaskProgressMilestoneGrowth, { milestones: [] })),
  "",
  "no chart without milestone history"
);

const contributions = render(
  React.createElement(TaskProgressContributions, {
    trackers: milestone.trackers,
    range: "year",
    anchor: progressToday(),
    onOpenTracker: noop,
  })
);
assert.match(contributions, /Organize scenes/);
assert.equal(
  (contributions.match(/progress-score-row milestone-subrow/g) ?? []).length,
  1,
  "trackers render as nested scoreboard rows"
);
assert.match(
  contributions,
  /this year/,
  "the selected period drives contributions"
);
assert.match(contributions, /Previous close → current completion/);
assert.doesNotMatch(
  contributions,
  /progress-period-tile|>Details<|aria-label="Edit"/,
  "nested rows skip period cells and actions"
);
assert.doesNotMatch(contributions, /task-progress-history-chart-plot/);

const pastContributions = render(
  React.createElement(TaskProgressContributions, {
    trackers: milestone.trackers,
    range: "day",
    anchor: "2026-01-05",
    onOpenTracker: noop,
  })
);
assert.match(pastContributions, /No tracker completed anything in this period/);
assert.match(pastContributions, /1 trackers with no activity · selected day/);
