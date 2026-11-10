import assert from "node:assert/strict";
import test from "node:test";
import { withExactPerformerMarkerCounts } from "../src/components/Performers/performerRoleStats_custom.ts";
import type { IPerformerRoleStats } from "../src/components/Performers/PerformerCard.tsx";

test("profile role totals retain exact marker counts", () => {
  const batchStats = {
    sex_scene_count: 17,
    facial_top_count: 4,
    facial_bottom_count: 5,
    feet_top_count: 6,
  } as IPerformerRoleStats;
  const markerCounts = {
    facial_marker_top_count: 10,
    facial_marker_bottom_count: 11,
    feet_marker_count: 12,
  };

  const result = withExactPerformerMarkerCounts(batchStats, markerCounts);

  assert.equal(result?.sex_scene_count, 17);
  assert.equal(result?.facial_top_count, 10);
  assert.equal(result?.facial_bottom_count, 11);
  assert.equal(result?.feet_top_count, 12);
  assert.equal(
    withExactPerformerMarkerCounts(undefined, markerCounts),
    undefined
  );
});
