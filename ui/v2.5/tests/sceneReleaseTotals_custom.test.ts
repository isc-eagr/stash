import assert from "node:assert/strict";
import test from "node:test";

import {
  sceneLastOAtCustom,
  sceneOTotalCustom,
  sceneStashDBMatchesTotalCustom,
  sceneTotalHintCustom,
} from "../src/components/Scenes/sceneReleaseTotals_custom.ts";

test("scene O total adds release O's", () => {
  assert.deepEqual(sceneOTotalCustom({ o_counter: 3, release_o_counter: 4 }), {
    own: 3,
    releases: 4,
    total: 7,
  });
  assert.equal(sceneOTotalCustom({ o_counter: null }).total, 0);
  assert.equal(sceneOTotalCustom({ release_o_counter: 2 }).total, 2);
});

test("StashDB Matches total stays hidden until an owner has a count", () => {
  assert.equal(sceneStashDBMatchesTotalCustom({}), undefined);
  assert.equal(
    sceneStashDBMatchesTotalCustom({ stashdb_matches: 0 })?.total,
    0
  );
  assert.deepEqual(
    sceneStashDBMatchesTotalCustom({ release_stashdb_matches: 5 }),
    { own: 0, releases: 5, total: 5 }
  );
});

test("only totals with release values are marked", () => {
  assert.deepEqual(
    sceneTotalHintCustom(sceneOTotalCustom({ o_counter: 3 })),
    {}
  );
  assert.deepEqual(sceneTotalHintCustom(undefined), {});
  assert.deepEqual(
    sceneTotalHintCustom(
      sceneOTotalCustom({ o_counter: 3, release_o_counter: 4 })
    ),
    {
      className: "scene-total-includes-releases",
      title: "3 on this scene + 4 from releases",
    }
  );
});

test("last O picks the latest of the scene's and releases' O's", () => {
  assert.equal(
    sceneLastOAtCustom({
      o_history: ["2026-01-02T10:00:00Z", "2026-01-05T10:00:00Z"],
      release_last_o_at: "2026-01-04T10:00:00Z",
    }),
    "2026-01-05T10:00:00Z"
  );
  assert.equal(
    sceneLastOAtCustom({
      o_history: ["2026-01-02T10:00:00Z"],
      release_last_o_at: "2026-02-01T10:00:00Z",
    }),
    "2026-02-01T10:00:00Z"
  );
  assert.equal(sceneLastOAtCustom({ o_history: [] }), undefined);
});
