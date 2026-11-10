import assert from "node:assert/strict";
import test from "node:test";
import {
  addSceneHistoryEntriesCustom,
  removeSceneHistoryEntriesCustom,
} from "../src/core/sceneHistoryCache_custom.ts";

test("history insertion keeps descending dates and aligned video timestamps", () => {
  assert.deepEqual(
    addSceneHistoryEntriesCustom(
      ["2026-09-03T00:00:00.000Z", "2026-09-01T00:00:00.000Z"],
      ["2026-09-02T00:00:00.000Z"],
      [30, 10]
    ),
    [
      { date: "2026-09-03T00:00:00.000Z", videoTimestamp: 30 },
      { date: "2026-09-02T00:00:00.000Z", videoTimestamp: null },
      { date: "2026-09-01T00:00:00.000Z", videoTimestamp: 10 },
    ]
  );
});

test("history deletion removes one matching occurrence and its timestamp", () => {
  assert.deepEqual(
    removeSceneHistoryEntriesCustom(
      ["2026-09-03T00:00:00.000Z", "2026-09-02T00:00:00.000Z"],
      ["2026-09-03T00:00:00.000Z"],
      [30, 20]
    ),
    [{ date: "2026-09-02T00:00:00.000Z", videoTimestamp: 20 }]
  );
});

test("history deletion without a date removes only the latest entry", () => {
  assert.deepEqual(
    removeSceneHistoryEntriesCustom(
      ["2026-09-03T00:00:00.000Z", "2026-09-02T00:00:00.000Z"],
      undefined
    ),
    [{ date: "2026-09-02T00:00:00.000Z", videoTimestamp: null }]
  );
});
