import assert from "node:assert/strict";

import { getSceneStatsCombinedPerformerActivity } from "../src/components/Scenes/SceneDetails/sceneStatsPerformerActivity_custom.ts";

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
