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
  value: React.ComponentProps<typeof TaskProgressCard>["tracker"]
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
  (noGoalMarkup.match(/progress-goal-period-green/g) ?? []).length,
  3,
  "trackers without a daily goal show all current periods in green"
);
assert.equal(
  (noGoalMarkup.match(/<strong>5<\/strong>/g) ?? []).length,
  3,
  "trackers without a daily goal show raw completed totals"
);
assert.doesNotMatch(
  noGoalMarkup,
  /progress-goal-meter/,
  "trackers without a daily goal omit target meters"
);
assert.equal(
  (noGoalMarkup.match(/progress-goal-period-change/g) ?? []).length,
  3,
  "each current period shows its percentage-point change"
);
assert.match(
  noGoalMarkup,
  /\+38\.46%/,
  "percentage-point changes are signed and rounded to two decimal places"
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
assert.match(
  markup,
  /progress-tracker-plan-label[^>]*>[\s\S]*?progress-tracker-plan-title[^>]*>Estimated finish at[\s\S]*?items\/day:[\s\S]*?progress-tracker-plan-date/,
  "finish planning reads as one compact calculation"
);
assert.match(markup, /Today/);
assert.match(markup, /This week/);
assert.match(markup, /This month/);
const checkpointMarkup = markup.match(
  /<ul class="milestone-checkpoints progress-checkpoints-compact"[^>]*>(.*?)<\/ul>/
)?.[1];
assert.ok(checkpointMarkup, "tracker cards show compact checkpoints");
assert.equal((checkpointMarkup.match(/<li /g) ?? []).length, 4);
assert.match(
  checkpointMarkup,
  /milestone-checkpoint-25 milestone-checkpoint-reached[^>]*><strong class="milestone-checkpoint-medal">25%<\/strong><small>07\/09\/2026<\/small>/,
  "the tracker records the first date a checkpoint was reached"
);
assert.match(
  checkpointMarkup,
  /milestone-checkpoint-50[^>]*><strong class="milestone-checkpoint-medal">50%<\/strong><small>Not yet<\/small>/
);
assert.match(
  checkpointMarkup,
  /milestone-checkpoint-75[^>]*><strong class="milestone-checkpoint-medal">75%<\/strong><small>Not yet<\/small>/
);
assert.match(checkpointMarkup, /title="Alpha Sapphire"/);
assert.match(checkpointMarkup, /100%<\/strong><small>Not yet<\/small>/);
const completedCheckpoints = renderCard({
  ...tracker,
  completed_count: 10,
  current_count: 0,
  history: [],
}).match(
  /<ul class="milestone-checkpoints progress-checkpoints-compact"[^>]*>(.*?)<\/ul>/
)?.[1];
assert.equal(
  (completedCheckpoints?.match(/milestone-checkpoint-reached/g) ?? []).length,
  4,
  "current progress marks checkpoints reached even without historical dates"
);
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

const completedCard = renderCard({
  ...tracker,
  status: "COMPLETED",
  current_count: 0,
  completed_count: 10,
});
assert.match(completedCard, /Completed/);
assert.match(completedCard, /progress-ring-completed/);
assert.doesNotMatch(
  completedCard,
  /<small>remaining<\/small>|Estimated finish at|progress-tracker-plan|progress-goal-summary/
);
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
assert.match(completedTodayCard, /Today/);
assert.match(completedTodayCard, /This week/);
assert.match(completedTodayCard, /This month/);
assert.doesNotMatch(
  completedTodayCard,
  /Estimated finish at|<small>remaining<\/small>/
);
