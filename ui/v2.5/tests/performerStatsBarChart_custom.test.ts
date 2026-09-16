import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server.js";

import {
  getPerformerStatsBarWidth,
  PerformerStatsBarChart,
} from "../src/components/Performers/PerformerDetails/PerformerStatsBarChart_custom.tsx";

assert.equal(
  getPerformerStatsBarWidth(51.4),
  51.4,
  "performer stat bars retain their precise percentage width"
);
assert.equal(
  getPerformerStatsBarWidth(-1),
  0,
  "performer stat bars do not extend before their track"
);
assert.equal(
  getPerformerStatsBarWidth(112),
  100,
  "performer stat bars never overflow their track"
);
assert.equal(
  getPerformerStatsBarWidth(Number.NaN),
  0,
  "invalid performer stat percentages render an empty bar"
);

const markup = ReactDOMServer.renderToStaticMarkup(
  React.createElement(PerformerStatsBarChart, {
    rows: [
      {
        color: "#00b3a4",
        key: "top",
        label: "Top",
        percent: 51.4,
        seconds: 329,
      },
      {
        color: "#28a745",
        key: "empty",
        label: "Ignored",
        percent: 48.6,
        seconds: 0,
      },
    ],
    title: "Sex Roles",
    totalSeconds: 329,
  })
);

assert.match(markup, /Sex Roles/, "the bar chart keeps its activity heading");
assert.match(
  markup,
  /role="progressbar"/,
  "the visible stat renders as an accessible horizontal progress bar"
);
assert.match(
  markup,
  /aria-valuenow="51\.4"/,
  "the horizontal progress bar exposes its exact percentage"
);
assert.match(
  markup,
  /width:51\.4%/,
  "the rendered bar width matches the activity percentage"
);
assert.doesNotMatch(
  markup,
  /Ignored/,
  "zero-duration stat rows are not displayed"
);
