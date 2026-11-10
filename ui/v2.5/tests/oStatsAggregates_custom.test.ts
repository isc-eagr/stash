import assert from "node:assert/strict";
import test from "node:test";
import {
  fillOStatsDays,
  fillOStatsMonths,
  oStatsYears,
} from "../src/components/OStats/oStatsDateSeries_custom.ts";
import {
  buildOStatsCalendar,
  oStatsCalendarLevel,
  summarizeOStatsCalendar,
} from "../src/components/OStats/oStatsCalendar_custom.ts";
import {
  O_STATS_UNKNOWN_BUCKET,
  oStatsBucketCounts,
  oStatsRatingBucket,
  oStatsSceneIDsInBucket,
  oStatsTierBucket,
  type OStatsSceneCount,
} from "../src/components/OStats/oStatsSceneBuckets_custom.ts";
import type { IUIConfig } from "../src/core/config.ts";

test("O date charts omit quiet years and zero-fill months and days", () => {
  assert.deepEqual(
    oStatsYears([
      { year: 2026, count: 1 },
      { year: 0, count: 0 },
      { year: 2024, count: 3 },
      { year: 2025, count: 0 },
    ]),
    [
      { value: 2024, count: 3 },
      { value: 2026, count: 1 },
    ]
  );
  assert.deepEqual(oStatsYears([]), []);
  assert.deepEqual(oStatsYears([{ year: 2024, count: 0 }]), []);
  const months = fillOStatsMonths([{ month: 5, count: 2 }]);
  assert.equal(months.length, 12);
  assert.deepEqual(months[4], { value: 5, count: 2 });
  assert.deepEqual(months[5], { value: 6, count: 0 });
  assert.equal(fillOStatsDays(2025, 4, []).length, 30);
});

test("calendar covers Jan 1 to Dec 31 in Monday-first weeks", () => {
  // 2025-01-01 is a Wednesday, so two leading cells are outside the year.
  const counts = new Map([
    ["2025-01-01", 1],
    ["2025-01-02", 4],
    ["2025-12-31", 2],
  ]);
  const calendar = buildOStatsCalendar(2025, counts);
  assert.equal(calendar.weeks[0][0], null);
  assert.equal(calendar.weeks[0][1], null);
  assert.equal(calendar.weeks[0][2]?.date, "2025-01-01");
  assert.equal(calendar.weeks[0][3]?.level, 4);
  const cells = calendar.weeks.flat().filter((cell) => cell !== null);
  assert.equal(cells.length, 365);
  assert.equal(cells[cells.length - 1]?.date, "2025-12-31");
  assert.equal(calendar.monthStarts.length, 12);
  assert.deepEqual(calendar.monthStarts[0], { month: 1, week: 0 });

  const early = buildOStatsCalendar(2024, new Map());
  const cellsIn2024 = early.weeks.flat().filter((cell) => cell !== null);
  assert.equal(cellsIn2024.length, 366);
  assert.equal(
    cellsIn2024.find((cell) => cell?.date === "2024-03-07")?.tracked,
    false
  );
  assert.equal(
    cellsIn2024.find((cell) => cell?.date === "2024-03-08")?.tracked,
    true
  );
});

test("calendar levels and summary", () => {
  assert.equal(oStatsCalendarLevel(0, 8), 0);
  assert.equal(oStatsCalendarLevel(1, 8), 1);
  assert.equal(oStatsCalendarLevel(8, 8), 4);

  assert.deepEqual(
    summarizeOStatsCalendar(
      2025,
      new Map([
        ["2025-03-01", 1],
        ["2025-03-02", 3],
        ["2025-03-03", 1],
        ["2025-03-05", 1],
      ])
    ),
    {
      total: 6,
      activeDays: 4,
      bestDay: { date: "2025-03-02", count: 3 },
      longestStreak: 3,
    }
  );
});

test("O counts bucket by scene rating and metallic tier", () => {
  const uiConfig = {
    roleTagIds: { goatTagId: "99" },
    ratingCardOverrideTagIds: { goldTagId: "50" },
  } as unknown as IUIConfig;
  const scenes: OStatsSceneCount[] = [
    {
      scene_id: "1",
      rating100: 92,
      tag_ids: [],
      has_royal_sapphire_bonus: false,
      count: 3,
    },
    {
      scene_id: "2",
      rating100: 94,
      tag_ids: [],
      has_royal_sapphire_bonus: false,
      count: 2,
    },
    {
      scene_id: "3",
      rating100: null,
      tag_ids: ["50"],
      has_royal_sapphire_bonus: false,
      count: 4,
    },
    {
      scene_id: "4",
      rating100: null,
      tag_ids: [],
      has_royal_sapphire_bonus: false,
      count: 1,
    },
    {
      scene_id: "5",
      rating100: 10,
      tag_ids: ["99"],
      has_royal_sapphire_bonus: false,
      count: 5,
    },
  ];

  const ratings = oStatsBucketCounts(scenes, oStatsRatingBucket, (key) => ({
    label: key,
    sortValue: Number(key.split("-")[0]),
  }));
  assert.deepEqual(
    ratings.data.map((item) => [item.key, item.count]),
    [
      ["10-14", 5],
      ["90-94", 5],
    ]
  );
  assert.equal(ratings.unknownCount, 5);
  assert.deepEqual(
    oStatsSceneIDsInBucket(scenes, oStatsRatingBucket, O_STATS_UNKNOWN_BUCKET),
    ["3", "4"]
  );

  const tierOf = (scene: OStatsSceneCount) => oStatsTierBucket(scene, uiConfig);
  assert.equal(
    tierOf(scenes[2]),
    "gold",
    "override tags apply without a rating"
  );
  assert.equal(tierOf(scenes[3]), O_STATS_UNKNOWN_BUCKET);
  assert.equal(tierOf(scenes[4]), "royal_sapphire", "GOAT wins over rating");
});
