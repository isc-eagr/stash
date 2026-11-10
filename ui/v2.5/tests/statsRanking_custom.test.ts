import assert from "node:assert/strict";
import test from "node:test";
import {
  mostRecentOTieBreaker,
  rankStatsItems,
} from "../src/utils/statsRanking_custom.ts";

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

test("O Count ties go to whoever reached the count most recently", () => {
  const rows = [
    { name: "Alpha", o: 3, last: "2025-01-01T10:00:00Z" },
    { name: "Bravo", o: 3, last: "2025-06-01T10:00:00Z" },
    { name: "Charlie", o: 5, last: "2024-01-01T10:00:00Z" },
    { name: "Delta", o: 3, last: null },
  ];
  assert.deepEqual(
    rankStatsItems(
      rows,
      (row) => row.o,
      (row) => row.name,
      (row) => mostRecentOTieBreaker(row.last)
    ).map((row) => row.name),
    ["Charlie", "Bravo", "Alpha", "Delta"]
  );
  assert.equal(mostRecentOTieBreaker("not a date"), 0);
});
