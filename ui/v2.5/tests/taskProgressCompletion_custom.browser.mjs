import assert from "node:assert/strict";
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
  import { MemoryRouter } from "react-router-dom";
  import { ApolloClient, ApolloProvider, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
  import { ConfigurationContext } from "./src/hooks/Config";
  import { ToastProvider } from "./src/hooks/Toast";
  import { TaskProgressCard } from "./src/components/TaskProgress/TaskProgressCard";
  import { TaskProgressTrackerModal } from "./src/components/TaskProgress/TaskProgressTrackerModal";
  import { TaskProgressForm } from "./src/components/TaskProgress/TaskProgressForm";
  import { progressToday } from "./src/components/TaskProgress/progressMath_custom";
  let previews = 0;
  const client = new ApolloClient({cache: new InMemoryCache(), link: new ApolloLink(operation => new Observable(observer => {
   if (operation.operationName === "TaskProgressPreview") previews++;
   observer.next({data: { taskProgressPreview: 0, findTags: { count: 0, tags: [] } }}); observer.complete();
  }))});
  const tracker = {id: "1", title: "Finished project", description: "All done", goal: 10, goal_per_day: 2, tag_id: "2", tag_name: "Pending", position: 0,
   started_on: "2026-10-01", history_started_on: "2026-10-01", status: "COMPLETED", mode: "FIXED", version: 2, item_types: ["scene"], current_count: 0,
   completed_count: 10, incoming_count: 0, item_counts: [], completed_item_counts: [{item_type: "scene", count: 10}],
   history: [{date: "2026-10-01", completed: 0, incoming: 0, remaining: 10, baseline_count: 10, goal_per_day: 2},
    {date: progressToday(), completed: 10, incoming: 0, remaining: 0, goal_per_day: 2}]};
  const noop = () => {};
  function App() {
   const [view, setView] = React.useState("card");
   window.setView = setView;
   window.previews = () => previews;
   return <ApolloProvider client={client}><ConfigurationContext.Provider value={{configuration: {ui: {}, interface: {disableDropdownCreate: {tag: true}}}}}>
    <IntlProvider locale="en" messages={{}}><ToastProvider><MemoryRouter><main className="task-progress-page">
     <TaskProgressCard tracker={tracker} busy={false} first last onOpen={() => setView("details")} onEdit={() => setView("form")}
      onMove={noop} onDragStart={noop} onDragEnd={noop} onDrop={noop} />
     {view === "details" && <TaskProgressTrackerModal tracker={tracker} onClose={() => setView("card")} onDetails={noop} />}
     {view === "form" && <TaskProgressForm tracker={tracker} busy={false} onClose={() => setView("card")} onSave={async () => true} />}
    </main></MemoryRouter></ToastProvider></IntlProvider>
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
        build.onLoad({ filter: /\.scss$/ }, () => ({
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
    console.error(error.message);
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
  const ring = page.locator(".progress-ring-completed");
  await ring.waitFor();
  assert.equal(await ring.locator("strong").innerText(), "100.00%");
  assert.equal(
    await ring
      .locator(".progress-ring-value")
      .evaluate((el) => getComputedStyle(el).stroke),
    "rgb(56, 189, 248)"
  );
  assert.equal(
    await ring
      .locator("strong")
      .evaluate((el) => getComputedStyle(el).animationName),
    "progress-completed-shimmer"
  );
  assert.match(
    await ring.locator("strong").evaluate((el) => getComputedStyle(el).filter),
    /drop-shadow/
  );
  assert.equal(await page.locator(".progress-tracker-plan").count(), 0);
  assert.equal(
    await page.locator(".progress-tracker-counts > span").count(),
    1
  );
  assert.equal(await page.locator(".progress-goal-period").count(), 3);
  const shimmerPositions = await ring.locator("strong").evaluate((el) => {
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
    await ring
      .locator("strong")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none"
  );
  await page.getByRole("button", { name: "Details", exact: true }).click();
  const details = page.locator(".task-progress-tracker-modal");
  await details.waitFor();
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
  assert.equal(
    await form.locator('#progress-status option[value="ARCHIVED"]').isEnabled(),
    true
  );
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
  console.log(
    "PASS: sapphire ring/glow/shimmer, reduced motion, completed card/details, midnight expiry, read-only form, and 320px layout."
  );
} finally {
  await browser.close();
}
