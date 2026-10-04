import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as selection from "../src/components/ScenePlayer/remoteLoopSelection_custom.ts";
import * as boundary from "../src/components/ScenePlayer/playbackBoundary_custom.ts";
import * as loopState from "../src/components/ScenePlayer/multiSegmentLoopState_custom.ts";
import * as markerRepeat from "../src/components/ScenePlayer/sceneMarkerRepeat_custom.ts";
import { sceneMarkerLoopSegmentCustom } from "../src/components/ScenePlayer/sceneMarkerLoopSegment_custom.ts";
import { showMultiSegmentLoopControlsCustom } from "../src/components/ScenePlayer/multiSegmentLoopSettings_custom.ts";

// Runs the real plugin against a minimal media clock, like remoteLoopSelection.
const pluginExports: Record<string, any> = {};
const timers = new Map<number, { callback: () => void; delay: number }>();
let nextTimerId = 0;
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
        : id.includes("sceneMarkerRepeat")
        ? markerRepeat
        : boundary,
    window: {
      setTimeout(callback: () => void, delay: number) {
        nextTimerId += 1;
        timers.set(nextTimerId, { callback, delay });
        return nextTimerId;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
    },
  }
);

const A = { id: "a", start: 10, end: 20, title: "A" };
const B = { id: "b", start: 30, end: 40 };
const C = { id: "c", start: 50, end: 60 };
const D = { id: "d", start: 70, end: 80 };

