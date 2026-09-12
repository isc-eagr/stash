import assert from "node:assert/strict";
import {
  emptyPlaygroundFilters,
  getPlaygroundPoints,
  matchesPlaygroundFilters,
  playgroundAxisMaximum,
  preparePlaygroundScene,
  updatePlaygroundFilter,
  type IPlaygroundScene,
} from "../src/components/Playground/playgroundData_custom.ts";
import {
  playgroundAdjustments,
  playgroundMetrics,
} from "../src/components/Playground/playgroundCatalog_custom.ts";
import {
  createPlaygroundRandom,
  hitTestPlaygroundPoints,
  playgroundQuadrant,
  positionPlaygroundPoints,
  samplePlaygroundPoints,
  layoutPlaygroundPoints,
  playgroundPointSpacing,
  playgroundSceneLimit,
} from "../src/components/Playground/playgroundChart_custom.ts";

const performer = {
  id: "p1",
  name: "Vato",
  ethnicity: " Latin ",
  country: "MX",
};
const base: IPlaygroundScene = {
  id: "1",
  title: "Scene",
  paths: {},
  files: [],
  studio: null,
  performers: [
    performer,
    { ...performer, id: "p2", ethnicity: "White", country: "US" },
  ],
  tags: [],
  rating100: 108,
  rating_scores: [
    {
      section: "criterion",
      key: "topAttractiveness",
      raw_value: 0,
      weighted_value: 0,
    },
    { section: "criterion", key: "chemistry", raw_value: 5, weighted_value: 2 },
    { section: "bonus", key: "theme", raw_value: 1, weighted_value: 1 },
    { section: "penalty", key: "production", raw_value: 0, weighted_value: -1 },
    { section: "penalty", key: "noOrgasm", raw_value: 0, weighted_value: 0 },
  ],
  scene_markers: [
    { primary_tag: { id: "facial-child" }, tags: [{ id: "hot" }] },
  ],
  scene_marker_tag_ancestors: [
    { tag_id: "facial-child", ancestor_ids: ["facial"] },
  ],
};
const config = {
  roleTagIds: {
    facialTagId: "facial",
    reallyHotTagId: "hot",
    soloTagId: "solo",
    sexTagId: "sex",
    oralTagId: "oral",
    goatTagId: "goat",
  },
};
const entry = preparePlaygroundScene(base, config);
// Every filter update is synchronous and leaves the cached source data intact.
for (const key of Object.keys(
  emptyPlaygroundFilters
) as (keyof typeof emptyPlaygroundFilters)[]) {
  const added = updatePlaygroundFilter(emptyPlaygroundFilters, key, [
    "new-filter",
  ]);
  assert.notEqual(added, emptyPlaygroundFilters);
  assert.deepEqual(added[key], ["new-filter"]);
  assert.deepEqual(emptyPlaygroundFilters[key], []);
  const removed = updatePlaygroundFilter(added, key, []);
  assert.deepEqual(removed, emptyPlaygroundFilters);
  assert.notEqual(
    removed,
    added,
    "removing a filter invalidates the plot inputs immediately"
  );
}
const excludedBonus = updatePlaygroundFilter(emptyPlaygroundFilters, "absent", [
  "bonus:theme",
]);
assert.equal(matchesPlaygroundFilters(entry, excludedBonus), false);
const includedBonus = updatePlaygroundFilter(excludedBonus, "present", [
  "bonus:theme",
]);
assert.deepEqual(includedBonus.absent, []);
assert.equal(
  matchesPlaygroundFilters(entry, includedBonus),
  true,
  "changing a filter immediately updates scene eligibility"
);
const removedBonus = updatePlaygroundFilter(includedBonus, "present", []);
assert.equal(matchesPlaygroundFilters(entry, removedBonus), true);
assert.deepEqual(
  updatePlaygroundFilter(includedBonus, "absent", ["bonus:theme"]).present,
  []
);
assert.equal(entry.mode, "default");
assert.deepEqual(entry.ethnicities, ["Latin", "White"]);
assert.equal(
  entry.facial,
  "rh",
  "descendant facial and hot tag must be on the same marker"
);
assert.equal(entry.metallic, "royal_sapphire");
const standardMetrics = playgroundMetrics("default");
const x = standardMetrics[0];
const y = standardMetrics.find((metric) => metric.key === "chemistry")!;
assert.deepEqual(
  getPlaygroundPoints([entry], x, y).map((point) => [point.x, point.y]),
  [[0, 5]],
  "zero is a saved score, not a missing value"
);
assert.equal(
  getPlaygroundPoints([{ ...entry, scores: { chemistry: 5 } }], x, y).length,
  0
);
assert.equal(
  getPlaygroundPoints(
    [{ ...entry, scores: { topAttractiveness: 0.5, chemistry: 5 } }],
    x,
    y
  ).length,
  0,
  "invalid persisted choices are not invented or rounded"
);
assert.equal(
  getPlaygroundPoints(
    [{ ...entry, scores: { topAttractiveness: NaN, chemistry: 5 } }],
    x,
    y
  ).length,
  0
);
const overall = standardMetrics.find((metric) => metric.key === "rating100")!;
assert.equal(
  playgroundAxisMaximum(getPlaygroundPoints([entry], x, overall), "y", overall),
  108,
  "ratings over 100 stay visible"
);
assert.equal(
  getPlaygroundPoints(
    [{ ...entry, scene: { ...base, rating100: null } }],
    x,
    overall
  ).length,
  0
);

