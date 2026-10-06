import assert from "node:assert/strict";
import test from "node:test";

import {
  getOutstandingActivityMatrix,
  getSceneCardChipInsightSets,
  normalizeSceneCardInsightThresholds,
  shouldShowOutstandingActivityTotalColumn,
} from "../src/components/Scenes/sceneCardInsightsData_custom.ts";

const tag = (
  id: string,
  name: string,
  parents: Array<{ id: string }> = []
) => ({ id, name, parents });

const performer = (
  id: string,
  name: string,
  metadata: { image_path?: string } = {}
) => ({ id, name, ...metadata });

const marker = (
  id: string,
  primaryTag: ReturnType<typeof tag>,
  seconds: number,
  endSeconds: number | null,
  secondaryTags: Array<ReturnType<typeof tag>> = [],
  topPerformers: Array<ReturnType<typeof performer>> = [],
  bottomPerformers: Array<ReturnType<typeof performer>> = []
) => ({
  id,
  seconds,
  end_seconds: endSeconds,
  primary_tag: primaryTag,
  tags: secondaryTags,
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});

const roleTagIds = {
  sexTagId: "sex",
  oralTagId: "oral",
  soloTagId: "solo",
  orgasmTagId: "orgasm",
  facialTagId: "facial",
  feetTagId: "feet",
  secondCameraTagId: "second-camera",
  reallyHotTagId: "really-hot",
  goatTagId: "goat",
};

const makeScene = (
  sceneMarkers: ReturnType<typeof marker>[],
  duration = 600,
  scenePerformers?: Array<ReturnType<typeof performer>>
) => {
  const derivedPerformers = new Map<string, ReturnType<typeof performer>>();
  sceneMarkers.forEach((sceneMarker) =>
    [...sceneMarker.top_performers, ...sceneMarker.bottom_performers].forEach(
      (scenePerformer) =>
        derivedPerformers.set(scenePerformer.id, scenePerformer)
    )
  );
  return {
    id: "scene-1",
    files: [{ duration }],
    performers: scenePerformers ?? Array.from(derivedPerformers.values()),
    scene_markers: sceneMarkers,
  };
};

const roleStats = (overrides: Record<string, number> = {}) => ({
  scene_count: 20,
  sex_top_count: 0,
  sex_bottom_count: 0,
  oral_role_top_count: 0,
  oral_role_bottom_count: 0,
  facial_scene_count: 0,
  ...overrides,
});

test("thresholds keep only the chip limit and rare-role share, bounded", () => {
  assert.deepEqual(normalizeSceneCardInsightThresholds(), {
    visibleInsightLimit: 7,
    rareRoleMaximumPercent: 20,
  });
  assert.deepEqual(
    normalizeSceneCardInsightThresholds({
      visibleInsightLimit: 99,
      rareRoleMaximumPercent: Number.NaN,
    }),
    { visibleInsightLimit: 20, rareRoleMaximumPercent: 20 }
  );
});

test("the matrix hides Total only when one performer makes it redundant", () => {
  const matrix = getOutstandingActivityMatrix(
    makeScene(
      [
        marker(
          "one",
          tag("touch", "Touch"),
          0,
          20,
          [],
          [performer("one", "One Vato")]
        ),
      ],
      100
    ),
    roleTagIds
  );

  assert.equal(shouldShowOutstandingActivityTotalColumn(matrix), false);
  assert.equal(
    shouldShowOutstandingActivityTotalColumn({ columns: [], rows: [] }),
    true
  );
  assert.equal(
    shouldShowOutstandingActivityTotalColumn({
      columns: [
        { id: "one", name: "One Vato" },
        { id: "two", name: "Two Vato" },
      ],
      rows: [],
    }),
    true
  );
});

