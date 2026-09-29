import assert from "node:assert/strict";
import test from "node:test";
import { rankStatsItems } from "../src/utils/statsRanking_custom.ts";

test("dashboard ranking preserves metric order and locale-aware stable ties", () => {
  const rows = [
    { id: 1, name: "Zulu", value: 0 },
    { id: 2, name: "Ángel", value: 4 },
    { id: 3, name: "angel", value: 4 },
    { id: 4, name: "Bravo", value: 4 },
    { id: 5, name: "First", value: 9 },
    { id: 6, name: "", value: 0 },
  ];
  const original = [...rows];
  const expected = [...rows].sort(
    (a, b) =>
      b.value - a.value ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  let metricCalls = 0;
  const ranked = rankStatsItems(
    rows,
    (row) => {
      metricCalls++;
      return row.value;
    },
    (row) => row.name
  );
  assert.deepEqual(ranked, expected);
  assert.deepEqual(rows, original);
  assert.equal(metricCalls, rows.length);
  assert.equal(ranked[0], rows[4]);
});

test("dashboard ranking handles empty input without computing metrics", () => {
  assert.deepEqual(
    rankStatsItems(
      [],
      () => {
        throw new Error("unexpected metric");
      },
      () => ""
    ),
    []
  );
});
