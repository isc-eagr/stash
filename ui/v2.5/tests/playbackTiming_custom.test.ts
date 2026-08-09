import assert from "node:assert/strict";
import type { VideoJsPlayer } from "video.js";

import {
  getNegativeMarkerSkipTargetCustom,
  getPlaybackBoundaryLeadCustom,
  NegativeMarkerSkipCoordinatorCustom,
  reachesPlaybackBoundaryCustom,
  startNegativeMarkerSkippingCustom,
} from "../src/components/ScenePlayer/playbackTiming_custom.ts";

assert.equal(
  reachesPlaybackBoundaryCustom(12.344, 12.345, 0.0009),
  false,
  "a boundary does not trigger before its measured frame window"
);
assert.equal(
  reachesPlaybackBoundaryCustom(12.344, 12.345, 0.001),
  true,
  "millisecond segment boundaries retain sub-second precision"
);
assert.equal(
  reachesPlaybackBoundaryCustom(12.245, 12.345, 1 / 30),
  false,
  "multi-segment playback no longer uses the old fixed 100ms margin"
);

assert.equal(
  getPlaybackBoundaryLeadCustom(1 / 60),
  1 / 60,
  "normal playback uses the measured presented-frame duration"
);
assert.equal(
  getPlaybackBoundaryLeadCustom(1 / 60, 2),
  1 / 30,
  "faster playback allows for the larger media-time step between frames"
);

const negativeMarkers = [
  { start_seconds: 20.125, end_seconds: 21.875 },
  { start_seconds: 21.8, end_seconds: 23.25 },
];

assert.equal(
  getNegativeMarkerSkipTargetCustom(20.124, 0.001, negativeMarkers),
  23.25,
  "the frame immediately before a negative marker seeks past overlapping ranges"
);
assert.equal(
  getNegativeMarkerSkipTargetCustom(20.5, 0, negativeMarkers),
  23.25,
  "seeking into a negative marker immediately exits the blocked range"
);
assert.equal(
  getNegativeMarkerSkipTargetCustom(20.123, 0.001, negativeMarkers),
  undefined,
  "clean playback outside the next frame window is not cut early"
);
assert.equal(
  getNegativeMarkerSkipTargetCustom(5, 0, [
    { start_seconds: 8.75, end_seconds: 5 },
  ]),
  8.75,
  "reversed negative-marker endpoints are normalized before playback"
);

const skipCoordinator = new NegativeMarkerSkipCoordinatorCustom();
assert.equal(
  skipCoordinator.beginSkip(20.124, 0.001, negativeMarkers, false, true),
  23.25,
  "the first blocked boundary starts one seek"
);
assert.equal(
  skipCoordinator.beginSkip(20.124, 0.001, negativeMarkers, false, true),
  undefined,
  "presented-frame callbacks cannot restart an in-flight negative-marker seek"
);
assert.equal(
  skipCoordinator.completeSeek(true),
  true,
  "a completed skip resumes when playback was active before the seek"
);
assert.equal(
  skipCoordinator.beginSkip(20.124, 0.001, negativeMarkers, true, true),
  undefined,
  "an unrelated in-flight seek is not replaced by a negative-marker seek"
);

assert.equal(
  skipCoordinator.beginSkip(20.5, 0, negativeMarkers, false, true),
  23.25,
  "a later blocked boundary can seek after the previous seek completes"
);
skipCoordinator.cancelResume();
assert.equal(
  skipCoordinator.completeSeek(true),
  false,
  "an explicit pause during the seek is respected"
);

const playerListeners = new Map<string, Set<() => void>>();
const videoListeners = new Map<string, Set<() => void>>();
let scheduledFrameCallback: VideoFrameRequestCallback | undefined;
let playerIsSeeking = false;
let seekCount = 0;
let playCount = 0;

function addListener(
  listeners: Map<string, Set<() => void>>,
  event: string,
  callback: () => void
) {
  const callbacks = listeners.get(event) ?? new Set<() => void>();
  callbacks.add(callback);
  listeners.set(event, callbacks);
}

function removeListener(
  listeners: Map<string, Set<() => void>>,
  event: string,
  callback: () => void
) {
  listeners.get(event)?.delete(callback);
}

function emit(listeners: Map<string, Set<() => void>>, event: string) {
  listeners.get(event)?.forEach((callback) => callback());
}

const fakeVideo = {
  currentTime: 20.124,
  paused: false,
  playbackRate: 1,
  addEventListener: (event: string, callback: () => void) =>
    addListener(videoListeners, event, callback),
  removeEventListener: (event: string, callback: () => void) =>
    removeListener(videoListeners, event, callback),
  requestVideoFrameCallback: (callback: VideoFrameRequestCallback) => {
    scheduledFrameCallback = callback;
    return 1;
  },
  cancelVideoFrameCallback: () => {},
};

const fakePlayer = {
  tech: () => ({ el: () => fakeVideo }),
  on: (event: string, callback: () => void) =>
    addListener(playerListeners, event, callback),
  off: (event: string, callback: () => void) =>
    removeListener(playerListeners, event, callback),
  paused: () => fakeVideo.paused,
  seeking: () => playerIsSeeking,
  playbackRate: () => fakeVideo.playbackRate,
  currentTime: (target?: number) => {
    if (target !== undefined) {
      seekCount++;
      playerIsSeeking = true;
      fakeVideo.currentTime = target;
    }
    return fakeVideo.currentTime;
  },
  play: () => {
    playCount++;
    fakeVideo.paused = false;
    return Promise.resolve();
  },
} as unknown as VideoJsPlayer;

const stopNegativeMarkerSkipping = startNegativeMarkerSkippingCustom(
  fakePlayer,
  negativeMarkers
);
const blockedBoundaryFrame = {
  mediaTime: 20.124,
} as VideoFrameCallbackMetadata;
scheduledFrameCallback?.(0, blockedBoundaryFrame);
scheduledFrameCallback?.(1, blockedBoundaryFrame);
scheduledFrameCallback?.(2, blockedBoundaryFrame);
assert.equal(
  seekCount,
  1,
  "repeated presented-frame callbacks issue only one currentTime assignment"
);

fakeVideo.paused = true;
playerIsSeeking = false;
emit(playerListeners, "seeked");
emit(videoListeners, "seeked");
assert.equal(
  playCount,
  1,
  "a stalled player resumes once after the skip resolves"
);
stopNegativeMarkerSkipping();
