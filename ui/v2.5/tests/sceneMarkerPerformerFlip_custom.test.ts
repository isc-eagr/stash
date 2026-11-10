import assert from "node:assert/strict";
import test from "node:test";

import { getFlippedSceneMarkerPerformers } from "../src/components/Scenes/SceneDetails/sceneMarkerPerformerFlip_custom.ts";

test("Flip swaps every performer and the pending Save IDs without mutating selections", () => {
  const top = [
    { id: "1", name: "First" },
    { id: "2", name: "Second" },
  ];
  const bottom = [{ id: "3", name: "Third" }, top[0]];
  const originalTop = structuredClone(top);
  const originalBottom = structuredClone(bottom);
  const flipped = getFlippedSceneMarkerPerformers(top, bottom);

  assert.deepEqual(flipped, {
    topPerformers: originalBottom,
    bottomPerformers: originalTop,
    top_performer_ids: ["3", "1"],
    bottom_performer_ids: ["1", "2"],
  });
  assert.deepEqual(top, originalTop);
  assert.deepEqual(bottom, originalBottom);
  assert.deepEqual(
    getFlippedSceneMarkerPerformers(
      flipped.topPerformers,
      flipped.bottomPerformers
    ),
    {
      topPerformers: originalTop,
      bottomPerformers: originalBottom,
      top_performer_ids: ["1", "2"],
      bottom_performer_ids: ["3", "1"],
    }
  );
});

test("Flip moves a one-sided selection and accepts empty selections", () => {
  const performer = { id: "1" };
  for (const [top, bottom] of [
    [[performer], []],
    [[], [performer]],
    [[], []],
  ]) {
    const flipped = getFlippedSceneMarkerPerformers(top, bottom);
    assert.deepEqual(flipped.topPerformers, bottom);
    assert.deepEqual(flipped.bottomPerformers, top);
    assert.deepEqual(
      flipped.top_performer_ids,
      bottom.map((p) => p.id)
    );
    assert.deepEqual(
      flipped.bottom_performer_ids,
      top.map((p) => p.id)
    );
  }
});
