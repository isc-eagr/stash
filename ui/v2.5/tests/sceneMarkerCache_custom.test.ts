import assert from "node:assert/strict";
import test from "node:test";
import {
  removeCacheReferenceCustom,
  upsertCacheReferenceCustom,
} from "../src/core/sceneMarkerCache_custom";

test("marker cache insertion appends a new normalized reference", () => {
  const existing = [{ __ref: "SceneMarker:1" }];

  assert.deepEqual(
    upsertCacheReferenceCustom(existing, { __ref: "SceneMarker:2" }),
    [{ __ref: "SceneMarker:1" }, { __ref: "SceneMarker:2" }]
  );
  assert.deepEqual(existing, [{ __ref: "SceneMarker:1" }]);
});

test("marker cache insertion does not duplicate an existing reference", () => {
  const existing = [{ __ref: "SceneMarker:1" }];

  assert.equal(
    upsertCacheReferenceCustom(existing, { __ref: "SceneMarker:1" }),
    existing
  );
});

test("marker cache removal only removes the requested normalized reference", () => {
  assert.deepEqual(
    removeCacheReferenceCustom(
      [{ __ref: "SceneMarker:1" }, { __ref: "SceneMarker:2" }],
      "SceneMarker:1"
    ),
    [{ __ref: "SceneMarker:2" }]
  );
});