test("outstanding activity matrix sorts tags and aggregates performer cells", () => {
  const first = performer("first", "First Vato", {
    image_path: "/performer/first/image",
  });
  const second = performer("second", "Second Vato");
  const kissing = tag("kissing", "Kissing");
  const body = tag("body", "Body");
  const brief = tag("brief", "Brief touch");
  const matrix = getOutstandingActivityMatrix(
    makeScene(
      [
        marker("kiss-1", kissing, 0, 30, [], [first], [second]),
        marker("kiss-2", kissing, 40, 50, [], [first]),
        marker("body", body, 60, 80),
        marker("brief", brief, 90, 95, [], [], [second]),
        marker("goat-body", body, 80, 90, [tag("goat", "GOAT")]),
      ],
      100,
      [first, second]
    ),
    roleTagIds
  );

  assert.deepEqual(
    matrix.rows.map((row) => row.tag.name),
    ["Kissing", "Body", "Brief touch"]
  );
  assert.deepEqual(
    matrix.columns.map((column) => column.name),
    ["First Vato", "Second Vato", "Scene-wide"]
  );
  assert.equal(matrix.columns[0].imagePath, "/performer/first/image");
  assert.deepEqual(matrix.rows[0].cells.first, {
    duration: 40,
    markerCount: 2,
    outstanding: { duration: 40, markerCount: 2 },
  });
  assert.deepEqual(matrix.rows[0].cells.second, {
    duration: 30,
    markerCount: 1,
    outstanding: { duration: 30, markerCount: 1 },
  });
  assert.deepEqual(matrix.rows[1].goat, { duration: 10, markerCount: 1 });
  assert.deepEqual(matrix.rows[1].outstanding, {
    duration: 20,
    markerCount: 1,
  });
  assert.equal(matrix.rows[0].percent, 40);
});

test("the matrix keeps Feet and skips activity, qualifiers, events, and 2nd Camera", () => {
  const scene = {
    ...makeScene(
      [
        marker("feet", tag("feet", "Feet"), 0, 20, [tag("goat", "GOAT")]),
        marker("sex", tag("sex", "Sex"), 0, 300, [tag("really-hot", "Hot")]),
        marker("deep", tag("deep-orgasm", "Deep Orgasm"), 50, 55),
        marker("cam", tag("rimming", "Rimming"), 60, 90, [
          tag("second-camera", "2nd Camera"),
        ]),
      ],
      100
    ),
    scene_marker_tag_ancestors: [
      { tag_id: "deep-orgasm", ancestor_ids: ["orgasm"] },
    ],
  };
  const matrix = getOutstandingActivityMatrix(scene, roleTagIds, false);

  assert.deepEqual(
    matrix.rows.map((row) => row.tag.name),
    ["Feet"]
  );
  assert.deepEqual(matrix.rows[0].goat, { duration: 20, markerCount: 1 });
  assert.deepEqual(matrix.columns, [], "totals only without performers");
});

test("orgasm chips detect simultaneous top vatos and repeated top orgasms", () => {
  const first = performer("first", "First Vato");
  const second = performer("second", "Second Vato");
  const orgasmSubtag = tag("orgasm-subtag", "Big Orgasm", [
    tag("orgasm", "Orgasm"),
  ]);
  const { all } = getSceneCardChipInsightSets(
    makeScene(
      [
        marker("simultaneous", orgasmSubtag, 0, 10, [], [first, second]),
        marker("first-repeat", tag("orgasm", "Orgasm"), 20, 30, [], [first]),
        marker("first-repeat-2", tag("orgasm", "Orgasm"), 40, 50, [], [first]),
        marker(
          "first-camera",
          tag("orgasm", "Orgasm"),
          60,
          70,
          [tag("second-camera", "2nd Camera")],
          [first]
        ),
      ],
      100
    ),
    roleTagIds
  );

  assert.deepEqual(
    all.map(({ label }) => label),
    ["2 vatos nut at the same time", "First Vato nuts 3 times"]
  );
  assert.deepEqual(
    all[0].performerPreviews.map(({ id }) => id),
    ["first", "second"]
  );
});

test("separate orgasm markers at the same moment count as simultaneous", () => {
  const orgasm = tag("orgasm", "Orgasm");
  const { all } = getSceneCardChipInsightSets(
    makeScene(
      [
        marker("first", orgasm, 500, 510, [], [performer("first", "First")]),
        marker(
          "second",
          orgasm,
          503,
          null,
          [],
          [performer("second", "Second")]
        ),
        marker("later", orgasm, 530, 535, [], [performer("third", "Third")]),
      ],
      600
    ),
    roleTagIds
  );

  assert.equal(all[0].key, "orgasm-simultaneous");
  assert.deepEqual(
    all[0].performerPreviews.map(({ id }) => id),
    ["first", "second"]
  );
});

