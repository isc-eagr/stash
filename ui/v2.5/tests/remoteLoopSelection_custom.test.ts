import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as selection from "../src/components/ScenePlayer/remoteLoopSelection_custom";
import * as boundary from "../src/components/ScenePlayer/playbackBoundary_custom";

// Exercise the actual plugin with a minimal media clock and no browser renderer.
const exports: Record<string, any> = {};
const videojs = {
  getPlugin: () =>
    class {
      constructor(public player: any) {}
    },
  registerPlugin() {},
};
const source = readFileSync(
  new URL(
    "../src/components/ScenePlayer/multi-segment-loop.ts",
    import.meta.url
  ),
  "utf8"
);
runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
  {
    exports,
    require: (id: string) =>
      id === "video.js"
        ? videojs
        : id.includes("remoteLoopSelection")
        ? selection
        : boundary,
    window: { setTimeout: () => 1, clearTimeout() {} },
  }
);
let time = 0;
const player = {
  ready() {},
  paused: () => false,
  playbackRate: () => 1,
  currentTime(value?: number) {
    if (value !== undefined) time = value;
    return time;
  },
};
const plugin = new exports.default(player);
for (const name of [
  "renderSegmentMarkers",
  "updateActiveSegmentMarker",
  "clearPendingMarker",
])
  plugin[name] = () => {};
const segments = [
  { id: "a", start: 0, end: 5 },
  { id: "b", start: 10, end: 15 },
  { id: "c", start: 20, end: 25 },
];
plugin.setSegments(segments);
plugin.setEnabled(true);
const revision = plugin.getRemoteLoopState().loop_revision;
assert.equal(plugin.selectRemoteSegments(["c", "a"], revision), true);
time = 5;
plugin.checkLoop();
assert.equal(time, 20, "subset follows original order and skips B");
time = 25;
plugin.checkLoop();
assert.equal(time, 0, "subset wraps to A");
assert.equal(plugin.selectRemoteSegments(["b"], revision), true);
assert.equal(time, 10, "selecting an excluded segment seeks immediately");
time = 15;
plugin.checkLoop();
assert.equal(time, 10, "one selected segment repeats");
time = 40;
plugin.selectRemoteSegments(["b"], revision);
assert.equal(
  time,
  10,
  "selection seeks back when the clock is outside the current segment"
);
plugin.selectRemoteSegments([], revision);
time = 15;
plugin.checkLoop();
assert.equal(time, 20, "deselect all restores original loop");
assert.equal(
  JSON.stringify(plugin.getSegments()),
  JSON.stringify(segments),
  "selection never edits saved segments"
);
assert.equal(plugin.selectRemoteSegments(["missing"], revision), false);
assert.equal(plugin.selectRemoteSegments(["a"], "old"), false);
plugin.selectRemoteSegments(["a"], revision);
plugin.setEnabled(false);
assert.equal(plugin.getRemoteLoopState().selected_segment_ids.length, 0);
assert.equal(plugin.selectRemoteSegments(["a"], revision), false);
plugin.setEnabled(true);
plugin.selectRemoteSegments(["a"], plugin.getRemoteLoopState().loop_revision);
plugin.setSegments(segments);
assert.equal(
  plugin.getRemoteLoopState().selected_segment_ids.length,
  0,
  "replacing a loop clears selection"
);

const toastExports: Record<string, any> = {};
const callbacks = new Map<string, () => void>();
let timeout = 0;
let expire = () => {};
let removed = false;
let host = "";
const normal = {
  appendChild: () => {
    host = "player";
  },
};
const fullscreen = {
  appendChild: () => {
    host = "fullscreen";
  },
};
const document = {
  fullscreenElement: fullscreen as typeof fullscreen | null,
  body: normal,
  createElement: () => ({
    style: {},
    setAttribute() {},
    remove: () => {
      removed = true;
    },
  }),
  addEventListener: (event: string, fn: () => void) => callbacks.set(event, fn),
  removeEventListener: (event: string) => callbacks.delete(event),
};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL(
        "../src/components/RemoteO/remoteToast_custom.ts",
        import.meta.url
      ),
      "utf8"
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  {
    exports: toastExports,
    document,
    window: {
      setTimeout: (fn: () => void, ms: number) => {
        expire = fn;
        timeout = ms;
        return 1;
      },
      clearTimeout() {},
    },
  }
);
toastExports.showRemoteToastCustom("O recorded", normal);
assert.equal(host, "fullscreen");
assert.equal(timeout, 1000);
document.fullscreenElement = null;
callbacks.get("fullscreenchange")!();
assert.equal(host, "player", "toast follows fullscreen exit");
expire();
assert.equal(removed, true);
assert.equal(callbacks.size, 0, "timeout cleans up fullscreen listener");
console.log("Remote loop playback and fullscreen toast tests passed.");
