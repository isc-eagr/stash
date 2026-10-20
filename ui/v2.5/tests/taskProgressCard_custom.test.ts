import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { TaskProgressCard } from "../src/components/TaskProgress/TaskProgressCard.tsx";
import { progressToday } from "../src/components/TaskProgress/progressMath_custom.ts";

const cardSource = readFileSync(
  new URL(
    "../src/components/TaskProgress/TaskProgressCard.tsx",
    import.meta.url
  ),
  "utf8"
);

const tracker: React.ComponentProps<typeof TaskProgressCard>["tracker"] = {
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
const renderCard = (
  value: React.ComponentProps<typeof TaskProgressCard>["tracker"],
  reorderable = true
) =>
  ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      React.createElement(
        MemoryRouter,
        {},
        React.createElement(TaskProgressCard, {
          tracker: value,
          reorderable,
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
const markup = renderCard(tracker);
const sortedMarkup = renderCard(tracker, false);
assert.match(sortedMarkup, /draggable="false"/);
assert.doesNotMatch(sortedMarkup, /Reorder tracker|Move earlier|Move later/);
assert.match(markup, /draggable="true"/);
assert.match(markup, /Move earlier/);
assert.match(markup, /Move later/);

assert.match(markup, /Organize videos/);
assert.match(markup, /progress-score-row/);
assert.match(
  markup,
  /btn-primary[^>]*>Details</,
  "Details is the primary action"
);
assert.match(markup, /aria-label="Edit"[^>]*btn-secondary/);
assert.match(
  markup,
  /progress-score-counts"><span class="progress-score-done"><strong>3<\/strong> done<\/span><span><strong>8<\/strong> left<\/span><\/div><small>Scenes<\/small>/,
  "done and left counts stand out above the item types"
);
assert.equal(
  (markup.match(/27\.27%/g) ?? []).length,
  1,
  "the row shows only the current percentage"
);
assert.doesNotMatch(markup, /Previous close|→/);
assert.match(markup, /progress-medal-fills" style="width:27\.27/);
assert.doesNotMatch(
  markup,
  /Forecast basis|progress-forecast/,
  "the finish planner moved into Details"
);
assert.doesNotMatch(
  cardSource,
  /taskProgressDailyGoal|faCheck|faTriangleExclamation/,
  "daily completion is shown in the period cells rather than beside the title"
);
assert.doesNotMatch(
  markup,
  /My task notes|Mark completed|View daily data/,
  "rows omit the graph, detail text, and lifecycle controls"
);

const coins = [
  ...markup.matchAll(
    /class="progress-medal-coin ([^"]*)"[^>]*title="([^"]*)"/g
  ),
];
assert.equal(coins.length, 4, "the bar carries all four medals");
assert.match(
  coins[0][1],
  /milestone-checkpoint-25 progress-medal-coin-reached/
);
assert.equal(
  coins[0][2],
  "Bronze · 07/09/2026",
  "medals keep the first date reached"
);
assert.match(coins[1][1], /progress-medal-coin-next/);
assert.equal(coins[1][2], "Silver · 3 to go");
assert.equal(coins[3][2], "Alpha Sapphire · Not yet");
assert.match(markup, /3 to Silver/, "rows say how far the next medal is");
assert.match(
  markup,
  /progress-medal-fills" style="width:27\.27[^"]*"><span class="progress-medal-fill" style="flex-grow:27\.27[^"]*"><\/span><span class="progress-medal-gain" style="flex-grow:0"><\/span><\/span>/,
  "earned progress is one rounded bar holding the earlier and gained segments"
);
assert.match(
  markup,
  /progress-finish-label progress-finish-label-empty"[^>]*>[\s\S]*?<span>Finish<\/span><strong>—<\/strong>/,
  "rows show the finish date from Details, read-only"
);
assert.match(
  markup,
  /progress-score-identity">[\s\S]*progress-score-actions[\s\S]*<\/div><\/div><div class="progress-score-progress">/,
  "Details and Edit sit under the tracker name"
);

for (const label of ["Today", "Week", "Month", "Year"]) {
  assert.match(markup, new RegExp(`<span>${label}</span>`));
}

const noGoalMarkup = renderCard({
  ...tracker,
  goal_per_day: null,
  history: [
    {
      ...tracker.history[0],
      completed: 5,
      date: progressToday(),
      goal_per_day: null,
    },
  ],
});
assert.equal(
  (noGoalMarkup.match(/progress-period-tile progress-goal-period-green/g) ?? [])
    .length,
  4,
  "trackers without a daily goal show every current period in green"
);
assert.equal(
  (noGoalMarkup.match(/<strong>5<\/strong>/g) ?? []).length,
  4,
  "trackers without a daily goal show raw completed totals"
);
assert.doesNotMatch(
  noGoalMarkup,
  /progress-period-meter/,
  "trackers without a daily goal omit target meters"
);

const completedCard = renderCard({
  ...tracker,
  status: "COMPLETED",
  current_count: 0,
  completed_count: 10,
});
assert.match(completedCard, /Completed/);
assert.match(completedCard, /progress-medal-bar-complete/);
assert.match(completedCard, /progress-score-percent-complete/);
assert.match(completedCard, /progress-medal-fills" style="width:100%"/);
assert.match(completedCard, /Every medal earned/);
assert.equal(
  (completedCard.match(/progress-medal-coin-reached/g) ?? []).length,
  4,
  "current progress marks medals reached even without historical dates"
);
assert.doesNotMatch(completedCard, / left<|progress-period-tiles/);

const completedTodayCard = renderCard({
  ...tracker,
  status: "COMPLETED",
  current_count: 0,
  completed_count: 10,
  history: [
    {
      ...tracker.history[0],
      date: progressToday(),
      completed: 10,
      remaining: 0,
    },
  ],
});
assert.match(
  completedTodayCard,
  /progress-period-tiles/,
  "periods stay through the last date with recorded data"
);

const emptyCard = renderCard({
  ...tracker,
  status: "COMPLETED",
  goal: 0,
  completed_count: 0,
  current_count: 0,
  history: [],
});
assert.match(emptyCard, />100\.00%</);
assert.doesNotMatch(emptyCard, /NaN|Infinity/);

const fixedCard = renderCard({
  ...tracker,
  mode: "FIXED",
  goal: 10,
  current_count: 8,
  completed_count: 9,
});
assert.match(fixedCard, />20\.00%</);
assert.match(fixedCard, /progress-medal-fills" style="width:20%"/);
