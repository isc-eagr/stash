import assert from "node:assert/strict";

import { getRatingAdvisorCriterionVatosCustom } from "../src/components/Shared/ratingAdvisorVatos_custom.ts";

const tag = (id: string) => ({ id, name: id });
const marker = (
  primaryTag: string,
  seconds: number,
  endSeconds: number,
  top: string[],
  bottom: string[]
) => ({
  seconds,
  end_seconds: endSeconds,
  primary_tag: tag(primaryTag),
  tags: [],
  top_performers: top.map((id) => ({ id })),
  bottom_performers: bottom.map((id) => ({ id })),
});
const vato = (id: string) => ({ id, name: `Vato ${id}`, image_path: `/${id}` });
const roleTagIds = { sexTagId: "sex", oralTagId: "oral", soloTagId: "solo" };
const ids = (vatos?: Array<{ id: string; percent?: number }>) =>
  vatos?.map(({ id, percent }) => `${id}:${percent}`);

const sexScene = {
  files: [{ duration: 200 }],
  performers: [vato("1"), vato("2"), vato("3")],
  scene_markers: [
    marker("sex", 0, 35, ["1"], ["2"]),
    marker("sex", 35, 100, ["3"], ["2"]),
    // Oral time is ignored once the scene has sex.
    marker("oral", 100, 200, ["2"], ["1"]),
  ],
};
const sexVatos = getRatingAdvisorCriterionVatosCustom(
  sexScene,
  roleTagIds,
  "default"
);
assert.deepEqual(ids(sexVatos.topAttractiveness), ["3:65", "1:35"]);
assert.deepEqual(ids(sexVatos.bottomAttractiveness), ["2:100"]);

const groupVatos = getRatingAdvisorCriterionVatosCustom(
  sexScene,
  roleTagIds,
  "group"
);
assert.deepEqual(ids(groupVatos.groupTopAttractiveness), ["3:65", "1:35"]);
assert.deepEqual(ids(groupVatos.groupBottomAttractiveness), ["2:100"]);
assert.equal(groupVatos.bottomAttractiveness, undefined);

const oralVatos = getRatingAdvisorCriterionVatosCustom(
  {
    ...sexScene,
    scene_markers: [
      marker("oral", 0, 40, ["1"], ["2"]),
      marker("oral", 40, 50, ["2"], ["1"]),
    ],
  },
  roleTagIds,
  "default"
);
assert.deepEqual(ids(oralVatos.topAttractiveness), ["1:80", "2:20"]);
assert.deepEqual(ids(oralVatos.bottomAttractiveness), ["2:80", "1:20"]);

assert.deepEqual(
  getRatingAdvisorCriterionVatosCustom(
    { ...sexScene, performers: [vato("1")], scene_markers: [] },
    roleTagIds,
    "solo"
  ),
  { soloPerformerAppeal: [vato("1")] },
  "solo scenes show their vato without a share"
);
assert.deepEqual(
  getRatingAdvisorCriterionVatosCustom(
    { ...sexScene, scene_markers: [] },
    roleTagIds,
    "default"
  ),
  {},
  "no timed sex or oral means no thumbnails"
);
