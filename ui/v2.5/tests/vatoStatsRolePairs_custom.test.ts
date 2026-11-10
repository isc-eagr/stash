import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVatoRolePairGrid,
  vatoRolePairKey,
  type IVatoStatsRolePair,
} from "../src/components/VatoStats/vatoStatsRolePairs_custom.ts";

const vatos = [
  { id: "1", ethnicity: "Latino" },
  { id: "2", ethnicity: " White " },
  { id: "3", ethnicity: "Latino" },
  { id: "4", ethnicity: "unknown" },
];
const pair = (
  activity: "SEX" | "ORAL",
  scene_id: string,
  top_id: string,
  bottom_id: string
): IVatoStatsRolePair => ({ activity, scene_id, top_id, bottom_id });
const pairs = [
  pair("SEX", "10", "1", "2"),
  // Two Latino tops in one scene still count the scene once.
  pair("SEX", "10", "3", "2"),
  pair("SEX", "11", "1", "2"),
  pair("SEX", "11", "2", "3"),
  pair("SEX", "12", "1", "4"),
  // Vato 9 is not loaded, so his ethnicity is unknown.
  pair("SEX", "13", "9", "1"),
  pair("ORAL", "10", "2", "1"),
];

test("role pair grids count each scene once per ethnicity pair", () => {
  const grid = buildVatoRolePairGrid(pairs, "SEX", vatos);

  assert.deepEqual(grid.cells.get(vatoRolePairKey("Latino", "White")), [
    "10",
    "11",
  ]);
  assert.deepEqual(grid.cells.get(vatoRolePairKey("White", "Latino")), ["11"]);
  assert.deepEqual(grid.tops, [
    { key: "Latino", label: "Latino", count: 2 },
    { key: "White", label: "White", count: 1 },
  ]);
  assert.deepEqual(grid.bottoms, [
    { key: "White", label: "White", count: 2 },
    { key: "Latino", label: "Latino", count: 1 },
  ]);
  assert.deepEqual(grid.sceneIds, ["10", "11"]);
  assert.deepEqual(grid.unknownSceneIds, ["12", "13"]);
});

test("role pair grids keep activities apart and follow selected vatos", () => {
  const oral = buildVatoRolePairGrid(pairs, "ORAL", vatos);
  assert.deepEqual([...oral.cells], [["White|Latino", ["10"]]]);
  assert.deepEqual(oral.unknownSceneIds, []);

  const selected = buildVatoRolePairGrid(pairs, "SEX", vatos, new Set(["3"]));
  assert.deepEqual(
    [...selected.cells],
    [
      ["Latino|White", ["10"]],
      ["White|Latino", ["11"]],
    ],
    "a pair counts when a selected vato is on either side"
  );
  assert.deepEqual(selected.unknownSceneIds, []);

  const empty = buildVatoRolePairGrid([], "SEX", vatos);
  assert.deepEqual(
    [empty.tops, empty.bottoms, empty.sceneIds, empty.unknownSceneIds],
    [[], [], [], []]
  );
});

test("role pair grids follow the marker filter's ethnicity rule", () => {
  const mixedVatos = [
    { id: "1", ethnicity: "Afrolatino" },
    { id: "2", ethnicity: "Latino" },
    { id: "3", ethnicity: "Mixed" },
  ];
  const grid = buildVatoRolePairGrid(
    [pair("ORAL", "20", "1", "2"), pair("ORAL", "21", "3", "2")],
    "ORAL",
    mixedVatos
  );

  assert.deepEqual(grid.cells.get(vatoRolePairKey("Black", "Latino")), [
    "20",
    "21",
  ]);
  assert.deepEqual(grid.cells.get(vatoRolePairKey("Afrolatino", "Latino")), [
    "20",
  ]);
  assert.deepEqual(grid.cells.get(vatoRolePairKey("Latino", "Latino")), ["20"]);
  assert.deepEqual(grid.cells.get(vatoRolePairKey("White", "Latino")), ["21"]);
  assert.deepEqual(grid.sceneIds, ["20", "21"]);
});
