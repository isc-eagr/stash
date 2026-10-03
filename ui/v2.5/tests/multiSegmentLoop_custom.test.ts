import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as selection from "../src/components/ScenePlayer/remoteLoopSelection_custom.ts";
import * as boundary from "../src/components/ScenePlayer/playbackBoundary_custom.ts";
import * as loopState from "../src/components/ScenePlayer/multiSegmentLoopState_custom.ts";
import { showMultiSegmentLoopControlsCustom } from "../src/components/ScenePlayer/multiSegmentLoopSettings_custom.ts";

// Runs the real plugin against a minimal media clock, like remoteLoopSelection.
const pluginExports: Record<string, any> = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL(
        "../src/components/ScenePlayer/multi-segment-loop.ts",
        import.meta.url
      ),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }
  ).outputText,
  {
    exports: pluginExports,
    require: (id: string) =>
      id === "video.js"
        ? {
            getPlugin: () =>
              class {
                constructor(public player: unknown) {}
              },
            registerPlugin() {},
          }
        : id.includes("remoteLoopSelection")
        ? selection
        : id.includes("multiSegmentLoopState")
        ? loopState
        : boundary,
    window: { setTimeout: () => 1, clearTimeout() {} },
  }
);

const A = { id: "a", start: 10, end: 20, title: "A" };
const B = { id: "b", start: 30, end: 40 };
const C = { id: "c", start: 50, end: 60 };
const D = { id: "d", start: 70, end: 80 };

function createLoop(enabled = true) {
  const clock = { time: 0 };
  const player = {
    ready() {},
    paused: () => false,
    seeking: () => false,
    playbackRate: () => 1,
    duration: () => 100,
    currentTime(value?: number) {
      if (value !== undefined) clock.time = value;
      return clock.time;
    },
  };
  const plugin = new pluginExports.default(player);
  for (const name of [
    "renderSegmentMarkers",
    "updateActiveSegmentMarker",
    "clearPendingMarker",
    "renderPendingMarker",
  ])
    plugin[name] = () => {};
  plugin.setSegments([A, B, C, D]);
  if (enabled) plugin.setEnabled(true);
  return { plugin, clock };
}

const current = (plugin: any) => plugin.getCurrentSegment()?.id;

test("subscribers receive a fresh snapshot for every edit", () => {
  const { plugin } = createLoop(false);
  const snapshots: any[] = [];
  const unsubscribe = plugin.subscribe((s: unknown) => snapshots.push(s));
  const before = plugin.getSnapshot();

  plugin.nudgeSegmentBoundary("a", "end", 3);
  plugin.setSegmentBoundaryToCurrentTime("b", "start");
  unsubscribe();
  plugin.removeSegment("c");

  assert.equal(snapshots.length, 2, "listeners stop after unsubscribing");
  assert.equal(before.segments[0].end, 20, "old snapshots are not mutated");
  assert.equal(snapshots[0].segments[0].end, 23);
  assert.equal(snapshots[1].segments[1].start, 0);
  assert.equal(plugin.getSnapshot().segments.length, 3);
});

test("removing an earlier segment keeps the playing segment", () => {
  const { plugin, clock } = createLoop();
  plugin.jumpToSegment(2);
  clock.time = 55;

  plugin.removeSegments(["a"]);
  assert.equal(current(plugin), "c");
  plugin.checkLoop();
  assert.equal(clock.time, 55, "playback continues inside C");

  clock.time = 60;
  plugin.checkLoop();
  assert.equal(clock.time, 70, "C still advances to D");
});

test("removing the playing segment moves to the next one", () => {
  const { plugin, clock } = createLoop();
  plugin.jumpToSegment(2);
  clock.time = 55;

  plugin.removeSegment("c");
  assert.equal(current(plugin), "d");
  plugin.checkLoop();
  assert.equal(clock.time, 70, "never plays the gap before D");

  plugin.jumpToSegment(2);
  plugin.removeSegment("d");
  assert.equal(current(plugin), "a", "removing the last segment wraps");
});

