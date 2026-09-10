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
  calculateInsightStatsRatingTierPopulation,
  calculateInsightStatsRatingTiers,
  compareInsightStatsVariants,
  countInsightStatsScene,
  createInsightStatsResult,
  insightStatsFinalRatingTier,
  insightStatsPercentage,
  insightStatsRatingTier,
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
  assert.equal(insightStatsPercentage(0, 0), 0);
  assert.equal(insightStatsPercentage(1, 4), 25);
});

test("rating tier counts use exact mutually exclusive scene and vato threshold bands", () => {
  const ratingCardThresholds = {
    scene: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
    performer: { bronze: 60, silver: 75, gold: 85, royalSapphire: 90 },
  };
  const ratedScenes = [
    {
      ...scene,
      id: "bronze-scene",
      rating100: 50,
      performers: [
        { id: "bronze-vato", name: "Bronze", rating100: 60 },
        { id: "silver-vato", name: "Silver", rating100: 75 },
      ],
    },
    {
      ...scene,
      id: "silver-scene",
      rating100: 70,
      performers: [
        { id: "silver-vato", name: "Silver", rating100: 75 },
        { id: "gold-vato", name: "Gold", rating100: 85 },
      ],
    },
    {
      ...scene,
      id: "gold-scene",
      rating100: 80,
      performers: [
        { id: "sapphire-vato", name: "Sapphire", rating100: 90 },
        { id: "unrated-vato", name: "Unrated", rating100: null },
      ],
    },
    { ...scene, id: "sapphire-scene", rating100: 95 },
    { ...scene, id: "below-scene", rating100: 49 },
  ];
  const counts = calculateInsightStatsRatingTiers(ratedScenes, {
    ratingCardThresholds,
  });
  for (const tier of ["bronze", "silver", "gold", "royalSapphire"] as const) {
    assert.equal(counts[tier].scenes.total, 1);
    assert.equal(counts[tier].scenes.sources.threshold, 1);
    assert.equal(counts[tier].vatos.total, 1);
    assert.equal(counts[tier].vatos.sources.threshold, 1);
  }
  assert.equal(
    insightStatsRatingTier(94, ratingCardThresholds, "scene"),
    "gold"
  );
  assert.equal(
    insightStatsRatingTier(95, ratingCardThresholds, "scene"),
    "royalSapphire"
  );
  assert.equal(
    insightStatsRatingTier(59, ratingCardThresholds, "performer"),
    undefined
  );
});

test("rating tier totals use final card precedence and deterministic source attribution", () => {
  const config = {
    roleTagIds: { ...roleTagIds, goatTagId: "goat" },
    ratingCardThresholds: {
      scene: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
      performer: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
    },
    ratingCardOverrideTagIds: {
      bronzeTagId: "bronze-override",
      silverTagId: "silver-override",
      goldTagId: "gold-override",
      royalSapphireTagId: "sapphire-override",
    },
  };
  const ratedScenes = [
    {
      ...scene,
      id: "goat-marker",
      rating100: 50,
      rating_tier_tags: [{ id: "bronze-override" }],
      scene_markers: [marker("goat", "goat-child", 0, 10)],
      scene_marker_tag_ancestors: [
        { tag_id: "goat-child", ancestor_ids: ["goat"] },
      ],
      performers: [
        {
          id: "tagged-vato",
          name: "Tagged",
          rating100: 99,
          rating_tier_tags: [
            { id: "bronze-override" },
            { id: "gold-override" },
          ],
        },
      ],
    },
    {
      ...scene,
      id: "advisor",
      rating100: null,
      rating_tier_tags: [{ id: "sapphire-override" }],
      rating_scores: [{ section: "bonus", key: "goatElement", raw_value: 0.5 }],
      performers: [
        {
          id: "tagged-vato",
          name: "Tagged duplicate",
          rating100: 99,
          rating_tier_tags: [{ id: "bronze-override" }],
        },
        { id: "rating-vato", name: "Rating", rating100: 70 },
      ],
    },
    {
      ...scene,
      id: "tag-override",
      rating100: 99,
      rating_tier_tags: [{ id: "silver-override" }],
    },
  ];
  const counts = calculateInsightStatsRatingTiers(ratedScenes, config);
  assert.equal(counts.royalSapphire.scenes.total, 2);
  assert.equal(counts.royalSapphire.scenes.sources.goatMarker, 1);
  assert.deepEqual(counts.royalSapphire.scenes.sourceIds.goatMarker, [
    "goat-marker",
  ]);
  assert.equal(counts.royalSapphire.scenes.sources.ratingAdvisor, 1);
  assert.deepEqual(counts.royalSapphire.scenes.sourceIds.ratingAdvisor, [
    "advisor",
  ]);
  assert.equal(counts.silver.scenes.total, 1);
  assert.equal(counts.silver.scenes.sources.tagOverride, 1);
  assert.equal(counts.gold.vatos.total, 1);
  assert.equal(counts.gold.vatos.sources.tagOverride, 1);
  assert.deepEqual(counts.gold.vatos.sourceIds.tagOverride, ["tagged-vato"]);
  assert.equal(counts.silver.vatos.total, 1);
  assert.equal(counts.silver.vatos.sources.threshold, 1);
  assert.deepEqual(counts.silver.vatos.ids, ["rating-vato"]);
  assert.equal(
    insightStatsFinalRatingTier(ratedScenes[0], config, "scene", ratedScenes[0])
      ?.source,
    "goatMarker"
  );
});

