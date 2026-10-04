import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

// Real Video.js playback and hover actions, without a backend or library media.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STASH_PLAYER_BROWSER_MODULE ||
  "playwright");
const esbuild = createRequire(require.resolve("vite"))("esbuild");
const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const video = execFileSync(process.env.STASH_PLAYER_FFMPEG || "ffmpeg", [
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "color=c=gray:s=160x90:r=30",
  "-t",
  "12",
  "-an",
  "-c:v",
  "libx264",
  "-bf",
  "0",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "frag_keyframe+empty_moov",
  "-f",
  "mp4",
  "pipe:1",
]).toString("base64");
const css =
  readFileSync(require.resolve("video.js/dist/video-js.css"), "utf8") +
  sass.compile(resolve(ui, "src/index.scss"), {
    loadPaths: [ui, resolve(ui, "node_modules")],
    logger: sass.Logger.silent,
  }).css;
const bundle = await esbuild.build({
  stdin: {
    contents: `
      import videojs from "video.js";
      import "./src/components/ScenePlayer/markers.ts";
      import "./src/components/ScenePlayer/multi-segment-loop.ts";
      import { sceneMarkerLoopSegmentCustom } from "./src/components/ScenePlayer/sceneMarkerLoopSegment_custom.ts";
      const player = videojs(document.querySelector("video-js"), {
        controls: true, muted: true, preload: new URLSearchParams(location.search).get("preload") || "auto", fluid: true,
        sources: [{ src: "data:video/mp4;base64,${video}", type: "video/mp4" }],
        plugins: { markers: {}, multiSegmentLoop: {} },
      });
      window.player = player;
      player.ready(() => {
        const markers = player.markers();
        const loop = player.multiSegmentLoop();
        markers.setOnMarkerAddToLoop(marker => loop.addSegments([sceneMarkerLoopSegmentCustom(marker, marker.title)]));
        markers.setOnMarkerRepeat(
          marker => loop.toggleMarkerRepeat(marker.id, sceneMarkerLoopSegmentCustom(marker, marker.title)),
          marker => loop.getSnapshot().markerRepeatId === marker.id
        );
        const setupMarkers = () => {
          markers.setFallbackDuration(12);
          markers.addRangeMarkers([{ id: "range", title: "Range", seconds: 1, end_seconds: 2.5,
            primaryTag: { id: "tag", name: "Activity" } }]);
          markers.addDotMarkers([{ id: "open", title: "Open", seconds: 9, end_seconds: null,
            primaryTag: { id: "tag", name: "Activity" } }]);
          markers.addNegativeMarkers([{ id: "negative", name: "Skip", start_seconds: 7, end_seconds: 8 }]);
          player.addClass("vjs-has-started");
          player.addClass("vjs-user-active");
          window.fixtureReady = true;
        };
        if (new URLSearchParams(location.search).get("preload") === "none") setupMarkers();
        else player.one("loadedmetadata", setupMarkers);
      });
    `,
    resolveDir: ui,
    loader: "ts",
  },
  absWorkingDir: ui,
  tsconfig: resolve(ui, "tsconfig.json"),
  bundle: true,
  write: false,
  logLevel: "silent",
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("http://marker-repeat.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
      body { padding-top: 260px; } .VideoPlayer { width: 100%; max-width: 800px; margin: auto; }
      </style></head><body class="application-theme-masculine-black"><div class="VideoPlayer">
      <div class="video-wrapper"><video-js></video-js></div></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
    })
  );
  await page.goto("http://marker-repeat.test/");
  await page.waitForFunction(() => window.fixtureReady);
  const repeatButton = page.locator(".scene-marker-timeline-repeat");
  const range = page.locator(".vjs-marker-range").first();
  const configuration = () =>
    page.evaluate(() => {
      const { markerRepeatId, ...state } = window.player
        .multiSegmentLoop()
        .getSnapshot();
      return state;
    });
  const settled = () => page.waitForFunction(() => !window.player.seeking());
  const hoverRange = async () => {
    await range.hover();
    await repeatButton.waitFor({ state: "visible" });
  };

  await page.evaluate(() => {
    const player = window.player;
    player.currentTime(4.25);
    player.multiSegmentLoop().setSegments([
      { id: "a", start: 4, end: 5, title: "First" },
      { id: "b", start: 6, end: 7, title: "Second" },
    ]);
    player.multiSegmentLoop().setEnabled(true);
    player.multiSegmentLoop().markPoint();
  });
  await settled();
  const before = await configuration();
  await hoverRange();
  assert.equal(
    await repeatButton.getAttribute("title"),
    "Put this marker on repeat"
  );
  assert.equal(await repeatButton.getAttribute("aria-pressed"), "false");
  assert(
    await page
      .getByRole("button", { name: "Send Marker to Loop", exact: true })
      .isVisible()
  );
  await repeatButton.click();
  await settled();
  assert.equal(await page.evaluate(() => window.player.currentTime()), 1);
  assert(
    await page.evaluate(() => window.player.paused()),
    "clicking repeat preserves paused playback"
  );
  assert.deepEqual(await configuration(), before);

  await page.evaluate(() => {
    window.markerWraps = 0;
    window.player.on("seeked", () => {
      if (
        window.player.multiSegmentLoop().getSnapshot().markerRepeatId ===
          "range" &&
        Math.abs(window.player.currentTime() - 1) < 0.05
      )
        window.markerWraps += 1;
    });
    window.player.playbackRate(2);
    return window.player.play();
  });
  await page.waitForFunction(() => window.markerWraps >= 2);
  assert.deepEqual(
    await configuration(),
    before,
    "real media wraps preserve loop configuration"
  );
  await page.evaluate(() => window.player.pause());
  await hoverRange();
  assert.equal(await repeatButton.textContent(), "Stop Repeating");
  assert.equal(await repeatButton.getAttribute("aria-pressed"), "true");
  await repeatButton.click();
  await settled();
  assert.equal(await page.evaluate(() => window.player.currentTime()), 4.25);
  assert.deepEqual(await configuration(), before);
  await page.evaluate(() => {
    window.resumedSecond = false;
    window.player.on("seeked", () => {
      if (
        !window.player.multiSegmentLoop().getSnapshot().markerRepeatId &&
        Math.abs(window.player.currentTime() - 6) < 0.05
      )
        window.resumedSecond = true;
    });
    return window.player.play();
  });
  await page.waitForFunction(() => window.resumedSecond);
  await page.evaluate(() => {
    window.player.pause();
    window.player.multiSegmentLoop().setEnabled(false);
    window.player.currentTime(3.125);
  });
  await settled();

  // The same compact hover action stays inside a narrow fullscreen player.
  await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() => window.player.requestFullscreen());
  await page.waitForFunction(() => !!document.fullscreenElement);
  await hoverRange();
  const bounds = await repeatButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const player = button.closest(".video-js").getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      playerLeft: player.left,
      playerRight: player.right,
    };
  });
  assert(
    bounds.left >= bounds.playerLeft && bounds.right <= bounds.playerRight
  );
  await repeatButton.click();
  await settled();
  await hoverRange();
  await repeatButton.click();
  await settled();
  assert.equal(await page.evaluate(() => window.player.currentTime()), 3.125);
  assert.equal(
    await page.evaluate(() => window.player.multiSegmentLoop().isEnabled()),
    false
  );
  await page.evaluate(() => window.player.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement);

  // Open-ended markers use the duration-capped fallback and repeat at EOF.
  await page.locator(".vjs-marker").hover();
  await repeatButton.click();
  await settled();
  assert.equal(await page.evaluate(() => window.player.currentTime()), 9);
  await page.evaluate(() => {
    window.fileEndWrap = false;
    window.player.on("seeked", () => {
      if (
        window.player.multiSegmentLoop().getSnapshot().markerRepeatId ===
          "open" &&
        Math.abs(window.player.currentTime() - 9) < 0.05
      )
        window.fileEndWrap = true;
    });
    return window.player.play();
  });
  await page.waitForFunction(() => window.fileEndWrap);
  assert.equal(
    await page.evaluate(
      () => window.player.multiSegmentLoop().getSnapshot().markerRepeatId
    ),
    "open"
  );
  await page.evaluate(() => window.player.pause());
  await page.locator(".vjs-marker").hover();
  await repeatButton.click();
  await settled();
  assert.equal(await page.evaluate(() => window.player.currentTime()), 3.125);

  await page.evaluate(() => window.player.dispose());
  await page.goto("http://marker-repeat.test/?preload=none");
  await page.waitForFunction(() => window.fixtureReady);
  assert.equal(await page.evaluate(() => window.player.readyState()), 0);
  await hoverRange();
  await repeatButton.click();
  assert.equal(
    await page.evaluate(
      () => window.player.multiSegmentLoop().getSnapshot().markerRepeatId
    ),
    "range"
  );
  await page.evaluate(() => {
    window.unloadedWrap = false;
    window.player.on("seeked", () => {
      if (
        window.player.multiSegmentLoop().getSnapshot().markerRepeatId ===
          "range" &&
        Math.abs(window.player.currentTime() - 1) < 0.05
      )
        window.unloadedWrap = true;
    });
    window.player.playbackRate(2);
    return window.player.play();
  });
  await page.waitForFunction(() => window.unloadedWrap);
  await page.evaluate(() => window.player.pause());
  await hoverRange();
  await repeatButton.click();
  await settled();
  assert.equal(await page.evaluate(() => window.player.currentTime()), 0);

  assert.deepEqual(errors, []);
  await page.evaluate(() => window.player.dispose());
  console.log(
    "PASS: hover repeat/stop, real media wraps, preserved loop, exact resume, paused and unloaded playback, narrow fullscreen, and open marker at EOF."
  );
} finally {
  await browser.close();
}
