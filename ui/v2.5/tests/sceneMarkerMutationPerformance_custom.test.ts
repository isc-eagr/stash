import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stashServiceSource = readFileSync(
  new URL("../src/core/StashService.ts", import.meta.url),
  "utf8"
);
const performerCardSource = readFileSync(
  new URL("../src/components/Performers/PerformerCard.tsx", import.meta.url),
  "utf8"
);
const negativePanelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneNegativeMarkersPanel.tsx",
    import.meta.url
  ),
  "utf8"
);

test("individual marker saves avoid the complete scene refetch hot path", () => {
  const markerHooks = stashServiceSource.slice(
    stashServiceSource.indexOf("export const useSceneMarkerCreate"),
    stashServiceSource.indexOf("export const useSceneMarkersDestroy")
  );

  assert.doesNotMatch(markerHooks, /awaitRefetchQueries/);
  assert.doesNotMatch(markerHooks, /"FindScene"/);
  assert.doesNotMatch(markerHooks, /fieldName:\s*"findPerformer"/);
  assert.doesNotMatch(markerHooks, /cache\.gc\(/);
  assert.match(markerHooks, /"FindSceneMarkerTags"/);
  assert.match(markerHooks, /"PerformerSceneMarkerRoles"/);
});

test("performer cards share one scene-wide marker-role operation", () => {
  assert.match(performerCardSource, /scenePerformerMarkerRoles\(scene_id:/);
  assert.doesNotMatch(
    performerCardSource,
    /query PerformerSceneMarkerRoles\(\$performer_id:/
  );
});

test("negative marker panel relies on normalized cache updates", () => {
  assert.match(
    negativePanelSource,
    /useSceneNegativeMarkerDestroy\(scene\.id\)/
  );
  assert.doesNotMatch(negativePanelSource, /onRefetch/);
});
