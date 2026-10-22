import assert from "node:assert/strict";
import test from "node:test";
import type { SceneStatsScene } from "../src/components/SceneStats/sceneStatsCompactData_custom.ts";
import {
  buildStashDBMatchesTableCustom,
  stashDBMatchesAverageCustom,
  stashDBMatchesLabelRowsCustom,
  stashDBMatchesRatingBandCustom,
  stashDBMatchesRatingGapsCustom,
  stashDBMatchesRowScenesURLCustom,
  stashDBMatchesSceneGroupsCustom,
  stashDBMatchesScenesCustom,
} from "../src/components/SceneStats/sceneStatsStashDBMatchesData_custom.ts";

function scene(overrides: Partial<SceneStatsScene>): SceneStatsScene {
  return {
    id: "1",
    duration: 0,
    filesize: 0,
    performer_count: 2,
    performer_ids: [],
    performer_ethnicities: [],
    performer_countries: [],
    performer_ratings: [],
    scene_markers: [],
    tags: [],
    has_royal_sapphire_bonus: false,
    organized: true,
    stashdb_matches: 0,
    ...overrides,
  };
}

const scenes = [
  scene({
    id: "1",
    stashdb_matches: 30,
    performer_count: 2,
    performer_ethnicities: ["Latino", "White", "Latino"],
    performer_ratings: [112, 85],
    rating100: 100,
    effective_date: "2024-05-01",
  }),
  scene({
    id: "2",
    stashdb_matches: 10,
    performer_count: 1,
    performer_ethnicities: ["Latino"],
    performer_ratings: [95, null],
    rating100: 75,
    effective_date: "2023-01-01",
  }),
  scene({ id: "3", stashdb_matches: 0, performer_count: 6, rating100: 91 }),
  scene({ id: "4", stashdb_matches: null }),
  scene({ id: "5", stashdb_matches: 50, organized: false }),
];

test("only organized scenes with a count are averaged", () => {
  const counted = stashDBMatchesScenesCustom(scenes);
  assert.deepEqual(
    counted.map((s) => s.id),
    ["1", "2", "3"]
  );
  assert.equal(stashDBMatchesAverageCustom(counted), 40 / 3);
  assert.equal(stashDBMatchesAverageCustom([]), undefined);
});

test("multi-ethnicity scenes count once toward each ethnicity", () => {
  const rows = buildStashDBMatchesTableCustom(
    stashDBMatchesScenesCustom(scenes),
    stashDBMatchesSceneGroupsCustom.ethnicity
  );
  assert.deepEqual(
    rows.map((row) => [row.label, row.sceneCount, row.average]),
    [
      ["White", 1, 30],
      ["Latino", 2, 20],
    ]
  );
});

test("vato ratings band once per scene and ordinal tables sort high to low", () => {
  const counted = stashDBMatchesScenesCustom(scenes);
  assert.deepEqual(
    buildStashDBMatchesTableCustom(
      counted,
      stashDBMatchesSceneGroupsCustom.vato_rating
    ).map((row) => [row.label, row.sceneCount, row.average]),
    [
      ["110-119", 1, 30],
      ["90-99", 1, 10],
      ["80-89", 1, 30],
    ]
  );
  assert.deepEqual(
    buildStashDBMatchesTableCustom(
      counted,
      stashDBMatchesSceneGroupsCustom.rating
    ).map((row) => [row.label, row.sceneIds]),
    [
      ["100-109", ["1"]],
      ["90-99", ["3"]],
      ["70-79", ["2"]],
    ]
  );
  assert.deepEqual(
    buildStashDBMatchesTableCustom(
      counted,
      stashDBMatchesSceneGroupsCustom.performer_count
    ).map((row) => row.label),
    ["1 vato", "2 vatos", "4+ vatos"]
  );
  assert.deepEqual(
    buildStashDBMatchesTableCustom(
      counted,
      stashDBMatchesSceneGroupsCustom.release_year
    ).map((row) => row.label),
    ["2024", "2023"]
  );
});

test("rating bands use ten points and continue past 100", () => {
  assert.equal(stashDBMatchesRatingBandCustom(100)?.label, "100-109");
  assert.equal(stashDBMatchesRatingBandCustom(117)?.label, "110-119");
  assert.equal(stashDBMatchesRatingBandCustom(99)?.label, "90-99");
  assert.equal(stashDBMatchesRatingBandCustom(89)?.label, "80-89");
  assert.equal(stashDBMatchesRatingBandCustom(5)?.label, "0-9");
  assert.equal(stashDBMatchesRatingBandCustom(null), undefined);
  assert.equal(stashDBMatchesRatingBandCustom(0), undefined);
});

