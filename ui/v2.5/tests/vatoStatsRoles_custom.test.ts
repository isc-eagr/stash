import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVatoRoleChartData,
  vatoMatchesRole,
  type IVatoRoleCounts,
} from "../src/components/VatoStats/vatoStatsRoles_custom.ts";

const empty: IVatoRoleCounts = {
  scene_count: 0,
  sex_top_count: 0,
  sex_bottom_count: 0,
  oral_top_count: 0,
  oral_bottom_count: 0,
  facial_given_count: 0,
  facial_received_count: 0,
  solo_scene_count: 0,
};

test("strictness follows sex and oral activity, independently of facials", () => {
  const cases: Array<[Partial<IVatoRoleCounts>, string[]]> = [
    [{}, []],
    [{ oral_top_count: 2, facial_received_count: 1 }, ["pure_tops"]],
    [{ oral_bottom_count: 2, facial_given_count: 1 }, ["pure_bottoms"]],
    [{ sex_top_count: 1, oral_top_count: 2 }, ["pure_tops"]],
    [{ sex_bottom_count: 1, oral_bottom_count: 2 }, ["pure_bottoms"]],
    [{ sex_top_count: 1, oral_bottom_count: 1 }, ["lenient_tops"]],
    [{ sex_bottom_count: 1, oral_top_count: 1 }, ["lenient_bottoms"]],
    [{ sex_top_count: 1, facial_received_count: 1 }, ["pure_tops"]],
    [{ sex_top_count: 1, sex_bottom_count: 1 }, []],
    [{ oral_top_count: 1, oral_bottom_count: 1 }, []],
    [{ facial_given_count: 1, facial_received_count: 1 }, []],
    [{ scene_count: 2, solo_scene_count: 2 }, ["solo_only"]],
    [{ scene_count: 3, solo_scene_count: 2 }, []],
    [{ scene_count: 1, solo_scene_count: 1, facial_given_count: 1 }, []],
    [{ scene_count: 1, solo_scene_count: 1, sex_top_count: 1 }, ["pure_tops"]],
  ];
  for (const [counts, expected] of cases) {
    const vato = { ...empty, ...counts };
    const chart = buildVatoRoleChartData([vato], "role_strictness");
    assert.deepEqual(
      chart.data.filter((bar) => bar.count > 0).map((bar) => bar.key),
      expected
    );
    for (const bar of chart.data) {
      assert.equal(
        vatoMatchesRole(vato, "role_strictness", bar.key),
        expected.includes(bar.key)
      );
    }
  }
});

test("role bars count each vato once per activity and allow overlapping roles", () => {
  const versatile = {
    ...empty,
    scene_count: 10,
    sex_top_count: 5,
    sex_bottom_count: 4,
    oral_top_count: 3,
    oral_bottom_count: 2,
    facial_given_count: 2,
    facial_received_count: 1,
    solo_scene_count: 1,
  };
  const solo = { ...empty, scene_count: 2, solo_scene_count: 2 };
  const chart = buildVatoRoleChartData([versatile, solo, empty], "role");
  assert.deepEqual(
    chart.data.map((bar) => bar.count),
    [1, 1, 1, 1, 1, 1, 2]
  );
  for (const bar of chart.data) {
    assert.equal(vatoMatchesRole(versatile, "role", bar.key), true);
  }
  assert.equal(
    vatoMatchesRole(versatile, "role_strictness", "solo_only"),
    false
  );
  assert.equal(vatoMatchesRole(solo, "role_strictness", "solo_only"), true);
  assert.equal(vatoMatchesRole(solo, "role", "invalid"), false);
});

test("empty role charts retain all requested bars in order with zero counts", () => {
  for (const category of ["role", "role_strictness"] as const) {
    const chart = buildVatoRoleChartData([], category);
    assert.equal(chart.data.length, category === "role" ? 7 : 5);
    assert.ok(chart.data.every((bar) => bar.count === 0));
    assert.equal(chart.unknownCount, 0);
  }
});
