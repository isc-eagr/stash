import assert from "node:assert/strict";

import {
  formatTimerCountdown,
  timerCountdownColor,
  timerCountdownMinutesToSeconds,
  timerCountdownPercentage,
  timerCountdownRemainingSeconds,
  timerCountdownTiming,
} from "../src/components/TaskProgress/taskProgressTimer_custom.ts";

assert.equal(timerCountdownMinutesToSeconds(5), 300);
assert.equal(timerCountdownMinutesToSeconds(0), undefined);
assert.equal(timerCountdownMinutesToSeconds(1441), undefined);

assert.equal(timerCountdownPercentage(300, 300), 100);
assert.equal(timerCountdownPercentage(0, 300), 0);
assert.equal(timerCountdownPercentage(500, 300), 100);

assert.equal(timerCountdownRemainingSeconds(10_000, 9_501), 1);
assert.equal(timerCountdownRemainingSeconds(10_000, 10_000), 0);
assert.equal(
  timerCountdownRemainingSeconds(10_000, 11_000),
  0,
  "pausing after the end time cannot produce negative time"
);
assert.deepEqual(timerCountdownTiming(10_000, 300, 9_501), {
  remainingSeconds: 1,
  overtimeSeconds: 0,
  elapsedSeconds: 299,
});
assert.deepEqual(timerCountdownTiming(10_000, 300, 11_000), {
  remainingSeconds: 0,
  overtimeSeconds: 1,
  elapsedSeconds: 301,
});

assert.equal(timerCountdownColor(100), "green");
assert.equal(timerCountdownColor(80), "green");
assert.equal(timerCountdownColor(79.99), "light-green");
assert.equal(timerCountdownColor(60), "light-green");
assert.equal(timerCountdownColor(59.99), "yellow");
assert.equal(timerCountdownColor(40), "yellow");
assert.equal(timerCountdownColor(39.99), "orange");
assert.equal(timerCountdownColor(20), "orange");
assert.equal(timerCountdownColor(19.99), "red");
assert.equal(timerCountdownColor(0), "red");

assert.equal(formatTimerCountdown(0), "00:00");
assert.equal(formatTimerCountdown(305), "05:05");
assert.equal(formatTimerCountdown(3661), "01:01:01");
