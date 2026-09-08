import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { Router } from "react-router-dom";

import {
  readStatsView,
  removeStatsFilter,
  writeStatsView,
  type StatsViewOptions,
  type StatsViewState,
} from "../src/utils/statsViewState_custom.ts";
import { useStatsViewState } from "../src/hooks/useStatsViewState_custom.ts";
import { StatsFilterBar } from "../src/components/StatsFilterBar_custom.tsx";

// pnpm keeps the router's history dependency private to its package directory.
const require = createRequire(import.meta.url);
const { createMemoryHistory } = createRequire(
  require.resolve("react-router-dom")
)("history");

type Category = "country" | "rating" | "release_day";
type Metric = "o_counter" | "rating100";
const options: StatsViewOptions<Category, Metric> = {
  prefix: "scene",
  categories: ["country", "rating", "release_day"],
  metrics: ["o_counter", "rating100"],
  defaultMetric: "o_counter",
};
const initialView: StatsViewState<Category, Metric> = {
  filters: [
    {
      category: "country",
      value: 'México & "España"',
      label: 'Country: México & "España"',
    },
    { category: "rating", value: "60-64", label: "Rating: 60–64" },
    {
      category: "release_day",
      value: "__unknown__",
      label: "Release day: Unknown",
    },
  ],
  metric: "rating100",
  studio: { id: "42", name: 'Ñero & "Studio"', aliases: [], image_path: "" },
  includeChildStudios: false,
  showList: true,
};

const search = writeStatsView(
  "?section=activity-matrix&extra=one&extra=two",
  options,
  initialView
);
assert.deepEqual(readStatsView(search, options), initialView);
const params = new URLSearchParams(search);
assert.equal(params.get("section"), "activity-matrix");
assert.deepEqual(params.getAll("extra"), ["one", "two"]);
assert.equal(params.getAll("sceneFilter").length, 3);

const defaults = readStatsView("", options);
assert.deepEqual(defaults, {
  filters: [],
  metric: "o_counter",
  studio: undefined,
  includeChildStudios: true,
  showList: false,
});
assert.equal(
  writeStatsView(search, options, defaults),
  "?section=activity-matrix&extra=one&extra=two"
);
assert.equal(writeStatsView("", options, defaults), "");
assert.equal(readStatsView("?sceneStudio=9", options).studio?.name, "Studio 9");
assert.equal(
  readStatsView("?sceneChildren=true&sceneList=false", options)
    .includeChildStudios,
  true
);

const malformed = new URLSearchParams("sceneMetric=unsupported&sceneList=yes");
for (const filter of [
  "not json",
  "null",
  JSON.stringify({ category: "unsupported", value: "x", label: "X" }),
  JSON.stringify({ category: "country", value: 123, label: "X" }),
  JSON.stringify({ category: "country", value: "x", label: null }),
  JSON.stringify(initialView.filters[0]),
  JSON.stringify({
    ...initialView.filters[0],
    label: "Duplicate with a new label",
  }),
  JSON.stringify(initialView.filters[1]),
])
  malformed.append("sceneFilter", filter);
const recovered = readStatsView(malformed.toString(), options);
assert.deepEqual(recovered.filters, initialView.filters.slice(0, 2));
assert.equal(recovered.metric, "o_counter");
assert.equal(recovered.showList, false);

// Removing a middle chip keeps both earlier and later filters in order.
const removed = removeStatsFilter(initialView.filters, 1);
assert.deepEqual(removed, [initialView.filters[0], initialView.filters[2]]);
assert.equal(initialView.filters.length, 3);
assert.deepEqual(
  removeStatsFilter(initialView.filters, -1),
  initialView.filters
);
assert.deepEqual(
  removeStatsFilter(initialView.filters, 10),
  initialView.filters
);

const history = createMemoryHistory({
  initialEntries: [`/scenestats${search}#charts`],
});
let captured:
  | ReturnType<typeof useStatsViewState<Category, Metric>>
  | undefined;