test("seeking into another segment makes it current", () => {
  const { plugin, clock } = createLoop();
  assert.equal(current(plugin), "a");

  clock.time = 52; // user seek into C, in browser event order
  plugin.onSeeking();
  plugin.checkLoop();
  assert.equal(clock.time, 52, "timeupdate during the seek does not advance");
  plugin.onSeeked();
  assert.equal(current(plugin), "c");
  clock.time = 60;
  plugin.checkLoop();
  assert.equal(clock.time, 70, "C advances to D, not B");

  plugin.onSeeked(); // the plugin's own seek to D.start
  assert.equal(current(plugin), "d");

  clock.time = 85; // user seek into a gap while playing
  plugin.onSeeking();
  plugin.onSeeked();
  assert.equal(current(plugin), "d");
  assert.equal(clock.time, 70, "a gap returns to the current segment");
});

test("scrubbing into a gap while paused leaves the playhead", () => {
  const { plugin, clock } = createLoop();
  plugin.player.paused = () => true;
  clock.time = 45;
  plugin.onSeeking();
  plugin.onSeeked();
  assert.equal(clock.time, 45);
  assert.equal(current(plugin), "a");

  clock.time = 55;
  plugin.onSeeked();
  assert.equal(current(plugin), "c", "a paused seek still selects a segment");
});

test("turning the loop on keeps the playhead's segment", () => {
  let { plugin, clock } = createLoop(false);
  clock.time = 55;
  plugin.setEnabled(true);
  assert.equal(current(plugin), "c");
  assert.equal(clock.time, 55, "no seek when already inside a segment");

  ({ plugin, clock } = createLoop(false));
  clock.time = 45;
  plugin.setEnabled(true);
  assert.equal(current(plugin), "c");
  assert.equal(clock.time, 50, "a gap starts at the next segment by time");

  ({ plugin, clock } = createLoop(false));
  clock.time = 90;
  plugin.setEnabled(true);
  assert.equal(current(plugin), "a");
  assert.equal(clock.time, 10, "after the last segment it wraps to the first");
});

test("repeating one segment turns the loop on", () => {
  const { plugin, clock } = createLoop(false);
  plugin.toggleLoopSingle("b");
  assert.equal(plugin.isEnabled(), true);
  assert.equal(clock.time, 30);

  clock.time = 40;
  plugin.checkLoop();
  assert.equal(clock.time, 30, "B repeats");

  plugin.setEnabled(false);
  assert.equal(plugin.getLoopSingleId(), null, "turning off clears repeat");
});

test("loop state helpers", () => {
  const segments = [A, B, C];
  assert.equal(
    loopState.loopSegmentIndexAfterRemoval(segments, 2, new Set(["a", "b"])),
    0
  );
  assert.equal(
    loopState.loopSegmentIndexAfterRemoval(
      segments,
      0,
      new Set(["a", "b", "c"])
    ),
    0
  );
  assert.equal(loopState.findLoopSegmentIndexAtTime(segments, 35, 0), 1);
  assert.equal(
    loopState.findLoopSegmentIndexAtTime(segments, 35, 0, ["c"]),
    -1
  );
  assert.equal(
    loopState.findLoopSegmentIndexAtTime(segments, 29.98, 0),
    1,
    "a seek just before a start still counts"
  );
  assert.deepEqual(loopState.nudgedLoopSegmentBounds(A, "start", -15, 100), {
    start: 0,
    end: 20,
  });
  assert.deepEqual(loopState.nudgedLoopSegmentBounds(A, "end", -15, 100), {
    start: 10,
    end: 10.1,
  });
  assert.deepEqual(loopState.nudgedLoopSegmentBounds(D, "end", 30, 75), {
    start: 70,
    end: 75,
  });
  assert.equal(
    loopState.loopSegmentsMatch([A], [{ start: 10, end: 20 }]),
    true
  );
  assert.equal(loopState.loopSegmentsMatch([A], [B]), false);
});

test("segments count as saved only when a preset matches them", () => {
  const presets = [
    { name: "Best", segments: [A, B] },
    { name: "Solo", segments: [C] },
  ];
  assert.equal(loopState.matchingLoopPresetName([A, B], presets), "Best");
  assert.equal(loopState.matchingLoopPresetName([B, A], presets), undefined);
  assert.equal(loopState.matchingLoopPresetName([], presets), undefined);
});

test("loop controls default on and follow the Custom setting", () => {
  assert.equal(showMultiSegmentLoopControlsCustom(undefined), true);
  assert.equal(showMultiSegmentLoopControlsCustom({}), true);
  assert.equal(
    showMultiSegmentLoopControlsCustom({ showMultiSegmentLoopControls: false }),
    false
  );
});
