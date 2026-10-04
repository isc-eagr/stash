import assert from "node:assert/strict";
import {
  createTaskProgressAchievementObserver,
  createTaskProgressAchievementWatcher,
  formatTaskProgressAchievement,
  taskProgressAchievementSnapshots,
} from "../src/components/TaskProgress/taskProgressAchievements_custom.ts";
import type { ITaskProgressAchievementSnapshot } from "../src/components/TaskProgress/taskProgressAchievements_custom.ts";

const snapshot = (
  percentage: number,
  overrides: Partial<ITaskProgressAchievementSnapshot> = {}
): ITaskProgressAchievementSnapshot => ({
  key: "tracker:1",
  name: "Organize scenes",
  kind: "Tracker",
  revision: "1",
  percentage,
  history: [],
  eligible: true,
  ...overrides,
});
const observe = createTaskProgressAchievementObserver();
assert.deepEqual(
  observe([snapshot(24.99)]),
  [],
  "loading establishes a quiet baseline"
);
const bronze = observe([snapshot(25)]);
assert.equal(bronze.length, 1);
assert.equal(bronze[0].tier, "Bronze");
assert.equal(bronze[0].name, "Organize scenes");
assert.deepEqual(
  observe([snapshot(25)]),
  [],
  "refreshing never repeats a medal"
);
assert.deepEqual(
  observe([snapshot(10)]),
  [],
  "incoming work can lower current progress"
);
assert.deepEqual(
  observe([snapshot(25)]),
  [],
  "re-crossing an earned medal is quiet"
);
const higherTiers = observe([snapshot(100)]);
assert.deepEqual(
  higherTiers.filter((item) => item.tier).map((item) => item.tier),
  ["Silver", "Gold", "Alpha Sapphire"]
);
assert.deepEqual(
  higherTiers.map((item) => item.threshold),
  [30, 40, 50, 60, 70, 75, 80, 90, 100],
  "larger jumps announce every newly crossed 10% step and preserve tier checkpoints"
);

const tenPercent = createTaskProgressAchievementObserver();
tenPercent([snapshot(0)]);
assert.deepEqual(
  tenPercent([snapshot(9.99)]),
  [],
  "trackers do not announce 5% steps"
);
const regular = tenPercent([snapshot(16.2)]);
assert.deepEqual(
  regular.map((item) => [item.threshold, item.tier]),
  [[10, undefined]],
  "ordinary checkpoints use the exact achieved percentage without a metallic tier"
);
assert.deepEqual(
  tenPercent([snapshot(19.99)]),
  [],
  "partial 10% steps do not announce early"
);
assert.deepEqual(
  tenPercent([snapshot(25)]).map((item) => [item.threshold, item.tier]),
  [
    [20, undefined],
    [25, "Bronze"],
  ],
  "25% still awards Bronze between regular 10% checkpoints"
);
tenPercent([snapshot(0)]);
assert.deepEqual(
  tenPercent([snapshot(25)]),
  [],
  "incoming work cannot repeat ordinary steps"
);

const milestones = createTaskProgressAchievementObserver();
assert.deepEqual(
  milestones([
    snapshot(24.99),
    snapshot(49.99, {
      key: "milestone:1",
      kind: "Milestone",
      name: "Finish backlog",
    }),
  ]),
  []
);
assert.deepEqual(
  milestones([
    snapshot(75),
    snapshot(50, {
      key: "milestone:1",
      kind: "Milestone",
      name: "Finish backlog",
    }),
  ]).map((item) => [item.kind, item.threshold]),
  [
    ["Tracker", 25],
    ["Tracker", 30],
    ["Tracker", 40],
    ["Tracker", 50],
    ["Tracker", 60],
    ["Tracker", 70],
    ["Tracker", 75],
    ["Milestone", 50],
  ],
  "one write can award every crossed tracker and milestone tier"
);

const historical = createTaskProgressAchievementObserver();
const oldHistory = [
  { date: "2026-09-01", completed: 75, incoming: 0, remaining: 25 },
];
historical([snapshot(10, { history: oldHistory })]);
assert.deepEqual(
  historical([snapshot(75, { history: oldHistory })]),
  [],
  "badges earned before incoming work lowered progress stay earned"
);
assert.equal(
  historical([snapshot(100, { history: oldHistory })]).find(
    (item) => item.threshold === 100
  )?.tier,
  "Alpha Sapphire"
);

const reset = createTaskProgressAchievementObserver();
reset([snapshot(10)]);
assert.deepEqual(
  reset([snapshot(75, { revision: "2" })]),
  [],
  "resets and membership edits establish a new baseline"
);
assert.equal(
  reset([snapshot(100, { revision: "2" })]).find(
    (item) => item.threshold === 100
  )?.tier,
  "Alpha Sapphire"
);
assert.deepEqual(
  reset([snapshot(100, { key: "tracker:new" })]),
  [],
  "creating a tracker never announces historical badges"
);
reset([]);
assert.deepEqual(
  reset([snapshot(100)]),
  [],
  "restoring a deleted tracker is quiet"
);

const inactive = createTaskProgressAchievementObserver();
inactive([snapshot(0, { eligible: false })]);
assert.deepEqual(
  inactive([snapshot(100, { eligible: false })]),
  [],
  "archived trackers and empty milestones cannot earn notifications"
);

