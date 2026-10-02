import assert from "node:assert/strict";
import {
  activeTaskProgressReportItems,
  boundedTaskProgressReportAnchor,
  firstTaskProgressReportActivity,
  previousTaskProgressReportPeriod,
  shiftTaskProgressReportPeriod,
  taskProgressActivityLevel,
  taskProgressPeriodComparisons,
  taskProgressReportDays,
  taskProgressReportMonths,
  taskProgressReportPeriod,
  taskProgressReportRow,
  taskProgressReportWeeks,
} from "../src/components/TaskProgress/taskProgressReports_custom.ts";
import type { ITaskProgressReportHistoryDay } from "../src/components/TaskProgress/taskProgressReports_custom.ts";

const today = "2026-09-24";
assert.deepEqual(taskProgressReportPeriod("week", today, today), {
  start: "2026-09-21",
  end: "2026-09-27",
  through: today,
});
assert.deepEqual(taskProgressReportPeriod("month", "2026-08-17", today), {
  start: "2026-08-01",
  end: "2026-08-31",
  through: "2026-08-31",
});
assert.deepEqual(taskProgressReportPeriod("year", today, today), {
  start: "2026-01-01",
  end: "2026-12-31",
  through: today,
});
assert.equal(
  shiftTaskProgressReportPeriod("week", "2026-01-01", -1),
  "2025-12-25"
);
assert.equal(
  shiftTaskProgressReportPeriod("month", "2026-03-31", -1),
  "2026-02-01"
);
assert.equal(
  shiftTaskProgressReportPeriod("year", "2026-09-24", -1),
  "2025-01-01"
);
assert.deepEqual(
  activeTaskProgressReportItems([
    { name: "Tracker B", completed: 2 },
    { name: "Idle", completed: 0 },
    { name: "Tracker A", completed: 9 },
  ]).map((item) => item.name),
  ["Tracker A", "Tracker B"],
  "each report section filters idle rows and sorts by period completions"
);
assert.equal(
  firstTaskProgressReportActivity([
    [
      {
        date: "2026-08-01",
        completed: 0,
        incoming: 0,
        remaining: 10,
      },
      {
        date: "2026-09-17",
        completed: 2,
        incoming: 0,
        remaining: 8,
      },
    ],
    [
      {
        date: "2026-09-12",
        completed: 0,
        incoming: 1,
        remaining: 11,
      },
    ],
  ]),
  "2026-09-12",
  "baseline dates do not extend the report selector before recorded activity"
);
assert.equal(firstTaskProgressReportActivity([[]]), undefined);
assert.equal(
  boundedTaskProgressReportAnchor("week", "2026-09-01", "2026-09-12", today),
  "2026-09-12"
);
assert.equal(
  boundedTaskProgressReportAnchor("month", "2027-01-01", "2026-09-12", today),
  today
);
assert.equal(
  boundedTaskProgressReportAnchor("year", "2025-01-01", "2026-09-12", today),
  "2026-09-12"
);

const history: ITaskProgressReportHistoryDay[] = [
  {
    date: "2026-09-14",
    completed: 5,
    incoming: 0,
    remaining: 95,
    baseline_count: 100,
    goal_per_day: 10,
  },
  {
    date: "2026-09-17",
    completed: 10,
    incoming: 0,
    remaining: 85,
    goal_per_day: 20,
  },
  {
    date: "2026-09-20",
    completed: 30,
    incoming: 0,
    remaining: 55,
    goal_per_day: 20,
  },
  {
    date: "2026-09-21",
    completed: 20,
    incoming: 0,
    remaining: 35,
    goal_per_day: 20,
  },
];
const pastWeek = taskProgressReportRow(
  history,
  taskProgressReportPeriod("week", "2026-09-16", today),
  today
);
assert.deepEqual(
  {
    completed: pastWeek.completed,
    totalCompleted: pastWeek.totalCompleted,
    expected: pastWeek.expected,
    goalDaysMet: pastWeek.goalDaysMet,
    goalDays: pastWeek.goalDays,
  },
  {
    completed: 45,
    totalCompleted: 45,
    expected: 110,
    goalDaysMet: 1,
    goalDays: 7,
  },
  "a past week carries effective daily goals through quiet days"
);
assert.ok(Math.abs(pastWeek.advanced - 45) < 0.001);

const currentWeek = taskProgressReportRow(
  history,
  taskProgressReportPeriod("week", today, today),
  today
);
assert.deepEqual(
  {
    completed: currentWeek.completed,
    totalCompleted: currentWeek.totalCompleted,
    expected: currentWeek.expected,
    goalDaysMet: currentWeek.goalDaysMet,
    goalDays: currentWeek.goalDays,
  },
  {
    completed: 20,
    totalCompleted: 65,
    expected: 80,
    goalDaysMet: 1,
    goalDays: 4,
  },
  "current reports count elapsed dates and retain the all-time completed count"
);
assert.ok(Math.abs(currentWeek.advanced - 20) < 0.001);

