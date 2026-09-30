import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStudioHeaderRatingCustom,
  getStudioHeaderRatingTilesCustom,
} from "../src/components/Studios/StudioDetails/studioHeaderInsights_custom.ts";

const empty = { entity_count: 0, average_rating100: null };

test("studio header rating tiles are hidden without rated entities", () => {
  assert.deepEqual(getStudioHeaderRatingTilesCustom(undefined), []);
  assert.deepEqual(
    getStudioHeaderRatingTilesCustom({
      overall_scene_average_rating100: null,
      solo_scenes: empty,
      sex_scenes: empty,
      threesome_scenes: empty,
      group_scenes: empty,
      performers: empty,
    }),
    []
  );
});

test("studio header rating tiles map advisor sections in order", () => {
  const tiles = getStudioHeaderRatingTilesCustom({
    overall_scene_average_rating100: 71.43,
    solo_scenes: { entity_count: 3, average_rating100: 66 },
    sex_scenes: { entity_count: 10, average_rating100: 73.84 },
    threesome_scenes: { entity_count: 2, average_rating100: 80 },
    group_scenes: empty,
    performers: { entity_count: 5, average_rating100: 58.61 },
  });

  assert.deepEqual(
    tiles.map((t) => [t.label, t.value, t.count]),
    [
      ["Overall", "71.4", undefined],
      ["Solo", "66", 3],
      ["Standard", "73.8", 10],
      ["Threesome", "80", 2],
      ["Group", "—", 0],
      ["Vatos", "58.6", 5],
    ]
  );
  assert.equal(tiles[0].highlight, true);
  assert.equal(tiles[5].noun, "vatos");
});

test("studio header rating format keeps integers and one decimal", () => {
  assert.equal(formatStudioHeaderRatingCustom(80), "80");
  assert.equal(formatStudioHeaderRatingCustom(80.25), "80.3");
  assert.equal(formatStudioHeaderRatingCustom(null), "—");
});