assert.equal(
  matchesPlaygroundFilters(entry, {
    ...emptyPlaygroundFilters,
    ethnicities: ["Latin", "Asian"],
    countries: ["MX"],
    counts: ["2"],
    metallic: ["royal_sapphire"],
    facial: ["any"],
    present: ["bonus:theme", "penalty:production"],
    absent: ["penalty:noOrgasm"],
  }),
  true,
  "OR within ordinary filters and AND between filters and adjustments"
);
assert.equal(
  matchesPlaygroundFilters(entry, {
    ...emptyPlaygroundFilters,
    countries: ["CA"],
  }),
  false
);
assert.equal(
  matchesPlaygroundFilters(entry, {
    ...emptyPlaygroundFilters,
    counts: ["1", "3"],
  }),
  false
);
assert.equal(
  matchesPlaygroundFilters(entry, {
    ...emptyPlaygroundFilters,
    absent: ["penalty:production"],
  }),
  false,
  "weighted-only penalties are present like the backend filter"
);
assert.equal(
  matchesPlaygroundFilters(entry, {
    ...emptyPlaygroundFilters,
    present: ["bonus:theme", "bonus:goatElement"],
  }),
  false
);
assert.equal(
  matchesPlaygroundFilters(entry, {
    ...emptyPlaygroundFilters,
    facial: ["regular"],
  }),
  false
);
assert.equal(
  matchesPlaygroundFilters(entry, {
    ...emptyPlaygroundFilters,
    facial: ["regular", "rh"],
  }),
  true
);

const unclassified = preparePlaygroundScene(
  {
    ...base,
    performers: [],
    rating100: null,
    rating_scores: [],
    scene_markers: [],
  },
  config
);
assert.equal(
  matchesPlaygroundFilters(unclassified, {
    ...emptyPlaygroundFilters,
    countries: ["unknown"],
    ethnicities: ["unknown"],
    counts: ["0"],
    metallic: ["unrated"],
    facial: ["no"],
  }),
  true
);
assert.equal(
  preparePlaygroundScene({ ...base, rating100: 20 }, config).metallic,
  "none"
);
assert.equal(
  preparePlaygroundScene(
    { ...base, rating100: 20 },
    {
      ...config,
      ratingCardThresholds: {
        scene: { bronze: 10, silver: 30, gold: 50, royalSapphire: 70 },
      },
    }
  ).metallic,
  "bronze",
  "configured scene thresholds are respected"
);
assert.equal(
  preparePlaygroundScene(
    { ...base, rating100: null, tags: [{ id: "gold-tag" }] },
    { ...config, ratingCardOverrideTagIds: { goldTagId: "gold-tag" } }
  ).metallic,
  "gold",
  "tag overrides work for unrated scenes"
);
assert.equal(
  preparePlaygroundScene(
    {
      ...base,
      rating100: null,
      rating_scores: [
        {
          section: "bonus",
          key: "goatElement",
          raw_value: 0.5,
          weighted_value: 0.5,
        },
      ],
    },
    config
  ).metallic,
  "royal_sapphire"
);
assert.equal(
  preparePlaygroundScene(
    {
      ...base,
      rating100: null,
      scene_markers: [{ primary_tag: { id: "goat-child" }, tags: [] }],
      scene_marker_tag_ancestors: [
        { tag_id: "goat-child", ancestor_ids: ["goat"] },
      ],
    },
    config
  ).metallic,
  "royal_sapphire"
);

