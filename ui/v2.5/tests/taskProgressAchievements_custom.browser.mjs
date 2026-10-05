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
  "src/hooks/toast_custom.scss",
  "src/components/TaskProgress/taskProgressCheckpoints_custom.scss",
  "src/components/TaskProgress/taskProgressAchievements_custom.scss",
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
      import { MemoryRouter, Route, Switch, useHistory } from "react-router-dom";
      import { ApolloClient, ApolloProvider, ApolloLink, InMemoryCache, Observable, gql } from "@apollo/client";
      import { TaskProgressAchievementMonitor } from "./src/components/TaskProgress/TaskProgressAchievementMonitor";
      import { TaskProgressCheckpoints } from "./src/components/TaskProgress/TaskProgressCheckpoints";
      import { createTaskProgressMutationLink } from "./src/core/taskProgressMutationLink_custom";
      import { ToastProvider, useToast } from "./src/hooks/Toast";
      let completed = 20;
      let queryCount = 0;
      const tracker = () => ({
        __typename: "TaskProgressTracker", id: "1", title: "Organize scenes", description: "",
        goal: 100, goal_per_day: null, tag_id: "2", tag_name: "Pending", position: 0,
        started_on: "2026-09-01", status: "ACTIVE", mode: "BACKLOG", version: 1,
        history_started_on: "2026-09-01", item_types: ["scene"], current_count: 100 - completed,
        completed_count: completed, incoming_count: 0, item_counts: [], completed_item_counts: [], history: [],
      });
      const milestone = () => ({
        __typename: "TaskProgressMilestone", id: "1", name: "Finish backlog", target_date: null,
        goal_per_day: null, version: 1, tracker_ids: ["1"], total_count: 100, completed_count: completed,
        incoming_count: 0, current_count: 100 - completed, item_counts: [], completed_item_counts: [],
        history: [], trackers: [tracker()],
      });
      const client = new ApolloClient({
        cache: new InMemoryCache(), link: ApolloLink.from([
          createTaskProgressMutationLink(),
          new ApolloLink(operation => new Observable(observer => {
            let data;
            if (operation.operationName === "FindTaskProgressTrackers") {
              queryCount++; data = { findTaskProgressTrackers: [tracker()] };
            } else if (operation.operationName === "FindTaskProgressMilestones") {
              queryCount++; data = { findTaskProgressMilestones: [milestone()] };
            } else {
              const field = operation.query.definitions[0].selectionSet.selections[0].name.value;
              data = { [field]: true };
            }
            observer.next({ data }); observer.complete();
          })),
        ]),
      });
      window.finish = async field => {
        completed = 100;
        await client.mutate({ mutation: gql('mutation CatalogWrite { ' + field + ' }') });
      };
      window.refreshProgress = () => window.dispatchEvent(new Event("focus"));
      window.queryCount = () => queryCount;
      const Catalogs = () => {
        const history = useHistory();
        const toast = useToast();
        window.saveToast = () => toast.success("Scene saved");
        window.errorToast = () => toast.error("Save failed");
        window.navigate = path => history.push(path);
        return <><TaskProgressAchievementMonitor /><Switch>
          <Route path="/scenes"><h1>Scenes</h1></Route>
          <Route path="/performers"><h1>Performers</h1></Route>
          <Route path="/galleries"><h1>Galleries</h1></Route>
        </Switch><TaskProgressCheckpoints history={[]} percentage={100} compact /></>;
      };
      render(<ApolloProvider client={client}><IntlProvider locale="en" messages={{}}>
        <ToastProvider><MemoryRouter initialEntries={["/scenes"]}><Catalogs /></MemoryRouter></ToastProvider>
      </IntlProvider></ApolloProvider>, document.querySelector("#root"));
    `,
    resolveDir: ui,
    loader: "tsx",
  },
  absWorkingDir: ui,
  tsconfig: resolve(ui, "tsconfig.json"),
  bundle: true,
  write: false,
  logLevel: "silent",
  define: { "process.env.NODE_ENV": '"development"' },
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
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("http://progress-achievements.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
      <body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
    })
  );
  await page.goto("http://progress-achievements.test/");
  await page.waitForFunction(() => window.queryCount() === 2);
  assert.equal(
    await page.locator(".toast-container:not(.hidden) .toast").count(),
    0,
    "initial load does not replay old achievements"
  );
  assert.equal(
    await page.locator(".progress-checkpoints-compact li").count(),
    4
  );
  assert.equal(await page.locator('[title="Alpha Sapphire"]').count(), 1);
  const toast = page.locator(".toast-container:not(.hidden) .toast");
  async function assertToastEntrance(side) {
    await page.waitForFunction(
      (property) =>
        document
          .querySelector(".toast-container:not(.hidden)")
          .getAnimations()
          .some((animation) => animation.transitionProperty === property),
      side
    );
    const entrance = await page
      .locator(".toast-container:not(.hidden)")
      .evaluate((element, property) => {
        const animation = element
          .getAnimations()
          .find((item) => item.transitionProperty === property);
        animation.pause();
        const positions = [0, 250, 500].map((time) => {
          animation.currentTime = time;
          return element.getBoundingClientRect().x;
        });
        const result = {
          positions,
          frames: animation.effect
            .getKeyframes()
            .map((frame) => frame[property]),
          duration: animation.effect.getTiming().duration,
          side: getComputedStyle(element)[property],
          edge: `${
            2 * parseFloat(getComputedStyle(document.documentElement).fontSize)
          }px`,
        };
        animation.play();
        return result;
      }, side);
    assert.equal(
      entrance.duration,
      500,
      "native half-second slide is preserved"
    );
    assert.deepEqual(entrance.frames, ["-350px", entrance.edge]);
    assert.equal(entrance.side, entrance.edge);
    const [start, middle, end] = entrance.positions;
    assert.ok(
      side === "left"
        ? start < middle && middle < end
        : start > middle && middle > end,
      `the toast slides in from the ${side}`
    );
    assert.equal(
      await page.locator(".toast-container.hidden .toast").count(),
      0,
      "the opposite container stays empty during interruption/resume"
    );
  }
  await page.evaluate(() => window.saveToast());
  await toast.getByText("Scene saved", { exact: true }).waitFor();
  await assertToastEntrance("right");
  assert.equal(
    await toast.locator(".progress-achievement-emblem").count(),
    0,
    "ordinary save events have no achievement decoration"
  );
  const nativeStyle = await toast.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    radius: getComputedStyle(element).borderRadius,
    width: getComputedStyle(element).width,
    headerPadding: getComputedStyle(element.querySelector(".toast-header"))
      .padding,
  }));
  await page.evaluate(async () => {
    await window.finish("sceneUpdate");
    window.saveToast();
  });
  await page.waitForFunction(() => window.queryCount() >= 4);
  await toast
    .getByText("Bronze · 25% achieved · Organize scenes", { exact: true })
    .waitFor();
  await assertToastEntrance("left");
  assert.ok(
    (await toast.textContent()).includes("Bronze · 25% achieved"),
    "achievements interrupt the existing success toast"
  );
  await page.evaluate(() => window.navigate("/performers"));
  await page.getByRole("heading", { name: "Performers" }).waitFor();
  await page.evaluate(() => window.refreshProgress());

  const colors = new Set();
  const metals = new Set();
  const tiers = new Map([
    [25, "Bronze"],
    [50, "Silver"],
    [75, "Gold"],
    [100, "Alpha Sapphire"],
  ]);
  for (const kind of ["Tracker", "Milestone"]) {
    const thresholds =
      kind === "Tracker"
        ? [25, 30, 40, 50, 60, 70, 75, 80, 90, 100]
        : Array.from({ length: 16 }, (_, index) => 25 + index * 5);
    for (const threshold of thresholds) {
      const tier = tiers.get(threshold);
      const name = kind === "Tracker" ? "Organize scenes" : "Finish backlog";
      const message = `${
        tier ? `${tier} · ` : ""
      }${threshold}% achieved · ${name}`;
      await toast.getByText(message, { exact: true }).waitFor();
      const emblem = toast.locator(".progress-achievement-emblem");
      assert.equal(await emblem.count(), 1);
      assert.equal(await emblem.getAttribute("aria-hidden"), "true");
      assert.equal(
        await emblem.locator("svg").getAttribute("data-icon"),
        threshold === 100 ? "trophy" : "medal",
        "Alpha Sapphire earns a trophy; other checkpoints earn a medal"
      );
      const metal = await emblem.evaluate(
        (element) => getComputedStyle(element).backgroundImage
      );
      assert.ok(metal.startsWith("linear-gradient("));
      if (tier && kind === "Tracker") metals.add(metal);
      if (kind === "Tracker" && threshold === 25) {
        const animation = await emblem.evaluate((element) => {
          const animations = element.getAnimations({ subtree: true });
          const shimmer = animations.find(
            (item) => item.animationName === "progress-achievement-shimmer"
          );
          const glow = animations.find(
            (item) => item.animationName === "progress-achievement-glow"
          );
          if (!shimmer || !glow) return null;
          animations.forEach((item) => item.pause());
          shimmer.currentTime = 450;
          glow.currentTime = 0;
          const before = {
            swipe: getComputedStyle(element, "::after").transform,
            glow: getComputedStyle(element).filter,
          };
          shimmer.currentTime = 1200;
          glow.currentTime = 1350;
          const after = {
            swipe: getComputedStyle(element, "::after").transform,
            glow: getComputedStyle(element).filter,
          };
          animations.forEach((item) => item.play());
          return { before, after };
        });
        assert.ok(animation, "the medal has shimmer and glow animations");
        assert.notEqual(animation.before.swipe, animation.after.swipe);
        assert.notEqual(animation.before.glow, animation.after.glow);
      }
      if (kind === "Tracker" && threshold === 30) {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const animation = await emblem.evaluate((element) => ({
          emblem: getComputedStyle(element).animationName,
          swipe: getComputedStyle(element, "::after").animationName,
          background: getComputedStyle(element).backgroundImage,
        }));
        assert.equal(animation.emblem, "none");
        assert.equal(animation.swipe, "none");
        assert.equal(animation.background, metal);
        await page.emulateMedia({ reducedMotion: "no-preference" });
      }
      assert.ok(
        (await toast.textContent()).includes(`${threshold}%`),
        "every toast shows its achieved percentage"
      );
      const background = await toast.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      );
      if (tier && kind === "Tracker") colors.add(background);
      assert.equal(
        await toast.locator(".toast-body").count(),
        0,
        "achievements use the same header-only native toast"
      );
      assert.equal(
        await toast.evaluate(
          (element) => getComputedStyle(element).borderRadius
        ),
        nativeStyle.radius
      );
      assert.equal(
        await toast
          .locator(".toast-header")
          .evaluate((element) => getComputedStyle(element).padding),
        nativeStyle.headerPadding
      );
      assert.equal(await toast.getAttribute("role"), "alert");
      if (!tier) {
        assert.equal(
          background,
          "rgb(23, 109, 123)",
          "regular achievements use teal to distinguish them from save events"
        );
        assert.notEqual(background, nativeStyle.background);
      }
      if (kind === "Tracker" && threshold === 40) {
        await page.evaluate(() => window.saveToast());
        assert.equal(
          await toast.getByText(message, { exact: true }).count(),
          1,
          "new success messages cannot interrupt achievements"
        );
        await page.evaluate(() => window.errorToast());
        await toast.getByText("Save failed", { exact: true }).waitFor();
        await assertToastEntrance("right");
        assert.equal(
          await toast.locator(".progress-achievement-emblem").count(),
          0
        );
        await toast.getByRole("button", { name: "Close", exact: true }).click();
        await toast.getByText(message, { exact: true }).waitFor();
        await assertToastEntrance("left");
      }
      for (const width of [320, 393, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        assert.equal(
          await toast.evaluate((element) => getComputedStyle(element).width),
          nativeStyle.width,
          "achievements retain native toast sizing at every viewport"
        );
        const placement = await page
          .locator(".toast-container:not(.hidden)")
          .evaluate((element) => {
            element.getAnimations().forEach((animation) => animation.finish());
            const style = getComputedStyle(element);
            return {
              top: style.top,
              bottom: style.bottom,
              left: style.left,
              marginLeft: style.marginLeft,
              transition: style.transitionProperty,
            };
          });
        assert.equal(
          width < 576 ? placement.bottom : placement.top,
          `${await page.evaluate(
            () =>
              4 *
              parseFloat(getComputedStyle(document.documentElement).fontSize)
          )}px`,
          "achievements use native mobile/desktop placement"
        );
        assert.equal(
          placement.left,
          width < 576
            ? `${width / 2}px`
            : `${await page.evaluate(
                () =>
                  2 *
                  parseFloat(
                    getComputedStyle(document.documentElement).fontSize
                  )
              )}px`
        );
        assert.equal(placement.transition, "left");
        if (width < 576) assert.equal(placement.marginLeft, "-175px");
        const messageBox = await toast
          .locator(".progress-achievement-message")
          .boundingBox();
        const closeBox = await toast
          .getByRole("button", { name: "Close", exact: true })
          .boundingBox();
        assert.ok(messageBox && closeBox);
        assert.ok(
          messageBox.x + messageBox.width <= closeBox.x,
          "the medal and message leave the native close control accessible"
        );
      }
      if (kind === "Tracker" && threshold === 25) {
        await page.waitForTimeout(6100);
        await toast
          .getByText("30% achieved · Organize scenes", { exact: true })
          .waitFor();
      } else {
        if (
          kind === "Tracker" &&
          threshold === 30 &&
          process.env.STASH_PROGRESS_SCREENSHOT
        ) {
          await page.setViewportSize({ width: 393, height: 852 });
          await page.screenshot({
            path: process.env.STASH_PROGRESS_SCREENSHOT,
          });
        }
        if (
          kind === "Tracker" &&
          threshold === 100 &&
          process.env.STASH_PROGRESS_TIER_SCREENSHOT
        ) {
          await toast.screenshot({
            path: process.env.STASH_PROGRESS_TIER_SCREENSHOT,
          });
        }
        await toast.getByRole("button", { name: "Close", exact: true }).click();
      }
    }
  }
  assert.equal(colors.size, 4, "each achievement uses a distinct tier palette");
  assert.equal(
    metals.size,
    4,
    "medals share the four checkpoint metal palettes"
  );
  await toast.getByText("Scene saved", { exact: true }).waitFor();
  await assertToastEntrance("right");
  assert.equal(
    await toast.locator(".progress-achievement-emblem").count(),
    0,
    "the pending success is delivered after every tracker and milestone achievement"
  );
  await toast.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(
    await toast.count(),
    0,
    "all queued achievements dismiss independently"
  );
  await page.evaluate(async () => {
    window.navigate("/galleries");
    await window.finish("galleryUpdate");
    window.refreshProgress();
  });
  await page.getByRole("heading", { name: "Galleries" }).waitFor();
  await page.waitForTimeout(500);
  assert.equal(
    await toast.count(),
    0,
    "route changes and repeated writes do not repeat badges"
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: left achievement and right system entrance animations, preserved height and mobile placement, existing save-toast component, header layout, metallic medals and Alpha Sapphire trophy, shimmer/glow animations, reduced motion, teal 10% tracker and 5% milestone achievements, all 26 queued achievements with percentages/names, errors > achievements > successes, error interruption/resume, deferred success delivery, six-second autohide, dismissal, and duplicate suppression."
  );
} finally {
  await browser.close();
}
