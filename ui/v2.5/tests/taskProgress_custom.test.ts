import assert from "node:assert/strict";

import {
  aggregateTaskProgressHistorySeries,
  buildTaskProgressHistorySeries,
  filterTaskProgressHistoryActivityPoints,
  formatTaskProgressDate,
  taskProgressISOToLocalDate,
  taskProgressLocalDateToISO,
  taskProgressCurrentGoalPeriods,
  taskProgressHistoryPercentages,
} from "../src/components/taskProgress_custom.ts";

const goalHistory = buildTaskProgressHistorySeries(
  [
    {
      date: "2026-09-07",
      completed: 2,
      incoming: 0,
      remaining: 20,
      goalPerDay: 2,
    },
    {
      date: "2026-09-10",
      completed: 4,
      incoming: 0,
      remaining: 16,
      goalPerDay: 4,
    },
  ],
  "all",
  "2026-09-13"
);
assert.deepEqual(
  goalHistory.map((point) => point.goalPerDay),
  [2, 2, 2, 4, 4, 4, 4],
  "daily history carries each goal only until its effective replacement"
);

const weeklyGoalHistory = aggregateTaskProgressHistorySeries(
  goalHistory,
  "week"
);
assert.equal(weeklyGoalHistory.length, 1);
assert.equal(weeklyGoalHistory[0].completed, 6);
assert.equal(
  weeklyGoalHistory[0].goalPerDay,
  22,
  "weekly graph goals sum the daily goals that applied during the week"
);

const monthlyGoalHistory = aggregateTaskProgressHistorySeries(
  goalHistory,
  "month"
);
assert.equal(monthlyGoalHistory.length, 1);
assert.equal(monthlyGoalHistory[0].completed, 6);
assert.equal(monthlyGoalHistory[0].goalPerDay, 22);

const currentGoals = taskProgressCurrentGoalPeriods(
  goalHistory,
  4,
  "2026-09-10"
);
assert.deepEqual(currentGoals.day, {
  completed: 4,
  goal: 4,
  start: "2026-09-10",
  end: "2026-09-10",
});
assert.deepEqual(
  { completed: currentGoals.week.completed, goal: currentGoals.week.goal },
  { completed: 6, goal: 10 },
  "the current weekly target preserves old daily goals and counts only elapsed days"
);
assert.equal(
  currentGoals.month.goal,
  10,
  "the current monthly target counts only elapsed goal days"
);
assert.equal(currentGoals.week.start, "2026-09-07", "weeks start on Monday");
assert.equal(currentGoals.week.end, "2026-09-10");

const elapsedWeek = taskProgressCurrentGoalPeriods(
  [
    {
      date: "2026-09-07",
      completed: 7,
      incoming: 0,
      remaining: 100,
      goalPerDay: 10,
    },
    {
      date: "2026-09-11",
      completed: 28,
      incoming: 0,
      remaining: 72,
      goalPerDay: 10,
    },
  ],
  10,
  "2026-09-11"
);
assert.deepEqual(
  { completed: elapsedWeek.week.completed, goal: elapsedWeek.week.goal },
  { completed: 35, goal: 50 },
  "Friday compares weekly completion with Monday through Friday goals"
);

const elapsedGoals = taskProgressCurrentGoalPeriods(
  [
    {
      date: "2026-09-01",
      completed: 7,
      incoming: 0,
      remaining: 100,
      goalPerDay: 10,
    },
    {
      date: "2026-09-05",
      completed: 28,
      incoming: 0,
      remaining: 72,
      goalPerDay: 10,
    },
  ],
  10,
  "2026-09-05"
);
assert.deepEqual(
  {
    completed: elapsedGoals.month.completed,
    goal: elapsedGoals.month.goal,
  },
  { completed: 35, goal: 50 },
  "month progress compares completion with only its five elapsed goal days"
);

const partialWeek = aggregateTaskProgressHistorySeries(
  buildTaskProgressHistorySeries(
    [
      {
        date: "2026-09-07",
        completed: 2,
        incoming: 0,
        remaining: 20,
        goalPerDay: 2,
      },
      {
        date: "2026-09-10",
        completed: 4,
        incoming: 0,
        remaining: 16,
        goalPerDay: 4,
      },
    ],
    "all",
    "2026-09-10"
  ),
  "week"
);
assert.equal(
  partialWeek[0].goalPerDay,
  10,
  "the current weekly graph bar uses only elapsed daily goals"
);

assert.equal(
  formatTaskProgressDate("2026-07-09"),
  "09/07/2026",
  "stored task dates display in DD/MM/YYYY format"
);

