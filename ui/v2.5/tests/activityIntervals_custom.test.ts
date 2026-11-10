import assert from "node:assert/strict";
import test from "node:test";
import {
  activityDurationCustom,
  intersectActivityIntervalsCustom,
  mergeActivityIntervalsCustom,
  subtractActivityIntervalsCustom,
} from "../src/utils/activityIntervals_custom.ts";
import { mergePlaybackRanges } from "../src/components/ScenePlayer/playbackBoundary_custom.ts";
import { filterLoopSegmentsOutsideNegativeMarkers } from "../src/components/ScenePlayer/loopSegments_custom.ts";
import { buildIntervalLoopSegments } from "../src/components/Scenes/SceneDetails/sceneStatsLoopSegments_custom.ts";
import { mergeSceneStatsInteractionIntervals } from "../src/components/Scenes/SceneDetails/sceneStatsPartnerInteractions_custom.ts";
import { getSceneNegativeMarkerTotalDuration } from "../src/components/Scenes/SceneDetails/sceneNegativeMarkerDuration_custom.ts";
import { markerStats } from "../src/components/Scenes/sceneCardInsightFacts_custom.ts";

test("cards, partner stats, skip ranges, and loops agree on unique time", () => {
  const intervals = [
    { start: 20, end: 30 },
    { start: 0, end: 10 },
    { start: 5, end: 8 },
    { start: 10, end: 15 },
    { start: 20, end: 30 },
  ];
  const original = structuredClone(intervals);
  const expected = [
    { start: 0, end: 15 },
    { start: 20, end: 30 },
  ];
  assert.deepEqual(mergeActivityIntervalsCustom(intervals), expected);
  assert.deepEqual(mergePlaybackRanges(intervals), expected);
  assert.deepEqual(mergeSceneStatsInteractionIntervals(intervals), expected);
  assert.deepEqual(
    buildIntervalLoopSegments("Sex", intervals).map(({ start, end }) => ({
      start,
      end,
    })),
    expected
  );
  const markers = intervals.map(({ start, end }, id) => ({
    id: String(id),
    seconds: start,
    end_seconds: end,
    primary_tag: { id: "sex", name: "Sex" },
    tags: [],
  }));
  assert.equal(markerStats(markers, 100).duration, 25);
  assert.equal(activityDurationCustom(intervals), 25);
  assert.equal(
    getSceneNegativeMarkerTotalDuration(
      intervals.map(({ start, end }) => ({
        start_seconds: start,
        end_seconds: end,
      })),
      100
    ),
    25
  );
  assert.deepEqual(
    intervals,
    original,
    "measuring time preserves saved ranges"
  );
});

test("overlapping skip ranges split loops without losing their labels", () => {
  const interval = { start: 0, end: 30 };
  const blockers = [
    { start: 5, end: 15 },
    { start: 10, end: 20 },
    { start: 30, end: 40 },
  ];
  const remaining = [
    { start: 0, end: 5 },
    { start: 20, end: 30 },
  ];
  assert.deepEqual(
    subtractActivityIntervalsCustom([interval], blockers),
    remaining
  );
  assert.deepEqual(intersectActivityIntervalsCustom([interval], blockers), [
    { start: 5, end: 20 },
  ]);
  assert.deepEqual(
    filterLoopSegmentsOutsideNegativeMarkers(
      [{ ...interval, title: "Saved marker" }],
      blockers.map(({ start, end }) => ({
        start_seconds: start,
        end_seconds: end,
      }))
    ),
    remaining.map((range) => ({ ...range, title: "Saved marker" }))
  );
  assert.equal(
    activityDurationCustom(remaining) +
      activityDurationCustom(
        intersectActivityIntervalsCustom([interval], blockers)
      ),
    30
  );
  assert.deepEqual(mergeActivityIntervalsCustom([]), []);
  assert.deepEqual(subtractActivityIntervalsCustom([interval], []), [interval]);
  assert.deepEqual(intersectActivityIntervalsCustom([interval], []), []);
});
