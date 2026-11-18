import assert from "node:assert/strict";
import test from "node:test";
import {
  amateurAppUrlCustom,
  mergeEventsByDateCustom,
  mergeSortedCustom,
  mergeTagCountsByNameCustom,
  oStatsRecordsCustom,
  oStatsRecordsEndDayCustom,
  oStatsTagPathCustom,
  readOStatsAmateurOnlyCustom,
  splitMergedTimelinePageCustom,
  sumCountsByKeyCustom,
  sumCountsWithUnknownCustom,
  withAmateurSourceCustom,
  zipMergedTimelinePageCustom,
} from "../src/components/OStats/oStatsAmateur_custom.ts";

test("value-keyed O counts add up across instances", () => {
  assert.deepEqual(
    sumCountsByKeyCustom(
      [
        { year: 2025, count: 3 },
        { year: 2026, count: 1 },
      ],
      [
        { year: 2026, count: 2 },
        { year: 2024, count: 5 },
      ],
      (item) => item.year
    ),
    [
      { year: 2025, count: 3 },
      { year: 2026, count: 3 },
      { year: 2024, count: 5 },
    ]
  );
  assert.deepEqual(
    sumCountsWithUnknownCustom(
      { counts: [{ age: 25, count: 1 }], unknown_count: 2 },
      { counts: [{ age: 25, count: 4 }], unknown_count: 1 },
      (item) => item.age
    ),
    { counts: [{ age: 25, count: 5 }], unknown_count: 3 }
  );
});

test("ranked rows interleave by count and ties keep this instance first", () => {
  const byCount = (a: { count: number }, b: { count: number }) =>
    b.count - a.count;
  assert.deepEqual(
    mergeSortedCustom(
      [
        { id: "m1", count: 5 },
        { id: "m2", count: 2 },
      ],
      [
        { id: "a1", count: 5 },
        { id: "a2", count: 3 },
      ],
      byCount
    ).map((row) => row.id),
    ["m1", "a1", "a2", "m2"]
  );
});

test("marker tags join by name and keep each instance's ID", () => {
  const merged = mergeTagCountsByNameCustom(
    [
      { tag_id: "1", tag_name: "Facial", count: 4 },
      { tag_id: "2", tag_name: "Kiss", count: 1 },
    ],
    [
      { tag_id: "9", tag_name: "facial", count: 2 },
      { tag_id: "8", tag_name: "Outdoor", count: 3 },
    ]
  );
  assert.deepEqual(merged, [
    { tag_id: "1", tag_name: "Facial", count: 6 },
    { tag_id: "8", tag_name: "Outdoor", count: 3, amateur: true },
    { tag_id: "2", tag_name: "Kiss", count: 1 },
  ]);
  assert.equal(oStatsTagPathCustom(merged[0]), "/ostats/tag/1");
  assert.equal(oStatsTagPathCustom(merged[1]), "/ostats/tag/8?oSource=amateur");
});

test("amateur drilldown paths keep their own search params", () => {
  const path = withAmateurSourceCustom(
    "/ostats/scene/5?statsRange=custom",
    true
  );
  assert.equal(path, "/ostats/scene/5?statsRange=custom&oSource=amateur");
  assert.equal(
    withAmateurSourceCustom("/ostats/scene/5", false),
    "/ostats/scene/5"
  );
  assert.equal(readOStatsAmateurOnlyCustom("?oSource=amateur"), true);
  assert.equal(readOStatsAmateurOnlyCustom("?statsRange=all"), false);
});

test("timeline events merge newest first", () => {
  assert.deepEqual(
    mergeEventsByDateCustom(
      [{ o_date: "2026-01-03T10:00:00Z" }, { o_date: "2026-01-01T10:00:00Z" }],
      [{ o_date: "2026-01-02T10:00:00-06:00" }]
    ).map((event) => event.o_date),
    [
      "2026-01-03T10:00:00Z",
      "2026-01-02T10:00:00-06:00",
      "2026-01-01T10:00:00Z",
    ]
  );
});

test("a merged timeline page takes the right slice of each instance", () => {
  const moment = (at: string) => ({ at, day: at.slice(0, 10) });
  const main = ["2026-01-05", "2026-01-03", "2026-01-01"].map(moment);
  const amateur = ["2026-01-04", "2026-01-03", "2026-01-02"].map(moment);
  // Merged: m05 a04 m03 a03 a02 m01 (equal times put this instance first).
  const first = splitMergedTimelinePageCustom(main, amateur, 0, 4);
  assert.deepEqual(first.main, { offset: 0, count: 2 });
  assert.deepEqual(first.amateur, { offset: 0, count: 2 });
  assert.deepEqual(first.order, ["main", "amateur", "main", "amateur"]);
  const second = splitMergedTimelinePageCustom(main, amateur, 4, 4);
  assert.deepEqual(second.main, { offset: 2, count: 1 });
  assert.deepEqual(second.amateur, { offset: 2, count: 1 });
  assert.deepEqual(second.order, ["amateur", "main"]);
  assert.deepEqual(
    zipMergedTimelinePageCustom(second.order, ["m01"], ["a02"]),
    ["a02", "m01"]
  );
  const past = splitMergedTimelinePageCustom(main, amateur, 10, 4);
  assert.deepEqual(past.order, []);
});

test("records over both instances match the server rules", () => {
  const days = [
    "2024-01-01", // before reliable tracking: ignored
    "2025-09-08", // excluded from the busiest day, still an O day
    "2025-09-08",
    "2025-09-08",
    "2025-09-01",
    "2025-09-01",
    "2025-09-03",
    "2025-09-03",
  ];
  const records = oStatsRecordsCustom(days, "2025-09-20");
  assert.deepEqual(records.mostOsInDay, { date: "2025-09-01", count: 2 });
  assert.deepEqual(records.longestPeriodWithoutO, {
    days: 12,
    start_date: "2025-09-09",
    end_date: "2025-09-20",
  });
  assert.deepEqual(oStatsRecordsCustom(["2025-01-02"], "2025-01-02"), {
    mostOsInDay: { date: "2025-01-02", count: 1 },
    longestPeriodWithoutO: {
      days: 0,
      start_date: "2025-01-02",
      end_date: "2025-01-02",
    },
  });
  assert.deepEqual(oStatsRecordsCustom([], "2025-01-02"), {
    mostOsInDay: undefined,
  });
  assert.equal(
    oStatsRecordsEndDayCustom("2025-12-31", "2026-03-01"),
    "2025-12-31"
  );
  assert.equal(
    oStatsRecordsEndDayCustom("2026-12-31", "2026-03-01"),
    "2026-03-01"
  );
  assert.equal(oStatsRecordsEndDayCustom(null, "2026-03-01"), "2026-03-01");
});

test("amateur app links follow the host this page was opened on", () => {
  assert.equal(
    amateurAppUrlCustom("http://localhost:9997/", "/scenes/5", "192.168.1.20"),
    "http://192.168.1.20:9997/scenes/5"
  );
  assert.equal(
    amateurAppUrlCustom("http://localhost:9997", "/scenes/5", "localhost"),
    "http://localhost:9997/scenes/5"
  );
  assert.equal(
    amateurAppUrlCustom("http://nas:9997/stash", "/performers/3", "localhost"),
    "http://nas:9997/stash/performers/3"
  );
});
