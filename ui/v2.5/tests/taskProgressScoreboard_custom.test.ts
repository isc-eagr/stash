import assert from "node:assert/strict";
import { taskProgressCurrentGoalPeriods } from "../src/components/taskProgress_custom.ts";
import { taskProgressPeriodComparisons } from "../src/components/TaskProgress/taskProgressReports_custom.ts";
import {
  taskProgressGoalStreak,
  taskProgressNextMedal,
  taskProgressCompletionCloses,
} from "../src/components/TaskProgress/taskProgressScoreboard_custom.ts";

assert.deepEqual(taskProgressNextMedal(642, 860), {
  threshold: 75,
  label: "Gold",
  need: 3,
});
assert.deepEqual(
  taskProgressNextMedal(0, 3),
  { threshold: 25, label: "Bronze", need: 1 },
  "a medal always needs at least one item"
);
assert.equal(taskProgressNextMedal(10, 10), undefined, "every medal earned");
assert.equal(taskProgressNextMedal(0, 0), undefined, "nothing to track");

const day = (date: string, completed: number, goalPerDay = 5) => ({
  date,
  completed,
  incoming: 0,
  remaining: 100,
  goalPerDay,
});
assert.equal(
  taskProgressGoalStreak(
    [
      day("2026-10-15", 2),
      day("2026-10-16", 5),
      day("2026-10-17", 6),
      day("2026-10-18", 1),
    ],
    "2026-10-18"
  ),
  2,
  "an unmet today keeps the streak from earlier days"
);
assert.equal(
  taskProgressGoalStreak(
    [day("2026-10-16", 5), day("2026-10-17", 6), day("2026-10-18", 5)],
    "2026-10-18"
  ),
  3,
  "a met today extends the streak"
);
assert.equal(
  taskProgressGoalStreak(
    [day("2026-10-16", 5), day("2026-10-18", 5)],
    "2026-10-18"
  ),
  1,
  "a missed day breaks the streak"
);
assert.equal(
  taskProgressGoalStreak(
    [day("2026-10-17", 9, 0), day("2026-10-18", 9, 0)],
    "2026-10-18"
  ),
  0,
  "days without a goal never count"
);

const fortnights = taskProgressCompletionCloses(
  [
    {
      date: "2026-09-02",
      completed: 10,
      incoming: 0,
      remaining: 90,
      completedTotal: 10,
    },
    {
      date: "2026-09-29",
      completed: 40,
      incoming: 0,
      remaining: 50,
      completedTotal: 50,
    },
    {
      date: "2026-10-14",
      completed: 25,
      incoming: 0,
      remaining: 25,
      completedTotal: 75,
    },
  ],
  "2026-10-19",
  "fortnight"
);
assert.deepEqual(
  fortnights.map((point) => [point.date, Math.round(point.percent)]),
  [
    ["2026-09-02", 10],
    ["2026-09-13", 10],
    ["2026-09-27", 10],
    ["2026-10-11", 50],
    ["2026-10-19", 75],
  ],
  "every second week closes, ending with the running week, after the first day"
);
const months = taskProgressCompletionCloses(
  [
    {
      date: "2026-08-10",
      completed: 10,
      incoming: 0,
      remaining: 90,
      completedTotal: 10,
    },
    {
      date: "2026-09-20",
      completed: 40,
      incoming: 0,
      remaining: 50,
      completedTotal: 50,
    },
    {
      date: "2026-10-02",
      completed: 25,
      incoming: 0,
      remaining: 25,
      completedTotal: 75,
    },
  ],
  "2026-10-19",
  "month"
);
assert.deepEqual(
  months.map((point) => [point.date, Math.round(point.percent)]),
  [
    ["2026-08-10", 10],
    ["2026-08-31", 10],
    ["2026-09-30", 50],
    ["2026-10-19", 75],
  ],
  "monthly closes start on the first recorded day"
);
assert.equal(
  taskProgressCompletionCloses(
    [
      { date: "2026-01-05", completed: 1, incoming: 0, remaining: 9 },
      { date: "2026-10-19", completed: 1, incoming: 0, remaining: 8 },
    ],
    "2026-10-19",
    "month",
    3
  )[0].date,
  "2026-08-31",
  "long histories keep only the latest closes"
);

const year = taskProgressCurrentGoalPeriods(
  [day("2025-12-31", 9), day("2026-01-02", 4), day("2026-10-19", 3)],
  5,
  "2026-10-19"
).year;
assert.equal(year.start, "2026-01-01");
assert.equal(
  year.completed,
  7,
  "This year counts only the current calendar year"
);

const comparisons = taskProgressPeriodComparisons(
  [
    { date: "2025-03-01", completed: 6, incoming: 0, remaining: 50 },
    { date: "2025-11-01", completed: 9, incoming: 0, remaining: 41 },
    { date: "2026-02-01", completed: 4, incoming: 0, remaining: 37 },
  ],
  "2026-10-19"
);
assert.equal(comparisons.year.current.completed, 4);
assert.equal(
  comparisons.year.previous.completed,
  6,
  "last year is cut to the same elapsed days"
);
assert.equal(comparisons.year.label, "vs same point last year");

const past = taskProgressPeriodComparisons(
  [
    { date: "2026-10-12", completed: 3, incoming: 0, remaining: 20 },
    { date: "2026-10-13", completed: 5, incoming: 0, remaining: 15 },
  ],
  "2026-10-19",
  "2026-10-13"
);
assert.equal(
  past.day.current.completed,
  5,
  "comparisons can anchor on a past day"
);
assert.equal(past.day.previous.completed, 3);
assert.equal(past.day.label, "vs previous day");
assert.equal(past.week.current.completed, 8, "the anchor's whole week counts");
assert.equal(past.week.label, "vs last week");
