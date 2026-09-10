import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSceneCardInsightThresholds } from "../src/components/Scenes/sceneCardInsightsData_custom.ts";
import type {
  InsightStatsWorkerInput,
  InsightStatsWorkerOutput,
} from "../src/components/InsightStats/insightStatsWorker_custom.ts";

test("worker reuses its read-only snapshot and suppresses obsolete preview results", async () => {
  const originalSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
  const originalDB = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const cachedScans = new Map<string, unknown>();
  // Asynchronous storage boundary: clone values just as IndexedDB does.
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open: () => {
        const db = {
          close() {},
          transaction: () => {
            const transaction = {
              oncomplete: () => {},
              objectStore: () => ({
                get: (key: string) => {
                  const request = {
                    result: structuredClone(cachedScans.get(key)),
                    onsuccess: () => {},
                  };
                  queueMicrotask(() => request.onsuccess());
                  return request;
                },
                put: (value: unknown, key: string) => {
                  cachedScans.set(key, structuredClone(value));
                  queueMicrotask(() => transaction.oncomplete());
                },
              }),
            };
            return transaction;
          },
        };
        const request = { result: db, onsuccess: () => {} };
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    },
  });
  const originalFetch = globalThis.fetch;
  const output: InsightStatsWorkerOutput[] = [];
  let fetchCount = 0;
  const scope = {
    postMessage: (message: InsightStatsWorkerOutput) => output.push(message),
    onmessage: (_event: { data: InsightStatsWorkerInput }) => {},
  };
  Object.defineProperty(globalThis, "self", {
    configurable: true,
    value: scope,
  });
  globalThis.fetch = async (_url, options) => {
    fetchCount += 1;
    const body = JSON.parse(String(options?.body));
    assert.match(body.query, /^\s*query /);
    return new Response(
      JSON.stringify({
        data: {
          findScenes: {
            count: 30,
            scenes: Array.from({ length: 30 }, (_, index) => ({
              id: String(index),
              files: [{ duration: 600 }],
              performers: [],
              scene_markers: [
                {
                  id: `activity-marker-${index}`,
                  seconds: 0,
                  end_seconds: 1,
                  primary_tag: { id: "sex", name: "sex" },
                  tags: [],
                  top_performers: [],
                  bottom_performers: [],
                },
                {
                  id: `marker-${index}`,
                  seconds: 0,
                  end_seconds: 1,
                  primary_tag: { id: "body", name: "body" },
                  tags: [],
                  top_performers: [],
                  bottom_performers: [],
                },
              ],
            })),
          },
        },
      }),
      { status: 200 }
    );
  };
  const waitForRevision = async (revision: number) => {
    const deadline = Date.now() + 3000;
    while (
      !output.some(
        (message) => message.type === "result" && message.requestId === revision
      )
    ) {
      assert.ok(Date.now() < deadline, JSON.stringify(output));
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };
  try {
    await import("../src/components/InsightStats/insightStatsWorker_custom.ts");
    scope.onmessage({
      data: {
        type: "load",
        url: "http://localhost/graphql",
        config: { roleTagIds: { sexTagId: "sex" } },
      },
    });
    scope.onmessage({
      data: {
        type: "simulate",
        requestId: 1,
        thresholds: normalizeSceneCardInsightThresholds(),
        ratingThresholds: {},
      },
    });
    await waitForRevision(1);
    scope.onmessage({
      data: {
        type: "simulate",
        requestId: 2,
        thresholds: normalizeSceneCardInsightThresholds({
          fillerTotalPercent: 100,
        }),
        ratingThresholds: {},
      },
    });
    scope.onmessage({
      data: {
        type: "simulate",
        requestId: 3,
        thresholds: normalizeSceneCardInsightThresholds({
          fillerTotalPercent: 99,
        }),
        ratingThresholds: {},
      },
    });
    await waitForRevision(3);
    assert.equal(
      output.some(
        (message) => message.type === "result" && message.requestId === 2
      ),
      false
    );
    assert.equal(
      fetchCount,
      1,
      "Slider previews must not reload scenes or write settings"
    );
    const latest = output.find(
      (message) => message.type === "result" && message.requestId === 3
    );
    assert.ok(latest?.type === "result");
    assert.equal(latest.current.total, 30);
    assert.equal(latest.current.rows.get("filler")?.all, 30);
    assert.equal(latest.preview.rows.get("filler")?.all, 30);
    assert.equal(latest.cacheAvailable, true);
    const reopen = async (force = false) => {
      const previous = output.filter(
        (message) => message.type === "result"
      ).length;
      scope.onmessage({
        data: {
          type: "load",
          url: "http://localhost/graphql",
          config: { roleTagIds: { sexTagId: "sex" } },
          force,
        },
      });
      const deadline = Date.now() + 3000;
      while (
        output.filter((message) => message.type === "result").length ===
        previous
      ) {
        assert.ok(Date.now() < deadline, JSON.stringify(output));
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    await reopen();
    assert.equal(fetchCount, 1, "Reopening uses the persisted scan");
    await reopen(true);
    assert.equal(fetchCount, 2, "Manual refresh bypasses the cache");
    const snapshot = cachedScans.get("http://localhost/graphql") as {
      scannedAt: string;
    };
    snapshot.scannedAt = new Date(
      Date.now() - 12 * 60 * 60 * 1000
    ).toISOString();
    await reopen();
    assert.equal(fetchCount, 3, "Expired scans reload");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSelf) Object.defineProperty(globalThis, "self", originalSelf);
    else Reflect.deleteProperty(globalThis, "self");
    if (originalDB) Object.defineProperty(globalThis, "indexedDB", originalDB);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});
