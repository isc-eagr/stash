import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { taskProgressChartSeries } from "../src/components/TaskProgress/taskProgressChart_custom.ts";
import { TaskProgressHistoryTooltip } from "../src/components/TaskProgress/TaskProgressHistoryTooltip.tsx";
import { TaskProgressHistoryTotals } from "../src/components/TaskProgress/TaskProgressHistoryTotals.tsx";

const history = [
  {
    date: "2025-12-31",
    completed: 2,
    incoming: 0,
    remaining: 98,
    baselineCount: 100,
    goalPerDay: 2,
  },
  {
    date: "2026-01-01",
    completed: 3,
    incoming: 0,
    remaining: 95,
    goalPerDay: 3,
  },
  {
    date: "2026-09-21",
    completed: 5,
    incoming: 0,
    remaining: 90,
    goalPerDay: 10,
  },
  {
    date: "2026-09-23",
    completed: 10,
    incoming: 2,
    remaining: 82,
    goalPerDay: 20,
  },
  { date: "2026-09-24", completed: 1, incoming: 0, remaining: 81 },
];
const today = "2026-09-24";
const daily = taskProgressChartSeries(history, "day", 7, today, today);
assert.equal(daily.length, 7);
assert.equal(daily[0].date, "2026-09-18");
assert.equal(
  daily[6].cumulativeCompleted,
  21,
  "range filtering preserves lifetime totals"
);
assert.equal(daily[4].completed, 0);
assert.equal(daily[4].goalPerDay, 10);
assert.equal(daily[5].goalPerDay, 20);
const pastDaily = taskProgressChartSeries(
  history,
  "day",
  7,
  "2026-09-21",
  today
);
assert.equal(pastDaily[pastDaily.length - 1].date, "2026-09-21");
assert.equal(pastDaily[pastDaily.length - 1].cumulativeCompleted, 10);
assert.equal(
  taskProgressChartSeries(history, "day", "all", today, today)[0].date,
  "2025-12-31"
);
const week = taskProgressChartSeries(history, "week", 30, today, today);
assert.equal(week[0].date, "2026-09-21");
assert.equal(week[week.length - 1].date, today);
assert.equal(week[0].cumulativeCompleted, 10);
assert.equal(
  taskProgressChartSeries(history, "month", 30, today, today)[0].date,
  "2026-09-01"
);
const year = taskProgressChartSeries(history, "year", 30, today, today);
assert.equal(year[0].date, "2026-01-01");
assert.equal(year[year.length - 1].date, today);
assert.equal(
  year[0].cumulativeCompleted,
  5,
  "yearly history preserves totals from previous years"
);
assert.equal(
  taskProgressChartSeries(history, "year", 30, "2025-12-31", today).length,
  1
);
assert.deepEqual(taskProgressChartSeries([], "day", 30, today, today), []);

const render = (component: React.ReactElement) =>
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(IntlProvider, { locale: "en", messages: {} }, component)
  );
const totals = render(
  React.createElement(TaskProgressHistoryTotals, {
    points: daily,
    title: "Project",
    completionOnly: false,
    view: "cumulative",
    onView: () => {},
  })
);
assert.match(totals, /Totals trend/);
assert.match(totals, /Remaining/);
assert.match(totals, /Show incoming/);
assert.doesNotMatch(totals, /task-progress-history-chart-incoming-line/);
assert.match(totals, /task-progress-history-chart-metric-line cumulative/);
const completed = render(
  React.createElement(TaskProgressHistoryTotals, {
    points: daily,
    title: "Project",
    completionOnly: true,
    view: "cumulative",
    onView: () => {},
  })
);
assert.doesNotMatch(
  completed,
  /aria-label="Line metric"/,
  "completed trackers keep their cumulative-only totals view"
);
const tooltip = render(
  React.createElement(TaskProgressHistoryTooltip, {
    point: daily[5],
    view: "cumulative",
    showIncoming: true,
  })
);
assert.match(tooltip, /Completed this day<\/span><strong>10<\/strong>/);
assert.match(tooltip, /Cumulative by this day/);
assert.match(tooltip, /Progress this day/);
assert.match(tooltip, /19\.61%/);
assert.match(tooltip, /Incoming<\/dt><dd>2/);
assert.match(tooltip, /Goal<\/dt><dd>20/);
const remaining = render(
  React.createElement(TaskProgressHistoryTooltip, {
    point: daily[5],
    view: "remaining",
  })
);
assert.match(remaining, /Remaining<\/dt><dd>82/);
assert.doesNotMatch(remaining, /Incoming<\/dt>/);
