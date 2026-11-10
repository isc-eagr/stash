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
const facial = tag("facial", "Facial");
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
  [feetActivity, sharedHighlight, unmatchedHighlight],
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
  [["oral|top-a|bottom-b", [], ["feet-activity", "highlight"]]],
  "Feet highlights join their overlapping activity group instead of creating a Feet section"
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

const directFeetHighlight = marker(
  "direct-feet-highlight",
  20,
  40,
  feet,
  [goat],
  [topA]
);
const directOrgasmHighlight = marker(
  "direct-orgasm-highlight",
  20,
  40,
  orgasm,
  [goat],
  [topA]
);
const directFacialHighlight = marker(
  "direct-facial-highlight",
  20,
  40,
  facial,
  [goat],
  [topA]
);
const overlapOnlyHighlight = marker(
  "overlap-only-highlight",
  20,
  40,
  oral,
  [goat],
  [topA]
);
const orgasmActivity = marker("orgasm-activity", 10, 80, orgasm, [], [topA]);
const facialActivity = marker("facial-activity", 10, 80, facial, [], [topA]);
const specialSectionLayout = buildChronologicalSceneMarkerLayout({
  allActivityMarkers: [feetActivity, orgasmActivity, facialActivity],
  visibleActivityMarkers: [feetActivity, orgasmActivity, facialActivity],
  highlightGroups: groupChronologicalSceneMarkerHighlights(
    [
      directFeetHighlight,
      directOrgasmHighlight,
      directFacialHighlight,
      overlapOnlyHighlight,
    ],
    [
      feetActivity,
      orgasmActivity,
      facialActivity,
      directFeetHighlight,
      directOrgasmHighlight,
      directFacialHighlight,
      overlapOnlyHighlight,
    ]
  ),
  allMarkers: [
    feetActivity,
    orgasmActivity,
    facialActivity,
    directFeetHighlight,
    directOrgasmHighlight,
    directFacialHighlight,
    overlapOnlyHighlight,
  ],
  roleTagIds,
});

assert.deepEqual(
  specialSectionLayout.groups.map((group) => [
    group.primaryTag.id,
    group.highlightGroups.flatMap((highlightGroup) =>
      highlightGroup.markers.map((marker) => marker.id)
    ),
  ]),
  [
    ["orgasm", ["direct-orgasm-highlight"]],
    ["facial", ["direct-facial-highlight"]],
  ],
  "Orgasm and Facial sections exclude highlights that inherit their tag only through overlap"
);

assert.deepEqual(
  specialSectionLayout.fallbackHighlightGroups.flatMap((highlightGroup) =>
    highlightGroup.markers.map((marker) => marker.id)
  ),
  ["direct-feet-highlight", "overlap-only-highlight"],
  "Feet and other non-matching highlights remain editable in Other Highlights"
);
