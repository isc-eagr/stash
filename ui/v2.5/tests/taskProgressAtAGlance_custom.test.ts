import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { TaskProgressAtAGlance } from "../src/components/TaskProgress/TaskProgressAtAGlance.tsx";

const tracker = {
  id: "1",
  title: "Organize videos",
  description: "My task notes",
  tag_id: "2",
  tag_name: "Pending",
  goal: 100,
  position: 0,
  started_on: "2026-09-07",
  history_started_on: "2026-09-07",
  status: "ACTIVE",
  mode: "FIXED",
  version: 1,
  item_types: ["scene"],
  current_count: 40,
  completed_count: 90,
  incoming_count: 0,
  item_counts: [],
  history: [],
};
const markup = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    IntlProvider,
    { locale: "en", messages: {} },
    React.createElement(TaskProgressAtAGlance, { tracker })
  )
);

assert.match(markup, /Items completed/);
assert.match(markup, /Items remaining/);
assert.match(markup, /Percentage completed/);
assert.match(markup, /Percentage remaining/);
assert.match(
  markup,
  /60.*Items completed/,
  "fixed-batch cards show completed baseline items rather than total activity events"
);
assert.match(markup, /40.*Items remaining/);
assert.match(markup, /60\.00%.*Percentage completed/);
assert.match(markup, /40\.00%.*Percentage remaining/);
