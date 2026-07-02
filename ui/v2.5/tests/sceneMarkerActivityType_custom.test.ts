import assert from "node:assert/strict";

import {
  compareActivityTypeSceneMarkers,
  getActivityTypeSectionMarkerTag,
  getActivityTypeSectionMarkerTagId,
  getActivityTypeSectionTagIds,
  getActivityTypeTagIds,
  groupActivityTypeSceneMarkers,
  isActivityTypeSectionSceneMarker,
  isActivityTypeSceneMarker,
} from "../src/components/Scenes/SceneDetails/sceneMarkerActivityType_custom.ts";

const tag = (
  id: string,
  name: string,
  parents: Array<{ id: string; name: string }> = []
) => ({ id, name, parents });
const performer = (id: string, name: string) => ({ id, name });

const roleTagIds = {
  sexTagId: "sex",
  oralTagId: "oral",
  soloTagId: "solo",
  feetTagId: "feet",
  orgasmTagId: "orgasm",
  facialTagId: "facial",
};

const marker = (
  primaryTag: ReturnType<typeof tag>,
  secondaryTags: Array<ReturnType<typeof tag>> = [],
  seconds = 0,
  id = primaryTag.id,
  topPerformers: Array<ReturnType<typeof performer>> = [],
  bottomPerformers: Array<ReturnType<typeof performer>> = []
) => ({
  id,
  seconds,
  end_seconds: null,
  primary_tag: primaryTag,
  tags: secondaryTags,
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});

const activityTypeTagIds = getActivityTypeTagIds({
  sexTagId: "sex",
  oralTagId: "oral",
  soloTagId: "solo",
});
const activityTypeSectionTagIds = getActivityTypeSectionTagIds(roleTagIds);

assert.equal(
  isActivityTypeSceneMarker(marker(tag("sex", "Sex")), activityTypeTagIds),
  true,
  "a configured sex primary marker with no secondary tags is an activity type marker"
);

assert.equal(
  isActivityTypeSceneMarker(
    marker(tag("sex", "Sex"), [tag("highlight", "Highlight")]),
    activityTypeTagIds
  ),
  false,
  "a configured activity primary marker with any secondary tag is a highlight marker"
);

assert.equal(
  isActivityTypeSceneMarker(
    marker(tag("facial", "Facial")),
    activityTypeTagIds
  ),
  false,
  "markers outside sex, oral, and solo are highlight markers"
);

assert.deepEqual(
  [
    marker(tag("sex", "Sex"), [], 1, "sex"),
    marker(tag("feet", "Feet"), [tag("closeup", "Closeup")], 2, "feet"),
    marker(tag("orgasm", "Orgasm"), [], 3, "orgasm"),
    marker(tag("facial", "Facial"), [], 4, "facial"),
    marker(tag("other", "Other"), [], 5, "other"),
  ]
    .filter((m) =>
      isActivityTypeSectionSceneMarker(m, activityTypeSectionTagIds)
    )
    .map((m) => m.id),
  ["sex", "feet", "orgasm", "facial"],
  "activity tab section markers include configured feet, orgasm, and facial primary tags"
);

assert.deepEqual(
  [
    marker(tag("orgasm", "Orgasm"), [], 1, "standard-orgasm"),
    marker(
      tag("orgasm", "Orgasm"),
      [tag("facial", "Facial")],
      2,
      "direct-facial-orgasm"
    ),
    marker(
      tag("orgasm", "Orgasm"),
      [tag("hot-facial", "Hot Facial", [tag("facial", "Facial")])],
      3,
      "child-facial-orgasm"
    ),
  ].map((m) => getActivityTypeSectionMarkerTagId(m, roleTagIds)),
  ["orgasm", "facial", "facial"],
  "facial-tagged orgasm markers are assigned to facial instead of standard orgasm"
);

assert.deepEqual(
  getActivityTypeSectionMarkerTag(
    marker(
      tag("orgasm", "Orgasm"),
      [tag("hot-facial", "Hot Facial", [tag("facial", "Facial")])],
      1,
      "child-facial-orgasm"
    ),
    roleTagIds
  )?.name,
  "Facial",
  "facial-priority orgasm markers display the facial section label"
);

assert.deepEqual(
  [
    marker(tag("solo", "Solo"), [], 1, "solo-early"),
    marker(tag("sex", "Sex"), [], 2, "sex-late"),
    marker(tag("oral", "Oral"), [], 3, "oral-late"),
    marker(tag("oral", "Oral"), [], 1, "oral-early"),
    marker(tag("sex", "Sex"), [], 1, "sex-early"),
    marker(tag("feet", "Feet"), [], 1, "feet-early"),
    marker(tag("orgasm", "Orgasm"), [], 1, "orgasm-early"),
    marker(tag("facial", "Facial"), [], 1, "facial-early"),
  ]
    .sort((a, b) =>
      compareActivityTypeSceneMarkers(a, b, {
        ...roleTagIds,
      })
    )
    .map((m) => m.id),
  [
    "oral-early",
    "oral-late",
    "sex-early",
    "sex-late",
    "solo-early",
    "feet-early",
    "orgasm-early",
    "facial-early",
  ],
  "activity tab section markers are grouped oral, sex, solo, feet, orgasm, facial and chronological within each group"
);

assert.deepEqual(
  groupActivityTypeSceneMarkers([
    marker(tag("oral", "Oral"), [], 20, "oral-late", [performer("a", "A")]),
    marker(tag("oral", "Oral"), [], 10, "oral-early", [performer("a", "A")]),
    marker(tag("oral", "Oral"), [], 30, "oral-other-top", [
      performer("b", "B"),
    ]),
  ]).map((group) => group.markers.map((m) => m.id)),
  [["oral-early", "oral-late"], ["oral-other-top"]],
  "activity type marker groups combine matching activity, top, and bottom configuration"
);
