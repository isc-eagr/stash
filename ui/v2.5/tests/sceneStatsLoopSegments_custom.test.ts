import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildIntersectedLoopSegments,
  buildIntervalLoopSegments,
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

const sceneStatsPanelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneStatsPanel.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.equal(
  sceneStatsPanelSource.match(/\{renderLoopTray\(\)\}/g)?.length,
  1,
  "only the Stats panel renders a loop action tray"
);
assert.doesNotMatch(
  sceneStatsPanelSource,
  /selectedRoleInteractions|toggleRoleInteraction|togglePartnerRoleSelection/,
  "Detailed Scene Stats has no loop selection"
);
assert.match(
  sceneStatsPanelSource,
  /selectableKey: `\$\{category\}-outstanding`[\s\S]*?selectableKey: `\$\{category\}-standard`/,
  "Sex, Oral, and Solo quality rows can be added to the loop"
);