test("rating threshold previews move only normally rated items", () => {
  const scenes = [
    { ...scene, id: "rated", rating100: 75 },
    {
      ...scene,
      id: "overridden",
      rating100: 75,
      rating_tier_tags: [{ id: "gold-override" }],
    },
  ];
  const base = {
    ratingCardThresholds: {
      scene: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
    },
    ratingCardOverrideTagIds: { goldTagId: "gold-override" },
  };
  const preview = {
    ...base,
    ratingCardThresholds: {
      scene: { bronze: 50, silver: 76, gold: 80, royalSapphire: 95 },
    },
  };
  const currentCounts = calculateInsightStatsRatingTiers(scenes, base);
  const previewCounts = calculateInsightStatsRatingTiers(scenes, preview);
  assert.equal(currentCounts.silver.scenes.sources.threshold, 1);
  assert.equal(previewCounts.bronze.scenes.sources.threshold, 1);
  assert.equal(currentCounts.gold.scenes.sources.tagOverride, 1);
  assert.equal(previewCounts.gold.scenes.sources.tagOverride, 1);
});

test("rating tier percentages use rated populations and retain a no-tier row", () => {
  const scenes = [
    {
      ...scene,
      id: "bronze",
      rating100: 60,
      performers: [
        { id: "rated-vato", name: "Rated", rating100: 40 },
        { id: "unrated-vato", name: "Unrated", rating100: null },
      ],
    },
    {
      ...scene,
      id: "below",
      rating100: 20,
      performers: [
        { id: "rated-vato", name: "Rated duplicate", rating100: 40 },
      ],
    },
    {
      ...scene,
      id: "unrated-override",
      rating100: null,
      rating_tier_tags: [{ id: "gold-override" }],
      performers: [],
    },
  ];
  const config = {
    ratingCardThresholds: {
      scene: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
      performer: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
    },
    ratingCardOverrideTagIds: { goldTagId: "gold-override" },
  };
  const counts = calculateInsightStatsRatingTiers(scenes, config);
  const population = calculateInsightStatsRatingTierPopulation(scenes);
  assert.deepEqual(population, { scenes: 2, vatos: 1 });
  assert.equal(counts.bronze.scenes.ratedTotal, 1);
  assert.equal(counts.none.scenes.total, 1);
  assert.equal(counts.none.scenes.ratedTotal, 1);
  assert.equal(counts.none.vatos.total, 1);
  assert.equal(counts.gold.scenes.total, 1);
  assert.equal(
    counts.gold.scenes.ratedTotal,
    0,
    "an unrated override remains in raw counts but not rated percentages"
  );
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
    insightStatsCatalog.find(({ id }) => id === "orgasm-report")?.note ?? "",
    /excluding 2nd Camera/
  );
  assert.match(
    insightStatsCatalog.find(({ id }) => id === "ugly-tops")?.note ?? "",
    /Group Top Attractiveness/
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

test("quality components are counted even when the engine merges them into one chip", () => {
  const result = createInsightStatsResult();
  const candidate: SceneCardInsightCandidate = {
    key: "activity-quality-sex-oral",
    label: "Amazing sex and Good oral",
    detail: "",
    kind: "activity-quality",
    tone: "activity",
    score: 1,
  };
  countInsightStatsScene(result, scene, [candidate], new Set([candidate.key]));
  assert.equal(result.rows.get("quality-Amazing sex")?.all, 1);
  assert.equal(result.rows.get("quality-Good oral")?.visible, 1);
  assert.equal(result.rows.get("quality-Good sex")?.all, 0);
  assert.equal(result.rows.get("activity-quality")?.all, 1);
});

test("threshold simulation changes quality counts without mutating saved settings or scenes", async () => {
  const input = {
    ...scene,
    scene_markers: [marker("sex", "sex", 0, 600), marker("hot", "hot", 0, 180)],
  };
  const config = {
    roleTagIds,
    sceneCardInsightThresholds: {
      goodOutstandingPercent: 20,
      greatOutstandingPercent: 40,
    },
  };
  const before = JSON.stringify({ input, config });
  const current = await calculateInsightStats(
    [input],
    config,
    normalizeSceneCardInsightThresholds(config.sceneCardInsightThresholds),
    new Map()
  );
  const preview = await calculateInsightStats(
    [input],
    config,
    normalizeSceneCardInsightThresholds({ goodOutstandingPercent: 35 }),
    new Map()
  );
  assert.equal(current?.rows.get("quality-Good sex")?.all, 1);
  assert.equal(preview?.rows.get("quality-Good sex")?.all, 0);
  assert.equal(JSON.stringify({ input, config }), before);
  const reset = await calculateInsightStats(
    [input],
    config,
    normalizeSceneCardInsightThresholds(config.sceneCardInsightThresholds),
    new Map()
  );
  assert.deepEqual(reset, current);
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
        matches.some((candidate) =>
          sets.visible.some(({ key }) => key === candidate.key)
        )
      ),
      definition.id
    );
  });
  assert.ok(
    sets.candidates.every((candidate) =>
      insightStatsCatalog.some((definition) => definition.matches(candidate))
    ),
    "All generated candidates belong to a catalog row"
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
