import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { TaskProgressReportActivity } from "../src/components/TaskProgress/TaskProgressReportActivity.tsx";
import type {
  ITaskProgressReportDay,
  TaskProgressReportRange,
} from "../src/components/TaskProgress/taskProgressReports_custom.ts";
import { taskProgressTrendGeometry } from "../src/components/TaskProgress/taskProgressTrend_custom.ts";

const renderActivity = (
  range: TaskProgressReportRange,
  days: readonly ITaskProgressReportDay[]
) =>
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      React.createElement(TaskProgressReportActivity, { range, days })
    )
  );

const days: ITaskProgressReportDay[] = [0, 25, 50, 80, 100, 101].map(
  (completed, index) => ({
    date: `2026-09-${21 + index}`,
    completed,
    goal: 100,
    future: false,
  })
);
const colors = ["red", "red", "orange", "yellow", "green", "sapphire"];
const barColors = (markup: string) =>
  [
    ...markup.matchAll(
      /progress-report-bar-track"><span(?: class="([^"]*)")?/g
    ),
  ].map((match) => match[1]);

assert.deepEqual(
  barColors(renderActivity("week", days)),
  colors.map((color) => `progress-report-goal-${color}`),
  "daily bars use the same goal thresholds as tracker cards, including blue above goal"
);

for (const range of ["month", "year"] as const) {
  const markup = renderActivity(range, days);
  days.forEach((day, index) => {
    assert.match(
      markup,
      new RegExp(
        `class="progress-report-goal-${
          colors[index]
        }"[^>]*><span[^>]*aria-label="${21 + index}/09/2026:`
      ),
      `${range} cells color each day by its own goal achievement`
    );
  });
  assert.match(markup, /100 completed \/ 100 \(100%\)/);
  assert.match(markup, /Daily goal/);

  const noGoalMarkup = renderActivity(
    range,
    days.map((day) => ({ ...day, goal: 0 }))
  );
  assert.doesNotMatch(noGoalMarkup, /progress-report-goal-/);
  assert.match(noGoalMarkup, /progress-report-heat-4/);
  assert.match(noGoalMarkup, /Less/);
  assert.match(noGoalMarkup, /More/);
}
assert.deepEqual(
  barColors(
    renderActivity(
      "week",
      days.map((day) => ({ ...day, goal: 0 }))
    )
  ),
  days.map(() => undefined),
  "bars without a goal keep their default green fill"
);

const mixedDays = [
  { date: "2026-09-21", completed: 4, goal: 8, future: false },
  { date: "2026-09-22", completed: 4, goal: 4, future: false },
  { date: "2026-09-23", completed: 4, goal: 0, future: false },
  { date: "2026-09-24", completed: 0, goal: 4, future: true },
];
assert.deepEqual(
  barColors(renderActivity("week", mixedDays)),
  [
    "progress-report-goal-orange",
    "progress-report-goal-green",
    undefined,
    undefined,
  ],
  "effective goal changes apply per day; removed goals and future days have no goal color"
);
for (const range of ["month", "year"] as const) {
  const markup = renderActivity(range, mixedDays);
  assert.match(
    markup,
    /class="progress-report-heat-4"[^>]*><span[^>]*aria-label="23\/09\/2026:/
  );
  assert.match(
    markup,
    /class="progress-report-heat-0 progress-report-future"[^>]*><span[^>]*aria-label="24\/09\/2026:/,
    "future dates stay neutral rather than looking like missed goals"
  );
}

const monthlyDays = [
  { date: "2026-01-01", completed: 2, goal: 10, future: false },
  { date: "2026-02-01", completed: 10, goal: 10, future: false },
  { date: "2026-02-02", completed: 0, goal: 10, future: true },
];
const monthlyColors = barColors(renderActivity("year", monthlyDays));
assert.equal(monthlyColors[0], "progress-report-goal-red");
assert.equal(
  monthlyColors[1],
  "progress-report-goal-green",
  "monthly bars compare completions to elapsed daily goals and exclude future targets"
);

const trendMarkup = renderActivity("day", days);
assert.match(trendMarkup, /progress-report-trend-area/);
assert.match(trendMarkup, /progress-report-trend-goal/);
assert.deepEqual(
  [
    ...trendMarkup.matchAll(/<circle class="progress-report-goal-([^"]+)"/g),
  ].map((match) => match[1]),
  colors,
  "Daily trend dots use each day's own goal state"
);
const geometry = taskProgressTrendGeometry(mixedDays);
const narrowGeometry = taskProgressTrendGeometry(mixedDays, 280);
assert.equal(narrowGeometry.width, 280);
assert.equal(narrowGeometry.height, 220);
assert.ok(
  narrowGeometry.points.every((point) => point.x >= 42 && point.x <= 238),
  "narrow trends leave room for readable endpoint dates"
);
assert.equal(geometry.points.length, 4);
assert.equal(geometry.points[2].completed, 4);
assert.ok(
  !geometry.line.includes(`${geometry.points[3].x},`),
  "future dates are not plotted as zero completions"
);
assert.ok(
  !geometry.goal.includes(`${geometry.points[2].x},`),
  "removed goals do not become a zero goal line"
);
assert.doesNotMatch(
  renderActivity(
    "day",
    days.map((day) => ({ ...day, goal: 0 }))
  ),
  /progress-report-trend-goal/
);
assert.doesNotMatch(
  renderActivity("day", []),
  /NaN|progress-report-trend-area/
);
assert.doesNotMatch(renderActivity("year", []), /NaN|progress-report-bars/);
assert.doesNotMatch(renderActivity("day", [days[0]]), /NaN/);

const selectableMarkup = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    IntlProvider,
    { locale: "en", messages: {} },
    React.createElement(TaskProgressReportActivity, {
      range: "month",
      days: mixedDays,
      onSelectDay: () => {},
      selectedDate: mixedDays[1].date,
    })
  )
);
assert.match(
  selectableMarkup,
  /<button[^>]*aria-label="22\/09\/2026:[^>]*aria-pressed="true"/
);
assert.match(
  selectableMarkup,
  /<button[^>]*disabled=""[^>]*aria-label="24\/09\/2026:/,
  "future cells cannot open daily details"
);
