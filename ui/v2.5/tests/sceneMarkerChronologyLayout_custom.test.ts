import assert from "node:assert/strict";

import {
  buildChronologicalSceneMarkerLayout,
  isChronologicalSceneMarkerGoatTagged,
} from "../src/components/Scenes/SceneDetails/sceneMarkerChronologyLayout_custom.ts";
import { groupChronologicalSceneMarkerHighlights } from "../src/components/Scenes/SceneDetails/sceneMarkerChronologySearch_custom.ts";

type TestTag = {
  id: string;
  name: string;
  parents: TestTag[];
};

const tag = (id: string, name: string, parents: TestTag[] = []): TestTag => ({
  id,
  name,
  parents,
});
const performer = (id: string, name: string) => ({ id, name });

const marker = (
  id: string,
  seconds: number,
  endSeconds: number | null,
  primaryTag: ReturnType<typeof tag>,
  secondaryTags: Array<ReturnType<typeof tag>> = [],
  topPerformers: Array<ReturnType<typeof performer>> = [],
  bottomPerformers: Array<ReturnType<typeof performer>> = []
) => ({
  id,
  seconds,
  end_seconds: endSeconds,
  primary_tag: primaryTag,
  tags: secondaryTags,
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});

const oral = tag("oral", "Oral");
const feet = tag("feet", "Feet");
const orgasm = tag("orgasm", "Orgasm");
const goat = tag("goat", "GOAT");
const topA = performer("top-a", "Top A");
const bottomB = performer("bottom-b", "Bottom B");

const roleTagIds = {
  oralTagId: "oral",
  sexTagId: "sex",
  soloTagId: "solo",
  feetTagId: "feet",
  orgasmTagId: "orgasm",
  facialTagId: "facial",
  goatTagId: "goat",
};

const oralActivity = marker(
  "oral-activity",
  0,
  100,
  oral,
  [],
  [topA],
  [bottomB]
);
const feetActivity = marker("feet-activity", 10, 80, feet, [], [topA]);
const sharedHighlight = marker("highlight", 20, 40, orgasm, [goat], [topA]);
const unmatchedHighlight = marker("unmatched", 120, 140, orgasm);
const allMarkers = [
  oralActivity,
  feetActivity,
  sharedHighlight,
  unmatchedHighlight,
];
const highlightGroups = groupChronologicalSceneMarkerHighlights(
  [sharedHighlight, unmatchedHighlight],
  allMarkers
);

const layout = buildChronologicalSceneMarkerLayout({
  allActivityMarkers: [oralActivity, feetActivity],
  visibleActivityMarkers: [feetActivity],
  highlightGroups,
  allMarkers,
  roleTagIds,
});

assert.deepEqual(
  layout.groups.map((group) => [
    group.key,
    group.markers.map((m) => m.id),
    group.highlightGroups.flatMap((highlightGroup) =>
      highlightGroup.markers.map((m) => m.id)
    ),
  ]),
  [
    ["oral|top-a|bottom-b", [], ["highlight"]],
    ["feet|top-a|", ["feet-activity"], ["highlight"]],
  ],
  "a highlight contained by multiple activity contexts is duplicated into every matching group, while filtered-out activity pills stay hidden"
);

assert.deepEqual(
  layout.fallbackHighlightGroups.flatMap((group) =>
    group.markers.map((m) => m.id)
  ),
  ["unmatched"],
  "unmatched highlights remain visible in the fallback bucket"
);

assert.equal(
  isChronologicalSceneMarkerGoatTagged(sharedHighlight, roleTagIds.goatTagId),
  true,
  "GOAT-tagged highlights are detected for Royal Sapphire styling"
);

assert.equal(
  isChronologicalSceneMarkerGoatTagged(
    marker("plain", 0, 10, orgasm),
    roleTagIds.goatTagId
  ),
  false,
  "non-GOAT highlights do not get Royal Sapphire styling"
);
