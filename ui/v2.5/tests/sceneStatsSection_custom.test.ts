import assert from "node:assert/strict";
import test from "node:test";
import {
  sceneStatsIncludeSubTagsFromSearch,
  sceneStatsSearchForIncludeSubTags,
  sceneStatsSearchForSection,
  sceneStatsSectionFromSearch,
} from "../src/components/SceneStats/sceneStatsSection_custom";

test("SceneStats restores the Activity Matrix section from the URL", () => {
  assert.equal(
    sceneStatsSectionFromSearch("?section=activity-matrix"),
    "activity-matrix"
  );
  assert.equal(sceneStatsSectionFromSearch("?section=unknown"), "overview");
});

test("SceneStats persists the Activity Matrix sub-tag mode", () => {
  const enabled = sceneStatsSearchForIncludeSubTags(
    "?section=activity-matrix",
    true
  );
  assert.equal(sceneStatsIncludeSubTagsFromSearch(enabled), true);
  assert.equal(
    sceneStatsSearchForIncludeSubTags(enabled, false),
    "?section=activity-matrix"
  );
});

test("SceneStats section URLs preserve unrelated query parameters", () => {
  const matrixSearch = sceneStatsSearchForSection(
    "?existing=value",
    "activity-matrix"
  );
  const parameters = new URLSearchParams(matrixSearch);
  assert.equal(parameters.get("existing"), "value");
  assert.equal(parameters.get("section"), "activity-matrix");

  assert.equal(
    sceneStatsSearchForSection(matrixSearch, "overview"),
    "?existing=value"
  );
});
