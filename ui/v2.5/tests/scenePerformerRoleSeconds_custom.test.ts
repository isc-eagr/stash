import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getScenePerformerRoleSeconds } from "../src/components/Scenes/scenePerformerRoleSeconds_custom.ts";

const tag = (id: string) => ({ id, name: id });
const marker = (
  primaryTag: string,
  seconds: number,
  endSeconds: number | null,
  top: string[],
  bottom: string[]
) => ({
  seconds,
  end_seconds: endSeconds,
  primary_tag: tag(primaryTag),
  tags: [],
  top_performers: top.map((id) => ({ id })),
  bottom_performers: bottom.map((id) => ({ id })),
});

const seconds = getScenePerformerRoleSeconds(
  {
    files: [{ duration: 100 }],
    scene_markers: [
      marker("sex", 0, 30, ["1"], ["2"]),
      marker("sex", 20, 40, ["1"], ["2"]),
      marker("oral", 50, 60, ["2"], ["1"]),
      marker("oral", 90, 130, ["2"], ["1"]),
      marker("sex", 60, null, ["1"], ["2"]),
      marker("solo", 0, 50, ["1"], []),
    ],
  },
  { sexTagId: "sex", oralTagId: "oral", soloTagId: "solo" }
);

assert.deepEqual(
  seconds.get("1"),
  {
    sexTopSeconds: 40,
    sexBottomSeconds: 0,
    oralTopSeconds: 0,
    oralBottomSeconds: 20,
  },
  "overlaps merge, open markers skip, and time clamps to the file"
);
assert.deepEqual(seconds.get("2"), {
  sexTopSeconds: 0,
  sexBottomSeconds: 40,
  oralTopSeconds: 20,
  oralBottomSeconds: 0,
});
assert.equal(
  getScenePerformerRoleSeconds(
    { files: [], scene_markers: [marker("sex", 0, 10, ["1"], ["2"])] },
    { sexTagId: "sex" }
  ).size,
  0,
  "scenes without a duration have no role time"
);

const popoverSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneCardPerformerPopover_custom.tsx",
    import.meta.url
  ),
  "utf8"
);
const stripSource = readFileSync(
  new URL(
    "../src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx",
    import.meta.url
  ),
  "utf8"
);
assert.match(
  popoverSource,
  /<PerformerCategoryStrip[\s\S]*?versatilityCard[\s\S]*?roleSeconds=/,
  "scene card vato hovers pass role time to the strip"
);
assert.match(
  stripSource,
  /if \(roleSeconds && role\.category !== "facial"\)[\s\S]*?<PerformerCardVersatilityTimeRow/,
  "sex and oral use compact time rows; facial keeps partners"
);

const detailPanelSource = readFileSync(
  new URL(
    "../src/components/Scenes/SceneDetails/SceneDetailPanel.tsx",
    import.meta.url
  ),
  "utf8"
);
const cardSource = readFileSync(
  new URL("../src/components/Performers/PerformerCard.tsx", import.meta.url),
  "utf8"
);
assert.match(
  detailPanelSource,
  /<PerformerCard[\s\S]*?sceneRoleSeconds=\{/,
  "scene page vato cards get role time"
);
assert.match(
  cardSource,
  /<PerformerCategoryStrip[\s\S]*?roleSeconds=\{sceneRoleSeconds\}/,
  "vato cards pass role time to the strip"
);

console.log("Scene performer role seconds tests passed.");
