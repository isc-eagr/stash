import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { buildSchema, parse, validate } from "graphql";
import {
  insightStatsCatalog,
  insightStatsTone,
  insightThresholdLabels,
} from "../src/components/InsightStats/insightStatsCatalog_custom.ts";
import {
  calculateInsightStats,
  compareInsightStatsVariants,
  countInsightStatsScene,
  createInsightStatsResult,
  insightStatsPercentage,
  isInsightStatsEligibleScene,
} from "../src/components/InsightStats/insightStatsData_custom.ts";
import {
  INSIGHT_STATS_SCENES_QUERY,
  loadInsightStatsScenes,
} from "../src/components/InsightStats/insightStatsQuery_custom.ts";
import {
  getSceneCardInsightSets,
  normalizeSceneCardInsightThresholds,
} from "../src/components/Scenes/sceneCardInsightsData_custom.ts";
import type { SceneCardInsightCandidate } from "../src/components/Scenes/sceneCardInsightTypes_custom.ts";

const scene = {
  id: "1",
  title: "Test scene",
  files: [{ duration: 600 }],
  performers: [],
  scene_markers: [],
};
const roleTagIds = {
  sexTagId: "sex",
  oralTagId: "oral",
  soloTagId: "solo",
  goatTagId: "goat",
  reallyHotTagId: "hot",
  orgasmTagId: "orgasm",
  facialTagId: "facial",
};
const tag = (id: string) => ({ id, name: id });
const marker = (
  id: string,
  primary: string,
  start: number,
  end: number,
  tags: string[] = []
) => ({
  id,
  seconds: start,
  end_seconds: end,
  primary_tag: tag(primary),
  tags: tags.map(tag),
});

test("insight catalog includes zero rows and every configurable threshold", () => {
  const result = createInsightStatsResult();
  assert.equal(result.rows.size, insightStatsCatalog.length);
  assert.ok(
    [...result.rows.values()].every((row) => row.all === 0 && row.visible === 0)
  );
  assert.deepEqual(
    Object.keys(insightThresholdLabels).sort(),
    Object.keys(normalizeSceneCardInsightThresholds()).sort()
  );
  assert.equal(
    insightStatsCatalog.some(
      ({ id, label, kind }) =>
        [
          "activity-summary",
          "few-highlights",
          "everybody-nuts",
          "feet",
          "filler",
          "lackluster",
        ].includes(id) ||
        /feet|filler|lackluster|few highlights|everybody nuts/i.test(label) ||
        /filler|lackluster/i.test(kind)
    ),
    false
  );
  assert.equal(
    Object.keys(insightThresholdLabels).some((key) => /filler/i.test(key)),
    false,
    "retired filler insight thresholds are absent from Insight Stats"
  );
  assert.equal(
    Object.keys(normalizeSceneCardInsightThresholds()).some((key) =>
      /filler/i.test(key)
    ),
    false,
    "retired filler settings are absent from the normalized threshold set"
  );
  assert.equal(insightStatsPercentage(0, 0), 0);
  assert.equal(insightStatsPercentage(1, 4), 25);
});

test("chip catalog keeps card tones and useful interaction rules for tooltips", () => {
  const balancedOrgy = insightStatsCatalog.find(
    ({ id }) => id === "interaction-balanced-orgy"
  );
  assert.equal(insightStatsTone("interaction"), "interaction");
  assert.equal(insightStatsTone("rare-role"), "rare");
  assert.equal(
    balancedOrgy?.note,
    "Four or more vatos, each interacting with at least half of the possible partners."
  );
  assert.match(
    insightStatsCatalog.find(({ id }) => id === "orgasm-facial-report")?.note ??
      "",
    /2nd Camera tag are excluded/
  );
  assert.equal(
    insightStatsCatalog.some(({ id }) => id === "facial-report"),
    false,
    "Orgasm and Facial reports share one Insight Stats family"
  );
  assert.match(
    insightStatsCatalog.find(({ id }) => id === "ugly-tops")?.note ?? "",
    /Group Top Attractiveness/
  );
  assert.equal(
    insightStatsCatalog.find(({ id }) => id === "leaning")?.label,
    "Fucking / eating pito split"
  );
  assert.equal(
    insightStatsCatalog.some(
      ({ id }) => id === "balanced" || id.startsWith("leaning-")
    ),
    false
  );
});