const currentYear = taskProgressReportRow(
  history,
  taskProgressReportPeriod("year", today, today),
  today
);
assert.equal(currentYear.completed, 65);
assert.equal(currentYear.expected, 190);
assert.equal(currentYear.goalDays, 11);
assert.ok(Math.abs(currentYear.advanced - 65) < 0.001);

const noGoal = taskProgressReportRow(
  [
    {
      date: "2026-09-22",
      completed: 2,
      incoming: 0,
      remaining: 8,
      baseline_count: 10,
      goal_per_day: null,
    },
  ],
  taskProgressReportPeriod("week", today, today),
  today
);
assert.equal(noGoal.completed, 2);
assert.equal(noGoal.goalDays, 0);
assert.equal(noGoal.expected, 0);
assert.ok(Math.abs(noGoal.advanced - 20) < 0.001);

const incoming = taskProgressReportRow(
  [
    {
      date: "2026-09-21",
      completed: 0,
      incoming: 0,
      remaining: 10,
      baseline_count: 10,
      goal_per_day: 2,
    },
    {
      date: "2026-09-22",
      completed: 1,
      incoming: 5,
      remaining: 14,
      goal_per_day: 2,
    },
  ],
  taskProgressReportPeriod("week", today, today),
  today
);
assert.equal(incoming.completed, 1);
assert.ok(incoming.advanced > 0);

assert.deepEqual(
  previousTaskProgressReportPeriod(
    "week",
    taskProgressReportPeriod("week", today, today),
    today
  ),
  { start: "2026-09-14", end: "2026-09-20", through: "2026-09-17" },
  "a running week compares against the same elapsed days of last week"
);
assert.deepEqual(
  previousTaskProgressReportPeriod(
    "month",
    taskProgressReportPeriod("month", "2026-08-17", today),
    today
  ),
  { start: "2026-07-01", end: "2026-07-31", through: "2026-07-31" },
  "a finished month compares against the whole previous month"
);
assert.equal(
  previousTaskProgressReportPeriod(
    "month",
    taskProgressReportPeriod("month", "2026-03-30", "2026-03-30"),
    "2026-03-30"
  ).through,
  "2026-02-28",
  "the comparison window never runs past a shorter previous month"
);
assert.deepEqual(
  [pastWeek.activeDays, pastWeek.elapsedDays],
  [3, 7],
  "active days count days with completions"
);
assert.deepEqual([currentWeek.activeDays, currentWeek.elapsedDays], [1, 4]);

const weekDays = taskProgressReportDays(
  history,
  taskProgressReportPeriod("week", today, today),
  today
);
assert.equal(weekDays.length, 7);
assert.deepEqual(weekDays[0], {
  date: "2026-09-21",
  completed: 20,
  goal: 20,
  future: false,
});
assert.equal(weekDays[4].future, true, "days after today are future");
assert.equal(
  taskProgressReportMonths(
    taskProgressReportDays(
      history,
      taskProgressReportPeriod("year", today, today),
      today
    )
  )[8],
  65
);
const monthWeeks = taskProgressReportWeeks(
  taskProgressReportDays(
    history,
    taskProgressReportPeriod("month", today, today),
    today
  )
);
assert.equal(monthWeeks.length, 5);
assert.equal(monthWeeks[0][0], undefined, "weeks start on Monday");
assert.equal(monthWeeks[0][1]?.date, "2026-09-01");
assert.deepEqual(
  [0, 1, 5, 6, 10].map((completed) =>
    taskProgressActivityLevel({ completed, goal: 0 }, 10)
  ),
  [0, 1, 2, 3, 4],
  "days without a goal scale against the busiest day"
);
assert.deepEqual(
  [1, 3, 4, 50].map((completed) =>
    taskProgressActivityLevel({ completed, goal: 4 }, 50)
  ),
  [1, 3, 4, 4],
  "days with a goal scale against it, so one huge day does not pale the rest"
);

const comparisons = taskProgressPeriodComparisons(
  [
    { date: "2026-08-31", completed: 0, incoming: 0, remaining: 20 },
    { date: "2026-09-21", completed: 4, incoming: 0, remaining: 16 },
    { date: "2026-09-22", completed: 2, incoming: 0, remaining: 14 },
    { date: "2026-09-23", completed: 4, incoming: 0, remaining: 10 },
  ],
  "2026-09-23"
);
assert.deepEqual(
  (["day", "week", "month"] as const).map((key) => [
    comparisons[key].current.completed,
    comparisons[key].current.advanced,
    comparisons[key].previous.completed,
    comparisons[key].previous.advanced,
    comparisons[key].label,
  ]),
  [
    [4, 20, 2, 10, "vs yesterday"],
    [10, 50, 0, 0, "vs same point last week"],
    [10, 50, 0, 0, "vs same point last month"],
  ],
  "today compares with yesterday; running weeks and months use the same elapsed days"
);
assert.deepEqual(
  [
    taskProgressPeriodComparisons([], "2026-09-23").day.current.completed,
    taskProgressPeriodComparisons([], "2026-09-23").day.current.advanced,
  ],
  [0, 0]
);
