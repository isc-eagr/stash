import assert from "node:assert/strict";

import {
  getSceneActivityMetrics,
  hasVisibleSceneActivitySortMetricCustom,
} from "../src/components/Scenes/sceneActivityMetricsData_custom.ts";

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
  55,
  "oral percent uses merged marker coverage relative to classified activity"
);
assert.equal(
  metrics?.activity.find((metric) => metric.key === "sex")?.percent,
  45,
  "sex percent uses the same classified activity denominator"
);
assert.deepEqual(
  metrics?.activity.map((metric) => metric.key),
  ["sex", "oral"],
  "the scene activity strip omits Other and zero-duration activities"
);
assert.equal(
  metrics?.activity.reduce((total, metric) => total + metric.percent, 0),
  100,
  "the three displayed activity types partition 100 percent"
);
assert.equal(
  hasVisibleSceneActivitySortMetricCustom("oral_activity_percent", metrics),
  true,
  "a sort value already present in an activity box suppresses its badge"
);
assert.equal(
  hasVisibleSceneActivitySortMetricCustom("solo_activity_percent", metrics),
  false,
  "a zero-duration activity without a box does not suppress its sort badge"
);
assert.equal(
  hasVisibleSceneActivitySortMetricCustom("unusable_activity_percent", metrics),
  false,
  "a zero-duration quality value without a box does not suppress its badge"
);
assert.equal(
  metrics?.activity.find((metric) => metric.key === "oral")?.duration,
  30,
  "the visual summary includes merged activity duration"
);
assert.equal(
  metrics?.quality.reduce((total, metric) => total + metric.percent, 0),
  100,
  "the four quality types partition the full scene"
);

const objectiveMetrics = getSceneActivityMetrics(
  {
    id: "scene-objective-summary",
    files: [{ duration: 100 }],
    scene_markers: [
      marker("sex", 0, 60),
      marker("oral", 60, 90),
      marker("solo", 90, 100),
      marker("feet", 0, 30),
      marker("pito", 60, 75),
    ],
  },
  { sexTagId: "sex", oralTagId: "oral", soloTagId: "solo" }
);

assert.deepEqual(
  objectiveMetrics?.activity.map((metric) => ({
    key: metric.key,
    label: metric.label,
    percent: metric.percent,
    duration: metric.duration,
    outstandingPercent: metric.outstandingPercent,
    outstandingDuration: metric.outstandingDuration,
  })),
  [
    {
      key: "sex",
      label: "Fucking",
      percent: 60,
      duration: 60,
      outstandingPercent: 50,
      outstandingDuration: 30,
    },
    {
      key: "oral",
      label: "Eating pito",
      percent: 30,
      duration: 30,
      outstandingPercent: 50,
      outstandingDuration: 15,
    },
    {
      key: "solo",
      label: "Jerking",
      percent: 10,
      duration: 10,
      outstandingPercent: 0,
      outstandingDuration: 0,
    },
  ],
  "each icon summary includes its classified share, duration, and Outstanding evidence"
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
  25,
  "Standard is limited to non-Outstanding activity coverage"
);
assert.equal(
  goatMetrics?.quality.find((metric) => metric.key === "unclassified")?.percent,
  50,
  "activity-free runtime is Unclassified"
);

const qualityPartitionMetrics = getSceneActivityMetrics(
  {
    id: "scene-quality-partition",
    files: [{ duration: 100 }],
    scene_markers: [marker("sex", 0, 40), marker("feet", 40, 60, ["goat"])],
    negative_markers: [{ start_seconds: 60, end_seconds: 80 }],
  },
  { sexTagId: "sex", goatTagId: "goat" }
);

assert.deepEqual(
  qualityPartitionMetrics?.quality.map(({ key, duration }) => ({
    key,
    duration,
  })),
  [
    { key: "outstanding", duration: 0 },
    { key: "standard", duration: 40 },
    { key: "unclassified", duration: 40 },
    { key: "unusable", duration: 20 },
  ],
  "a Feet-only marker is Unclassified and negative-marker time is Unusable"
);

const ordinaryOrgasmMetrics = getSceneActivityMetrics(
  {
    id: "scene-ordinary-orgasm",
    files: [{ duration: 100 }],
    scene_markers: [marker("orgasm", 10, 30)],
  },
  { orgasmTagId: "orgasm" }
);

assert.equal(
  ordinaryOrgasmMetrics?.quality.find((metric) => metric.key === "outstanding")
    ?.percent,
  0,
  "an ordinary Orgasm does not count as Outstanding"
);

const hotOrgasmMetrics = getSceneActivityMetrics(
  {
    id: "scene-hot-orgasm",
    files: [{ duration: 100 }],
    scene_markers: [
      marker("sex", 10, 30, ["really-hot"]),
      marker("orgasm", 10, 30, ["really-hot"]),
    ],
  },
  { sexTagId: "sex", orgasmTagId: "orgasm", reallyHotTagId: "really-hot" }
);

assert.equal(
  hotOrgasmMetrics?.quality.find((metric) => metric.key === "outstanding")
    ?.percent,
  20,
  "a Really Hot Orgasm remains Outstanding"
);