test("a row opens exactly its scenes, most matched first", () => {
  const storage = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      get length() {
        return storage.size;
      },
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  const [row] = buildStashDBMatchesTableCustom(
    stashDBMatchesScenesCustom(scenes),
    stashDBMatchesSceneGroupsCustom.ethnicity
  ).filter((r) => r.label === "Latino");

  const url = new URL(
    stashDBMatchesRowScenesURLCustom("By Vato Ethnicity", row),
    "http://stash"
  );
  assert.equal(url.pathname, "/scenes");
  assert.equal(url.searchParams.get("sortby"), "stashdb_matches");
  assert.equal(url.searchParams.get("sortdir"), "desc");
  const criterion = JSON.parse(url.searchParams.get("c") ?? "{}");
  assert.equal(criterion.type, "insight_chip");
  const snapshot = JSON.parse(
    storage.get(`stash-insight-match:${criterion.value}`) ?? "{}"
  );
  assert.deepEqual(snapshot.ids, ["1", "2"]);
  assert.equal(snapshot.label, "StashDB Matches By Vato Ethnicity: Latino");
});

test("vatos and studios group by ID, once per scene", () => {
  const counted = stashDBMatchesScenesCustom([
    scene({
      id: "1",
      stashdb_matches: 9,
      performer_ids: ["7", "8", "7"],
      studio_id: "3",
    }),
    scene({
      id: "2",
      stashdb_matches: 3,
      performer_ids: ["7"],
      studio_id: "3",
    }),
    scene({
      id: "3",
      stashdb_matches: 6,
      performer_ids: ["8"],
      studio_id: null,
    }),
  ]);
  assert.deepEqual(
    buildStashDBMatchesTableCustom(
      counted,
      stashDBMatchesSceneGroupsCustom.vato
    ).map((row) => [row.key, row.sceneIds, row.average]),
    [
      ["8", ["1", "3"], 7.5],
      ["7", ["1", "2"], 6],
    ]
  );
  assert.deepEqual(
    buildStashDBMatchesTableCustom(
      counted,
      stashDBMatchesSceneGroupsCustom.studio
    ).map((row) => [row.key, row.sceneCount]),
    [["3", 2]]
  );
});

test("rating vs community ranks the biggest percentile gaps", () => {
  const gaps = stashDBMatchesRatingGapsCustom(
    [
      // One match is usually your own, so it can't be an Underrated Gem.
      scene({ id: "mine", rating100: 99, stashdb_matches: 1 }),
      scene({ id: "gem", title: "Gem", rating100: 98, stashdb_matches: 2 }),
      scene({ id: "hype", title: "Hype", rating100: 40, stashdb_matches: 90 }),
      scene({ id: "fair", rating100: 70, stashdb_matches: 30 }),
      scene({ id: "unrated", rating100: null, stashdb_matches: 500 }),
    ],
    5
  );
  assert.deepEqual(
    gaps.underrated.map((s) => [s.id, s.title, Math.round(s.gap * 3)]),
    [["gem", "Gem", 1]]
  );
  assert.deepEqual(
    gaps.overhyped.map((s) => [s.id, Math.round(s.gap * 3)]),
    [
      ["hype", -3],
      ["fair", -1],
    ]
  );
  assert.deepEqual(stashDBMatchesRatingGapsCustom([scene({ rating100: 80 })]), {
    underrated: [],
    overhyped: [],
  });
});

test("vato and studio rows only read their own names", () => {
  // Performer 1 and studio 1 are different things that share an ID.
  const names = {
    vato: new Map([["1", "Reign"]]),
    studio: new Map([["1", "Bilatinmen"]]),
  };
  const rows = buildStashDBMatchesTableCustom(
    stashDBMatchesScenesCustom([
      scene({ id: "10", performer_ids: ["1"], studio_id: "1" }),
    ]),
    stashDBMatchesSceneGroupsCustom.vato
  );
  assert.equal(
    stashDBMatchesLabelRowsCustom("vato", rows, names)[0].label,
    "Reign"
  );
  assert.equal(
    stashDBMatchesLabelRowsCustom("studio", rows, names)[0].label,
    "Bilatinmen"
  );
  assert.equal(
    stashDBMatchesLabelRowsCustom("vato", rows, { studio: names.studio })[0]
      .label,
    "#1"
  );
  assert.equal(
    stashDBMatchesLabelRowsCustom("ethnicity", rows, names)[0].label,
    "1"
  );
});
