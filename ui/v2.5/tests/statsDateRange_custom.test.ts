import assert from "node:assert/strict";
import test from "node:test";
import {
  addStatsDateRangeToPath,
  isStatsIsoDate,
  readStatsDateRange,
  resolveStatsDateRange,
  statsDateRangeLabel,
  statsDateRangeVariable,
  writeStatsDateRange,
} from "../src/utils/statsDateRange_custom.ts";

const today = new Date(2026, 8, 30); // Sep 30 2026, local time

test("the default range is all time and stays out of the URL", () => {
  const range = readStatsDateRange("?sceneMetric=rating100");
  assert.deepEqual(range, { preset: "all", field: "RELEASE" });
  assert.equal(statsDateRangeVariable(range, today), null);
  assert.equal(
    writeStatsDateRange("?sceneMetric=rating100", range),
    "?sceneMetric=rating100"
  );
});

test("presets resolve to inclusive local-day bounds", () => {
  const base = { field: "RELEASE" as const };
  assert.deepEqual(resolveStatsDateRange({ ...base, preset: "30d" }, today), {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  assert.deepEqual(resolveStatsDateRange({ ...base, preset: "365d" }, today), {
    from: "2025-10-01",
    to: "2026-09-30",
  });
  assert.deepEqual(
    resolveStatsDateRange({ ...base, preset: "this_year" }, today),
    { from: "2026-01-01", to: "2026-12-31" }
  );
  assert.deepEqual(
    resolveStatsDateRange({ ...base, preset: "last_year" }, today),
    { from: "2025-01-01", to: "2025-12-31" }
  );
});

test("custom ranges round-trip through the URL and swap reversed bounds", () => {
  const search = writeStatsDateRange("?statsRange=30d&other=1", {
    preset: "custom",
    from: "2025-06-01",
    to: "2025-03-01",
    field: "O_DATE",
  });
  const range = readStatsDateRange(search);
  assert.deepEqual(range, {
    preset: "custom",
    from: "2025-06-01",
    to: "2025-03-01",
    field: "O_DATE",
  });
  assert.equal(new URLSearchParams(search).get("other"), "1");
  assert.deepEqual(statsDateRangeVariable(range, today), {
    from: "2025-03-01",
    to: "2025-06-01",
    field: "O_DATE",
  });
  assert.equal(statsDateRangeLabel(range, today), "2025-03-01 – 2025-06-01");
});

test("invalid URL values fall back safely", () => {
  assert.deepEqual(
    readStatsDateRange(
      "?statsRange=custom&statsFrom=2025-02-30&statsTo=nope&statsDateField=BAD"
    ),
    { preset: "custom", field: "RELEASE" }
  );
  assert.equal(isStatsIsoDate("2024-02-29"), true);
  assert.equal(isStatsIsoDate("2025-02-29"), false);
});

test("stats links carry the range without dropping their own query", () => {
  assert.equal(
    addStatsDateRangeToPath(
      "/ostats/tag/5?scopeStudioId=3",
      "?statsRange=90d&statsDateField=ADDED&unrelated=x"
    ),
    "/ostats/tag/5?scopeStudioId=3&statsRange=90d&statsDateField=ADDED"
  );
  assert.equal(addStatsDateRangeToPath("/vatostats", ""), "/vatostats");
});
