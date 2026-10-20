import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_PROGRESS_BROWSER_MODULE ||
  "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = [
  "src/index.scss",
  "src/components/TaskProgress/taskProgressPage_custom.scss",
  "src/components/TaskProgress/progressLedger_custom.scss",
  "src/components/TaskProgress/taskProgressCheckpoints_custom.scss",
  "src/components/TaskProgressHistoryChart.scss",
]
  .map(
    (path) =>
      sass.compile(resolve(ui, path), {
        loadPaths: [ui, resolve(ui, "node_modules")],
        logger: sass.Logger.silent,
      }).css
  )
  .join("\n");
const bundle = await esbuild.build({
  stdin: {
    contents: `
  import React from "react";
  import { render } from "react-dom";
  import { IntlProvider } from "react-intl";
  import { MemoryRouter, useHistory, useLocation } from "react-router-dom";
  import { ApolloClient, ApolloProvider, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
  import { ConfigurationContext } from "./src/hooks/Config";
  import { ToastProvider } from "./src/hooks/Toast";
  import { TaskProgressCard } from "./src/components/TaskProgress/TaskProgressCard";
  import TaskProgress from "./src/components/TaskProgress";
  import { TaskProgressTrackerModal } from "./src/components/TaskProgress/TaskProgressTrackerModal";
  import { TaskProgressForm } from "./src/components/TaskProgress/TaskProgressForm";
  import { progressToday } from "./src/components/TaskProgress/progressMath_custom";
  let previews = 0;
  let reorderWrites = 0;
  const client = new ApolloClient({cache: new InMemoryCache(), link: new ApolloLink(operation => new Observable(observer => {
   if (operation.operationName === "TaskProgressPreview") previews++;
   if (operation.operationName === "TaskProgressTrackersReorder") reorderWrites++;
   if (operation.operationName === "TaskProgressMilestoneCreate") {
    const created = {...milestones[2], id: "m4", name: operation.variables.input.name};
    milestones = [...milestones, created];
    observer.next({data: {taskProgressMilestoneCreate: created}}); observer.complete(); return;
   }
   if (operation.operationName === "TaskProgressMilestoneUpdate") {
    const input = operation.variables.input;
    const updated = {...milestones.find(item => item.id === input.id), name: input.name, version: 2};
    milestones = milestones.map(item => item.id === input.id ? updated : item);
    observer.next({data: {taskProgressMilestoneUpdate: updated}}); observer.complete(); return;
   }
   if (operation.operationName === "TaskProgressMilestoneDestroy") {
    milestones = milestones.filter(item => item.id !== operation.variables.id);
    observer.next({data: {taskProgressMilestoneDestroy: true}}); observer.complete(); return;
   }
   observer.next({data: operation.operationName === "FindTaskProgressTrackers" ? {findTaskProgressTrackers: trackers} :
    operation.operationName === "FindTaskProgressMilestones" ? {findTaskProgressMilestones: milestones} :
    operation.operationName === "TaskProgressOrganizedScenes" ? {taskProgressOverall: {total_count: 1000, organized_count: 258,
     completed_count: 300, incoming_count: 0, goal_per_day: 10, history: []}} :
    { taskProgressPreview: 0, findTags: { count: 0, tags: [] } }}); observer.complete();
  }))});
  const tracker = {__typename: "TaskProgressTracker", id: "1", title: "Finished project", description: "All done", goal: 10, goal_per_day: 2, tag_id: "0", tag_name: "Pending", position: 0,
   started_on: "2026-10-01", history_started_on: "2026-10-01", status: "COMPLETED", mode: "FIXED", version: 2, item_types: ["scene"], current_count: 0,
   completed_count: 10, incoming_count: 0, item_counts: [], completed_item_counts: [{item_type: "scene", count: 10}],
   history: [{date: "2026-10-01", completed: 0, incoming: 0, remaining: 10, baseline_count: 10, goal_per_day: 2},
    {date: progressToday(), completed: 10, incoming: 0, remaining: 0, goal_per_day: 2}]};
  const trackers = [
   {...tracker, id: "2", title: "Organize scenes", status: "ACTIVE", current_count: 80, completed_count: 20, goal: 100, mode: "BACKLOG"},
   {...tracker, id: "3", title: "Review markers with a longer title that wraps across several lines", status: "PAUSED", current_count: 60, completed_count: 40, goal: 100, mode: "BACKLOG"},
   tracker
  ];
  const milestone = {__typename: "TaskProgressMilestone", id: "m1", name: "First milestone", version: 1, target_date: "2026-12-31", goal_per_day: 2,
   tracker_ids: ["2"], trackers: [trackers[0]], total_count: 100, completed_count: 20, current_count: 80, incoming_count: 0,
   item_counts: [{item_type: "scene", count: 80}], completed_item_counts: [{item_type: "scene", count: 20}],
   history: tracker.history.map((day, index) => ({...day, added: 0, removed: 0, baseline_count: 100, remaining: index ? 80 : 100, completed: index ? 20 : 0}))};
  let milestones = [milestone,
   {...milestone, id: "m2", name: "Second milestone", target_date: null, tracker_ids: ["3", "1"], trackers: [trackers[1], tracker],
    total_count: 110, completed_count: 50, current_count: 60},
   {...milestone, id: "m3", name: "Empty milestone", target_date: null, goal_per_day: null, tracker_ids: [], trackers: [], history: [],
    total_count: 0, completed_count: 0, current_count: 0, item_counts: [], completed_item_counts: []}
  ];
  function Navigation() {
   const routerHistory = useHistory();
   window.progressSearch = useLocation().search;
   window.navigateProgress = search => routerHistory.push({pathname: "/progress", search});
   return null;
  }
  const noop = () => {};
  function App() {
   const [view, setView] = React.useState("card");
   const [mainPage, setMainPage] = React.useState(false);
   window.showMainPage = () => setMainPage(true);
   window.setView = setView;
   window.previews = () => previews;
   window.reorderWrites = () => reorderWrites;
   return <ApolloProvider client={client}><ConfigurationContext.Provider value={{configuration: {ui: {}, interface: {disableDropdownCreate: {tag: true}}}}}>
    <IntlProvider locale="en" messages={{}}><ToastProvider><MemoryRouter initialEntries={["/progress?status=ALL"]}><Navigation />{mainPage ? <TaskProgress /> : <main className="task-progress-page">
     <TaskProgressCard tracker={tracker} busy={false} first last onOpen={() => setView("details")} onEdit={() => setView("form")}
      onMove={noop} onDragStart={noop} onDragEnd={noop} onDrop={noop} />
     {view === "details" && <TaskProgressTrackerModal tracker={tracker} onClose={() => setView("card")} onDetails={noop} />}
     {view === "form" && <TaskProgressForm tracker={tracker} busy={false} onClose={() => setView("card")} onSave={async () => true} />}
    </main>}</MemoryRouter></ToastProvider></IntlProvider>
   </ConfigurationContext.Provider></ApolloProvider>;
  }
  render(<App />, document.querySelector("#root"));
 `,
    resolveDir: ui,
    loader: "tsx",
  },
  absWorkingDir: ui,
  tsconfig: resolve(ui, "tsconfig.json"),
  bundle: true,
  mainFields: ["module", "main"],
  write: false,
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env": '{"DEV":false}',
  },
  plugins: [
    {
      name: "fixture-styles",
      setup(build) {
        build.onLoad({ filter: /\.(scss|css)$/ }, () => ({
          contents: "",
          loader: "js",
        }));
      },
    },
  ],
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.stack);
  });
  await page.route("http://progress-completion.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
    })
  );
  await page.route("**/graphql*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: { findTags: { count: 0, tags: [] } } }),
    })
  );
  await page.clock.install({ time: new Date("2026-10-08T05:59:58Z") });
  await page.clock.pauseAt(new Date("2026-10-08T05:59:59Z"));
  await page.goto("http://progress-completion.test/");
  const progress = page.locator(".progress-ledger-completed");
  await progress.waitFor();
  assert.equal(await progress.locator("strong").innerText(), "100.00%");
  assert.equal(
    await progress
      .locator(".progress-ledger-earlier")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(148, 195, 223)"
  );
  assert.equal(
    await progress
      .locator("strong")
      .evaluate((el) => getComputedStyle(el).animationName),
    "progress-completed-shimmer"
  );
  assert.match(
    await progress
      .locator("strong")
      .evaluate((el) => getComputedStyle(el).filter),
    /drop-shadow/
  );
  assert.equal(await page.locator(".progress-tracker-plan").count(), 0);
  assert.equal(
    await page.locator(".progress-tracker-counts > span").count(),
    1
  );
  assert.equal(await page.locator(".progress-goal-period").count(), 3);
  const shimmerPositions = await progress.locator("strong").evaluate((el) => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const first = getComputedStyle(el).backgroundPosition;
    animation.currentTime = 1500;
    return [first, getComputedStyle(el).backgroundPosition];
  });
  assert.notEqual(shimmerPositions[0], shimmerPositions[1]);
  await page.clock.fastForward(1100);
  await page.waitForFunction(
    () => !document.querySelector(".progress-goal-period"),
    undefined,
    { timeout: 3000 }
  );
  assert.equal(
    await page.locator(".progress-goal-period").count(),
    0,
    "completion periods disappear at the next reporting midnight without refreshing"
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await progress
      .locator("strong")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none"
  );
  await page.getByRole("button", { name: "Details", exact: true }).click();
  const details = page.locator(".task-progress-tracker-modal");
  await details.waitFor();
  assert.deepEqual(
    await details
      .getByRole("group", { name: "Progress period", exact: true })
      .getByRole("button")
      .allTextContents(),
    ["Monthly", "Yearly", "Totals trend"]
  );
  assert.equal(
    await details.locator(".progress-tracker-at-a-glance-card").count(),
    2
  );
  assert.equal(
    await details
      .locator(
        ".progress-tracker-modal-forecast, .progress-tracker-modal-items"
      )
      .count(),
    0
  );
  assert.equal(
    await details
      .getByRole("button", { name: "Remaining", exact: true })
      .count(),
    0
  );
  assert.equal(
    await details.getByText("Items remaining", { exact: true }).count(),
    0
  );
  assert.equal(
    await details.getByText("Percentage remaining", { exact: true }).count(),
    0
  );
  assert.equal(
    await details.getByText("Deleted tag", { exact: true }).count(),
    1
  );
  assert.equal(await details.locator('a[href="/tags/0"]').count(), 0);
  assert.equal(
    await details.getByText("Activity progression", { exact: true }).count(),
    1
  );
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const form = page.locator(".task-progress-form-modal");
  await form.waitFor();
  for (const id of ["progress-goal-per-day", "progress-mode", "progress-reset"])
    assert.equal(await form.locator("#" + id).isDisabled(), true);
  assert.equal(await form.locator("#progress-title").isEnabled(), true);
  assert.equal(
    await form.locator('#progress-status option[value="ACTIVE"]').isDisabled(),
    true
  );
  assert.equal(await form.locator("#progress-status").isDisabled(), true);
  assert.equal(
    await form
      .getByRole("button", { name: "Save tracker", exact: true })
      .isEnabled(),
    true
  );
  assert.equal(
    await form.locator("[class*='control--is-disabled']").count(),
    1
  );
  assert.equal(await page.evaluate(() => window.previews()), 0);
  assert.deepEqual(errors, []);
  // Verify the completion treatment fits a narrow phone layout.
  await form.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    ),
    true
  );
  await page.evaluate(() => window.showMainPage());
  await page.locator("#progress-status").selectOption("ALL");
  const cards = page.locator(".progress-tracker-card");
  await cards.nth(2).waitFor();
  const overall = page.locator(".progress-ledger-overall");
  assert.deepEqual(
    await overall
      .locator(".progress-tracker-counts > span")
      .evaluateAll((fields) =>
        fields.map((field) => ({
          value: field.querySelector("strong").textContent,
          label: field.querySelector("small").textContent,
        }))
      ),
    [
      { value: "258", label: "completed" },
      { value: "742", label: "remaining" },
    ],
    "Overall labels current organized and remaining scenes like regular trackers"
  );
  assert.equal(
    await overall
      .locator(".progress-ledger-total, .progress-ledger-key small")
      .count(),
    0
  );
  const screenshots = resolve(ui, "../../.local/task-progress-trackers");
  await mkdir(screenshots, { recursive: true });
  for (const width of [1440, 1024, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const countStyle = (element) => {
      const style = getComputedStyle(element);
      return [style.fontSize, style.fontWeight, style.lineHeight];
    };
    assert.deepEqual(
      await overall
        .locator(".progress-tracker-counts strong")
        .first()
        .evaluate(countStyle),
      await cards
        .first()
        .locator(".progress-tracker-counts strong")
        .first()
        .evaluate(countStyle),
      `${width}px: Overall and regular trackers use the same count typography`
    );
    await page.locator("#progress-sort").selectOption("progress_desc");
    assert.deepEqual(
      await cards.locator(".progress-ledger-percent").allTextContents(),
      ["100.00%", "40.00%", "20.00%"]
    );
    assert.equal(await page.locator(".progress-tracker-reorder").count(), 0);
    for (const card of await cards.all())
      assert.equal(await card.getAttribute("draggable"), "false");
    const boxes = await cards.evaluateAll((elements) =>
      elements.map((card) => {
        const rect = card.getBoundingClientRect();
        const bar = card
          .querySelector(".progress-ledger-bar")
          .getBoundingClientRect();
        return {
          x: rect.x,
          bottom: rect.bottom,
          top: rect.top,
          width: rect.width,
          barX: bar.x,
          barWidth: bar.width,
        };
      })
    );
    for (const [index, box] of boxes.entries()) {
      assert.equal(box.x, boxes[0].x, `${width}px: tracker rows align`);
      assert.equal(
        box.width,
        boxes[0].width,
        `${width}px: tracker rows share a width`
      );
      assert.equal(
        box.barX,
        boxes[0].barX,
        `${width}px: progress bars start together`
      );
      assert.equal(
        box.barWidth,
        boxes[0].barWidth,
        `${width}px: progress bars have equal widths`
      );
      if (index)
        assert.ok(
          box.top >= boxes[index - 1].bottom,
          `${width}px: one tracker per row`
        );
    }
    assert.equal(await page.locator(".progress-ring").count(), 0);
    assert.equal(await page.locator(".progress-ledger-percent").count(), 4);
    for (const percent of await page
      .locator(".progress-ledger-percent")
      .allTextContents())
      assert.match(percent, /^\d+\.\d{2}%$/);
    await page.screenshot({
      path: resolve(screenshots, `trackers-${width}.png`),
      fullPage: true,
    });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter(
          (element) => element.getBoundingClientRect().right > window.innerWidth
        )
        .map((element) => ({
          className: element.className,
          width: element.getBoundingClientRect().width,
        }))
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      true,
      `${width}px: no horizontal overflow: ${JSON.stringify(overflow)}`
    );
    await page.locator("#progress-sort").selectOption("progress_asc");
    assert.deepEqual(
      await cards.locator(".progress-ledger-percent").allTextContents(),
      ["20.00%", "40.00%", "100.00%"]
    );
    await page.locator("#progress-sort").selectOption("manual");
    assert.deepEqual(
      await cards.locator(".progress-ledger-percent").allTextContents(),
      ["20.00%", "40.00%", "100.00%"]
    );
    assert.equal(await page.locator(".progress-tracker-reorder").count(), 3);
    for (const card of await cards.all())
      assert.equal(await card.getAttribute("draggable"), "true");
  }
  await page.locator("#progress-sort").selectOption("progress_desc");
  await page.locator("#progress-status").selectOption("CURRENT");
  assert.equal(
    await page.locator("#progress-sort").inputValue(),
    "progress_desc"
  );
  assert.deepEqual(
    await cards.locator(".progress-ledger-percent").allTextContents(),
    ["40.00%", "20.00%"]
  );
  assert.equal(await page.evaluate(() => window.reorderWrites()), 0);
  await page
    .locator(".progress-page-tabs")
    .getByText("Milestones", { exact: true })
    .click();
  const milestoneCards = page.locator(".milestone-card");
  await milestoneCards.nth(2).waitFor();
  assert.equal(await page.locator("#milestone-selector").count(), 0);
  assert.equal(await page.locator(".task-progress-milestone-modal").count(), 0);
  assert.equal(await milestoneCards.locator('[role="table"]').count(), 0);
  assert.equal(
    await milestoneCards.locator(".task-progress-history-chart").count(),
    0
  );
  for (const width of [1440, 1024, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await milestoneCards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const bar = element
          .querySelector(".progress-tracker-summary .progress-ledger-bar")
          .getBoundingClientRect();
        return {
          x: rect.x,
          width: rect.width,
          top: rect.top,
          bottom: rect.bottom,
          barX: bar.x,
          barWidth: bar.width,
        };
      })
    );
    for (const [index, box] of boxes.entries()) {
      assert.equal(box.x, boxes[0].x);
      assert.equal(box.width, boxes[0].width);
      assert.equal(box.barX, boxes[0].barX);
      assert.equal(box.barWidth, boxes[0].barWidth);
      if (index) assert.ok(box.top >= boxes[index - 1].bottom);
    }
    await page.screenshot({
      path: resolve(screenshots, `milestones-${width}.png`),
      fullPage: true,
    });
    const first = milestoneCards.nth(0);
    const second = milestoneCards.nth(1);
    await first.locator(".milestone-contributions > summary").click();
    await first.locator(".milestone-contributions-content").waitFor();
    assert.equal(await second.locator('[role="table"]').count(), 0);
    await first.getByRole("button", { name: "Month", exact: true }).click();
    await first
      .getByRole("button", { name: "Overall progress", exact: false })
      .click();
    await second.locator(".milestone-contributions > summary").click();
    await second.locator(".milestone-contributions-content").waitFor();
    assert.equal(
      await first.locator(".milestone-contributions").getAttribute("open"),
      ""
    );
    assert.equal(
      await milestoneCards.locator(".task-progress-history-chart").count(),
      0
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      true,
      `${width}px: expanded milestone tables fit`
    );
    await page.screenshot({
      path: resolve(screenshots, `milestones-expanded-${width}.png`),
      fullPage: true,
    });
    await first.getByRole("button", { name: "Details", exact: true }).click();
    const modal = page.locator(".task-progress-milestone-modal");
    await modal.waitFor();
    assert.equal(
      await modal.locator(".modal-title").innerText(),
      "First milestone"
    );
    assert.equal(
      await modal.locator(".task-progress-history-chart").count(),
      1
    );
    assert.equal(
      await milestoneCards.locator(".task-progress-history-chart").count(),
      0
    );
    assert.deepEqual(
      await modal
        .getByRole("group", { name: "Progress period", exact: true })
        .getByRole("button")
        .allTextContents(),
      ["Monthly", "Yearly", "Totals trend"]
    );
    await modal.getByRole("button", { name: "Yearly", exact: true }).click();
    await modal.getByRole("button", { name: "Monthly", exact: true }).click();
    await modal
      .getByRole("button", { name: "Totals trend", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      true,
      `${width}px: milestone graphs stay inside Details`
    );
    await page.screenshot({
      path: resolve(screenshots, `milestone-details-${width}.png`),
      fullPage: true,
    });
    await modal
      .locator(".modal-footer")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await first.locator(".milestone-contributions > summary").click();
    await first
      .locator(".milestone-contributions-content")
      .waitFor({ state: "detached" });
    assert.equal(
      await second.locator(".milestone-contributions").getAttribute("open"),
      ""
    );
    await second.locator(".milestone-contributions > summary").click();
    await second
      .locator(".milestone-contributions-content")
      .waitFor({ state: "detached" });
    assert.equal(await milestoneCards.locator('[role="table"]').count(), 0);
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await milestoneCards
    .nth(0)
    .locator(".milestone-contributions > summary")
    .click();
  await milestoneCards
    .nth(0)
    .getByRole("button", { name: "Organize scenes", exact: true })
    .click();
  const trackerDetails = page.locator(
    ".task-progress-tracker-modal:not(.task-progress-milestone-modal)"
  );
  await trackerDetails.waitFor();
  assert.deepEqual(
    await trackerDetails
      .getByRole("group", { name: "Progress period", exact: true })
      .getByRole("button")
      .allTextContents(),
    ["Monthly", "Yearly", "Totals trend"]
  );
  assert.equal(
    await trackerDetails.locator(".modal-title").innerText(),
    "Organize scenes"
  );
  await trackerDetails
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await trackerDetails.waitFor({ state: "hidden" });
  await page.evaluate(() =>
    window.navigateProgress("?view=milestones&milestone=m2")
  );
  const milestoneModal = page.locator(".task-progress-milestone-modal");
  await milestoneModal.waitFor();
  assert.equal(
    await milestoneModal.locator(".modal-title").innerText(),
    "Second milestone"
  );
  assert.equal(await milestoneCards.count(), 3);
  await milestoneModal
    .locator(".modal-footer")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() =>
      new URLSearchParams(window.progressSearch).has("milestone")
    ),
    false
  );
  await page.evaluate(() =>
    window.navigateProgress("?view=milestones&milestone=missing")
  );
  await page
    .getByRole("alert")
    .filter({ hasText: "This milestone is unavailable." })
    .waitFor();
  assert.equal(await milestoneCards.count(), 3);
  await page.locator(".alert-warning .close").click();
  await milestoneCards
    .nth(1)
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.locator("#milestone-name").fill("Edited milestone");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await milestoneCards
    .nth(1)
    .getByText("Edited milestone", { exact: true })
    .waitFor();
  await milestoneCards
    .nth(2)
    .getByRole("button", { name: "Details", exact: true })
    .click();
  await milestoneModal
    .getByText("No progress history has been recorded yet.", { exact: true })
    .waitFor();
  await milestoneModal
    .locator(".modal-footer")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create milestone", exact: true })
    .click();
  await page.locator("#milestone-name").fill("New milestone");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await milestoneCards.nth(3).waitFor();
  assert.equal(await page.locator(".task-progress-milestone-modal").count(), 0);
  await milestoneCards
    .nth(3)
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await milestoneCards.nth(3).waitFor({ state: "detached" });
  assert.equal(await milestoneCards.count(), 3);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: tracker sorting/layout/completion, all milestone rows, independent collapsed contributions, per-milestone graph modals, direct links, tracker links, milestone create/edit/delete, and responsive layouts."
  );
} finally {
  await browser.close();
}
