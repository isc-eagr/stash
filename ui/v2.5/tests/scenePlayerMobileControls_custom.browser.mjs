import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

// Use an installed Playwright runtime without adding a production dependency.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_PLAYER_BROWSER_MODULE ||
  "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css =
  readFileSync(require.resolve("video.js/dist/video-js.css"), "utf8") +
  sass.compile(resolve(ui, "src/index.scss"), {
    loadPaths: [ui, resolve(ui, "node_modules")],
    logger: sass.Logger.silent,
  }).css;
const bundle = await esbuild.build({
  stdin: {
    contents: `
      import React from "react";
      import { render } from "react-dom";
      import { IntlProvider } from "react-intl";
      import videojs from "video.js";
      import "videojs-seek-buttons";
      import "./src/components/ScenePlayer/PlaylistButtons.ts";
      import "./src/components/ScenePlayer/autostart-button.ts";
      import "./src/components/ScenePlayer/source-selector.ts";
      import "./src/components/ScenePlayer/big-buttons.ts";
      import { MultiSegmentLoopButtons } from "./src/components/ScenePlayer/MultiSegmentLoopButtons.tsx";
      import abLoop from "videojs-abloop";
      abLoop(window, videojs);
      const player = videojs(document.querySelector("video-js"), {
        controls: true, preload: "none", playbackRates: [0.5, 1, 1.5, 2],
        controlBar: { pictureInPictureToggle: false, chaptersButton: false, volumePanel: { inline: false } },
        plugins: { skipButtons: {}, sourceSelector: {}, autostartButton: { enabled: false }, bigButtons: {},
          abLoopPlugin: { start: 0, end: false, enabled: false, createButtons: true } },
      });
      player.ready(() => {
        const streamMenu = player.sourceSelector().menu;
        streamMenu.setSources([
          { src: "first.mp4", type: "video/mp4", label: "Direct" },
          { src: "second.mp4", type: "video/mp4", label: "Transcoded" },
        ]);
        streamMenu.update();
        player.skipButtons().setForwardHandler(() => { window.skippedNext = true; });
        player.skipButtons().setBackwardHandler(() => { window.skippedPrevious = true; });
        const bar = player.controlBar.el();
        bar.querySelector(".vjs-current-time-display").textContent = "1:23:45";
        bar.querySelector(".vjs-duration-display").textContent = "2:15:59";
        const fullscreen = player.controlBar.getChild("fullscreenToggle").el();
        const button = (className, label) => {
          const element = document.createElement("button");
          element.className = className;
          element.type = "button";
          element.setAttribute("aria-label", label);
          element.textContent = label.slice(0, 1);
          return element;
        };
        for (const [className, label] of [
          ["vjs-negative-marker-skip-btn vjs-button", "Negative markers"],
          ["vjs-performer-image-overlay-btn vjs-button", "Vato images"],
          ["vjs-performer-image-toggle-btn vjs-button", "Image visibility"],
          ["vjs-chromecast-button vjs-control vjs-button", "Chromecast"],
          ["vjs-airplay-button vjs-control vjs-button", "AirPlay"],
        ]) bar.insertBefore(button(className, label), fullscreen);
        const loops = document.createElement("div");
        loops.className = "vjs-control vjs-multi-segment-loop-control";
        bar.insertBefore(loops, fullscreen);
        const loopRoot = document.createElement("div");
        document.body.appendChild(loopRoot);
        render(React.createElement(IntlProvider, { locale: "en", messages: {
          "multi_segment_loop.add_segments": "Add Loop Segments",
          "multi_segment_loop.edit_segments": "Edit Loop Segments",
          "multi_segment_loop.preset_count": "{count} presets",
        } }, React.createElement(MultiSegmentLoopButtons, {
          container: loops, loop: { state: { enabled: false, segments: [] } }, presetCount: 3,
          editorOpen: false, onEditorOpenChange: () => { window.loopEditorOpened = true; },
        })), loopRoot);
        player.addClass("vjs-has-started");
        player.addClass("vjs-touch-enabled");
        player.addClass("vjs-user-active");
        window.player = player;
        window.fixtureReady = true;
      });
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
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("http://player-controls.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
      <body class="application-theme-masculine-black"><div class="VideoPlayer"><div class="video-wrapper"><video-js></video-js></div></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
    })
  );
  await page.goto("http://player-controls.test/");
  await page.waitForFunction(() => window.fixtureReady);

  async function checkControls(width, height, singleRow = false) {
    await page.setViewportSize({ width, height });
    const result = await page.evaluate(() => {
      const player = document.querySelector(".video-js");
      const bar = document.querySelector(".vjs-control-bar");
      const bounds = player.getBoundingClientRect();
      const controls = [
        ...bar.querySelectorAll(
          ":scope > .vjs-control, :scope > .vjs-button, .vjs-multi-segment-loop-btn"
        ),
      ]
        .filter(
          (control) =>
            !control.classList.contains("vjs-progress-control") &&
            control.getBoundingClientRect().width > 0
        )
        .map((control) => {
          const rect = control.getBoundingClientRect();
          return {
            name: control.className,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        });
      const timeline = bar
        .querySelector(".vjs-progress-control")
        .getBoundingClientRect();
      return {
        bounds: {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
        },
        barTop: bar.getBoundingClientRect().top,
        timelineBottom: timeline.bottom,
        controls,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      };
    });
    assert(
      result.controls.some((control) =>
        control.name.includes("vjs-fullscreen-control")
      ),
      "fullscreen remains visible"
    );
    const fullscreen = result.controls.find((control) =>
      control.name.includes("vjs-fullscreen-control")
    );
    assert(
      Math.abs(fullscreen.top - result.barTop) <= 1,
      "fullscreen must stay on the first mobile row"
    );
    for (const selector of [".vjs-playback-rate", ".vjs-skip-button"]) {
      assert(
        await page
          .locator(selector)
          .evaluateAll((elements) =>
            elements.every(
              (element) => getComputedStyle(element).display === "none"
            )
          ),
        `${selector} is hidden on mobile`
      );
    }
    for (const control of result.controls) {
      if (singleRow)
        assert(
          Math.abs(control.top - result.barTop) <= 1,
          `${width}px: ${control.name} must stay in one row`
        );
      assert(
        control.left >= result.bounds.left - 1 &&
          control.right <= result.bounds.right + 1,
        `${width}px: ${control.name} must fit horizontally`
      );
      assert(
        control.top >= result.bounds.top - 1 &&
          control.bottom <= result.bounds.bottom + 1,
        `${width}px: ${control.name} must fit vertically`
      );
    }
    assert(
      result.timelineBottom <= result.barTop + 1,
      "timeline stays above the wrapped controls"
    );
    assert.equal(
      result.scrollWidth,
      result.viewport,
      "toolbar cannot cause horizontal page scrolling"
    );
    const loopButtons = await page
      .locator(".vjs-multi-segment-loop-btn")
      .evaluateAll((buttons) => {
        return buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            top: rect.top,
          };
        });
      });
    assert.equal(
      loopButtons[0].top,
      loopButtons[1].top,
      "loop buttons stay on the same row"
    );
    assert(
      loopButtons[1].left - loopButtons[0].right <= 1,
      "loop buttons cannot leave an unused gap"
    );
    assert(
      await page
        .locator(".vjs-multi-segment-loop-btn svg")
        .evaluateAll((icons) =>
          icons.every((icon) => {
            const glyph = icon.getBoundingClientRect();
            return glyph.width >= 20 && glyph.height >= 20;
          })
        ),
      "mobile loop icons must remain large enough to see"
    );
    assert(
      await page
        .locator(".vjs-multi-segment-loop-btn svg")
        .evaluateAll((icons) =>
          icons.every((icon) => {
            const glyph = icon.getBoundingClientRect();
            const button = icon.closest("button").getBoundingClientRect();
            return glyph.left >= button.left && glyph.right <= button.right;
          })
        ),
      "loop icons must fit inside the compact buttons without clipping"
    );
    for (const selector of [
      ".vjs-fullscreen-control",
      ".vjs-multi-segment-loop-btn",
    ]) {
      const reachable = await page.locator(selector).evaluateAll((buttons) =>
        buttons.every((button) => {
          const rect = button.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
          return hit === button || button.contains(hit);
        })
      );
      assert(
        reachable,
        `${width}px: ${selector} must receive taps without an overlay covering it`
      );
    }
  }

  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [393, 852],
    [430, 932],
    [844, 390],
  ]) {
    await checkControls(width, height);
  }
  await checkControls(393, 852);
  await page
    .getByRole("button", { name: "Edit Loop Segments", exact: true })
    .click();
  assert(
    await page.evaluate(() => window.loopEditorOpened),
    "the actual loop editor button receives taps"
  );
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await page.waitForFunction(() => window.player.isFullscreen());
  await checkControls(393, 852);
  await page.evaluate(() => window.player.exitFullscreen());

  await page.evaluate(() => {
    document
      .querySelector(".VideoPlayer")
      .classList.add(
        "scene-player-hide-chromecast",
        "scene-player-hide-stream",
        "scene-player-hide-autostart"
      );
  });
  for (const selector of [
    ".vjs-chromecast-button",
    ".vjs-source-selector",
    ".vjs-autostart-button",
  ]) {
    assert.equal(
      await page
        .locator(selector)
        .evaluate((element) => getComputedStyle(element).display),
      "none"
    );
  }
  await page.evaluate(() => {
    document
      .querySelectorAll(".abLoopButton")
      .forEach((element) => element.remove());
    const bar = document.querySelector(".vjs-control-bar");
    bar.querySelector(".vjs-current-time-display").textContent = "0:18";
    bar.querySelector(".vjs-duration-display").textContent = "19:59";
  });
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [393, 852],
    [430, 932],
    [844, 390],
  ]) {
    await checkControls(width, height, true);
  }
  await checkControls(393, 852, true);
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await page.waitForFunction(() => window.player.isFullscreen());
  await checkControls(393, 852, true);
  await page.evaluate(() => window.player.exitFullscreen());
  if (process.env.STASH_PLAYER_SCREENSHOT)
    await page.screenshot({ path: process.env.STASH_PLAYER_SCREENSHOT });
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(
    await page
      .locator(".vjs-control-bar")
      .evaluate((bar) => getComputedStyle(bar).flexWrap),
    "nowrap",
    "desktop layout is unchanged"
  );
  for (const selector of [
    ".vjs-control-bar > .vjs-fullscreen-control",
    ".vjs-control-bar > .vjs-playback-rate",
  ]) {
    assert.equal(
      await page
        .locator(selector)
        .evaluate((button) => getComputedStyle(button).order),
      "0",
      "desktop retains its original button order"
    );
  }
  for (const selector of [
    ".vjs-control-bar > .vjs-playback-rate",
    ".vjs-skip-button.vjs-icon-next-item",
    ".vjs-skip-button.vjs-icon-previous-item",
  ]) {
    assert(
      await page.locator(selector).isVisible(),
      `${selector} remains visible on desktop`
    );
  }
  await page.locator(".vjs-skip-button.vjs-icon-next-item").click();
  await page.locator(".vjs-skip-button.vjs-icon-previous-item").click();
  assert(
    await page.evaluate(() => window.skippedNext && window.skippedPrevious),
    "desktop previous/next video buttons remain usable"
  );
  await page
    .getByRole("button", { name: "Playback Rate", exact: true })
    .click();
  await page.getByRole("menuitemradio", { name: "1.5x", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.player.playbackRate()),
    1.5,
    "desktop playback speed remains usable"
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile hides playback speed and previous/next video buttons; remaining standard controls fit one row at 320–430px, landscape and fullscreen; optional controls remain reachable; desktop controls and tap targets verified."
  );
} finally {
  await browser.close();
}
