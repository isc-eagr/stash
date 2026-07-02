import assert from "node:assert/strict";

import {
  compareActivityTypeSceneMarkers,
  getActivityTypeTagIds,
  groupActivityTypeSceneMarkers,
  isActivityTypeSceneMarker,
} from "../src/components/Scenes/SceneDetails/sceneMarkerActivityType_custom.ts";

const tag = (id: string, name: string) => ({ id, name });
const performer = (id: string, name: string) => ({ id, name });

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
    marker(tag("solo", "Solo"), [], 1, "solo-early"),
    marker(tag("sex", "Sex"), [], 2, "sex-late"),
    marker(tag("oral", "Oral"), [], 3, "oral-late"),
    marker(tag("oral", "Oral"), [], 1, "oral-early"),
    marker(tag("sex", "Sex"), [], 1, "sex-early"),
  ]
    .sort((a, b) =>
      compareActivityTypeSceneMarkers(a, b, {
        sexTagId: "sex",
        oralTagId: "oral",
        soloTagId: "solo",
      })
    )
    .map((m) => m.id),
  ["oral-early", "oral-late", "sex-early", "sex-late", "solo-early"],
  "activity type markers are grouped oral, sex, solo and chronological within each group"
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
