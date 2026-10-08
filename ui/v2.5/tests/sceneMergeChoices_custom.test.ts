import assert from "node:assert/strict";
import test from "node:test";

import {
  IMergeChoiceScene,
  loopPresetMergeChoice,
  negativeMarkerMergeChoice,
  ratingMergeChoice,
  releaseMergeChoice,
  stashDBMatchesMergeChoice,
} from "../src/components/Scenes/sceneMergeChoices_custom.ts";

const scene = (
  id: string,
  overrides: Partial<IMergeChoiceScene> = {}
): IMergeChoiceScene => ({
  id,
  title: `Scene ${id}`,
  rating100: null,
  rating_scores: [],
  stashdb_matches: null,
  releases: [],
  negative_markers: [],
  multi_segment_loop_presets: [],
  ...overrides,
});

test("list choices start with every row except source duplicates", () => {
  const dest = scene("1", {
    negative_markers: [
      { id: "1", name: "Intro", start_seconds: 0, end_seconds: 30 },
      { id: "2", name: "Intro", start_seconds: 0, end_seconds: 30 },
    ],
    multi_segment_loop_presets: [
      { id: "1", name: "Best", segments: [{ start: 1, end: 2 }] },
    ],
  });
  const source = scene("2", {
    negative_markers: [
      { id: "3", name: "Intro", start_seconds: 0, end_seconds: 30 },
      { id: "4", name: "", start_seconds: 60, end_seconds: 90 },
    ],
    multi_segment_loop_presets: [
      { id: "2", name: "Best", segments: [{ start: 1, end: 2 }] },
      { id: "3", name: "Best", segments: [{ start: 5, end: 9 }] },
    ],
  });

  const negatives = negativeMarkerMergeChoice(dest, [source]);
  assert.deepEqual(negatives.destIDs, ["1", "2"]);
  assert.deepEqual(
    negatives.keptIDs,
    ["1", "2", "4"],
    "destination duplicates are never dropped"
  );
  assert.equal(negatives.items[3].label, "1:00-1:30");

  const presets = loopPresetMergeChoice(dest, [source]);
  assert.deepEqual(presets.keptIDs, ["1", "3"]);
  assert.equal(presets.items[2].label, "Best · 0:05-0:09");
});

test("releases keep both sides by default", () => {
  const choice = releaseMergeChoice(
    scene("1", { releases: [{ id: "10", title: "Cut", date: "2020-01-01" }] }),
    [
      scene("2", {
        releases: [{ id: "11", code: "AB-1", studio: { name: "Studio" } }],
      }),
    ]
  );
  assert.deepEqual(choice.keptIDs, ["10", "11"]);
  assert.deepEqual(
    choice.items.map((i) => i.label),
    ["Cut · 2020-01-01", "AB-1 · Studio"]
  );
});

test("rating default mirrors the backend", () => {
  const answered = scene("2", { rating100: 60, rating_scores: [{}] });
  const manual = scene("3", { rating100: 80 });

  assert.deepEqual(
    ratingMergeChoice(scene("1", { rating_scores: [{}] }), [answered]),
    {
      candidates: [answered],
      sourceID: "2",
      useSource: false,
    }
  );
  assert.equal(
    ratingMergeChoice(scene("1", { rating100: 40 }), [manual, answered])
      .sourceID,
    "2"
  );
  assert.equal(
    ratingMergeChoice(scene("1", { rating100: 40 }), [manual, answered])
      .useSource,
    true
  );
  assert.equal(
    ratingMergeChoice(scene("1", { rating100: 40 }), [manual]).useSource,
    false
  );
  assert.equal(ratingMergeChoice(scene("1"), [manual]).useSource, true);
  assert.equal(
    ratingMergeChoice(scene("1"), [scene("2")]).candidates.length,
    0
  );
});

test("StashDB Matches offers differing source counts, including zero", () => {
  const zero = scene("2", { stashdb_matches: 0 });
  assert.deepEqual(stashDBMatchesMergeChoice(scene("1"), [zero]), {
    candidates: [zero],
    sourceID: "2",
    useSource: true,
  });
  assert.equal(
    stashDBMatchesMergeChoice(scene("1", { stashdb_matches: 4 }), [zero])
      .useSource,
    false
  );
  assert.equal(
    stashDBMatchesMergeChoice(scene("1", { stashdb_matches: 0 }), [zero])
      .candidates.length,
    0
  );
});
