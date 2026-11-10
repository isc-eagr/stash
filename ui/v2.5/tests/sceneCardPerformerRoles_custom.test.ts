import assert from "node:assert/strict";

import { getSceneCardPerformerMarkerRoles } from "../src/components/Scenes/sceneCardPerformerRoles_custom.ts";

const performer = (id: string) => ({ id });
const tag = (id: string) => ({ id });
const marker = (
  id: string,
  primaryTagID: string,
  topIDs: string[],
  bottomIDs: string[],
  secondaryTagIDs: string[] = []
) => ({
  id,
  primary_tag: tag(primaryTagID),
  tags: secondaryTagIDs.map(tag),
  top_performers: topIDs.map(performer),
  bottom_performers: bottomIDs.map(performer),
});

const roles = getSceneCardPerformerMarkerRoles(
  {
    scene_markers: [
      marker("1", "sex-child", ["10"], ["2"]),
      marker("2", "oral", ["2"], ["10"]),
      marker("3", "facial-child", ["10"], ["2"]),
      marker("4", "facial-child", ["10"], ["2"], ["camera-child"]),
      marker("5", "solo-child", ["10"], []),
      marker("6", "feet-child", ["10"], []),
      marker("7", "sex-child", ["10"], ["2", "3"]),
    ],
    scene_marker_tag_ancestors: [
      { tag_id: "sex-child", ancestor_ids: ["sex"] },
      { tag_id: "facial-child", ancestor_ids: ["facial", "orgasm"] },
      { tag_id: "camera-child", ancestor_ids: ["second-camera"] },
      { tag_id: "solo-child", ancestor_ids: ["solo"] },
      { tag_id: "feet-child", ancestor_ids: ["feet"] },
    ],
  },
  {
    sexTagId: "sex",
    oralTagId: "oral",
    soloTagId: "solo",
    facialTagId: "facial",
    orgasmTagId: "orgasm",
    feetTagId: "feet",
    secondCameraTagId: "second-camera",
  }
);

assert.deepEqual(roles.get("10"), [
  "sex_top",
  "oral_bottom",
  "solo",
  "facial_top_1",
  "facial_unique_1",
  "sex_top_partners_2",
  "sex_all_partners_2",
  "sex_top_pids:2,3",
  "oral_bottom_partners_1",
  "oral_all_partners_1",
  "oral_bottom_pids:2",
  "facial_top_partners_1",
  "facial_all_partners_1",
  "facial_top_pids:2",
  "orgasm_top_1",
  "feet_top_1",
]);

assert.deepEqual(
  roles.get("2"),
  [
    "sex_bottom",
    "oral_top",
    "facial_bottom_1",
    "facial_unique_1",
    "sex_bottom_partners_1",
    "sex_all_partners_1",
    "sex_bottom_pids:10",
    "oral_top_partners_1",
    "oral_all_partners_1",
    "oral_top_pids:10",
    "facial_bottom_partners_1",
    "facial_all_partners_1",
    "facial_bottom_pids:10",
  ],
  "role strips include both directions and scene-local partner IDs"
);

assert.equal(
  roles.get("10")?.includes("facial_top_2"),
  false,
  "2nd-camera descendants do not inflate facial counts"
);
assert.equal(
  roles.get("10")?.includes("orgasm_top_2"),
  false,
  "2nd-camera descendants do not inflate orgasm counts"
);
assert.deepEqual(
  roles.get("3"),
  [
    "sex_bottom",
    "sex_bottom_partners_1",
    "sex_all_partners_1",
    "sex_bottom_pids:10",
  ],
  "each performer receives an independent strip summary"
);
