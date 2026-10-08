import assert from "node:assert/strict";

import {
  getSceneActivityMetrics,
  getSceneMarkerCountCustom,
  sceneActivityMarkerIsOutstanding,
  sceneActivityTagAncestors,
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

// Negative markers are skipped time. Each activity reports the share of its own
// time inside them; Outstanding excludes that time, so the two never overlap.
const negativeShareMetrics = getSceneActivityMetrics(
  {
    id: "scene-negative-share",
    files: [{ duration: 100 }],
    scene_markers: [
      { ...marker("sex", 0, 60), tags: [{ id: "goat", parents: [] }] },
      marker("oral", 60, 90),
    ],
    negative_markers: [{ start_seconds: 45, end_seconds: 75 }],
  },
  { sexTagId: "sex", oralTagId: "oral", goatTagId: "goat" }
);

assert.deepEqual(
  negativeShareMetrics?.activity.map(
    ({ key, outstandingPercent, negativePercent }) => ({
      key,
      outstandingPercent,
      negativePercent,
    })
  ),
  [
    { key: "sex", outstandingPercent: 75, negativePercent: 25 },
    { key: "oral", outstandingPercent: 0, negativePercent: 50 },
  ],
  "each activity's negative share counts only its own time inside negative markers"
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
    files: [{ duration: 400 }],
    scene_markers: [
      marker("sex", 0, 40),
      marker("feet", 20, 30),
      marker("body", 40, 360),
      marker("orgasm", 380, 390),
    ],
    negative_markers: [{ start_seconds: 360, end_seconds: 380 }],
  },
  { sexTagId: "sex", goatTagId: "goat", orgasmTagId: "orgasm" }
);

assert.deepEqual(
  qualityPartitionMetrics?.quality.map(({ key, duration }) => ({
    key,
    duration,
  })),
  [
    { key: "outstanding", duration: 330 },
    { key: "standard", duration: 30 },
    { key: "unclassified", duration: 20 },
    { key: "unusable", duration: 20 },
  ],
  "non-activity highlights count inside and outside activity; plain orgasms remain Unclassified outside activity"
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
  "a standalone Orgasm marker needs a quality qualifier to count as Outstanding"
);

// Production scene 9836: the plain orgasm overlaps an unqualified Solo range.
const scene9836Metrics = getSceneActivityMetrics(
  {
    id: "9836",
    files: [{ duration: 561.45 }],
    scene_markers: [
      marker("24", 65.521034, 480.17501),
      marker("15", 447.626705, 460.807515),
    ],
  },
  { soloTagId: "24", orgasmTagId: "15", reallyHotTagId: "9", goatTagId: "10" }
);
assert.equal(
  scene9836Metrics?.quality.find(({ key }) => key === "outstanding")?.duration,
  0
);
assert.equal(scene9836Metrics?.activity[0].outstandingDuration, 0);
assert.equal(
  scene9836Metrics?.quality.find(({ key }) => key === "standard")?.duration,
  480.17501 - 65.521034
);

for (const qualifier of [undefined, "really-hot-child", "goat-child"]) {
  const descendantMetrics = getSceneActivityMetrics(
    {
      id: "qualified-orgasm-descendant",
      files: [{ duration: 100 }],
      scene_markers: [
        marker("solo", 0, 50),
        {
          ...marker("facial-child", 40, 60, ["facial"]),
          tags: qualifier ? [{ id: qualifier, parents: [] }] : [],
        },
      ],
      scene_marker_tag_ancestors: [
        { tag_id: "facial-child", ancestor_ids: ["facial", "orgasm"] },
        { tag_id: "really-hot-child", ancestor_ids: ["really-hot"] },
        { tag_id: "goat-child", ancestor_ids: ["goat"] },
      ],
    },
    {
      soloTagId: "solo",
      orgasmTagId: "orgasm",
      reallyHotTagId: "really-hot",
      goatTagId: "goat",
    }
  );
  assert.equal(
    descendantMetrics?.quality.find(({ key }) => key === "outstanding")
      ?.duration,
    qualifier ? 20 : 0,
    "Orgasm descendants need a quality tag on the same marker, including qualifier descendants"
  );
  assert.equal(
    descendantMetrics?.activity[0].outstandingDuration,
    qualifier ? 10 : 0,
    "only the qualified overlap contributes to Outstanding Solo activity"
  );
}

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

// Marker counts: primary or secondary tag, direct subtags, Really Hot subsets.
const countScene = {
  scene_markers: [
    {
      seconds: 0,
      end_seconds: 5,
      primary_tag: { id: "orgasm", parents: [] },
      tags: [{ id: "hot", parents: [] }],
    },
    {
      seconds: 10,
      end_seconds: 15,
      primary_tag: { id: "sex", parents: [] },
      tags: [{ id: "orgasm-child", parents: [{ id: "orgasm" }] }],
    },
    {
      seconds: 20,
      end_seconds: 25,
      primary_tag: { id: "facial", parents: [] },
      tags: [],
    },
  ],
};
const countTags = {
  orgasmTagId: "orgasm",
  facialTagId: "facial",
  reallyHotTagId: "hot",
};
assert.equal(
  getSceneMarkerCountCustom(countScene, countTags, "orgasm_count"),
  2
);
assert.equal(
  getSceneMarkerCountCustom(countScene, countTags, "really_hot_orgasm_count"),
  1
);
assert.equal(
  getSceneMarkerCountCustom(countScene, countTags, "facial_count"),
  1
);
assert.equal(
  getSceneMarkerCountCustom(countScene, countTags, "really_hot_facial_count"),
  0
);
assert.equal(
  getSceneMarkerCountCustom(
    countScene,
    { orgasmTagId: "orgasm" },
    "really_hot_orgasm_count"
  ),
  undefined,
  "Really Hot counts need the Really Hot tag configured"
);

// Flattened ancestry classifies grandchild tags that only carry direct parents.
const deepFacialScene = {
  id: "deep-facial",
  files: [{ duration: 100 }],
  scene_markers: [
    marker("sex", 0, 50, []),
    {
      ...marker("self-facial", 40, 45, ["facial"]),
    },
  ],
  scene_marker_tag_ancestors: [
    { tag_id: "self-facial", ancestor_ids: ["facial", "orgasm"] },
  ],
};
assert.equal(
  getSceneMarkerCountCustom(
    deepFacialScene,
    { orgasmTagId: "orgasm", facialTagId: "facial" },
    "orgasm_count"
  ),
  1
);
const deepOrgasmQuality = getSceneActivityMetrics(
  {
    ...deepFacialScene,
    scene_markers: [
      {
        ...marker("sex", 0, 50),
        tags: [{ id: "self-facial", parents: [{ id: "facial" }] }],
      },
    ],
  },
  { sexTagId: "sex", orgasmTagId: "orgasm", facialTagId: "facial" }
);
// An unqualified orgasm descendant does not make the activity Outstanding.
assert.equal(
  deepOrgasmQuality?.quality.find(({ key }) => key === "outstanding")?.duration,
  0
);

// The scene Stats tab shares this classifier, so a GOAT grandchild qualifies
// an activity marker as Outstanding there too.
assert.equal(
  sceneActivityMarkerIsOutstanding(
    {
      ...marker("sex", 0, 50),
      tags: [{ id: "goat-moment", parents: [{ id: "goat-family" }] }],
    },
    { sexTagId: "sex", goatTagId: "goat" },
    sceneActivityTagAncestors({
      scene_marker_tag_ancestors: [
        { tag_id: "goat-moment", ancestor_ids: ["goat-family", "goat"] },
      ],
    })
  ),
  true
);
