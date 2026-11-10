import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getScenePlayerORecordTargetCustom,
  SCENE_PLAYER_O_IDLE_MS,
} from "../src/components/ScenePlayer/scenePlayerORecord_custom.ts";

assert.equal(SCENE_PLAYER_O_IDLE_MS, 2000);
assert.deepEqual(getScenePlayerORecordTargetCustom("scene-1", 125.875), {
  sceneId: "scene-1",
  videoTimestamp: 125.875,
});
assert.equal(getScenePlayerORecordTargetCustom("", 10), undefined);
assert.equal(
  getScenePlayerORecordTargetCustom("scene-1", Number.NaN),
  undefined
);
assert.equal(getScenePlayerORecordTargetCustom("scene-1", -0.001), undefined);

const playerSource = readFileSync(
  new URL("../src/components/ScenePlayer/ScenePlayer.tsx", import.meta.url),
  "utf8"
);
const playerStyles = readFileSync(
  new URL("../src/components/ScenePlayer/styles.scss", import.meta.url),
  "utf8"
);

assert.match(
  playerSource,
  /recordOAtTimestamp\(\{[\s\S]*?id: target\.sceneId,[\s\S]*?video_timestamp: target\.videoTimestamp/,
  "the player O control records the active scene and exact video timestamp"
);
assert.match(
  playerSource,
  /createPortal\([\s\S]*?scene-player-record-o-overlay[\s\S]*?<SweatDrops \/>[\s\S]*?_player\.el\(\)!/,
  "the shared O-count icon is portaled onto the video for normal and fullscreen playback"
);
assert.match(
  playerSource,
  /createPortal\([\s\S]*?scene-player-o-recorded-toast[\s\S]*?_player\.el\(\)!/,
  "recording confirmation is rendered inside the fullscreen player element"
);
assert.match(
  playerSource,
  /player\.on\("useractive", useractive\)[\s\S]*?player\.on\("userinactive", userinactive\)/,
  "the overlay follows Video.js cursor activity and its two-second idle timeout"
);
assert.match(
  playerStyles,
  /\.scene-player-record-o-overlay\s*\{[\s\S]*?right:\s*1\.5rem;[\s\S]*?top:\s*1\.5rem;[\s\S]*?&\.is-hidden\s*\{[\s\S]*?visibility:\s*hidden/,
  "the upper-right O overlay hides when the two-second player idle state begins"
);
