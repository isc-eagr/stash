import assert from "node:assert/strict";
import {
  createSceneTierMembers,
  groupSceneTiers,
  sceneTierGroupKey,
  sceneTierGroupLabel,
  type ISceneTierMember,
} from "../src/components/Playground/sceneTiersData_custom.ts";
import { ratingTierForEntity } from "../src/components/Playground/ratingTiersData_custom.ts";
import type { IPlaygroundEntry } from "../src/components/Playground/playgroundData_custom.ts";

const currentConfig = {
  thresholds: {
    scene: { bronze: 50, silver: 70, gold: 80, royalSapphire: 95 },
  },
  overrideTagIds: {
    bronzeTagId: "bronze-override",
    silverTagId: "silver-override",
    goldTagId: "gold-override",
    royalSapphireTagId: "sapphire-override",
  },
  goatTagId: "goat",
};
const projectedConfig = {
  ...currentConfig,
  thresholds: {
    scene: { bronze: 60, silver: 75, gold: 85, royalSapphire: 98 },
  },
};

for (const [rating, tier] of [
  [49, "none"],
  [50, "bronze"],
  [69, "bronze"],
  [70, "silver"],
  [79, "silver"],
  [80, "gold"],
  [94, "gold"],
  [95, "royal_sapphire"],
] as const) {
  assert.equal(
    ratingTierForEntity({ rating100: rating }, currentConfig, "scene"),
    tier,
    `scene rating ${rating} uses the inclusive ${tier} threshold boundary`
  );
}
assert.equal(
  ratingTierForEntity(
    { rating100: 100, tags: [{ id: "bronze-override" }] },
    currentConfig,
    "scene"
  ),
  "bronze",
  "configured scene tag overrides the numeric tier"
);
assert.equal(
  ratingTierForEntity(
    { rating100: 1, tags: [{ id: "goat" }] },
    currentConfig,
    "scene"
  ),
  "royal_sapphire",
  "the configured GOAT tag promotes a scene"
);
assert.equal(
  ratingTierForEntity(
    {
      rating100: 1,
      rating_scores: [{ section: "bonus", key: "goatElement", raw_value: 0.5 }],
    },
    currentConfig,
    "scene"
  ),
  "royal_sapphire",
  "the rating advisor's goat bonus promotes a scene"
);

function entry(
  id: string,
  rating100: number | null,
  studio: { id: string; name: string } | null,
  sceneType?: IPlaygroundEntry["sceneType"],
  tags: { id: string }[] = []
): IPlaygroundEntry {
  return {
    scene: {
      id,
      rating100,
      studio,
      tags,
      paths: {},
      files: [],
      performers: [],
      rating_scores: [],
      scene_markers: [],
      scene_marker_tag_ancestors: [],
    },
    mode: "default",
    sceneType,
    ethnicities: [],
    countries: [],
    metallic: "unrated",
    facial: "no",
    scores: {},
    adjustments: new Set(),
  };
}

const allEntries = [
  entry("scene-1", 50, { id: "studio-a", name: "Same Name" }, "sex"),
  entry("scene-2", 70, { id: "studio-b", name: "Same Name" }, "sex"),
  entry("scene-3", 80, null),
  entry("scene-unrated", null, { id: "studio-a", name: "Same Name" }, "oral"),
  entry("scene-override", 1, { id: "studio-a", name: "Same Name" }, "oral", [
    { id: "gold-override" },
  ]),
  entry("scene-goat", 1, { id: "studio-b", name: "Same Name" }, "solo", [
    { id: "goat" },
  ]),
];

assert.equal(sceneTierGroupLabel(allEntries[2], "studio"), "Unknown");
assert.equal(sceneTierGroupKey(allEntries[2], "studio"), "__unknown__");
assert.equal(sceneTierGroupLabel(allEntries[2], "sceneType"), "Unknown");
assert.equal(sceneTierGroupKey(allEntries[2], "sceneType"), "__unknown__");

