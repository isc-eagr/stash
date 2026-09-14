import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { TaskProgressCard } from "../src/components/TaskProgress/TaskProgressCard.tsx";

const cardSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressCard.tsx",
    import.meta.url
  ),
  "utf8"
);

const tracker = {
  id: "1",
  title: "Organize videos",
  description: "My task notes",
  tag_id: "2",
  tag_name: "Pending",
  goal: 10,
  goal_per_day: 3,
  position: 0,
  started_on: "2026-09-07",
  history_started_on: "2026-09-07",
  status: "ACTIVE",
  mode: "BACKLOG",
  version: 1,
  item_types: ["scene"],
  current_count: 8,
  completed_count: 3,
  incoming_count: 1,
  item_counts: [{ item_type: "scene", count: 8 }],
  history: [
    {
      date: "2026-09-07",
      completed: 3,
      incoming: 1,
      remaining: 8,
      baseline_count: 10,
      goal_per_day: 3,
    },
  ],
};
const noop = () => {};
const markup = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    IntlProvider,
    { locale: "en", messages: {} },
    React.createElement(
      MemoryRouter,
      {},
      React.createElement(TaskProgressCard, {
        tracker,
        busy: false,
        first: true,
        last: false,
        onOpen: noop,
        onEdit: noop,
        onMove: noop,
        onDragStart: noop,
        onDragEnd: noop,
        onDrop: noop,
      })
    )
  )
);
assert.match(markup, /Organize videos/);
assert.match(markup, /Details/);
assert.match(
  markup,
  /btn-primary/,
  "Details uses an enabled primary button style"
);
assert.match(markup, /Edit/);
assert.match(markup, /27\.27%/, "tracker percentages keep two decimal places");
assert.match(
  markup,
  /progress-ring/,
  "tracker totals include the compact circular progress indicator"
);
assert.match(markup, /Complete/, "the progress indicator has a visible label");
assert.doesNotMatch(
  cardSource,
  /taskProgressDailyGoal|faCheck|faTriangleExclamation/,
  "daily completion is shown in the goal cards rather than repeated beside the title"
);
assert.match(
  markup,
  /btn-outline-primary/,
  "Edit uses a visible outlined primary button style"
);
assert.match(markup, /Items per day/, "planning lives on each tracker card");
assert.match(markup, /progress-tracker-plan-title[^>]*>Estimated Finish Date/);
assert.match(
  markup,
  /progress-tracker-plan-label[^>]*>[\s\S]*?At[\s\S]*?items\/day:[\s\S]*?progress-tracker-plan-date/,
  "finish planning is organized into a title line and a compact calculation line"
);
assert.match(markup, /Today/);
assert.match(markup, /This week/);
assert.match(markup, /This month/);
const footerIndex = markup.indexOf("progress-tracker-footer");
const actionsIndex = markup.indexOf(
  "progress-tracker-card-actions",
  footerIndex
);
const planIndex = markup.indexOf("progress-tracker-plan", footerIndex);
assert.ok(
  footerIndex >= 0 && actionsIndex > footerIndex && planIndex > actionsIndex,
  "tracker actions render before the right-aligned planning controls"
);
assert.match(markup, /Move earlier/);
assert.match(markup, /Move later/);
assert.doesNotMatch(
  markup,
  /My task notes|Mark completed|View daily data/,
  "cards omit the graph, detail text, and lifecycle controls"
);
