import assert from "node:assert/strict";

import {
  getSceneStatsPartnerInteractions,
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
        seconds: 68,
        percent: 68,
      },
      {
        performer: chaseCarter,
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
        seconds: 30,
        percent: 50,
      },
      {
        performer: dayDayRockafella,
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
  "partner image paths stay attached to donut slices"
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
