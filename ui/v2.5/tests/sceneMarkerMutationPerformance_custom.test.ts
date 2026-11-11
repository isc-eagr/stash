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
const ownerHooksSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/useSceneMarkerOwner_custom.ts",
    import.meta.url
  ),
  "utf8"
);
const markerFormSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneMarkerForm.tsx",
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
    /useSceneMarkerOwnerMutationsCustom\(\{\s*sceneId: scene\.id,/
  );
  assert.match(
    ownerHooksSource,
    /useSceneNegativeMarkerDestroy\(\s*owner\.sceneId\s*\)/
  );
  assert.doesNotMatch(negativePanelSource, /onRefetch/);
});

test("multi-mutation marker splits suppress intermediate grouped refetches", () => {
  const splitSave = markerFormSource.slice(
    markerFormSource.indexOf("if (isInsertBetween && marker)"),
    markerFormSource.indexOf(
      '} else if (isNew && input.insert_mode === "negative-marker")'
    )
  );

  // The inserted marker or skip range and the right side defer; the final
  // source update refreshes.
  assert.equal(
    splitSave.match(/deferRefresh: true/g)?.length,
    3,
    "only the final source update should trigger the authoritative marker-group refresh"
  );
  assert.match(
    splitSave,
    /leftEndSeconds,\s*\}\),\s*\{ id: marker\.id \}\s*\);/
  );
  assert.match(
    ownerHooksSource,
    /options\?\.deferRefresh \? \{ refetchQueries: \[\] \} : \{\}/
  );
});
