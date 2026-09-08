import assert from "node:assert/strict";
import test from "node:test";
import {
  getSceneCardInsightSets,
  normalizeSceneCardInsightThresholds,
} from "../src/components/Scenes/sceneCardInsightsData_custom.ts";
import {
  calculateInsightStats,
  countInsightStatsScene,
  createInsightStatsResult,
  compareInsightStatsVariants,
} from "../src/components/InsightStats/insightStatsData_custom.ts";
import { insightStatsMainCatalog } from "../src/components/InsightStats/insightStatsCatalog_custom.ts";
import { deriveInsightRoleCounts } from "../src/components/InsightStats/insightStatsRoles_custom.ts";
import {
  insightCacheLifetime,
  isFreshInsightSnapshot,
} from "../src/components/InsightStats/insightStatsCache_custom.ts";
import {
  createInsightSceneLink,
  openInsightSceneLink,
  readInsightSceneMatch,
} from "../src/utils/insightSceneLinks_custom.ts";
import { InsightChipCriterion } from "../src/models/list-filter/criteria/insight-chip_custom.ts";

const tag = (id: string) => ({ id, name: id });
const marker = (
  id: string,
  primary: string,
  start: number,
  end: number,
  tags: string[] = []
) => ({
  id,
  primary_tag: tag(primary),
  tags: tags.map(tag),
  seconds: start,
  end_seconds: end,
});
const scene = {
  id: "1",
  files: [{ duration: 600 }],
  performers: [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ],
  scene_markers: [
    marker("1", "sex", 0, 600),
    marker("2", "body", 0, 90, ["pito"]),
  ],
};
const config = {
  roleTagIds: {
    sexTagId: "sex",
    goatTagId: "goat",
    outstandingActivityCommonTagIds: ["body", "pito"],
  },
};

test("tag drilldowns split exact engine labels and retain full combinations", async () => {
  const thresholds = normalizeSceneCardInsightThresholds();
  const stats = (await calculateInsightStats(
    [scene],
    config,
    thresholds,
    new Map()
  ))!;
  const row = stats.rows.get("outstanding-activity")!;
  assert.equal(row.all, 1);
  assert.deepEqual([...row.parts.keys()].sort(), [
    "Good amount of body",
    "Good amount of pito",
  ]);
  for (const part of row.parts.values()) {
    assert.equal(part.all, 1);
    assert.deepEqual(part.sceneIds.all, ["1"]);
  }
  assert.equal(row.variants.size, 1);
  assert.equal(
    compareInsightStatsVariants(row, row, "all", "", true).length,
    2
  );
  assert.equal(
    compareInsightStatsVariants(row, row, "all", "", false).length,
    1
  );
  const card = getSceneCardInsightSets(scene, config.roleTagIds, thresholds);
  const totalsOnly = getSceneCardInsightSets(
    scene,
    config.roleTagIds,
    thresholds,
    undefined,
    undefined,
    false
  );
  assert.deepEqual(totalsOnly.candidates, card.candidates);
  assert.equal(totalsOnly.outstandingActivityMatrix.columns.length, 0);
  assert.ok(
    totalsOnly.outstandingActivityMatrix.rows.every(
      (r) => Object.keys(r.cells).length === 0
    )
  );
});

test("GOAT parts deduplicate performers and preserve tag names containing conjunctions", () => {
  const stats = createInsightStatsResult();
  const candidates = ["a", "b"].map((id) => ({
    key: `goat-${id}`,
    kind: "goat" as const,
    tone: "goat" as const,
    detail: "",
    score: 1,
    label: `GOAT body and pito from ${id}`,
    statsLabel: "GOAT body and pito",
    statsParts: ["GOAT body", "GOAT pito", "GOAT tag with and inside"],
  }));
  countInsightStatsScene(stats, scene, candidates, new Set(["goat-b"]));
  const row = stats.rows.get("goat")!;
  assert.equal(row.all, 1);
  for (const part of row.parts.values()) {
    assert.equal(part.all, 1);
    assert.equal(part.visible, 1);
    assert.deepEqual(part.sceneIds.visible, ["1"]);
  }
  assert.ok(row.parts.has("GOAT tag with and inside"));
});

test("main catalog consolidates quality, balance, and interaction patterns", () => {
  const ids = insightStatsMainCatalog.map((r) => r.id);
  for (const id of ["activity-quality", "leaning", "interaction"])
    assert.ok(ids.includes(id));
  assert.ok(
    !ids.some(
      (id) => /^(quality-|leaning-|interaction-)/.test(id) || id === "balanced"
    )
  );
});

test("role history matches distinct scenes, tag ancestry and narrower marker precedence", () => {
  const top = [{ id: "a", name: "A" }];
  const bottom = [{ id: "b", name: "B" }];
  const input = {
    ...scene,
    scene_marker_tag_ancestors: [{ tag_id: "child", ancestor_ids: ["sex"] }],
    scene_markers: [
      { ...marker("10", "child", 0, 600), top_performers: top },
      { ...marker("11", "other", 10, 20, ["sex"]), top_performers: bottom },
      { ...marker("12", "sex", 30, 40), top_performers: bottom },
    ],
  };
  const roles = deriveInsightRoleCounts([input, { ...input, id: "2" }], config);
  assert.equal(
    roles.get("a"),
    undefined,
    "The broad marker loses to narrower matching markers"
  );
  assert.equal(
    roles.get("b")?.sex_top_count,
    2,
    "Multiple markers count once per scene"
  );
});

test("scan cache expires at twelve hours and rejects invalid timestamps", () => {
  const scannedAt = "2026-09-07T00:00:00Z";
  const now = Date.parse(scannedAt);
  assert.ok(
    isFreshInsightSnapshot(
      { scenes: [], scannedAt },
      now + insightCacheLifetime - 1
    )
  );
  assert.equal(
    isFreshInsightSnapshot(
      { scenes: [], scannedAt },
      now + insightCacheLifetime
    ),
    false
  );
  assert.equal(
    isFreshInsightSnapshot({ scenes: [], scannedAt: "invalid" }, now),
    false
  );
});

test("chip links restore all matching IDs, and missing snapshots fail closed", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const data = new Map<string, string>();
  const storage = {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  const opened: Array<[string, string, string]> = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      open: (...args: [string, string, string]) => {
        opened.push(args);
        return {};
      },
    },
  });
  try {
    const link = createInsightSceneLink("Good amount of body · preview", [
      "1",
      "2",
      "1",
    ]);
    const params = JSON.parse(
      new URL(link, "http://localhost").searchParams.get("c")!
    );
    assert.deepEqual(readInsightSceneMatch(params.value)?.ids, ["1", "2"]);
    const criterion = new InsightChipCriterion();
    criterion.fromDecodedParams(params);
    const input = {};
    criterion.applyToCriterionInput(input);
    assert.deepEqual(input, { insight_scene_ids: ["1", "2"] });
    assert.match(criterion.getLabel(), /preview/);
    data.clear();
    criterion.applyToCriterionInput(input);
    assert.deepEqual(input, { insight_scene_ids: [] });
    assert.match(criterion.getLabel(), /expired/);
    assert.equal(openInsightSceneLink("Good amount of body", ["3"]), true);
    assert.equal(opened[0][1], "_blank");
    assert.equal(opened[0][2], "noopener,noreferrer");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