function HookHarness() {
  captured = useStatsViewState(options);
  return null;
}
function renderHook() {
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(Router, { history }, React.createElement(HookHarness))
  );
  assert.ok(captured);
  return captured;
}

let hook = renderHook();
assert.deepEqual(hook.view, initialView);
hook.setFilters((filters) => removeStatsFilter(filters, 1));
assert.deepEqual(renderHook().view.filters, removed);
const afterRemoval = history.location.search;

// Two callbacks from the same render must read the latest history location,
// keeping the first update when React has not rerendered between calls.
hook = renderHook();
hook.setMetric("o_counter");
hook.setShowList((visible) => !visible);
assert.equal(renderHook().view.metric, "o_counter");
assert.equal(renderHook().view.showList, false);
assert.deepEqual(renderHook().view.filters, removed);

history.goBack();
assert.equal(renderHook().view.showList, true);
assert.equal(renderHook().view.metric, "o_counter");
history.goBack();
assert.equal(history.location.search, afterRemoval);
assert.equal(renderHook().view.metric, "rating100");
history.goForward();
assert.equal(renderHook().view.metric, "o_counter");

// Updating the release route and its filters is one history transition while
// retaining the selected studio, list visibility, unrelated query and hash.
const previousLocation = { ...history.location };
const previousIndex = history.index;
renderHook().updateView(
  { filters: [initialView.filters[0]] },
  "/scenestats/2026/9"
);
assert.equal(history.index, previousIndex + 1);
assert.equal(history.location.pathname, "/scenestats/2026/9");
assert.equal(history.location.hash, "#charts");
const routedView = renderHook().view;
assert.deepEqual(routedView.studio, initialView.studio);
assert.equal(routedView.includeChildStudios, false);
assert.equal(routedView.showList, true);
assert.deepEqual(routedView.filters, [initialView.filters[0]]);
assert.equal(
  new URLSearchParams(history.location.search).get("section"),
  "activity-matrix"
);
renderHook().updateView({ filters: [initialView.filters[0]] });
assert.equal(
  history.index,
  previousIndex + 1,
  "An unchanged view must not add a history entry"
);
history.goBack();
assert.equal(history.location.pathname, previousLocation.pathname);
assert.equal(history.location.search, previousLocation.search);
history.goForward();
assert.deepEqual(renderHook().view, routedView);

// A fresh history/Router (as after refresh) restores exactly the saved view.
const refreshedHistory = createMemoryHistory({
  initialEntries: [
    history.location.pathname + history.location.search + history.location.hash,
  ],
});
ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    Router,
    { history: refreshedHistory },
    React.createElement(HookHarness)
  )
);
assert.deepEqual(captured?.view, routedView);

const markup = ReactDOMServer.renderToStaticMarkup(
  React.createElement(StatsFilterBar, {
    label: "Active scene filters",
    total: "1,234 matching scenes",
    filters: [
      { label: "Country: México", onRemove: () => {} },
      { label: "Rating: 60–64", onRemove: () => {} },
    ],
    onUndo: () => {},
    onClear: () => {},
  })
);
assert.match(markup, /role="region" aria-label="Active scene filters"/);
assert.match(markup, /role="status">1,234 matching scenes/);
assert.match(
  markup,
  /<button[^>]+type="button"[^>]+aria-label="Remove filter: Country: México"/
);
assert.match(markup, /aria-label="Remove filter: Rating: 60–64"/);
assert.match(markup, /aria-hidden="true">×/);
assert.match(markup, />Undo last filter<\/button>/);
assert.match(markup, />Clear filters<\/button>/);
assert.doesNotMatch(markup, /role="listitem"/);
assert.equal(
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(StatsFilterBar, {
      label: "Filters",
      total: "All scenes",
      filters: [],
      onUndo: () => {},
      onClear: () => {},
    })
  ),
  ""
);

console.log("Stats view state and filter bar tests passed.");