test("Orgasm and Facial reports split event counts and sort each breakdown descending", async () => {
  const first = {
    ...scene,
    id: "five-events",
    scene_markers: [
      marker("sex", "sex", 0, 300),
      marker("facial-goat", "facial", 1, 2, ["goat", "hot"]),
      marker("facial-hot", "facial", 3, 4, ["hot"]),
      marker("orgasm-hot", "orgasm", 5, 6, ["hot"]),
      marker("orgasm-plain-1", "orgasm", 7, 8),
      marker("orgasm-plain-2", "orgasm", 9, 10),
    ],
  };
  const second = {
    ...scene,
    id: "three-events",
    scene_markers: [
      marker("sex", "sex", 0, 300),
      marker("facial", "facial", 1, 2),
      marker("orgasm-1", "orgasm", 3, 4),
      marker("orgasm-2", "orgasm", 5, 6),
    ],
  };
  const result = await calculateInsightStats(
    [first, second],
    { roleTagIds },
    normalizeSceneCardInsightThresholds(),
    new Map()
  );
  const row = result?.rows.get("orgasm-facial-report");

  assert.equal(row?.all, 2);
  assert.equal(row?.parts.get("5 total orgasms")?.all, 1);
  assert.equal(row?.parts.get("3 total orgasms")?.all, 1);
  assert.equal(row?.parts.get("3 regular orgasms")?.all, 1);
  assert.equal(row?.parts.get("2 regular orgasms")?.all, 1);
  assert.equal(row?.parts.get("2 facials")?.all, 1);
  assert.equal(row?.parts.get("1 facial")?.all, 1);
  assert.equal(row?.parts.get("1 GOAT event")?.all, 1);
  assert.equal(row?.parts.get("1 GOAT facial")?.all, 1);
  assert.equal(row?.parts.get("2 Really Hot events")?.all, 1);
  assert.equal(row?.parts.get("1 Really Hot regular orgasm")?.all, 1);
  assert.equal(row?.parts.get("1 Really Hot facial")?.all, 1);
  assert.equal(
    row?.parts.has("2 Really Hot facials"),
    false,
    "GOAT takes precedence over Really Hot for a marker carrying both tags"
  );
  assert.deepEqual(
    compareInsightStatsVariants(row!, row!, "all", "", true).map(
      ({ label }) => label
    ),
    [
      "5 total orgasms",
      "3 total orgasms",
      "3 regular orgasms",
      "2 regular orgasms",
      "2 facials",
      "1 facial",
      "1 GOAT event",
      "1 GOAT facial",
      "2 Really Hot events",
      "1 Really Hot regular orgasm",
      "1 Really Hot facial",
    ]
  );
});

test("coverage totals require an ended activity type marker", async () => {
  const ended = {
    ...scene,
    id: "ended-activity",
    scene_markers: [marker("ended-marker", "sex", 0, 300)],
  };
  const noMarkers = { ...scene, id: "no-markers" };
  const noEnd = {
    ...scene,
    id: "no-end",
    scene_markers: [marker("open-marker", "sex", 0, null)],
  };
  const endedNonActivity = {
    ...scene,
    id: "ended-non-activity",
    scene_markers: [marker("ended-marker", "body", 0, 300)],
  };
  const activityWithSecondaryTag = {
    ...scene,
    id: "activity-with-secondary-tag",
    scene_markers: [marker("highlight-marker", "sex", 0, 300, ["body"])],
  };
  assert.equal(isInsightStatsEligibleScene(ended, roleTagIds), true);
  assert.equal(isInsightStatsEligibleScene(noMarkers), false);
  assert.equal(isInsightStatsEligibleScene(noEnd, roleTagIds), false);
  assert.equal(
    isInsightStatsEligibleScene(endedNonActivity, roleTagIds),
    false
  );
  assert.equal(
    isInsightStatsEligibleScene(activityWithSecondaryTag, roleTagIds),
    false
  );
  const result = (await calculateInsightStats(
    [ended, noMarkers, noEnd, endedNonActivity, activityWithSecondaryTag],
    { roleTagIds },
    normalizeSceneCardInsightThresholds(),
    new Map()
  ))!;
  assert.equal(result.scanned, 5);
  assert.equal(result.total, 1);
  assert.equal(result.excludedWithoutMarkers, 1);
  assert.equal(result.excludedWithoutEndTime, 3);
});

test("GOAT families and combinations count a scene once across performer chips", () => {
  const result = createInsightStatsResult();
  const goat = (key: string, name: string): SceneCardInsightCandidate => ({
    key,
    label: `GOAT body from ${name}`,
    statsLabel: "GOAT body",
    detail: "",
    tone: "goat",
    kind: "goat",
    score: 1,
  });
  countInsightStatsScene(
    result,
    scene,
    [goat("goat-1", "One"), goat("goat-2", "Two")],
    new Set(["goat-2"])
  );
  assert.equal(result.rows.get("goat")?.all, 1);
  assert.equal(result.rows.get("goat")?.visible, 1);
  assert.equal(result.rows.get("goat")?.variants.get("GOAT body")?.all, 1);
  assert.equal(result.rows.get("goat")?.variants.get("GOAT body")?.visible, 1);
  assert.equal(result.total, 1);
});