assert.equal(
  formatTaskProgressDate(new Date(2026, 0, 2)),
  "02/01/2026",
  "completion estimates display in DD/MM/YYYY format"
);
assert.equal(
  taskProgressLocalDateToISO(taskProgressISOToLocalDate("2026-09-12")),
  "2026-09-12",
  "date pickers preserve the selected calendar day without a timezone shift"
);

const history = buildTaskProgressHistorySeries(
  [
    {
      date: "2026-09-01",
      completed: 1,
      incoming: 0,
      remaining: 9,
      baselineCount: 10,
    },
    {
      date: "2026-09-03",
      completed: 2,
      incoming: 0,
      remaining: 7,
    },
    {
      date: "2026-09-05",
      completed: 0,
      incoming: 1,
      remaining: 8,
    },
  ],
  "all",
  "2026-09-07"
);

assert.deepEqual(
  history.map(({ date, completed, incoming, remaining }) => ({
    date,
    completed,
    incoming,
    remaining,
  })),
  [
    { date: "2026-09-01", completed: 1, incoming: 0, remaining: 9 },
    { date: "2026-09-02", completed: 0, incoming: 0, remaining: 9 },
    { date: "2026-09-03", completed: 2, incoming: 0, remaining: 7 },
    { date: "2026-09-04", completed: 0, incoming: 0, remaining: 7 },
    { date: "2026-09-05", completed: 0, incoming: 1, remaining: 8 },
    { date: "2026-09-06", completed: 0, incoming: 0, remaining: 8 },
    { date: "2026-09-07", completed: 0, incoming: 0, remaining: 8 },
  ],
  "history fills missing calendar days and carries the remaining count"
);

assert.equal(
  history.at(-1)?.completedAverage,
  3 / 7,
  "the completion trend uses a trailing seven-calendar-day average"
);

assert.deepEqual(
  history.map((entry) => entry.cumulativeCompleted),
  [1, 1, 3, 3, 3, 3, 3],
  "cumulative completions include completed work from every visible day"
);

assert.equal(
  history[0].baselineCount,
  10,
  "baseline markers remain attached to their recorded calendar day"
);

assert.deepEqual(
  buildTaskProgressHistorySeries(history, 7, "2026-09-10").map(
    (entry) => entry.date
  ),
  [
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
  ],
  "a seven-day view remains bounded to the latest seven calendar days"
);

const thirtyDayHistory = buildTaskProgressHistorySeries(
  history,
  30,
  "2026-10-15"
);
assert.equal(
  thirtyDayHistory.length,
  30,
  "the thirty-day view contains thirty inclusive calendar days"
);
assert.equal(thirtyDayHistory[0].date, "2026-09-16");
assert.equal(thirtyDayHistory.at(-1)?.date, "2026-10-15");
assert.equal(
  thirtyDayHistory[0].cumulativeCompleted,
  3,
  "a bounded view retains completions recorded before its first visible day"
);

assert.deepEqual(
  buildTaskProgressHistorySeries(
    [
      { date: "2026-09-07", completed: 1, incoming: 2, remaining: 11 },
      { date: "2026-09-07", completed: 3, incoming: 4, remaining: 12 },
      { date: "invalid", completed: 100, incoming: 100, remaining: 100 },
      { date: "2026-09-08", completed: 100, incoming: 100, remaining: 100 },
    ],
    "all",
    "2026-09-07"
  )[0],
  {
    date: "2026-09-07",
    completed: 4,
    incoming: 6,
    added: 0,
    removed: 0,
    remaining: 12,
    baselineCount: undefined,
    completedAverage: 4,
    cumulativeCompleted: 4,
  },
  "same-day rows are combined while invalid and future rows are ignored"
);

assert.deepEqual(
  filterTaskProgressHistoryActivityPoints([
    {
      date: "2026-09-07",
      completed: 0,
      incoming: 0,
      remaining: 4,
      completedAverage: 0,
      cumulativeCompleted: 0,
    },
    {
      date: "2026-09-08",
      completed: 2,
      incoming: 0,
      remaining: 2,
      completedAverage: 1,
      cumulativeCompleted: 2,
    },
    {
      date: "2026-09-09",
      completed: 0,
      incoming: 0,
      remaining: 2,
      baselineCount: 2,
      completedAverage: 0,
      cumulativeCompleted: 2,
    },
  ]).map((point) => point.date),
  ["2026-09-08"],
  "daily data omits inactive zero days"
);

const historyPercentages = taskProgressHistoryPercentages({
  completed: 27,
  incoming: 0,
  remaining: 803,
  cumulativeCompleted: 197,
});
assert.equal(historyPercentages.completedPercentage, 19.7);
assert.equal(historyPercentages.remainingPercentage, 80.3);
assert.ok(
  Math.abs(historyPercentages.periodProgressPercentage - 2.7) < 0.000001,
  "period progress is the percentage-point change from the previous bucket"
);

