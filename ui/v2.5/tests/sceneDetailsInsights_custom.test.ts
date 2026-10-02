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

test("scene Details leads with shared insights before Description", () => {
  const insightIndex = detailsSource.indexOf("<SceneCardInsights");
  const descriptionIndex = detailsSource.indexOf("{renderDetails()}");

  assert.ok(insightIndex >= 0);
  assert.ok(descriptionIndex > insightIndex);
  assert.match(detailsSource, /roleStatsByPerformer=\{roleStatsByPerformer\}/);
  assert.match(detailsSource, /detailPage/);
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
