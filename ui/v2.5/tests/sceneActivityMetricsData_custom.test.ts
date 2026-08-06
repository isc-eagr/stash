import assert from "node:assert/strict";

import { getSceneActivityMetrics } from "../src/components/Scenes/sceneActivityMetricsData_custom.ts";

const marker = (
  primaryTagId: string,
  seconds: number,
  endSeconds: number,
  parentTagIds: string[] = []
) => ({
  seconds,
  end_seconds: endSeconds,
  primary_tag: {
    id: primaryTagId,
    parents: parentTagIds.map((id) => ({ id })),
  },
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

const goatMetrics = getSceneActivityMetrics(
  {
    id: "scene-goat",
    files: [{ duration: 100 }],
    scene_markers: [marker("oral", 0, 25, ["goat"]), marker("oral", 25, 50)],
  },
  { oralTagId: "oral", goatTagId: "goat" }
);

assert.equal(
  goatMetrics?.quality.find((metric) => metric.key === "outstanding")?.percent,
  25,
  "a configured GOAT descendant marker is Outstanding even when it is a plain activity marker"
);
assert.equal(
  goatMetrics?.quality.find((metric) => metric.key === "standard")?.percent,
  75,
  "GOAT activity coverage is removed from Standard"
);
