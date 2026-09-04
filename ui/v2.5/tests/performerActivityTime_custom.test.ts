import assert from "node:assert/strict";

import { getScenePerformerOverviewActivityMetrics } from "../src/utils/scenePerformerOverview_custom.ts";
import TextUtils from "../src/utils/text.ts";

const metrics = getScenePerformerOverviewActivityMetrics({
  sex_top_seconds: 332,
  sex_bottom_seconds: 0,
  oral_top_seconds: 455,
  oral_bottom_seconds: 0,
  solo_seconds: 499,
});

assert.deepEqual(
  metrics.map(({ key, label, role, seconds }) => ({
    key,
    label,
    role,
    timestamp: TextUtils.secondsToTimestamp(seconds),
  })),
  [
    {
      key: "sex-top",
      label: "Time Fucking",
      role: "top",
      timestamp: "5:32",
    },
    {
      key: "sex-bottom",
      label: "Time Getting Fucked",
      role: "bottom",
      timestamp: "0:00",
    },
    {
      key: "oral-top",
      label: "Time Getting His Pito Sucked",
      role: "top",
      timestamp: "7:35",
    },
    {
      key: "oral-bottom",
      label: "Time Sucking Pito",
      role: "bottom",
      timestamp: "0:00",
    },
    {
      key: "solo",
      label: "Time Jerking",
      role: "solo",
      timestamp: "8:19",
    },
  ]
);
