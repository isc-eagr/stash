import assert from "node:assert/strict";
import test from "node:test";
import {
  getVatoStatsStudioRoleCounts,
  getVatoStatsStudioSummary,
  getVatoStatsStudioTierRows,
  type IVatoStatsStudioPerformer,
} from "../src/components/VatoStats/vatoStatsStudioScope_custom.ts";

const performers: IVatoStatsStudioPerformer[] = [
  {
    penis_length: 20,
    scene_count: 1,
    sex_top_count: 2,
    sex_bottom_count: 0,
    oral_top_count: 0,
    oral_bottom_count: 0,
    solo_scene_count: 0,
    facial_given_count: 0,
    facial_received_count: 0,
    ethnicity: "Latino",
    metallic_rating: "gold",
  },
  {
    penis_length: null,
    scene_count: 3,
    sex_top_count: 1,
    sex_bottom_count: 0,
    oral_top_count: 0,
    oral_bottom_count: 1,
    solo_scene_count: 0,
    facial_given_count: 0,
    facial_received_count: 0,
    ethnicity: "Latino",
    metallic_rating: "bronze",
  },
  {
    penis_length: 18,
    scene_count: 1,
    sex_top_count: 0,
    sex_bottom_count: 0,
    oral_top_count: 0,
    oral_bottom_count: 0,
    solo_scene_count: 1,
    facial_given_count: 0,
    facial_received_count: 0,
    ethnicity: "Black",
    metallic_rating: "royal_sapphire",
  },
];

test("studio summary uses only the scoped performer rows", () => {
  assert.deepEqual(getVatoStatsStudioSummary(performers, 10), {
    estimatedLiters: 0.03,
    totalPenisMeters: 0.55,
    performersSexGivenCount: 2,
    performersSexReceivedCount: 0,
    performersOralGivenCount: 0,
    performersOralReceivedCount: 1,
    performersFacialGivenCount: 0,
    performersFacialReceivedCount: 0,
    performersSoloOnlyCount: 1,
    performersOneSceneCount: 2,
  });
});

test("studio role and tier summaries stay within the selected studio", () => {
  assert.deepEqual(getVatoStatsStudioRoleCounts(performers), {
    strictTop: 1,
    lenientTop: 1,
    strictBottom: 0,
    lenientBottom: 0,
  });
  assert.deepEqual(getVatoStatsStudioTierRows(performers), [
    {
      ethnicity: "Latino",
      bronze: 1,
      silver: 0,
      gold: 1,
      royal_sapphire: 0,
    },
    {
      ethnicity: "Black",
      bronze: 0,
      silver: 0,
      gold: 0,
      royal_sapphire: 1,
    },
  ]);
});
