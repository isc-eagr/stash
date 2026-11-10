import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStudioHeaderRatingCustom,
  getStudioHeaderRatingPanelsCustom,
} from "../src/components/Studios/StudioDetails/studioHeaderInsights_custom.ts";

const empty = { entity_count: 0 };

test("studio header rating panels are hidden without rated entities", () => {
  const none = { sceneKeys: [], showVatos: false };
  assert.deepEqual(getStudioHeaderRatingPanelsCustom(undefined), none);
  assert.deepEqual(
    getStudioHeaderRatingPanelsCustom({
      solo_scenes: empty,
      sex_scenes: empty,
      threesome_scenes: empty,
      group_scenes: empty,
      performers: empty,
    }),
    none
  );
});

test("studio header rating panels keep rated scene rubrics in order", () => {
  assert.deepEqual(
    getStudioHeaderRatingPanelsCustom({
      solo_scenes: { entity_count: 3 },
      sex_scenes: { entity_count: 10 },
      threesome_scenes: empty,
      group_scenes: { entity_count: 1 },
      performers: { entity_count: 5 },
    }),
    {
      sceneKeys: ["solo_scenes", "sex_scenes", "group_scenes"],
      showVatos: true,
    }
  );
});

test("studio header rating format keeps integers and one decimal", () => {
  assert.equal(formatStudioHeaderRatingCustom(80), "80");
  assert.equal(formatStudioHeaderRatingCustom(80.25), "80.3");
  assert.equal(formatStudioHeaderRatingCustom(null), "—");
});
