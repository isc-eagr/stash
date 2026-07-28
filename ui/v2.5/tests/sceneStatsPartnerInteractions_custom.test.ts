import assert from "node:assert/strict";

import {
  getSceneStatsAvailableInteractionViews,
  getSceneStatsAvailablePartnerViews,
  getSceneStatsInteractionPairCategories,
  getSceneStatsInteractionPairIntervals,
  getSceneStatsInteractionPairs,
  getSceneStatsOverallPartnerDistribution,
  getSceneStatsPartnerBarPercent,
  getSceneStatsPartnerRoleBreakdown,
  getSceneStatsPartnerInteractions,
  getSceneStatsRoleInteractionCategories,
  getSceneStatsRoleInteractionKey,
  getSceneStatsRoleInteractions,
  getSceneStatsRoleInteractionView,
  isSceneStatsLeadingPartner,
  shouldShowSceneStatsDetails,
  shouldShowSceneStatsInteractionPercent,
  shouldShowSceneStatsPartnerInteractions,
  type ISceneStatsPartnerPerformer,
} from "../src/components/Scenes/SceneDetails/sceneStatsPartnerInteractions_custom.ts";

const mainPerformer: ISceneStatsPartnerPerformer = {
  id: "main",
  name: "Main Vato",
  imagePath: "/main.jpg",
};
const chaseCarter: ISceneStatsPartnerPerformer = {
  id: "chase",
  name: "Chase Carter",
  imagePath: "/chase.jpg",
};
const dayDayRockafella: ISceneStatsPartnerPerformer = {
  id: "day-day",
  name: "Day Day Rockafella",
  imagePath: "/day-day.jpg",
};

