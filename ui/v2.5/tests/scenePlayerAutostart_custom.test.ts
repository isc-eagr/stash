import assert from "node:assert/strict";
import {
  shouldAutostartSceneCustom,
  seekScenePlayerTimestampCustom,
} from "../src/components/ScenePlayer/scenePlayerAutostart_custom.ts";

for (const config of [
  undefined,
  null,
  {},
  { autostartVideo: false, autostartVideoOnPlaySelected: false },
]) {
  for (const requested of [false, true]) {
    assert.equal(
      shouldAutostartSceneCustom(config, requested),
      false,
      "disabled Auto Start stays off for ordinary scenes, queue and timestamp links"
    );
  }
}

assert.equal(
  shouldAutostartSceneCustom({ autostartVideo: true }, false),
  true,
  "Auto-start video can still be explicitly enabled later"
);
assert.equal(
  shouldAutostartSceneCustom({ autostartVideoOnPlaySelected: true }, true),
  true,
  "explicitly enabling Auto Start on selected scenes permits requested playback"
);
assert.equal(
  shouldAutostartSceneCustom({ autostartVideoOnPlaySelected: true }, false),
  false,
  "the selected-scene preference does not auto-start ordinary scene pages"
);

for (const paused of [false, true]) {
  const state = { time: 12, paused, playCalls: 0, pauseCalls: 0 };
  const player = {
    currentTime(value?: number) {
      if (value !== undefined) state.time = value;
      return state.time;
    },
    play() {
      state.paused = false;
      state.playCalls += 1;
    },
    pause() {
      state.paused = true;
      state.pauseCalls += 1;
    },
  };
  seekScenePlayerTimestampCustom(player, 42);
  assert.deepEqual(
    state,
    { time: 42, paused, playCalls: 0, pauseCalls: 0 },
    "timestamp clicks seek while keeping playing videos playing and paused videos paused"
  );
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    seekScenePlayerTimestampCustom(player, invalid);
    assert.equal(state.time, 42, "invalid timestamps cannot change playback");
  }
}
seekScenePlayerTimestampCustom(null, 42);
