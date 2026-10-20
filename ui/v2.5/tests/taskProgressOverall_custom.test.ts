import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const overallSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressOverall.tsx",
    import.meta.url
  ),
  "utf8"
);
const modalSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressOverallModal.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.doesNotMatch(
  overallSource,
  /<TaskProgressHistoryChart/,
  "the Overall Progress card does not render its history chart inline"
);
assert.match(
  overallSource,
  /onClick=\{\(\) => setShowDetails\(true\)\}/,
  "the Overall Progress card exposes its history through a Details action"
);
assert.match(overallSource, /\{t\("Details"\)\}/);
assert.match(
  modalSource,
  /useTaskProgressOverallGoalUpdateMutation/,
  "the Overall items-per-day goal is edited in Details and persisted through the API"
);
assert.doesNotMatch(
  overallSource,
  /progress-overall-goal-form|useTaskProgressOverallGoalUpdateMutation/,
  "the Overall card keeps goal settings out of its summary"
);
assert.doesNotMatch(
  overallSource,
  /localStorage/,
  "the Overall goal is no longer browser-local"
);
assert.match(
  overallSource,
  /<TaskProgressPeriodTiles\s+variant="hero"\s+comparisons=/,
  "the Overall hero shows Today, This week, This month, and This year against the previous period"
);
assert.match(
  overallSource,
  /<TaskProgressMedalBar\s+large/,
  "the Overall hero puts the medals on its progress bar"
);
assert.match(
  overallSource,
  /taskProgressGoalStreak\(history, today\)/,
  "the Overall hero shows the daily-goal streak"
);
assert.doesNotMatch(
  overallSource,
  /<ProgressBar/,
  "the Overall Progress card no longer duplicates progress as a linear bar"
);
assert.match(
  modalSource,
  /<TaskProgressHistoryChart/,
  "the Overall Progress modal reuses the shared tracker history chart"
);
assert.match(modalSource, /size="xl"/);
assert.match(modalSource, /\{t\("Overall Progress"\)\}/);
assert.match(modalSource, /currentGoalPerDay=\{goalPerDay\}/);

assert.match(
  overallSource,
  /completedTotal: day\.completed_total \?\? undefined,/,
  "Overall period tiles receive the organized-scene snapshots"
);
assert.match(
  modalSource,
  /<TaskProgressGoalSummary[\s\S]*?completedTotal: day\.completed_total \?\? undefined,/,
  "Overall Details period percentages receive the organized-scene snapshots"
);
