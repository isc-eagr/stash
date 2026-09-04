import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFileSync(`${repoRoot}${path}`, "utf8");

test("organized toggle uses its lightweight mutation", () => {
  const scene = read("ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx");
  const operations = read("ui/v2.5/graphql/mutations/scene.graphql");

  assert.match(scene, /await updateSceneOrganized\(/);
  assert.match(
    operations,
    /mutation SceneOrganizedUpdate[\s\S]*?\bid\b[\s\S]*?\borganized\b[\s\S]*?\bupdated_at\b/
  );
});

test("scene edit and History mutations avoid heavyweight response graphs", () => {
  const operations = read("ui/v2.5/graphql/mutations/scene.graphql");
  const sceneUpdate = operations.match(
    /mutation SceneUpdate[\s\S]*?\n}\n/
  )?.[0];

  assert.ok(sceneUpdate);
  assert.doesNotMatch(sceneUpdate, /\.\.\.SceneData/);
  for (const operation of [
    "SceneAddPlay",
    "SceneDeletePlay",
    "SceneAddO",
    "SceneDeleteO",
  ]) {
    const body = operations.match(
      new RegExp(`mutation ${operation}[\\s\\S]*?\\n}\\n`)
    )?.[0];
    assert.ok(body, `${operation} was not found`);
    assert.doesNotMatch(body, /\bhistory\b/);
    assert.match(body, /\bcount\b/);
  }
});

test("scene edit submits only changed fields", () => {
  const editPanel = read(
    "ui/v2.5/src/components/Scenes/SceneDetails/SceneEditPanel.tsx"
  );

  assert.match(editPanel, /changedSceneEditFieldsCustom\(/);
  assert.match(editPanel, /buildSubmitInputCustom\(/);
});

test("hot scene actions defer full-cache garbage collection", () => {
  const service = read("ui/v2.5/src/core/StashService.ts");

  assert.match(service, /if \(garbageCollect\) cache\.gc\(\)/);
  assert.doesNotMatch(
    service.match(
      /export const useSceneDecrementO[\s\S]*?export const useSceneResetO/
    )?.[0] ?? "",
    /cache\.gc\(\)/
  );
});
