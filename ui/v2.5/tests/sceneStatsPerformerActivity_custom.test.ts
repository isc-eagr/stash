import assert from "node:assert/strict";

import {
  getSceneStatsCombinedPerformerActivity,
  getSceneStatsPerformerActivityLabels,
  getSceneStatsPerformerActivityPercent,
} from "../src/components/Scenes/SceneDetails/sceneStatsPerformerActivity_custom.ts";

assert.deepEqual(
  getSceneStatsPerformerActivityLabels("sex"),
  {
    performerParticipationLabel: "Performer Sex Participation",
    sceneTotalLabel: "Total Scene Sex Activity",
  },
  "Sex activity clearly distinguishes the performer metric from its scene denominator"
);

assert.deepEqual(
  getSceneStatsPerformerActivityLabels("both"),
  {
    performerParticipationLabel: "Performer Overall Participation",
    sceneTotalLabel: "Total Scene Overall Activity (Sex + Oral)",
  },
  "Overall activity identifies its combined Sex and Oral denominator"
);

assert.equal(
  getSceneStatsPerformerActivityPercent(240, 480),
  50,
  "performer participation uses the scene activity duration as its denominator"
);

assert.equal(
  getSceneStatsPerformerActivityPercent(270, 600),
  45,
  "Overall participation uses the combined scene Sex and Oral duration"
);

assert.equal(
  getSceneStatsPerformerActivityPercent(0, 0),
  0,
  "empty activity durations produce a zero percentage"
);

assert.deepEqual(
  getSceneStatsCombinedPerformerActivity(
    {
      bottomSeconds: 20,
      topSeconds: 40,
      totalSeconds: 60,
    },
    {
      bottomSeconds: 25,
      topSeconds: 10,
      totalSeconds: 30,
    }
  ),
  {
    bottomPercent: 50,
    bottomSeconds: 45,
    topPercent: 56,
    topSeconds: 50,
    totalSeconds: 90,
  },
  "Overall sums Sex and Oral totals and calculates roles against the combined duration"
);

assert.equal(
  getSceneStatsCombinedPerformerActivity(
    {
      bottomSeconds: 20,
      topSeconds: 40,
      totalSeconds: 60,
    },
    undefined
  ),
  undefined,
  "Overall stays hidden when Oral has no performer activity"
);

assert.equal(
  getSceneStatsCombinedPerformerActivity(
    {
      bottomSeconds: 0,
      topSeconds: 0,
      totalSeconds: 0,
    },
    {
      bottomSeconds: 25,
      topSeconds: 10,
      totalSeconds: 30,
    }
  ),
  undefined,
  "Overall stays hidden when Sex has no performer activity"
);