test("Insight Stats counts Outstanding and activity splits in bounded percentage ranges", async () => {
  const input = {
    ...scene,
    files: [{ duration: 200 }],
    scene_markers: [
      marker("sex", "sex", 0, 130),
      marker("sex-hot", "hot", 0, 26),
      marker("oral", "oral", 130, 200),
      marker("oral-hot", "hot", 130, 179),
    ],
  };
  const result = await calculateInsightStats(
    [input],
    { roleTagIds },
    normalizeSceneCardInsightThresholds(),
    new Map()
  );
  const quality = result?.rows.get("activity-quality");
  const split = result?.rows.get("leaning");

  assert.equal(quality?.all, 1);
  assert.equal(
    quality?.variants.get("0-20% outstanding sex, 61-80% outstanding oral")
      ?.all,
    1
  );
  assert.equal(quality?.variants.size, 1);
  assert.equal(split?.all, 1);
  assert.equal(
    split?.variants.get("61-70% fucking, 31-40% eating pito")?.all,
    1
  );
  assert.equal(split?.variants.size, 1);
  assert.equal(result?.rows.has("activity-summary"), false);
});

test("coverage agrees with card selection and lowering the visible limit does not change qualification", async () => {
  const input = {
    ...scene,
    scene_markers: [
      marker("sex", "sex", 0, 400),
      marker("oral", "oral", 400, 600),
      marker("goat", "goat", 0, 180, ["body"]),
    ],
  };
  const config = { roleTagIds };
  const thresholds = normalizeSceneCardInsightThresholds({
    visibleInsightLimit: 1,
  });
  const sets = getSceneCardInsightSets(
    input,
    roleTagIds,
    thresholds,
    undefined,
    new Map()
  );
  const result = (await calculateInsightStats(
    [input],
    config,
    thresholds,
    new Map()
  ))!;
  assert.equal(sets.visible.length, 1);
  assert.ok(sets.all.length > 1);
  const visibleKeys = new Set(sets.visible.map(({ key }) => key));
  insightStatsCatalog.forEach((definition) => {
    const matches = sets.candidates.filter(definition.matches);
    assert.equal(
      result.rows.get(definition.id)?.all,
      Number(matches.length > 0),
      definition.id
    );
    assert.equal(
      result.rows.get(definition.id)?.visible,
      Number(
        matches.some(
          (candidate) =>
            candidate.statsVisibleKeys?.some((key) => visibleKeys.has(key)) ??
            visibleKeys.has(candidate.key)
        )
      ),
      definition.id
    );
  });
  assert.ok(
    sets.candidates.every((candidate) =>
      insightStatsCatalog.some((definition) => definition.matches(candidate))
    ),
    "every candidate belongs to a catalog row"
  );
  const unlimited = (await calculateInsightStats(
    [input],
    config,
    normalizeSceneCardInsightThresholds({ visibleInsightLimit: 20 }),
    new Map()
  ))!;
  result.rows.forEach((row, id) =>
    assert.equal(row.all, unlimited.rows.get(id)?.all)
  );
});

test("variant comparison retains disappearing and newly appearing chips with the library denominator", () => {
  const current = createInsightStatsResult();
  const preview = createInsightStatsResult();
  const candidate = (label: string): SceneCardInsightCandidate => ({
    key: "outstanding-activity",
    label,
    tone: "tag",
    kind: "outstanding-activity",
    detail: "",
    score: 1,
  });
  countInsightStatsScene(
    current,
    scene,
    [candidate("Lots of body")],
    new Set()
  );
  countInsightStatsScene(
    preview,
    scene,
    [candidate("Some body")],
    new Set(["outstanding-activity"])
  );
  const rows = compareInsightStatsVariants(
    current.rows.get("outstanding-activity")!,
    preview.rows.get("outstanding-activity")!,
    "all",
    " BODY "
  );
  assert.deepEqual(
    rows.map(({ label, current: c, preview: p }) => [label, c, p]),
    [
      ["Some body", 0, 1],
      ["Lots of body", 1, 0],
    ]
  );
  assert.equal(insightStatsPercentage(rows[0].preview, 4), 25);
});