const fixed = {
  id: "4",
  title: "Fixed",
  version: 3,
  status: "PAUSED",
  mode: "FIXED",
  goal: 8,
  current_count: 4,
  completed_count: 100,
  history: [
    {
      date: "2026-09-01",
      completed: 4,
      incoming: 0,
      remaining: 4,
      baseline_count: 8,
    },
  ],
} as Parameters<typeof taskProgressAchievementSnapshots>[0][number];
const member = { ...fixed, version: 2 };
const milestone = {
  id: "4",
  name: "Milestone",
  version: 1,
  trackers: [member],
  total_count: 8,
  completed_count: 4,
  history: fixed.history,
} as Parameters<typeof taskProgressAchievementSnapshots>[1][number];
const converted = taskProgressAchievementSnapshots([fixed], [milestone]);
assert.equal(
  converted[0].percentage,
  50,
  "fixed batches use completed membership, not event counts"
);
assert.equal(
  converted[0].eligible,
  true,
  "paused trackers still record achievements"
);
assert.equal(converted[0].history[0].baselineCount, 8);
assert.equal(converted[1].percentage, 50);
assert.notEqual(
  converted[0].key,
  converted[1].key,
  "tracker and milestone IDs have separate namespaces"
);
assert.notEqual(
  converted[1].revision,
  taskProgressAchievementSnapshots(
    [],
    [
      {
        ...milestone,
        trackers: [{ ...member, version: 3 }],
      },
    ]
  )[0].revision,
  "resetting a member also resets the milestone notification baseline"
);

let resolveLoad: (snapshots: ITaskProgressAchievementSnapshot[]) => void;
let loads = 0;
let shouldFail = false;
const delivered: number[] = [];
const watcher = createTaskProgressAchievementWatcher(
  () => {
    loads++;
    if (shouldFail) return Promise.reject(new Error("offline"));
    return new Promise((resolve) => {
      resolveLoad = resolve;
    });
  },
  (items) => delivered.push(...items.map((item) => item.threshold))
);
const first = watcher.refresh();
await watcher.refresh();
await watcher.refresh();
assert.equal(loads, 1, "concurrent writes share the active refresh");
resolveLoad!([snapshot(20)]);
await Promise.resolve();
assert.equal(loads, 2, "a write during loading schedules a follow-up refresh");
resolveLoad!([snapshot(50)]);
await first;
assert.deepEqual(delivered, [25, 30, 40, 50]);
shouldFail = true;
await watcher.refresh();
shouldFail = false;
const retry = watcher.refresh();
resolveLoad!([snapshot(75)]);
await retry;
assert.deepEqual(
  delivered,
  [25, 30, 40, 50, 60, 70, 75],
  "failed refreshes preserve the last successful baseline"
);
const last = watcher.refresh();
watcher.dispose();
resolveLoad!([snapshot(100)]);
await last;
await watcher.refresh();
assert.equal(loads, 5);
assert.deepEqual(
  delivered,
  [25, 30, 40, 50, 60, 70, 75],
  "unmounting cancels delivery and future requests"
);

for (const achievement of [...regular, ...bronze, ...higherTiers]) {
  const message = formatTaskProgressAchievement(achievement);
  assert.match(
    message,
    new RegExp(`${achievement.threshold}%`),
    "each toast shows the achieved percentage"
  );
  if (achievement.tier) {
    assert.match(
      message,
      new RegExp(`${achievement.tier} · ${achievement.threshold}% achieved`)
    );
  } else {
    assert.match(message, new RegExp(`^${achievement.threshold}% achieved`));
  }
  assert.match(message, /Organize scenes/);
}

const regularMilestone = createTaskProgressAchievementObserver();
const milestoneSnapshot = (percentage: number) =>
  snapshot(percentage, {
    key: "milestone:2",
    kind: "Milestone",
    name: "My milestone",
  });
regularMilestone([milestoneSnapshot(0)]);
assert.deepEqual(
  regularMilestone([milestoneSnapshot(4.99)]),
  [],
  "milestones do not announce partial 5% steps"
);
const milestoneStep = regularMilestone([milestoneSnapshot(5)]);
assert.equal(milestoneStep.length, 1);
assert.equal(milestoneStep[0].threshold, 5);
assert.equal(milestoneStep[0].name, "My milestone");
assert.equal(milestoneStep[0].kind, "Milestone");
assert.equal(milestoneStep[0].tier, undefined);
assert.equal(
  formatTaskProgressAchievement(milestoneStep[0]),
  "5% achieved · My milestone"
);
assert.deepEqual(
  regularMilestone([milestoneSnapshot(9.99)]),
  [],
  "milestones wait for the next complete 5% step"
);
assert.deepEqual(
  regularMilestone([milestoneSnapshot(100)]).map((item) => [
    item.threshold,
    item.tier,
  ]),
  [
    [10, undefined],
    [15, undefined],
    [20, undefined],
    [25, "Bronze"],
    [30, undefined],
    [35, undefined],
    [40, undefined],
    [45, undefined],
    [50, "Silver"],
    [55, undefined],
    [60, undefined],
    [65, undefined],
    [70, undefined],
    [75, "Gold"],
    [80, undefined],
    [85, undefined],
    [90, undefined],
    [95, undefined],
    [100, "Alpha Sapphire"],
  ],
  "milestone jumps announce each 5% step with one toast at tier checkpoints"
);
assert.deepEqual(
  regularMilestone([milestoneSnapshot(100)]),
  [],
  "milestone 5% steps do not repeat on refresh"
);
assert.equal(
  formatTaskProgressAchievement(
    bronze[0],
    (label) =>
      ({
        Bronze: "Bronce",
        achieved: "alcanzado",
      }[label] ?? label)
  ),
  "Bronce · 25% alcanzado · Organize scenes"
);
