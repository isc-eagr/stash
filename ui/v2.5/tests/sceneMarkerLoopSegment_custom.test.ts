import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sceneMarkerLoopSegmentCustom } from "../src/components/ScenePlayer/sceneMarkerLoopSegment_custom.ts";

test("loop action uses the full saved marker range", () => {
  assert.deepEqual(
    sceneMarkerLoopSegmentCustom({ seconds: 12, end_seconds: 48 }, "Action"),
    { start: 12, end: 48, title: "Action" }
  );
});

test("loop action matches the Markers panel fallback for markers without ends", () => {
  assert.deepEqual(sceneMarkerLoopSegmentCustom({ seconds: 12 }, "Action"), {
    start: 12,
    end: 32,
    title: "Action",
  });
  assert.deepEqual(
    sceneMarkerLoopSegmentCustom({ seconds: 12, end_seconds: 12 }, "Action"),
    { start: 12, end: 13, title: "Action" }
  );
});

test("timeline marker action reaches the scene loop API", () => {
  const markersSource = readFileSync(
    new URL("../src/components/ScenePlayer/markers.ts", import.meta.url),
    "utf8"
  );
  const playerSource = readFileSync(
    new URL("../src/components/ScenePlayer/ScenePlayer.tsx", import.meta.url),
    "utf8"
  );
  const sceneSource = readFileSync(
    new URL("../src/components/Scenes/SceneDetails/Scene.tsx", import.meta.url),
    "utf8"
  );

  assert.match(markersSource, /Send Marker to Loop/);
  assert.match(markersSource, /this\.onMarkerAddToLoop\?\.\(loopMarker\)/);
  assert.match(
    playerSource,
    /setOnMarkerAddToLoop\([\s\S]*?sceneMarkerLoopSegmentCustom\(/
  );
  assert.match(
    sceneSource,
    /addMultiSegmentLoopSegments=\{addMultiSegmentLoopSegments\}/
  );
});