test("empty and cancelled simulations produce safe results", async () => {
  const empty = await calculateInsightStats(
    [],
    {},
    normalizeSceneCardInsightThresholds(),
    new Map()
  );
  assert.equal(empty?.total, 0);
  const cancelled = await calculateInsightStats(
    [scene],
    {},
    normalizeSceneCardInsightThresholds(),
    new Map(),
    () => true
  );
  assert.equal(cancelled, undefined);
});

test("rare-role coverage uses performer history and responds at the inclusive threshold", async () => {
  const top = { id: "top", name: "Top" };
  const bottom = { id: "bottom", name: "Bottom" };
  const input = {
    ...scene,
    performers: [top, bottom],
    scene_markers: [
      {
        ...marker("sex", "sex", 0, 600),
        top_performers: [top],
        bottom_performers: [bottom],
      },
    ],
  };
  const roles = new Map([
    [
      bottom.id,
      {
        scene_count: 12,
        sex_top_count: 4,
        sex_bottom_count: 1,
        oral_role_top_count: 0,
        oral_role_bottom_count: 0,
        facial_scene_count: 0,
      },
    ],
  ]);
  const current = (await calculateInsightStats(
    [input],
    { roleTagIds },
    normalizeSceneCardInsightThresholds({ rareRoleMaximumPercent: 20 }),
    roles
  ))!;
  const preview = (await calculateInsightStats(
    [input],
    { roleTagIds },
    normalizeSceneCardInsightThresholds({ rareRoleMaximumPercent: 19 }),
    roles
  ))!;
  assert.equal(current.rows.get("rare-sex-bottom")?.all, 1);
  assert.equal(preview.rows.get("rare-sex-bottom")?.all, 0);
  assert.equal(
    current.rows.get("rare-sex-bottom")?.variants.has("Rare sex bottom"),
    true
  );
});

test("tag thresholds move actual combinations without changing family qualification", async () => {
  const input = {
    ...scene,
    scene_markers: [
      marker("activity", "sex", 0, 600),
      marker("body", "body", 0, 180),
    ],
  };
  const current = (await calculateInsightStats(
    [input],
    { roleTagIds },
    normalizeSceneCardInsightThresholds(),
    new Map()
  ))!;
  const preview = (await calculateInsightStats(
    [input],
    { roleTagIds },
    normalizeSceneCardInsightThresholds({ tagLotsMinPercent: 35 }),
    new Map()
  ))!;
  assert.equal(current.rows.get("outstanding-activity")?.all, 1);
  assert.equal(preview.rows.get("outstanding-activity")?.all, 1);
  assert.equal(
    current.rows.get("outstanding-activity")?.variants.get("Lots of body")?.all,
    1
  );
  assert.equal(
    preview.rows
      .get("outstanding-activity")
      ?.variants.get("Good amount of body")?.all,
    1
  );
});

test("scene scanner paginates, reports progress, and refuses inconsistent snapshots", async () => {
  const pages: number[] = [];
  const progress: number[] = [];
  const result = await loadInsightStatsScenes(
    async (_query, { page }) => {
      pages.push(page as number);
      return {
        findScenes: { count: 2, scenes: [{ ...scene, id: String(page) }] },
      } as never;
    },
    (loaded) => progress.push(loaded)
  );
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(progress, [1, 2]);
  assert.equal(result.length, 2);
  await assert.rejects(
    loadInsightStatsScenes(
      async (_query, { page }) =>
        ({
          findScenes: { count: page === 1 ? 2 : 3, scenes: [scene] },
        } as never),
      () => {}
    ),
    /library changed/
  );
  await assert.rejects(
    loadInsightStatsScenes(
      async () => ({ findScenes: { count: 2, scenes: [scene] } } as never),
      () => {}
    ),
    /pages changed/
  );
  await assert.rejects(
    loadInsightStatsScenes(
      async () => ({ findScenes: { count: 2, scenes: [] } } as never),
      () => {}
    ),
    /incomplete scene data/
  );
});

test("insight scan queries validate against the actual server schema", () => {
  const schemaRoot = new URL("../../../graphql/schema/", import.meta.url);
  const sources = [schemaRoot, new URL("types/", schemaRoot)].flatMap(
    (directory) =>
      readdirSync(directory)
        .filter((name) => name.endsWith(".graphql"))
        .map((name) => readFileSync(new URL(name, directory), "utf8"))
  );
  const schema = buildSchema(sources.join("\n"));
  for (const query of [INSIGHT_STATS_SCENES_QUERY]) {
    assert.deepEqual(
      validate(schema, parse(query)).map((error) => error.message),
      []
    );
  }
});
