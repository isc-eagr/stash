import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_PROGRESS_BROWSER_MODULE ||
  "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css =
  [
    "src/index.scss",
    "src/components/TaskProgress/taskProgressPage_custom.scss",
    "src/components/TaskProgressHistoryChart.scss",
  ]
    .map(
      (path) =>
        sass.compile(resolve(ui, path), {
          loadPaths: [ui, resolve(ui, "node_modules")],
          logger: sass.Logger.silent,
        }).css
    )
    .join("\n") +
  (await readFile(
    resolve(ui, "node_modules/react-datepicker/dist/react-datepicker.css"),
    "utf8"
  ));
const bundle = await esbuild.build({
  stdin: {
    contents: `
      import React from "react";
      import { render } from "react-dom";
      import { IntlProvider } from "react-intl";
      import { ApolloClient, ApolloProvider, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
      import { TaskProgressHistoryChart } from "./src/components/TaskProgressHistoryChart";
      import { TaskProgressReports } from "./src/components/TaskProgress/TaskProgressReports";
      const history = [
        {date:"2025-12-31",completed:2,incoming:0,remaining:98,baselineCount:100,goalPerDay:2},
        {date:"2026-01-01",completed:3,incoming:0,remaining:95,goalPerDay:3},
        {date:"2026-09-21",completed:5,incoming:0,remaining:90,goalPerDay:10},
        {date:"2026-09-23",completed:10,incoming:2,remaining:82,goalPerDay:20},
        {date:"2026-09-24",completed:1,incoming:0,remaining:81},
      ];
      const reportHistory = history.map(day => ({...day, baseline_count: day.baselineCount ?? null, goal_per_day: day.goalPerDay ?? undefined}));
      const tracker = {id:"1",title:"Project",status:"ACTIVE",history_started_on:"2025-12-31",history:reportHistory};
      const client = new ApolloClient({cache:new InMemoryCache(),link:new ApolloLink(operation => new Observable(observer => {
        observer.next({data:operation.operationName === "FindTaskProgressMilestones" ? {findTaskProgressMilestones:[]} :
          {taskProgressOverall:{total_count:102,organized_count:21,completed_count:21,incoming_count:2,goal_per_day:20,history:reportHistory.map(day => ({...day,goal_per_day:day.goal_per_day ?? 20}))}}});
        observer.complete();
      }))});
      function App() {
        const [view,setView] = React.useState("tracker");
        window.setChartView = setView;
        return <ApolloProvider client={client}><IntlProvider locale="en" messages={{}}><main className="task-progress-page" style={{maxWidth:1000,margin:"0 auto",padding:12}}>
          {view === "reports" ? <TaskProgressReports trackers={[tracker]} trackersLoading={false} /> : <TaskProgressHistoryChart key={view} title={view} history={history} today="2026-09-24" completionOnly={view === "completed"} onSelectDay={view === "overall" ? undefined : date => {window.selectedDay = date;}} />}
        </main></IntlProvider></ApolloProvider>;
      }
      render(<App />,document.querySelector("#root"));
    `,
    loader: "tsx",
    resolveDir: ui,
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
    console.error(error.message);
  });
  await page.route("http://progress-charts.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
    })
  );
  await page.clock.install({ time: new Date("2026-09-24T18:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-24T18:00:00Z"));
  await page.goto("http://progress-charts.test/");
  const chart = page.locator(".task-progress-history-chart");
  await chart.locator(".progress-report-trend").waitFor();
  assert.equal(await chart.locator(".progress-report-trend-point").count(), 30);
  const dailyPoint = chart.locator(
    '.progress-report-trend-point[aria-label^="23/09/2026:"]'
  );
  await dailyPoint.focus();
  assert.match(
    await chart.getByRole("tooltip").innerText(),
    /Completed this day\s+10/
  );
  assert.match(
    await chart.getByRole("tooltip").innerText(),
    /Cumulative by this day\s+20/
  );
  await dailyPoint.press("Enter");
  assert.equal(await page.evaluate(() => window.selectedDay), "2026-09-23");
  await chart.getByRole("button", { name: "7d", exact: true }).click();
  assert.equal(await chart.locator(".progress-report-trend-point").count(), 7);
  const screenshots = resolve(ui, "../../.local/task-progress-charts");
  await mkdir(screenshots, { recursive: true });
  await chart.screenshot({ path: resolve(screenshots, "daily.png") });

  for (const [mode, selector] of [
    ["Weekly", ".progress-report-bars"],
    ["Monthly", ".progress-report-calendar"],
    ["Yearly", ".progress-report-heatmap"],
  ]) {
    await chart.getByRole("button", { name: mode, exact: true }).click();
    await chart.locator(selector).first().waitFor();
    assert.equal(await chart.locator(".progress-report-trend").count(), 0);
    assert.equal(
      await chart
        .getByRole("button", { name: "Next", exact: true })
        .isDisabled(),
      true
    );
    if (mode === "Monthly") {
      const cell = chart.locator(
        '.progress-activity-day[aria-label^="23/09/2026:"]'
      );
      await cell.focus();
      assert.match(
        await chart.getByRole("tooltip").innerText(),
        /Completed this day\s+10/
      );
      await cell.press("Space");
      assert.equal(await page.evaluate(() => window.selectedDay), "2026-09-23");
      assert.equal(
        await chart
          .locator('.progress-activity-day[aria-label^="25/09/2026:"]')
          .isDisabled(),
        true
      );
      await page.getByRole("button", { name: "Monthly", exact: true }).focus();
    }
    await chart.screenshot({
      path: resolve(screenshots, `${mode.toLowerCase()}.png`),
    });
    await chart.getByRole("button", { name: "Previous", exact: true }).click();
    assert.equal(
      await chart
        .getByRole("button", { name: "Next", exact: true })
        .isDisabled(),
      false
    );
    await chart.getByRole("button", { name: "Current", exact: true }).click();
  }
  await chart.locator(".task-progress-history-chart-totals > summary").click();
  await chart.getByLabel("Show incoming").check();
  assert.equal(
    await chart.locator(".task-progress-history-chart-incoming-line").count(),
    1
  );
  await chart.getByRole("button", { name: "Remaining", exact: true }).click();
  assert.equal(
    await chart
      .locator(".task-progress-history-chart-metric-line.remaining")
      .count(),
    1
  );
  await page.evaluate(() => window.setChartView("completed"));
  await page
    .locator('.task-progress-history-chart[aria-label^="completed:"]')
    .waitFor();
  assert.equal(
    await chart.getByRole("button", { name: "Remaining", exact: true }).count(),
    0
  );
  for (const view of ["overall", "milestone"]) {
    await page.evaluate((next) => window.setChartView(next), view);
    await page
      .locator(`.task-progress-history-chart[aria-label^="${view}:"]`)
      .waitFor();
    await chart.getByRole("button", { name: "Yearly", exact: true }).click();
    await chart.locator(".progress-report-heatmap").waitFor();
  }

  await page.evaluate(() => window.setChartView("reports"));
  const reports = page.locator(".progress-reports");
  await reports
    .locator(".nav-link")
    .filter({ hasText: /^Daily$/ })
    .click();
  await reports.locator(".progress-report-trend").waitFor();
  assert.equal(
    await reports.locator(".progress-report-trend-point").count(),
    7
  );
  assert.match(
    await reports.locator(".progress-report-tiles").innerText(),
    /Items completed\s+1/i
  );
  assert.match(await reports.locator("h3").innerText(), /^24\/09\/2026$/);
  assert.equal(
    await reports.locator(".progress-report-trend-point.selected").count(),
    1
  );
  await reports.getByRole("button", { name: "Previous", exact: true }).click();
  assert.match(await reports.locator("h3").innerText(), /^23\/09\/2026$/);
  assert.match(
    await reports.locator(".progress-report-tiles").innerText(),
    /Items completed\s+10/i
  );
  assert.equal(
    await reports
      .locator('.progress-report-trend-point[aria-label^="24/09/2026:"]')
      .count(),
    0
  );
  await reports.getByRole("button", { name: "Current", exact: true }).click();
  for (const mode of ["Weekly", "Monthly", "Yearly"]) {
    await reports
      .locator(".nav-link")
      .filter({ hasText: new RegExp(`^${mode}$`) })
      .click();
    assert.equal(await reports.locator(".progress-report-trend").count(), 0);
  }
  await reports
    .locator(".nav-link")
    .filter({ hasText: /^Daily$/ })
    .click();
  await reports.screenshot({ path: resolve(screenshots, "reports-daily.png") });

  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => window.setChartView("tracker"));
  for (const mode of ["Daily", "Weekly", "Monthly", "Yearly"]) {
    await chart.getByRole("button", { name: mode, exact: true }).click();
    if (mode === "Daily") {
      assert.ok(
        (await chart.locator(".progress-report-trend svg").boundingBox())
          .height >= 180,
        "Daily trend stays readable at 320px"
      );
      assert.equal(
        await chart.locator(".progress-report-trend-point text").count(),
        3
      );
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      true,
      `${mode} fits 320px without page overflow`
    );
    await chart.screenshot({
      path: resolve(screenshots, `${mode.toLowerCase()}-mobile.png`),
    });
  }
  await page.evaluate(() => window.setChartView("reports"));
  await reports
    .locator(".nav-link")
    .filter({ hasText: /^Daily$/ })
    .click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    ),
    true,
    "Daily Reports fits 320px without page overflow"
  );
  await reports.screenshot({
    path: resolve(screenshots, "reports-daily-mobile.png"),
  });
  assert.deepEqual(errors, []);
  console.log(
    "Passed progress chart modes, daily reports, tooltips, drill-downs, calendar navigation, totals, completed trackers, and 320px layout."
  );
} finally {
  await browser.close();
}
