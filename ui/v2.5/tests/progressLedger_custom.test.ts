import assert from "node:assert/strict";
import {
  progressLedgerForecast,
  progressLedgerSnapshot,
} from "../src/components/TaskProgress/progressLedger_custom.ts";
import { taskProgressReportPeriod } from "../src/components/TaskProgress/taskProgressReports_custom.ts";

const today = "2026-10-18";
const history = [
  {
    date: "2026-10-11",
    completed: 0,
    incoming: 0,
    remaining: 4177,
    completed_total: 280,
  },
  {
    date: "2026-10-12",
    completed: 44,
    incoming: 385,
    remaining: 4721,
    completed_total: 324,
    baseline_count: 5045,
  },
];
const period = taskProgressReportPeriod("week", today, today);
const snapshot = progressLedgerSnapshot(history, period, today, {
  completed: 324,
  remaining: 4722,
});
assert.equal(
  snapshot.previousPercent?.toFixed(2),
  "6.28",
  "previous percentage is the real prior close, with its own denominator"
);
assert.equal(snapshot.percent.toFixed(2), "6.42");
assert.equal(
  snapshot.total,
  5046,
  "current periods use live counts even when the last historical remaining count is stale"
);
assert.equal(snapshot.netCompletedGain, 44);
const library = progressLedgerSnapshot(
  [
    {
      date: "2026-10-11",
      completed: 0,
      incoming: 0,
      remaining: 28023,
      completed_total: 722,
    },
    {
      date: "2026-10-18",
      completed: 113,
      incoming: 0,
      remaining: 28022,
      completed_total: 736,
    },
  ],
  period,
  today
);
assert.equal(
  library.netCompletedGain,
  14,
  "the highlighted bar must not equate credited deletions with retained organized scenes"
);
const past = progressLedgerSnapshot(
  history,
  { start: "2026-10-12", end: "2026-10-12", through: "2026-10-12" },
  today,
  { completed: 999, remaining: 1 }
);
assert.equal(
  past.total,
  5045,
  "historical reports never leak today's live totals"
);
assert.equal(
  progressLedgerSnapshot([], period, today).previousPercent,
  undefined,
  "missing history is unknown, not zero"
);
assert.equal(progressLedgerSnapshot([], period, today).percent, 0);

// Tracking began this year: the year counts from the first recorded day.
const firstYear = progressLedgerSnapshot(
  [
    { date: "2026-09-07", completed: 4, incoming: 0, remaining: 96 },
    { date: "2026-10-01", completed: 6, incoming: 0, remaining: 90 },
  ],
  taskProgressReportPeriod("year", today, today),
  today,
  { completed: 10, remaining: 90 }
);
assert.equal(
  firstYear.previousPercent,
  0,
  "with no earlier history the period opens at the first day's opening close"
);
assert.equal(
  firstYear.netCompletedGain,
  10,
  "every completion since tracking began counts as this period's gain"
);
const organizedBefore = progressLedgerSnapshot(
  [
    {
      date: "2026-09-07",
      completed: 5,
      incoming: 0,
      remaining: 80,
      completed_total: 25,
    },
  ],
  taskProgressReportPeriod("year", today, today),
  today,
  { completed: 25, remaining: 80 }
);
assert.equal(
  organizedBefore.previousPercent?.toFixed(2),
  "19.05",
  "work finished before tracking began stays in the opening close"
);
assert.equal(organizedBefore.netCompletedGain, 5);

const regular = [
  { date: "2026-10-11", completed: 14, incoming: 7, remaining: 100 },
];
const forecast = progressLedgerForecast(regular, 100, today);
assert.equal(forecast.netRate, 1);
assert.equal(forecast.date, "2027-01-26");
assert.equal(forecast.assumesNoIncoming, false);
const growing = progressLedgerForecast(
  [{ ...regular[0], incoming: 21 }],
  100,
  today
);
assert.equal(growing.date, "2026-12-07");
assert.equal(
  growing.assumesNoIncoming,
  true,
  "growing scope falls back to a clearly labeled no-incoming plan"
);
assert.equal(
  progressLedgerForecast(regular, 100, today, "PAUSED").date,
  undefined
);
assert.equal(
  progressLedgerForecast([{ ...regular[0], completed: 0 }], 100, today).date,
  undefined
);
assert.equal(
  progressLedgerForecast([{ ...regular[0], date: today }], 100, today).date,
  undefined,
  "today's partial activity is excluded"
);
