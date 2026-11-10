import assert from "node:assert/strict";
import test from "node:test";
import {
  getVatoStatsStudioScope,
  getVatoStatsSummary,
} from "../src/components/VatoStats/vatoStatsStudioScope_custom.ts";

test("studio detail scope follows the child studio content switch", () => {
  const studio = { id: "42", name: "Mi Estudio" };

  assert.deepEqual(getVatoStatsStudioScope(studio, false), {
    id: "42",
    name: "Mi Estudio",
    depth: 0,
  });
  assert.deepEqual(getVatoStatsStudioScope(studio, true), {
    id: "42",
    name: "Mi Estudio",
    depth: -1,
  });
  assert.equal(getVatoStatsStudioScope({ id: "99" }, false).name, "Studio 99");
});

test("summary sums pito length with a 17 cm default", () => {
  assert.deepEqual(
    getVatoStatsSummary([
      { penis_length: 20 },
      { penis_length: null },
      { penis_length: 18 },
    ]),
    {
      totalPenisMeters: 0.55,
      measuredCount: 2,
      assumedCount: 1,
    }
  );
  assert.deepEqual(getVatoStatsSummary([]), {
    totalPenisMeters: 0,
    measuredCount: 0,
    assumedCount: 0,
  });
});

test("novelty estimates disclose missing and invalid measurements", () => {
  assert.deepEqual(
    getVatoStatsSummary([
      { penis_length: 0 },
      { penis_length: -2 },
      { penis_length: NaN },
      { penis_length: 18 },
    ]),
    {
      totalPenisMeters: 0.69,
      measuredCount: 1,
      assumedCount: 3,
    }
  );
});
