import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneNegativeMarkersPanel.tsx",
    import.meta.url
  ),
  "utf8"
);

test("Skip tab places total skipped time above the marker list", () => {
  const metricIndex = panelSource.indexOf('id="negative_markers_total_time"');
  const descriptionIndex = panelSource.indexOf(
    'id="negative_markers_description"'
  );
  const listIndex = panelSource.indexOf('className="negative-markers-list"');

  assert.ok(metricIndex >= 0);
  assert.ok(descriptionIndex > metricIndex);
  assert.ok(listIndex > metricIndex);
  assert.match(panelSource, /getSceneNegativeMarkerTotalDuration\(/);
});