// A fixed filtered cohort is what both current and projected views operate on.
// Do not re-query/re-filter one side: exact IDs back every clickable count.
const fixedCohort = allEntries.filter(({ scene }) => scene.id !== "scene-goat");
const members = createSceneTierMembers(
  fixedCohort,
  currentConfig,
  projectedConfig
);
assert.deepEqual(
  members.map(({ entry: memberEntry, current, projected }) => [
    memberEntry.scene.id,
    current,
    projected,
  ]),
  [
    ["scene-1", "bronze", "none"],
    ["scene-2", "silver", "bronze"],
    ["scene-3", "gold", "silver"],
    ["scene-unrated", undefined, undefined],
    ["scene-override", "gold", "gold"],
  ],
  "current and projected tiers are calculated over the same filtered scenes"
);

const studioGroups = groupSceneTiers(members, "studio", "label", false);
assert.equal(
  studioGroups.length,
  3,
  "studios with the same display name remain separate groups by ID"
);
assert.deepEqual(
  studioGroups.map(({ key, label }) => [key, label]),
  [
    ["studio-a", "Same Name"],
    ["studio-b", "Same Name"],
    ["__unknown__", "Unknown"],
  ]
);
assert.deepEqual(
  studioGroups.find(({ key }) => key === "studio-a"),
  {
    key: "studio-a",
    label: "Same Name",
    current: {
      royal_sapphire: { count: 0, ids: [] },
      gold: { count: 1, ids: ["scene-override"] },
      silver: { count: 0, ids: [] },
      bronze: { count: 1, ids: ["scene-1"] },
      none: { count: 0, ids: [] },
    },
    projected: {
      royal_sapphire: { count: 0, ids: [] },
      gold: { count: 1, ids: ["scene-override"] },
      silver: { count: 0, ids: [] },
      bronze: { count: 0, ids: [] },
      none: { count: 1, ids: ["scene-1"] },
    },
    currentTotal: 2,
    projectedTotal: 2,
    currentIds: ["scene-1", "scene-override"],
    projectedIds: ["scene-1", "scene-override"],
  }
);
assert.deepEqual(
  studioGroups.find(({ key }) => key === "studio-b"),
  {
    key: "studio-b",
    label: "Same Name",
    current: {
      royal_sapphire: { count: 0, ids: [] },
      gold: { count: 0, ids: [] },
      silver: { count: 1, ids: ["scene-2"] },
      bronze: { count: 0, ids: [] },
      none: { count: 0, ids: [] },
    },
    projected: {
      royal_sapphire: { count: 0, ids: [] },
      gold: { count: 0, ids: [] },
      silver: { count: 0, ids: [] },
      bronze: { count: 1, ids: ["scene-2"] },
      none: { count: 0, ids: [] },
    },
    currentTotal: 1,
    projectedTotal: 1,
    currentIds: ["scene-2"],
    projectedIds: ["scene-2"],
  }
);
assert.deepEqual(
  studioGroups.find(({ key }) => key === "__unknown__")?.currentIds,
  ["scene-3"],
  "unrated entries do not inflate current totals or drilldown IDs"
);
assert.deepEqual(
  studioGroups.find(({ key }) => key === "__unknown__")?.projectedIds,
  ["scene-3"]
);

const sceneTypeGroups = groupSceneTiers(members, "sceneType", "total", true);
assert.deepEqual(
  sceneTypeGroups.map(({ key, currentIds, projectedIds }) => [
    key,
    currentIds,
    projectedIds,
  ]),
  [
    ["sex", ["scene-1", "scene-2"], ["scene-1", "scene-2"]],
    ["oral", ["scene-override"], ["scene-override"]],
    ["__unknown__", ["scene-3"], ["scene-3"]],
  ],
  "scene type grouping retains exact current/projected cohort IDs and hides an all-unrated row"
);

const onlyUnrated: ISceneTierMember[] = [
  { entry: allEntries[3], current: undefined, projected: undefined },
];
assert.deepEqual(
  groupSceneTiers(onlyUnrated, "sceneType", "total", true),
  [],
  "a group with no rated scene in either comparison is omitted"
);