const incomingPercentages = taskProgressHistoryPercentages({
  completed: 0,
  incoming: 10,
  remaining: 90,
  cumulativeCompleted: 10,
});
assert.equal(incomingPercentages.completedPercentage, 10);
assert.equal(incomingPercentages.remainingPercentage, 90);
assert.ok(
  Math.abs(incomingPercentages.periodProgressPercentage + 1.1111111111) <
    0.000001,
  "incoming work can reduce the tracker completion percentage"
);

const scopeHistory = buildTaskProgressHistorySeries(
  [
    { date: "2026-10-12", completed: 1, incoming: 0, remaining: 30 },
    {
      date: "2026-10-13",
      completed: 0,
      incoming: 0,
      added: 61,
      removed: 203,
      remaining: 0,
    },
    { date: "2026-10-14", completed: 0, incoming: 0, remaining: 0 },
  ],
  "all",
  "2026-10-14"
);
assert.deepEqual(
  scopeHistory.map((point) => [point.added, point.removed]),
  [
    [0, 0],
    [61, 203],
    [0, 0],
  ],
  "scope changes stay on their recorded day"
);
assert.deepEqual(
  filterTaskProgressHistoryActivityPoints(scopeHistory).map(
    (point) => point.date
  ),
  ["2026-10-12", "2026-10-13"],
  "days with only scope changes still appear in the daily data"
);
const scopeWeek = aggregateTaskProgressHistorySeries(scopeHistory, "week");
assert.equal(scopeWeek[0].added, 61, "weekly totals sum added work");
assert.equal(scopeWeek[0].removed, 203, "weekly totals sum removed work");
assert.equal(
  taskProgressHistoryPercentages(scopeHistory[1]).periodProgressPercentage,
  0,
  "scope changes are not reported as completion progress"
);

const snapshotHistory = buildTaskProgressHistorySeries(
  [
    {
      date: "2026-10-15",
      completed: 0,
      incoming: 0,
      remaining: 90,
      completedTotal: 10,
    },
    // Two pending deletions earn completion without becoming organized.
    {
      date: "2026-10-16",
      completed: 5,
      incoming: 0,
      remaining: 85,
      completedTotal: 13,
    },
  ],
  "all",
  "2026-10-17"
);
assert.deepEqual(
  snapshotHistory.map((point) => point.cumulativeCompleted),
  [10, 13, 13],
  "snapshots include work finished before tracking and carry forward"
);
const snapshotPercentages = taskProgressHistoryPercentages(snapshotHistory[1]);
assert.ok(
  Math.abs(snapshotPercentages.completedPercentage - (13 / 98) * 100) <
    0.000001,
  "cumulative percentage matches finished over finished plus remaining"
);
assert.ok(
  Math.abs(
    snapshotPercentages.periodProgressPercentage - (13 / 98 - 0.1) * 100
  ) < 0.000001,
  "period progress compares with the prior day's recorded close"
);
assert.equal(
  taskProgressHistoryPercentages(snapshotHistory[2]).periodProgressPercentage,
  0,
  "quiet days keep the prior close"
);
const snapshotWeek = aggregateTaskProgressHistorySeries(
  snapshotHistory,
  "week"
);
assert.ok(
  Math.abs(
    taskProgressHistoryPercentages(snapshotWeek[0]).periodProgressPercentage -
      (13 / 98 - 0.1) * 100
  ) < 0.000001,
  "weekly progress starts from the first day's opening close"
);

const overallPeriodHistory = [
  {
    date: "2026-09-30",
    completed: 0,
    incoming: 0,
    remaining: 60,
    completedTotal: 40,
  },
  {
    date: "2026-10-11",
    completed: 5,
    incoming: 0,
    remaining: 55,
    completedTotal: 45,
  },
  {
    date: "2026-10-12",
    completed: 4, // Two organized scenes and two pending deletions.
    incoming: 0,
    remaining: 51,
    completedTotal: 47,
  },
  {
    date: "2026-10-17",
    completed: 3, // One organized scene and two pending deletions.
    incoming: 0,
    remaining: 48,
    completedTotal: 48,
  },
];
const overallGoals = taskProgressCurrentGoalPeriods(
  overallPeriodHistory,
  null,
  "2026-10-17"
);
assert.deepEqual(
  [
    overallGoals.day.completed,
    overallGoals.week.completed,
    overallGoals.month.completed,
  ],
  [3, 7, 12],
  "deletions still earn goal completion credit independently of organized percentages"
);