const regular = preparePlaygroundScene(
  {
    ...base,
    scene_markers: [
      { primary_tag: { id: "facial-child" }, tags: [] },
      { primary_tag: { id: "hot" }, tags: [] },
    ],
  },
  config
);
assert.equal(
  regular.facial,
  "regular",
  "hot elsewhere in the scene is not a hot facial"
);
assert.equal(
  preparePlaygroundScene(base, { roleTagIds: { facialTagId: "facial" } })
    .facial,
  "regular"
);
assert.equal(
  preparePlaygroundScene({ ...base, performers: [performer] }, config).mode,
  "solo"
);
const soloMarker = { primary_tag: { id: "solo" }, tags: [] };
const soloActivity = preparePlaygroundScene(
  { ...base, scene_markers: [soloMarker] },
  config
);
const oralActivity = preparePlaygroundScene(
  {
    ...base,
    scene_markers: [
      soloMarker,
      { primary_tag: { id: "facial" }, tags: [{ id: "oral-child" }] },
    ],
    scene_marker_tag_ancestors: [
      { tag_id: "oral-child", ancestor_ids: ["oral"] },
    ],
  },
  config
);
const sexActivity = preparePlaygroundScene(
  {
    ...base,
    scene_markers: [
      ...oralActivity.scene.scene_markers,
      { primary_tag: { id: "sex-child" }, tags: [] },
    ],
    scene_marker_tag_ancestors: [
      ...oralActivity.scene.scene_marker_tag_ancestors,
      { tag_id: "sex-child", ancestor_ids: ["sex"] },
    ],
  },
  config
);
assert.equal(soloActivity.sceneType, "solo");
assert.equal(
  oralActivity.sceneType,
  "oral",
  "oral descendant tags take priority over solo markers"
);
assert.equal(
  sexActivity.sceneType,
  "sex",
  "sex descendants take priority over oral and solo markers"
);
assert.equal(
  preparePlaygroundScene(
    { ...base, performers: [performer], scene_markers: [] },
    config
  ).sceneType,
  undefined,
  "activity classification requires markers even when the rating mode is solo"
);
assert.equal(
  preparePlaygroundScene(sexActivity.scene, {}).sceneType,
  undefined,
  "unconfigured activity tags do not guess scene types"
);
for (const activity of [soloActivity, oralActivity, sexActivity]) {
  assert.equal(
    matchesPlaygroundFilters(activity, {
      ...emptyPlaygroundFilters,
      sceneTypes: [activity.sceneType!],
    }),
    true
  );
}
assert.deepEqual(
  [soloActivity, oralActivity, sexActivity, unclassified]
    .filter((activity) =>
      matchesPlaygroundFilters(activity, {
        ...emptyPlaygroundFilters,
        sceneTypes: ["solo", "oral"],
      })
    )
    .map((activity) => activity.sceneType),
  ["solo", "oral"],
  "selected scene types combine with OR and exclude unknown activity"
);
assert.equal(
  matchesPlaygroundFilters(oralActivity, {
    ...emptyPlaygroundFilters,
    sceneTypes: ["oral"],
    countries: ["MX"],
    counts: ["2"],
    present: ["bonus:theme"],
  }),
  true,
  "scene type combines with existing filters"
);
assert.equal(
  matchesPlaygroundFilters(oralActivity, {
    ...emptyPlaygroundFilters,
    sceneTypes: ["oral"],
    countries: ["CA"],
  }),
  false,
  "other filters still constrain a matching scene type"
);
assert.equal(
  matchesPlaygroundFilters(unclassified, emptyPlaygroundFilters),
  true,
  "clearing scene types restores unclassified scenes"
);
assert.equal(
  preparePlaygroundScene({ ...base, scene_markers: [soloMarker] }, config).mode,
  "solo"
);
assert.equal(
  preparePlaygroundScene(
    {
      ...base,
      scene_markers: [soloMarker, { primary_tag: { id: "sex" }, tags: [] }],
    },
    config
  ).mode,
  "default",
  "sex takes precedence over solo markers"
);
assert.equal(
  preparePlaygroundScene(
    {
      ...base,
      scene_markers: [soloMarker, { primary_tag: { id: "oral" }, tags: [] }],
    },
    config
  ).mode,
  "default"
);
assert.equal(
  preparePlaygroundScene(
    {
      ...base,
      performers: Array.from({ length: 4 }, (_, index) => ({
        ...performer,
        id: String(index),
      })),
      scene_markers: [soloMarker],
    },
    config
  ).mode,
  "group",
  "group takes precedence for four-plus performers"
);
assert.deepEqual(
  playgroundMetrics("solo").map((metric) => metric.key),
  ["soloPerformerAppeal", "soloPerformance", "soloUsability", "rating100"]
);
assert.deepEqual(
  playgroundMetrics("group").map((metric) => metric.key),
  [
    "groupTopAttractiveness",
    "groupEnergy",
    "groupPayoff",
    "groupUsability",
    "rating100",
  ]
);
assert.ok(
  playgroundAdjustments("solo").some(
    (option) => option.value === "bonus:feetBonus"
  )
);
assert.ok(
  !playgroundAdjustments("solo").some(
    (option) => option.value === "bonus:oralOnly"
  )
);
assert.ok(
  playgroundAdjustments("group").some(
    (option) => option.value === "bonus:groupBottomAttractiveness"
  )
);