function createLoop(enabled = true) {
  timers.clear();
  const clock = { time: 0, paused: false, rate: 1 };
  const player = {
    ready() {},
    paused: () => clock.paused,
    seeking: () => false,
    playbackRate: () => clock.rate,
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

const repeatRange = { start: 82, end: 87, title: "Marker" };
const loopConfiguration = (plugin: any) => {
  const { markerRepeatId, ...configuration } = plugin.getSnapshot();
  return JSON.stringify(configuration);
};

test("marker repeat preserves the entire active loop and resumes its playhead", () => {
  const { plugin, clock } = createLoop();
  plugin.jumpToSegment(2);
  clock.time = 54.25;
  plugin.markPoint();
  plugin.setLoopSingleId("c");
  clock.time = 54.25;
  const before = loopConfiguration(plugin);

  plugin.toggleMarkerRepeat("marker", repeatRange);
  plugin.onSeeking();
  plugin.onSeeked();
  assert.equal(clock.time, 82);
  assert.equal(plugin.getSnapshot().markerRepeatId, "marker");
  assert.equal(loopConfiguration(plugin), before);

  clock.time = 87;
  plugin.checkLoop();
  plugin.onSeeked();
  assert.equal(clock.time, 82, "the marker repeats rather than advancing C");
  assert.equal(loopConfiguration(plugin), before);

  plugin.toggleMarkerRepeat("marker", repeatRange);
  plugin.onSeeking();
  plugin.onSeeked();
  assert.equal(clock.time, 54.25);
  assert.equal(plugin.getSnapshot().markerRepeatId, null);
  assert.equal(loopConfiguration(plugin), before);
  clock.time = 60;
  plugin.checkLoop();
  assert.equal(clock.time, 50, "the previous single-segment loop resumes");
});

test("marker repeat preserves remote subsets and their revision", () => {
  const { plugin, clock } = createLoop();
  const revision = plugin.getRemoteLoopState().loop_revision;
  plugin.selectRemoteSegments(["a", "c"], revision);
  clock.time = 14;
  const before = JSON.stringify(plugin.getRemoteLoopState());
  plugin.toggleMarkerRepeat("marker", repeatRange);
  clock.time = 87;
  plugin.checkLoop();
  assert.equal(JSON.stringify(plugin.getRemoteLoopState()), before);
  plugin.toggleMarkerRepeat("marker", repeatRange);
  assert.equal(clock.time, 14);
  clock.time = 20;
  plugin.checkLoop();
  assert.equal(clock.time, 50, "A still advances directly to C");
});

test("marker repeat with a disabled or empty loop restores regular playback", () => {
  for (const empty of [false, true]) {
    const { plugin, clock } = createLoop(false);
    if (empty) plugin.clearSegments();
    clock.time = 42.75;
    const before = loopConfiguration(plugin);
    plugin.toggleMarkerRepeat("marker", repeatRange);
    clock.time = 87;
    plugin.checkLoop();
    assert.equal(clock.time, 82);
    assert.equal(plugin.isEnabled(), false);
    plugin.toggleMarkerRepeat("marker", repeatRange);
    plugin.onSeeked();
    plugin.checkLoop();
    assert.equal(clock.time, 42.75);
    assert.equal(loopConfiguration(plugin), before);
    assert.equal(plugin.boundaryTimer, null);
  }
});

test("switching repeated markers retains the original resume point", () => {
  const { plugin, clock } = createLoop(false);
  clock.time = 23.5;
  plugin.toggleMarkerRepeat("first", repeatRange);
  clock.time = 84;
  plugin.toggleMarkerRepeat("second", { start: 63, end: 69 });
  assert.equal(clock.time, 63);
  assert.equal(plugin.getSnapshot().markerRepeatId, "second");
  clock.time = 69;
  plugin.checkLoop();
  assert.equal(clock.time, 63);
  plugin.toggleMarkerRepeat("second", { start: 63, end: 69 });
  assert.equal(clock.time, 23.5);
});

test("marker repeat keeps paused scrubbing and resumes at the marker on play", () => {
  const { plugin, clock } = createLoop();
  clock.time = 15;
  clock.paused = true;
  plugin.toggleMarkerRepeat("marker", repeatRange);
  assert.equal(clock.paused, true);
  assert.equal(plugin.boundaryTimer, null);
  clock.time = 45;
  plugin.onSeeking();
  plugin.onSeeked();
  assert.equal(clock.time, 45, "paused scrubbing is left alone");
  clock.paused = false;
  plugin.onPlaying();
  assert.equal(clock.time, 82, "playing returns to the temporary marker");
  plugin.onSeeked();
  clock.time = 55;
  plugin.onSeeking();
  plugin.onSeeked();
  assert.equal(clock.time, 82, "a seek cannot change the configured segment");
  assert.equal(current(plugin), "a");
  clock.paused = true;
  plugin.onPause();
  plugin.toggleMarkerRepeat("marker", repeatRange);
  assert.equal(clock.time, 15);
  assert.equal(clock.paused, true);
});

test("temporary marker uses precise rate-aware timers and survives stalls", () => {
  const { plugin, clock } = createLoop(false);
  clock.time = 25;
  clock.rate = 2;
  plugin.toggleMarkerRepeat("marker", repeatRange);
  assert.equal(timers.get(plugin.boundaryTimer)?.delay, 2500);
  clock.time = 86.9;
  timers.get(plugin.boundaryTimer)!.callback();
  assert.equal(clock.time, 86.9, "a stalled media clock does not loop early");
  assert.ok(Math.abs(timers.get(plugin.boundaryTimer)!.delay - 50) < 0.001);
  clock.time = 87;
  timers.get(plugin.boundaryTimer)!.callback();
  assert.equal(clock.time, 82);
  clock.rate = 0.5;
  plugin.boundRescheduleBoundary();
  assert.equal(timers.get(plugin.boundaryTimer)?.delay, 10000);
  plugin.toggleMarkerRepeat("marker", repeatRange);
  assert.equal(plugin.boundaryTimer, null, "stopping clears the repeat timer");
});

test("marker repeat uses open-marker fallback and clamps at the media end", () => {
  const { plugin, clock } = createLoop(false);
  clock.time = 12;
  plugin.toggleMarkerRepeat(
    "open",
    sceneMarkerLoopSegmentCustom({ seconds: 92 }, "Open")
  );
  assert.equal(clock.time, 92);
  assert.equal(timers.get(plugin.boundaryTimer)?.delay, 8000);
  let playCalls = 0;
  plugin.player.play = () => {
    playCalls += 1;
    clock.paused = false;
    return Promise.resolve();
  };
  clock.time = 100;
  clock.paused = true;
  plugin.boundOnEnded();
  assert.equal(clock.time, 92);
  assert.equal(playCalls, 1, "reaching the file end restarts the marker");
  plugin.toggleMarkerRepeat("open", repeatRange);
  assert.equal(clock.time, 12);
});

test("invalid marker ranges leave playback and active repeat unchanged", () => {
  const { plugin, clock } = createLoop(false);
  clock.time = 23;
  for (const range of [
    { start: NaN, end: 25 },
    { start: 5, end: Infinity },
    { start: 50, end: 40 },
    { start: 110, end: 115 },
  ]) {
    plugin.toggleMarkerRepeat("invalid", range);
    assert.equal(clock.time, 23);
    assert.equal(plugin.getSnapshot().markerRepeatId, null);
  }
  plugin.toggleMarkerRepeat("valid", repeatRange);
  plugin.toggleMarkerRepeat("invalid", { start: 90, end: 89 });
  assert.equal(plugin.getSnapshot().markerRepeatId, "valid");
  assert.equal(clock.time, 82);
});

test("source replacement ends temporary repeat without seeking the old video", () => {
  const { plugin, clock } = createLoop();
  const before = loopConfiguration(plugin);
  plugin.toggleMarkerRepeat("marker", repeatRange);
  clock.time = 0;
  plugin.boundClearSeek();
  assert.equal(clock.time, 0);
  assert.equal(plugin.getSnapshot().markerRepeatId, null);
  assert.equal(loopConfiguration(plugin), before);
  assert.equal(plugin.boundaryTimer, null);
});

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
