import assert from "node:assert/strict";
import {
  milestoneContributionHeaders,
  milestoneContributionRows,
} from "../src/components/TaskProgress/milestoneContributions_custom.ts";

type Tracker = Parameters<typeof milestoneContributionRows>[0][number];
const tracker = (id: string, counts: number[]): Tracker =>
  ({
    id,
    title: id,
    mode: "BACKLOG",
    completed_count: counts.reduce((sum, count) => sum + count, 0),
    current_count: 50,
    history: ["2026-09-01", "2026-09-21", "2026-09-23"].map((date, index) => ({
      date,
      completed: counts[index],
      incoming: 0,
      remaining: 50,
      baseline_count: 100,
    })),
  } as Tracker);
const trackers = [
  tracker("A", [10, 6, 3]),
  tracker("B", [10, 0, 1]),
  tracker("Idle", [0, 0, 0]),
];

for (const [period, completed, shares, label] of [
  ["day", [3, 1, 0], [75, 25, 0], "today"],
  ["week", [9, 1, 0], [90, 10, 0], "this week"],
  ["month", [19, 11, 0], [190 / 3, 110 / 3, 0], "this month"],
] as const) {
  const rows = milestoneContributionRows(trackers, period, "2026-09-23");
  assert.deepEqual(
    rows.map((row) => row.values.periodCompleted),
    completed
  );
  rows.forEach((row, index) => {
    assert.ok(Math.abs(row.values.share - shares[index]) < 0.000001);
    assert.equal(row.values.completed, trackers[index].completed_count);
    assert.equal(row.values.periodPercent, row.comparison.current.advanced);
  });
  assert.deepEqual(
    milestoneContributionHeaders(period).map((header) => header.label),
    [
      "Tracker",
      "Completed",
      "Tracker completed (%)",
      `Completed ${label}`,
      `Completion change ${label}`,
      `Share of ${period} completions (%)`,
    ],
    "only the selected period appears in columns and mobile sort options"
  );
  assert.deepEqual(
    milestoneContributionHeaders(period).map((header) => header.key),
    [
      "title",
      "completed",
      "percent",
      "periodCompleted",
      "periodPercent",
      "share",
    ],
    "sort keys remain visible and follow the period when switching"
  );
}

assert.deepEqual(milestoneContributionRows([], "day", "2026-09-23"), []);
assert.equal(
  milestoneContributionRows([trackers[2]], "week", "2026-09-23")[0].values
    .share,
  0,
  "a period with no completions shows zero rather than NaN"
);
const fixed = { ...trackers[0], mode: "FIXED", goal: 70 } as Tracker;
assert.equal(
  milestoneContributionRows([fixed], "day", "2026-09-23")[0].values.completed,
  20,
  "fixed batches retain their cumulative completed calculation"
);

console.log("Milestone contribution period and share tests passed.");
