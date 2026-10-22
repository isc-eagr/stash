import assert from "node:assert/strict";
import test from "node:test";
import {
  sceneStatsFlagFromSearch,
  sceneStatsSearchForFlag,
  sceneStatsSearchForSection,
  sceneStatsSectionFromSearch,
} from "../src/components/SceneStats/sceneStatsSection_custom";

test("SceneStats restores the Activity Matrix section from the URL", () => {
  assert.equal(
    sceneStatsSectionFromSearch("?section=activity-matrix"),
    "activity-matrix"
  );
  assert.equal(
    sceneStatsSectionFromSearch("?section=stashdb-matches"),
    "stashdb-matches"
  );
  assert.equal(sceneStatsSectionFromSearch("?section=unknown"), "overview");
  // Activity & Ratings moved onto the overview; old links land there.
  assert.equal(sceneStatsSectionFromSearch("?section=insights"), "overview");
});

test("SceneStats persists its switches in the URL", () => {
  for (const flag of ["includeSubTags", "hideFew"] as const) {
    const enabled = sceneStatsSearchForFlag(
      "?section=activity-matrix",
      flag,
      true
    );
    assert.equal(sceneStatsFlagFromSearch(enabled, flag), true, flag);
    assert.equal(
      sceneStatsSearchForFlag(enabled, flag, false),
      "?section=activity-matrix",
      flag
    );
  }
  assert.equal(
    sceneStatsFlagFromSearch("?includeSubTags=true", "hideFew"),
    false
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