const points = getPlaygroundPoints(
  [entry, { ...entry, scene: { ...base, id: "2" } }],
  x,
  y
);
assert.equal(
  samplePlaygroundPoints(points, () => 0)[0].entry.scene.id,
  "2",
  "sampling can discover a later scene at the same coordinate"
);
assert.equal(
  samplePlaygroundPoints(points, () => 0.99)[0].entry.scene.id,
  "1",
  "sampling can retain the first scene"
);
assert.deepEqual(
  samplePlaygroundPoints(points, createPlaygroundRandom(42)),
  samplePlaygroundPoints(points, createPlaygroundRandom(42)),
  "one shuffle stays stable across rerenders"
);
const sample = samplePlaygroundPoints([...points, { ...points[0], x: 3 }]);
assert.equal(
  sample.length,
  2,
  "each distinct coordinate has exactly one random discovery"
);
assert.equal(
  new Set(sample.map((point) => `${point.x}:${point.y}`)).size,
  sample.length
);
const positioned = positionPlaygroundPoints(sample, 800, 540, 5, 5);
assert.equal(
  hitTestPlaygroundPoints(positioned, positioned[0].cx + 2, positioned[0].cy)
    .length,
  1
);
assert.equal(hitTestPlaygroundPoints(positioned, 500, 400).length, 0);
const sharedScores = Array.from({ length: 80 }, (_, index) => ({
  ...points[0],
  x: 2,
  y: 3,
  entry: { ...entry, scene: { ...base, id: `shared-${index}` } },
}));
const sharedSample = samplePlaygroundPoints(
  sharedScores,
  createPlaygroundRandom(27),
  3
);
assert.equal(
  sharedSample.length,
  3,
  "spread mode samples a small cluster per coordinate"
);
assert.equal(
  new Set(sharedSample.map((point) => point.entry.scene.id)).size,
  3
);
assert.deepEqual(
  sharedSample,
  samplePlaygroundPoints(sharedScores, createPlaygroundRandom(27), 3),
  "the cluster stays stable until shuffled"
);
assert.notDeepEqual(
  sharedSample,
  samplePlaygroundPoints(sharedScores, createPlaygroundRandom(92), 3),
  "shuffle can discover different scenes with the same scores"
);
assert.equal(
  samplePlaygroundPoints(sharedScores, createPlaygroundRandom(27)).length,
  1,
  "exact mode retains one scene per coordinate"
);
assert.equal(
  samplePlaygroundPoints(
    sharedScores.slice(0, 2),
    createPlaygroundRandom(27),
    3
  ).length,
  2,
  "small groups keep their available scenes"
);
const manyScores = sharedScores.flatMap((point, index) =>
  Array.from({ length: 5 }, (_, copy) => ({ ...point, x: index, y: copy }))
);
assert.equal(
  samplePlaygroundPoints(manyScores, createPlaygroundRandom(27), 3).length,
  playgroundSceneLimit,
  "total sampled scenes are capped to avoid a crowded plot"
);
const clusterSpread = { xMetric: x, yMetric: y, xSplit: 2.5, ySplit: 2.5 };
const desktopCluster = layoutPlaygroundPoints(
  sharedSample,
  800,
  540,
  5,
  5,
  clusterSpread
);
assert.equal(
  desktopCluster.length,
  3,
  "several scenes with shared scores are visible when space permits"
);
for (const width of [280, 400, 800]) {
  const layout = layoutPlaygroundPoints(
    sharedSample,
    width,
    460,
    5,
    5,
    clusterSpread
  );
  assert.ok(layout.length > 0 && layout.length <= 3);
  assert.deepEqual(
    layout,
    layoutPlaygroundPoints(sharedSample, width, 460, 5, 5, clusterSpread)
  );
  layout.forEach((point, index) => {
    layout
      .slice(index + 1)
      .forEach((other) =>
        assert.ok(
          Math.hypot(point.cx - other.cx, point.cy - other.cy) >=
            playgroundPointSpacing,
          "rendered dots never collide, including on small screens"
        )
      );
    assert.equal(
      hitTestPlaygroundPoints(layout, point.cx, point.cy)[0].entry.scene.id,
      point.entry.scene.id,
      "each clustered dot opens its own scene, not the first scene with matching scores"
    );
    assert.equal(point.x, 2);
    assert.equal(point.y, 3);
    assert.equal(
      playgroundQuadrant({ x: point.displayX, y: point.displayY }, 2.5, 2.5),
      playgroundQuadrant(point, 2.5, 2.5)
    );
  });
}
const noSpreadRoom = layoutPlaygroundPoints(sharedSample, 280, 460, 100, 100, {
  ...clusterSpread,
  xMetric: overall,
  yMetric: overall,
});
assert.equal(
  noSpreadRoom.length,
  1,
  "when exact axes cannot separate a cluster, only one dot is rendered"
);
const grid = Array.from({ length: 36 }, (_, index) => ({
  entry: { ...entry, scene: { ...base, id: `grid-${index}` } },
  x: index % 6,
  y: Math.floor(index / 6),
}));
const exactGrid = positionPlaygroundPoints(grid, 800, 540, 5, 5);
for (const split of [0, 2, 2.5, 5]) {
  const spread = { xMetric: x, yMetric: y, xSplit: split, ySplit: split };
  const spreadGrid = positionPlaygroundPoints(grid, 800, 540, 5, 5, spread);
  assert.deepEqual(
    spreadGrid,
    positionPlaygroundPoints(grid, 800, 540, 5, 5, spread),
    "visual spread stays stable across hover/rerenders"
  );
  const resized = positionPlaygroundPoints(grid, 400, 460, 5, 5, spread);
  spreadGrid.forEach((point, index) => {
    assert.equal(
      point.x,
      grid[index].x,
      "spread never changes the exact tooltip X score"
    );
    assert.equal(
      point.y,
      grid[index].y,
      "spread never changes the exact tooltip Y score"
    );
    assert.ok(Math.abs(point.displayX - point.x) <= 0.22 + 1e-12);
    assert.ok(Math.abs(point.displayY - point.y) <= 0.22 + 1e-12);
    assert.ok(point.displayX >= 0 && point.displayX <= 5);
    assert.ok(point.displayY >= 0 && point.displayY <= 5);
    assert.equal(
      playgroundQuadrant(
        { x: point.displayX, y: point.displayY },
        split,
        split
      ),
      playgroundQuadrant(point, split, split),
      "visual spread preserves the true quadrant, including boundary scores"
    );
    assert.equal(point.displayX, resized[index].displayX);
    assert.equal(point.displayY, resized[index].displayY);
    assert.equal(
      hitTestPlaygroundPoints(spreadGrid, point.cx, point.cy)[0].entry.scene.id,
      point.entry.scene.id,
      "hover hit testing follows the displayed dot"
    );
  });
  assert.ok(
    new Set(spreadGrid.slice(0, 6).map((point) => point.displayY)).size > 1,
    "equal-score rows visually loosen up"
  );
}
assert.deepEqual(
  positionPlaygroundPoints(grid, 800, 540, 5, 5),
  exactGrid,
  "turning spread off restores exact positions"
);
const mixedAxes = positionPlaygroundPoints(grid, 800, 540, 100, 5, {
  xMetric: overall,
  yMetric: y,
  xSplit: 50,
  ySplit: 2.5,
});
mixedAxes.forEach((point) =>
  assert.equal(
    point.displayX,
    point.x,
    "overall ratings retain their exact positions"
  )
);
assert.equal(playgroundQuadrant({ x: 0, y: 0 }, 2.5, 2.5), 0);
assert.equal(playgroundQuadrant({ x: 5, y: 0 }, 2.5, 2.5), 1);
assert.equal(playgroundQuadrant({ x: 0, y: 5 }, 2.5, 2.5), 2);
assert.equal(
  playgroundQuadrant({ x: 2.5, y: 2.5 }, 2.5, 2.5),
  3,
  "dividing values belong to high quadrants"
);

console.log(
  "Playground filtering, metrics, scene modes, tiers, and chart tests passed."
);
