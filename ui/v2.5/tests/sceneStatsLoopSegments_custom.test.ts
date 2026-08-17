import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildIntersectedLoopSegments,
  buildIntervalLoopSegments,
  getSceneStatsScopedLoopSegments,
  isSelectableLoopSegmentInterval,
} from "../src/components/Scenes/SceneDetails/sceneStatsLoopSegments_custom.ts";

assert.equal(
  isSelectableLoopSegmentInterval({ start: 10, end: 10.001 }),
  false,
  "one-millisecond closed gaps are not selectable loop segments"
);

assert.equal(
  isSelectableLoopSegmentInterval({ start: 10, end: 10.002 }),
  true,
  "intervals longer than one millisecond are selectable"
);

assert.deepEqual(
  buildIntervalLoopSegments("STANDARD", [
    { start: 1, end: 1.001 },
    { start: 5, end: 7 },
  ]),
  [
    {
      start: 5,
      end: 7,
      title: "STANDARD",
    },
  ]
);

assert.deepEqual(
  buildIntersectedLoopSegments(
    "OUTSTANDING SEX",
    [
      {
        start: 10,
        end: 20,
        title: "SEX: Good marker",
      },
      {
        start: 30,
        end: 40,
        title: "SEX: Plain marker",
      },
    ],
    [
      {
        start: 12,
        end: 18,
        title: "OUTSTANDING: Good marker",
      },
      {
        start: 50,
        end: 60,
        title: "OUTSTANDING: Other marker",
      },
    ]
  ),
  [
    {
      start: 12,
      end: 18,
      title: "OUTSTANDING SEX: Good marker",
    },
  ],
  "opposing activity and quality selections are intersected"
);

assert.deepEqual(
  buildIntersectedLoopSegments(
    "STANDARD SEX",
    [
      {
        start: 10,
        end: 20,
        title: "SEX: Plain marker",
      },
    ],
    [
      {
        start: 0,
        end: 15,
        title: "STANDARD",
      },
    ]
  ),
  [
    {
      start: 10,
      end: 15,
      title: "STANDARD SEX: Plain marker",
    },
  ],
  "standard quality intersections keep only the overlapping activity marker span"
);

const scopedSegments = {
  overview: [{ start: 1, end: 2, title: "Overview" }],
  performer: [{ start: 3, end: 4, title: "Performer" }],
  interaction: [{ start: 5, end: 6, title: "Interaction" }],
};

assert.deepEqual(
  getSceneStatsScopedLoopSegments("overview", scopedSegments),
  scopedSegments.overview,
  "the Stats panel loop action ignores Detailed Scene Stats selections"
);

assert.deepEqual(
  getSceneStatsScopedLoopSegments("details", scopedSegments),
  [...scopedSegments.performer, ...scopedSegments.interaction],
  "the Detailed Scene Stats loop action ignores Stats panel selections"
);

const sceneStatsPanelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneStatsPanel.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.match(
  sceneStatsPanelSource,
  /renderLoopTray\("overview"\)/,
  "the Stats panel renders its own loop action tray"
);
assert.match(
  sceneStatsPanelSource,
  /renderLoopTray\("details"\)/,
  "the Detailed Scene Stats dialog retains its loop action tray"
);
