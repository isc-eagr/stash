import assert from "node:assert/strict";

import { getSceneMarkerTimelineHoverPerformers } from "../src/components/ScenePlayer/sceneMarkerTimelineHover_custom.ts";

const tag = (id: string, name: string) => ({ id, name, parents: [] });
const performer = (id: string, name: string) => ({
  id,
  name,
  image_path: `/${id}.jpg`,
});
const marker = (
  id: string,
  seconds: number,
  endSeconds: number,
  primaryTag: ReturnType<typeof tag>,
  topPerformers: Array<ReturnType<typeof performer>> = [],
  bottomPerformers: Array<ReturnType<typeof performer>> = []
) => ({
  id,
  seconds,
  end_seconds: endSeconds,
  primary_tag: primaryTag,
  tags: [],
  top_performers: topPerformers,
  bottom_performers: bottomPerformers,
});

const sex = tag("sex", "Sex");
const outstanding = tag("outstanding", "Outstanding");
const oral = tag("oral", "Oral");
const alex = performer("alex", "Alex");
const ben = performer("ben", "Ben");

const activityMarker = marker("activity", 0, 60, sex, [ben], [alex]);
const outstandingMarker = marker("outstanding", 20, 30, outstanding, [alex]);
const allMarkers = [activityMarker, outstandingMarker];

const outstandingHover = getSceneMarkerTimelineHoverPerformers(
  outstandingMarker,
  allMarkers
);

const alexHoverCards = outstandingHover?.filter(
  ({ performer: hoverPerformer }) => hoverPerformer.id === alex.id
);

assert.equal(
  alexHoverCards?.length,
  1,
  "mixed-role overlaps produce one timeline hover card per performer"
);
assert.deepEqual(
  alexHoverCards?.map(({ topTags, bottomTags }) => ({
    topTags: topTags.map((itemTag) => itemTag.id),
    bottomTags: bottomTags.map((itemTag) => itemTag.id),
  })),
  [{ topTags: [outstanding.id], bottomTags: [sex.id] }],
  "one timeline hover card carries both top and bottom overlap tags"
);

const dualRoleActivityMarker = marker(
  "dual-role-activity",
  70,
  90,
  sex,
  [alex],
  [alex]
);
const activityHover = getSceneMarkerTimelineHoverPerformers(
  dualRoleActivityMarker,
  [dualRoleActivityMarker]
);

assert.equal(
  activityHover.length,
  1,
  "dual-role activity markers produce one timeline hover card per performer"
);
assert.deepEqual(
  activityHover.map(({ topTags, bottomTags }) => ({
    topTags: topTags.map((itemTag) => itemTag.id),
    bottomTags: bottomTags.map((itemTag) => itemTag.id),
  })),
  [{ topTags: [sex.id], bottomTags: [sex.id] }],
  "one activity hover card carries both direct role colors without overlap context"
);

const containingSexMarker = marker(
  "containing-sex",
  100,
  200,
  sex,
  [alex],
  [ben]
);
const containedOralMarker = marker(
  "contained-oral",
  130,
  150,
  oral,
  [ben],
  [alex]
);
const overlappingActivityMarkers = [containingSexMarker, containedOralMarker];
const oralHover = getSceneMarkerTimelineHoverPerformers(
  containedOralMarker,
  overlappingActivityMarkers
);

assert.deepEqual(
  oralHover.map(({ performer: hoverPerformer, topTags, bottomTags }) => ({
    performer: hoverPerformer.id,
    topTags: topTags.map((itemTag) => itemTag.id),
    bottomTags: bottomTags.map((itemTag) => itemTag.id),
  })),
  [
    { performer: ben.id, topTags: [oral.id], bottomTags: [sex.id] },
    { performer: alex.id, topTags: [sex.id], bottomTags: [oral.id] },
  ],
  "a contained activity marker inherits the containing activity marker tags and roles"
);

const sexHover = getSceneMarkerTimelineHoverPerformers(
  containingSexMarker,
  overlappingActivityMarkers
);

assert.deepEqual(
  sexHover.map(({ performer: hoverPerformer, topTags, bottomTags }) => ({
    performer: hoverPerformer.id,
    topTags: topTags.map((itemTag) => itemTag.id),
    bottomTags: bottomTags.map((itemTag) => itemTag.id),
  })),
  [
    { performer: alex.id, topTags: [sex.id], bottomTags: [] },
    { performer: ben.id, topTags: [], bottomTags: [sex.id] },
  ],
  "a containing activity marker does not inherit tags from a smaller contained marker"
);
