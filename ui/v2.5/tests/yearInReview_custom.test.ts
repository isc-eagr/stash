import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseYearInReviewYear,
  yearInReviewChange,
  yearInReviewElapsedDays,
  yearInReviewMonths,
  yearInReviewNewcomers,
  yearInReviewOStatsPath,
  yearInReviewPath,
  yearInReviewRanges,
  yearInReviewYears,
} from "../src/components/YearInReview/yearInReview_custom.ts";

test("the review reads one calendar year by O date", () => {
  assert.deepEqual(yearInReviewRanges(2026), {
    range: { from: "2026-01-01", to: "2026-12-31", field: "O_DATE" },
    before: { from: null, to: "2025-12-31", field: "O_DATE" },
  });
  assert.equal(yearInReviewPath(2026), "/stats/year/2026");
  assert.equal(
    yearInReviewOStatsPath("/ostats/vato/7", 2026),
    "/ostats/vato/7?statsRange=custom&statsFrom=2026-01-01&statsTo=2026-12-31"
  );
});

test("the year defaults to the latest one with O's", () => {
  const counts = [
    { year: 2026, count: 4 },
    { year: 2024, count: 9 },
    { year: 2025, count: 0 },
    { year: 0, count: 3 },
  ];
  assert.deepEqual(yearInReviewYears(counts), {
    years: [2024, 2026],
    year: 2026,
    previous: 2024,
    next: undefined,
  });
  assert.deepEqual(yearInReviewYears(counts, 2024), {
    years: [2024, 2026],
    year: 2024,
    previous: undefined,
    next: 2026,
  });
  assert.equal(
    yearInReviewYears(counts, 2025).year,
    2026,
    "a year without O's falls back to the latest"
  );
  assert.deepEqual(yearInReviewYears([]), {
    years: [],
    year: undefined,
    previous: undefined,
    next: undefined,
  });
  assert.equal(parseYearInReviewYear("2026"), 2026);
  assert.equal(parseYearInReviewYear("26"), undefined);
  assert.equal(parseYearInReviewYear(undefined), undefined);
});

test("months are zero-filled from the year's days", () => {
  const months = yearInReviewMonths(
    2026,
    [
      { date: "2026-01-05", count: 2 },
      { date: "2026-01-31", count: 1 },
      { date: "2026-12-31", count: 4 },
      { date: "2025-12-31", count: 9 },
    ],
    "en-GB"
  );
  assert.equal(months.length, 12);
  assert.deepEqual(
    months.map((month) => month.count),
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4]
  );
  assert.deepEqual(
    [months[0].key, months[0].label, months[11].month],
    ["01", "Jan", 12]
  );
});

test("new favorites, change and elapsed days", () => {
  const ranked = [{ id: "3" }, { id: "1" }, { id: "2" }];
  assert.deepEqual(
    yearInReviewNewcomers(ranked, ["1"], (item) => item.id),
    [{ id: "3" }, { id: "2" }],
    "vatos with an earlier O are left out and the ranking is kept"
  );

  assert.equal(yearInReviewChange(125, 100, 2025), "+25% vs 2025");
  assert.equal(yearInReviewChange(50, 100, 2025), "−50% vs 2025");
  assert.equal(yearInReviewChange(100, 100, 2025), "0% vs 2025");
  assert.equal(yearInReviewChange(10, 0, 2025), undefined);
  assert.equal(yearInReviewChange(10, undefined, 2025), undefined);

  assert.equal(yearInReviewElapsedDays(2024, new Date(2026, 5, 1)), 366);
  assert.equal(yearInReviewElapsedDays(2026, new Date(2026, 0, 10)), 10);
  assert.equal(yearInReviewElapsedDays(2027, new Date(2026, 0, 10)), 0);
});

test("Year in Review is routed and linked from the stats navigation", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(read("../src/App.tsx"), /path="\/stats\/year\/:year\?"/);
  assert.ok(
    read("../src/App.tsx").indexOf('path="/stats/year/:year?"') <
      read("../src/App.tsx").indexOf('<Route path="/stats" '),
    "the review route comes before the upstream /stats route"
  );
  assert.match(
    read("../src/components/StatsLinks_custom.tsx"),
    /\/stats\/year/
  );
});
