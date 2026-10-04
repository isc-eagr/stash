import assert from "node:assert/strict";
import test from "node:test";
import {
  daysInMonth,
  formatStatsBarPercent,
  sortStatsBarData,
  statsRange,
} from "../src/utils/statsBarChart_custom.ts";
import { fillSceneStatsReleaseBuckets } from "../src/components/SceneStats/sceneStatsReleaseBuckets_custom.ts";
import { sceneStatsAverages } from "../src/components/SceneStats/sceneStatsAverages_custom.ts";

test("bar percentages stay readable at both ends", () => {
  assert.equal(formatStatsBarPercent(0, 10), "0%");
  assert.equal(formatStatsBarPercent(1, 300), "<1%");
  assert.equal(formatStatsBarPercent(1, 30), "3.3%");
  assert.equal(formatStatsBarPercent(15, 20), "75%");
  assert.equal(formatStatsBarPercent(3, 0), "0%");
});

test("count sort keeps natural order available and breaks ties by label", () => {
  const data = [
    { label: "b", count: 2 },
    { label: "a", count: 2 },
    { label: "c", count: 5 },
  ];
  assert.deepEqual(
    sortStatsBarData(data, "natural").map((item) => item.label),
    ["b", "a", "c"]
  );
  assert.deepEqual(
    sortStatsBarData(data, "count").map((item) => item.label),
    ["c", "a", "b"]
  );
});

test("series helpers cover leap years and empty ranges", () => {
  assert.deepEqual(statsRange(3, 5), [3, 4, 5]);
  assert.deepEqual(statsRange(5, 3), []);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
});

test("Scene Stats release charts omit empty years and keep calendar months and days", () => {
  const years = fillSceneStatsReleaseBuckets(
    new Map([
      [2022, 1],
      [0, 0],
      [2019, 2],
      [2020, 0],
    ]),
    "year"
  );
  assert.deepEqual(
    years.map((bucket) => [bucket.value, bucket.count]),
    [
      [2019, 2],
      [2022, 1],
    ]
  );
  assert.deepEqual(fillSceneStatsReleaseBuckets(new Map(), "year"), []);
  assert.deepEqual(
    fillSceneStatsReleaseBuckets(new Map([[2024, 0]]), "year"),
    []
  );

  const months = fillSceneStatsReleaseBuckets(new Map([[3, 4]]), "month", 2024);
  assert.equal(months.length, 12);
  assert.equal(months[2].count, 4);
  assert.equal(months[0].count, 0);
  assert.equal(months[0].key, "2024-1");

  const days = fillSceneStatsReleaseBuckets(new Map(), "day", 2024, 2);
  assert.equal(days.length, 29);
  assert.equal(days[28].key, "2024-02-29");
});

test("scene averages follow the filtered scenes and count unique vatos", () => {
  assert.deepEqual(
    sceneStatsAverages([
      { duration: 600, performer_count: 2, performer_ids: ["1", "2"] },
      { duration: 0, performer_count: 2, performer_ids: ["2", "3"] },
    ]),
    {
      averageSceneLength: 600,
      averageScenesPerPerformer: 4 / 3,
      uniquePerformerCount: 3,
    }
  );
  assert.deepEqual(sceneStatsAverages([]), {
    averageSceneLength: undefined,
    averageScenesPerPerformer: undefined,
    uniquePerformerCount: 0,
  });
});
