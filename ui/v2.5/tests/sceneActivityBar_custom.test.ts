import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { SceneActivityMetricRows } from "../src/components/Scenes/sceneActivityMetricsData_custom.ts";
import {
  getSceneActivityBarCustom,
  sceneActivityBarShowsSortCustom,
} from "../src/components/Scenes/sceneActivityBarData_custom.ts";

const rows = (
  durations: Partial<Record<"sex" | "oral" | "solo", number>>
): SceneActivityMetricRows => {
  const total = Object.values(durations).reduce((sum, value) => sum + value, 0);
  return {
    activity: (["sex", "oral", "solo"] as const).flatMap((key) =>
      durations[key]
        ? [
            {
              key,
              label: key,
              duration: durations[key],
              percent: Math.round((durations[key] / total) * 100),
            },
          ]
        : []
    ),
    quality: [],
  };
};

const ends = (metrics: SceneActivityMetricRows) => {
  const bar = getSceneActivityBarCustom(metrics);
  return bar
    ? {
        left: bar.left && [bar.left.key, bar.left.percent, bar.left.dominant],
        right: [bar.right.key, bar.right.percent, bar.right.dominant],
        rightShare: bar.rightShare,
      }
    : undefined;
};

assert.equal(
  getSceneActivityBarCustom(rows({})),
  undefined,
  "scenes without timed activity have no bar"
);
assert.deepEqual(ends(rows({ sex: 60, oral: 40 })), {
  left: ["sex", 60, true],
  right: ["oral", 40, false],
  rightShare: 0.4,
});
assert.deepEqual(
  ends(rows({ sex: 100 })),
  { left: ["sex", 100, true], right: ["oral", 0, false], rightShare: 0 },
  "sex-only dials all the way left with an empty Oral end"
);
assert.deepEqual(
  ends(rows({ oral: 100 })),
  { left: ["sex", 0, false], right: ["oral", 100, true], rightShare: 1 },
  "oral-only dials all the way right with an empty Sex end"
);
assert.deepEqual(
  ends(rows({ solo: 100 })),
  { left: undefined, right: ["solo", 100, true], rightShare: 1 },
  "solo-only has no left end and highlights the hand on the right"
);
assert.deepEqual(
  ends(rows({ sex: 70, solo: 30 })),
  { left: ["solo", 30, false], right: ["sex", 70, true], rightShare: 0.7 },
  "solo sits left of sex"
);
assert.deepEqual(
  ends(rows({ oral: 25, solo: 75 })),
  { left: ["solo", 75, true], right: ["oral", 25, false], rightShare: 0.25 },
  "solo sits left of oral"
);
assert.deepEqual(
  ends(rows({ sex: 50, solo: 30, oral: 20 })),
  {
    left: ["solo", 30, false],
    right: ["sex", 50, true],
    rightShare: 0.625,
  },
  "with all three, the two longest follow the pairing rules and need not sum to 100"
);
assert.deepEqual(
  ends(rows({ sex: 50, oral: 50 })),
  { left: ["sex", 50, true], right: ["oral", 50, true], rightShare: 0.5 },
  "a tie highlights both ends"
);

const withOutstanding = rows({ sex: 60, oral: 40 });
withOutstanding.activity[0].outstandingPercent = 45;
const outstandingBar = getSceneActivityBarCustom(withOutstanding);
assert.deepEqual(
  [
    outstandingBar?.left?.outstandingPercent,
    outstandingBar?.right.outstandingPercent,
  ],
  [45, 0],
  "each end carries its activity's Outstanding share for the card batteries"
);

const threeWay = getSceneActivityBarCustom(
  rows({ sex: 50, solo: 30, oral: 20 })
);
assert.equal(
  sceneActivityBarShowsSortCustom("solo_activity_percent", threeWay),
  true,
  "a sort value printed on a bar end suppresses its badge"
);
assert.equal(
  sceneActivityBarShowsSortCustom("oral_activity_percent", threeWay),
  false,
  "the activity left off the bar keeps its sort badge"
);
assert.equal(
  sceneActivityBarShowsSortCustom(
    "oral_activity_percent",
    getSceneActivityBarCustom(rows({ sex: 100 }))
  ),
  true,
  "an empty end still prints its 0%"
);
assert.equal(
  sceneActivityBarShowsSortCustom("outstanding_activity_percent", threeWay),
  false,
  "quality sorts are no longer shown on cards"
);

const sceneCardSource = readFileSync(
  new URL("../src/components/Scenes/SceneCard.tsx", import.meta.url),
  "utf8"
);
assert.doesNotMatch(
  sceneCardSource,
  /<SceneActivityMetrics\b/,
  "scene cards replace the activity and quality boxes"
);
assert.match(
  sceneCardSource,
  /<SceneActivityBar[\s\S]*?outstandingBatteries\s*\/>/,
  "only scene cards show the Outstanding batteries"
);

console.log("Scene card activity bar tests passed.");
