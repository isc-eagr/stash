import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const detailsSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneDetailPanel.tsx",
    import.meta.url
  ),
  "utf8"
);

test("scene insights moved from the Details tab to the header date line", () => {
  const sceneSource = readFileSync(
    new URL("../src/components/Scenes/SceneDetails/Scene.tsx", import.meta.url),
    "utf8"
  );
  const insightsSource = readFileSync(
    new URL(
      "../src/components/Scenes/SceneCardInsights_custom.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.doesNotMatch(detailsSource, /<SceneCardInsights/);
  assert.match(
    sceneSource,
    /className="scene-meta-line"[\s\S]*?className="date"[\s\S]*?<SceneDetailInsights scene=\{scene\} \/>/
  );
  assert.match(
    insightsSource,
    /export const SceneDetailInsights[\s\S]*?roleStatsByPerformer=\{roleStatsByPerformer\}[\s\S]*?detailPage/
  );
});

test("StashDB Matches stay in the toolbar, not Details", () => {
  assert.doesNotMatch(detailsSource, /stashdb_matches/);
});

test("scene maintenance dates live after the Edit form and code is absent from Details", () => {
  const editSource = readFileSync(
    new URL(
      "../src/components/Scenes/SceneDetails/SceneEditPanel.tsx",
      import.meta.url
    ),
    "utf8"
  );
  assert.doesNotMatch(
    detailsSource,
    /props\.scene\.(code|created_at|updated_at)/
  );
  const formEnd = editSource.lastIndexOf("</Form>");
  assert.ok(formEnd >= 0);
  for (const field of ["created_at", "updated_at"]) {
    assert.ok(editSource.indexOf(`scene.${field}`) > formEnd);
  }
  assert.match(editSource, /renderInputField\("code", "text", "scene_code"\)/);
});