test("flattened ancestor IDs classify deep orgasm descendants", () => {
  const first = performer("first", "First Vato");
  const deep = tag("deep-orgasm", "Deep Orgasm");
  const { all } = getSceneCardChipInsightSets(
    {
      ...makeScene(
        [
          marker("deep-1", deep, 0, 5, [], [first]),
          marker("deep-2", deep, 10, 15, [], [first]),
        ],
        100
      ),
      scene_marker_tag_ancestors: [
        { tag_id: "deep-orgasm", ancestor_ids: ["orgasm"] },
      ],
    },
    roleTagIds
  );

  assert.deepEqual(
    all.map(({ label }) => label),
    ["First Vato nuts twice"]
  );
});

test("Only scene needs an exact library count of one", () => {
  const vato = performer("only-vato", "Only Vato");
  const scene = makeScene([], 0, [vato, vato]);
  const chips = (sceneCount: number) =>
    getSceneCardChipInsightSets(
      scene,
      undefined,
      undefined,
      new Map([[vato.id, roleStats({ scene_count: sceneCount })]])
    ).all;

  assert.deepEqual(chips(1), [
    {
      key: "only-scene-only-vato",
      label: "Only scene with Only Vato",
      detail: "Only Vato appears in only this scene in your library",
      tone: "rare",
      performerPreviews: [vato],
    },
  ]);
  for (const count of [0, 2, 30, NaN]) {
    assert.deepEqual(chips(count), []);
  }
  assert.deepEqual(
    getSceneCardChipInsightSets(scene, undefined).all,
    [],
    "missing history must not imply a single scene"
  );
});

const oralTopScene = (vato: ReturnType<typeof performer>) =>
  makeScene([
    marker(
      "oral",
      tag("oral", "Oral"),
      0,
      60,
      [],
      [vato],
      [performer("b", "B")]
    ),
    marker(
      "sex",
      tag("sex", "Sex"),
      60,
      120,
      [],
      [performer("b", "B")],
      [vato]
    ),
  ]);

test("oral topping is rare at five oral scenes and twenty percent or less", () => {
  const vato = performer("chacalito", "Chacalito Regio");
  const labels = (stats: Record<string, number>, thresholds = {}) =>
    getSceneCardChipInsightSets(
      oralTopScene(vato),
      roleTagIds,
      thresholds,
      new Map([[vato.id, roleStats(stats)]])
    ).all.map(({ label }) => label);

  assert.deepEqual(
    labels({ oral_role_top_count: 2, oral_role_bottom_count: 8 }),
    ["Rare instance of Chacalito Regio having his pito sucked"]
  );
  assert.deepEqual(
    labels({ oral_role_top_count: 1, oral_role_bottom_count: 30 }),
    ["Only time Chacalito Regio gets his pito sucked"]
  );
  assert.deepEqual(
    labels({ oral_role_top_count: 2, oral_role_bottom_count: 2 }),
    [],
    "needs five oral scenes"
  );
  assert.deepEqual(
    labels({ oral_role_top_count: 3, oral_role_bottom_count: 7 }),
    [],
    "30% is not rare by default"
  );
  assert.deepEqual(
    labels(
      { oral_role_top_count: 3, oral_role_bottom_count: 7 },
      { rareRoleMaximumPercent: 30 }
    ),
    ["Rare instance of Chacalito Regio having his pito sucked"]
  );
  assert.deepEqual(
    labels({
      sex_top_count: 9,
      sex_bottom_count: 1,
      oral_role_top_count: 9,
      oral_role_bottom_count: 1,
    }),
    [],
    "rare sex roles no longer make chips"
  );
});

test("chips order orgasms, then only scene, then rare roles, under the limit", () => {
  const vato = performer("vato", "Vato");
  const sets = getSceneCardChipInsightSets(
    makeScene(
      [
        ...oralTopScene(vato).scene_markers,
        marker("o-1", tag("orgasm", "Orgasm"), 200, 205, [], [vato]),
        marker("o-2", tag("orgasm", "Orgasm"), 300, 305, [], [vato]),
      ],
      600
    ),
    roleTagIds,
    { visibleInsightLimit: 2 },
    new Map([
      [
        vato.id,
        roleStats({
          scene_count: 1,
          oral_role_top_count: 1,
          oral_role_bottom_count: 9,
        }),
      ],
    ])
  );

  assert.deepEqual(
    sets.all.map(({ key }) => key),
    ["orgasm-repeat-vato", "only-scene-vato", "rare-oral-top-vato"]
  );
  assert.deepEqual(
    sets.visible.map(({ key }) => key),
    ["orgasm-repeat-vato", "only-scene-vato"]
  );
});
