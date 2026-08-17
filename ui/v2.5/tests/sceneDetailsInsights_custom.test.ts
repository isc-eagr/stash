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

test("scene Details places the shared insight strip after Studio Code and before Description", () => {
  const codeIndex = detailsSource.indexOf("props.scene.code");
  const insightIndex = detailsSource.indexOf("<SceneCardInsights");
  const descriptionIndex = detailsSource.indexOf("{renderDetails()}");

  assert.ok(codeIndex >= 0);
  assert.ok(insightIndex > codeIndex);
  assert.ok(descriptionIndex > insightIndex);
  assert.match(detailsSource, /roleStatsByPerformer=\{roleStatsByPerformer\}/);
  assert.match(detailsSource, /detailPage/);
});
