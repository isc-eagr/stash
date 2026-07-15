import assert from "node:assert/strict";

import { getSceneActivityMetrics } from "../src/components/Scenes/sceneActivityMetricsData_custom.ts";

const marker = (primaryTagId: string, seconds: number, endSeconds: number) => ({
  seconds,
  end_seconds: endSeconds,
  primary_tag: { id: primaryTagId },
  tags: [],
});

const metrics = getSceneActivityMetrics(
  {
    id: "scene-1",
    files: [{ duration: 100 }],
    scene_markers: [
      marker("oral", 0, 20),
      marker("oral", 10, 30),
      marker("sex", 40, 65),
    ],
  },
  { oralTagId: "oral", sexTagId: "sex" }
);

assert.equal(
  metrics?.activity.find((metric) => metric.key === "oral")?.percent,
  30,
  "oral percent uses merged marker coverage relative to scene duration"
);
assert.equal(
  metrics?.activity.find((metric) => metric.key === "sex")?.percent,
  25,
  "sex percent uses the same scene activity metric calculation"
);