const interactions = getSceneStatsPartnerInteractions([
  {
    category: "sex",
    interval: { start: 0, end: 32 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
  {
    category: "sex",
    interval: { start: 32, end: 100 },
    topPerformers: [mainPerformer],
    bottomPerformers: [dayDayRockafella],
  },
  {
    category: "oral",
    interval: { start: 100, end: 130 },
    topPerformers: [chaseCarter, dayDayRockafella],
    bottomPerformers: [mainPerformer],
  },
  {
    category: "solo",
    interval: { start: 130, end: 150 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
]);

assert.deepEqual(
  interactions.main.sex,
  {
    totalSeconds: 100,
    partners: [
      {
        performer: dayDayRockafella,
        intervals: [{ start: 32, end: 100 }],
        seconds: 68,
        percent: 68,
      },
      {
        performer: chaseCarter,
        intervals: [{ start: 0, end: 32 }],
        seconds: 32,
        percent: 32,
      },
    ],
  },
  "sex partner time is distributed across opposite-role performers"
);

assert.deepEqual(
  interactions.main.oral,
  {
    totalSeconds: 60,
    partners: [
      {
        performer: chaseCarter,
        intervals: [{ start: 100, end: 130 }],
        seconds: 30,
        percent: 50,
      },
      {
        performer: dayDayRockafella,
        intervals: [{ start: 100, end: 130 }],
        seconds: 30,
        percent: 50,
      },
    ],
  },
  "simultaneous oral partners each receive their interaction duration"
);

assert.equal(
  interactions.main.oral?.partners[0].performer.imagePath,
  "/chase.jpg",
  "partner image paths stay attached to explorer rows"
);

assert.deepEqual(
  getSceneStatsOverallPartnerDistribution(interactions.main),
  {
    totalSeconds: 160,
    partners: [
      {
        performer: dayDayRockafella,
        intervals: [{ start: 32, end: 130 }],
        seconds: 98,
        percent: 61,
      },
      {
        performer: chaseCarter,
        intervals: [
          { start: 0, end: 32 },
          { start: 100, end: 130 },
        ],
        seconds: 62,
        percent: 39,
      },
    ],
  },
  "Overall Partners combines Sex and Oral time into one distribution"
);

const overallPartnerDistribution = getSceneStatsOverallPartnerDistribution(
  interactions.main
);
assert.ok(overallPartnerDistribution);
assert.deepEqual(
  getSceneStatsAvailablePartnerViews(interactions.main),
  ["both", "sex", "oral"],
  "Overall is available when both Sex and Oral partner columns have values"
);
assert.equal(
  getSceneStatsPartnerBarPercent(98, overallPartnerDistribution),
  100,
  "the most-interacted partner fills the complete comparison bar"
);
assert.equal(
  getSceneStatsPartnerBarPercent(62, overallPartnerDistribution),
  63,
  "other partner bars are relative to the longest partner bar"
);
assert.equal(
  isSceneStatsLeadingPartner(98, overallPartnerDistribution),
  true,
  "the highest-time partner is identified for column highlighting"
);
assert.equal(
  isSceneStatsLeadingPartner(62, overallPartnerDistribution),
  false,
  "lower-time partners are not highlighted as column leaders"
);
assert.equal(
  isSceneStatsLeadingPartner(98, {
    ...overallPartnerDistribution,
    partners: overallPartnerDistribution.partners.map((partner) => ({
      ...partner,
      seconds: 98,
    })),
  }),
  true,
  "exact ties remain eligible for the highest-time highlight"
);
assert.equal(
  shouldShowSceneStatsInteractionPercent(2),
  false,
  "directional percentages are hidden when a scene has fewer than three performers"
);
assert.equal(
  shouldShowSceneStatsInteractionPercent(3),
  true,
  "directional percentages remain visible for group scenes"
);
assert.equal(
  shouldShowSceneStatsPartnerInteractions(2),
  false,
  "Partner Interactions is hidden for scenes with two or fewer performers"
);
assert.equal(
  shouldShowSceneStatsPartnerInteractions(3),
  true,
  "Partner Interactions remains visible for group scenes"
);
assert.equal(
  shouldShowSceneStatsDetails(1),
  false,
  "Detailed Scene Stats is unavailable for solo scenes"
);
assert.equal(
  shouldShowSceneStatsDetails(2),
  true,
  "Detailed Scene Stats remains available for partnered scenes"
);

const canonicalPairs = getSceneStatsInteractionPairs(
  [mainPerformer, chaseCarter, dayDayRockafella],
  interactions
);
const mainAndChasePair = canonicalPairs.find(
  (pair) => pair.key === "chase::main"
);

assert.deepEqual(
  mainAndChasePair?.categories.sex?.performerPercents,
  { main: 32, chase: 100 },
  "the matrix retains each performer's directional percentage denominator"
);

const overlappingInteractions = getSceneStatsPartnerInteractions([
  {
    category: "sex",
    interval: { start: 0, end: 40 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
  {
    category: "sex",
    interval: { start: 20, end: 60 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
]);

assert.equal(
  overlappingInteractions.main.sex?.totalSeconds,
  60,
  "overlapping ranges with the same partner are merged before totaling time"
);

const matrixInteractions = getSceneStatsPartnerInteractions([
  {
    category: "sex",
    interval: { start: 0, end: 40 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
  {
    category: "oral",
    interval: { start: 30, end: 60 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
]);
const matrixPairs = getSceneStatsInteractionPairs(
  [mainPerformer, chaseCarter],
  matrixInteractions
);

assert.equal(
  matrixPairs.length,
  1,
  "the interaction matrix emits one canonical pair instead of mirrored rows"
);
assert.deepEqual(
  matrixPairs[0].categories.sex?.performerPercents,
  { main: 100, chase: 100 },
  "a canonical pair records both performers"
);
assert.deepEqual(
  getSceneStatsInteractionPairCategories(matrixPairs[0], "both"),
  ["sex", "oral"],
  "Both selects every available interaction category for the pair"
);
assert.deepEqual(
  getSceneStatsInteractionPairIntervals(matrixPairs[0], "both"),
  [{ start: 0, end: 60 }],
  "Both merges overlapping Sex and Oral intervals before loop selection"
);

const directionalMarkers = [
  {
    category: "sex",
    interval: { start: 0, end: 40 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
  {
    category: "oral",
    interval: { start: 30, end: 60 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
  {
    category: "sex",
    interval: { start: 40, end: 60 },
    topPerformers: [chaseCarter],
    bottomPerformers: [mainPerformer],
  },
  {
    category: "sex",
    interval: { start: 60, end: 100 },
    topPerformers: [mainPerformer],
    bottomPerformers: [dayDayRockafella],
  },
] as const;
const directionalInteractions = getSceneStatsRoleInteractions([
  ...directionalMarkers,
]);
const mainTopsChase = directionalInteractions.find(
  (interaction) =>
    interaction.key ===
    getSceneStatsRoleInteractionKey(mainPerformer.id, chaseCarter.id)
);

assert.ok(mainTopsChase, "the matrix includes the Top-to-Bottom direction");
assert.deepEqual(
  getSceneStatsRoleInteractionCategories(mainTopsChase, "both"),
  ["sex", "oral"],
  "an Overall directional lane selects its available Sex and Oral intervals"
);
assert.deepEqual(
  getSceneStatsRoleInteractionCategories(mainTopsChase, "sex"),
  ["sex"],
  "an activity directional lane selects only its own interval category"
);
assert.deepEqual(
  getSceneStatsRoleInteractionCategories(mainTopsChase, "oral"),
  ["oral"],
  "each populated directional lane remains independently selectable"
);
assert.ok(
  directionalInteractions.some(
    (interaction) =>
      interaction.key ===
      getSceneStatsRoleInteractionKey(chaseCarter.id, mainPerformer.id)
  ),
  "the reverse Top-to-Bottom direction is a separate matrix cell"
);
assert.deepEqual(
  getSceneStatsRoleInteractionView(
    mainTopsChase,
    "both",
    directionalInteractions
  ),
  {
    bottomPercent: 100,
    intervals: [{ start: 0, end: 60 }],
    seconds: 60,
    topPercent: 60,
  },
  "Both displays one combined Sex-and-Oral duration with directional percentages"
);
assert.deepEqual(
  getSceneStatsRoleInteractionView(
    mainTopsChase,
    "sex",
    directionalInteractions
  ),
  {
    bottomPercent: 100,
    intervals: [{ start: 0, end: 40 }],
    seconds: 40,
    topPercent: 50,
  },
  "Sex percentages use all matching Top and Bottom time as their denominators"
);

const directionalPartnerInteractions = getSceneStatsPartnerInteractions([
  ...directionalMarkers,
]);
const directionalPairs = getSceneStatsInteractionPairs(
  [mainPerformer, chaseCarter, dayDayRockafella],
  directionalPartnerInteractions
);
const directionalMainAndChasePair = directionalPairs.find(
  (pair) => pair.key === "chase::main"
);

assert.ok(directionalMainAndChasePair);
assert.deepEqual(
  getSceneStatsPartnerRoleBreakdown(
    mainPerformer.id,
    chaseCarter.id,
    "both",
    directionalMainAndChasePair,
    directionalInteractions
  ),
  {
    bottomedFor: { percent: 33, seconds: 20 },
    topped: { percent: 100, seconds: 60 },
  },
  "partner role percentages use the pair's merged interaction time"
);
assert.deepEqual(
  getSceneStatsPartnerRoleBreakdown(
    dayDayRockafella.id,
    mainPerformer.id,
    "both",
    directionalPairs.find((pair) => pair.key === "day-day::main")!,
    directionalInteractions
  ),
  {
    bottomedFor: { percent: 100, seconds: 40 },
    topped: { percent: 0, seconds: 0 },
  },
  "missing role directions remain zero so the UI can hide them"
);

const oralOnlyMarkers = [
  {
    category: "oral",
    interval: { start: 0, end: 30 },
    topPerformers: [mainPerformer],
    bottomPerformers: [chaseCarter],
  },
];
assert.deepEqual(
  getSceneStatsAvailablePartnerViews(
    getSceneStatsPartnerInteractions(oralOnlyMarkers).main
  ),
  ["oral"],
  "the partner table hides empty Sex and redundant Overall columns"
);
assert.deepEqual(
  getSceneStatsAvailableInteractionViews(
    getSceneStatsRoleInteractions(oralOnlyMarkers)
  ),
  ["oral"],
  "the matrix hides Sex and Both when the scene only has Oral interactions"
);
assert.deepEqual(
  getSceneStatsAvailableInteractionViews(directionalInteractions),
  ["sex", "oral", "both"],
  "the matrix retains both activity selectors when both contain interactions"
);
