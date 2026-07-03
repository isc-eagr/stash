import assert from "node:assert/strict";

import { findSceneMarkerGapWarnings } from "../src/components/Scenes/SceneDetails/sceneMarkerGapWarning_custom.ts";

const roleTagIds = {
  sexTagId: "sex",
  oralTagId: "oral",
  soloTagId: "solo",
};

const baseDraft = {
  seconds: 60,
  end_seconds: 120,
  primary_tag_id: "facial",
  tag_ids: [],
};

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: baseDraft,
    sceneMarkers: [
      {
        id: "next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "facial", name: "Facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "Facial",
  }
);

assert.equal(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      end_seconds: 120.999,
    },
    sceneMarkers: [
      {
        id: "next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  }),
  undefined,
  "one-millisecond next gaps are treated as already closed"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: baseDraft,
    sceneMarkers: [
      {
        id: "previous",
        seconds: 40,
        end_seconds: 59,
        primary_tag: { id: "facial", name: "Facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.previous,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 59,
    closeToSeconds: 59.001,
    adjacentMarkerType: "Facial",
  }
);

assert.equal(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      seconds: 59.001,
    },
    sceneMarkers: [
      {
        id: "previous",
        seconds: 40,
        end_seconds: 59,
        primary_tag: { id: "facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  }),
  undefined,
  "one-millisecond previous gaps are treated as already closed"
);

assert.equal(
  findSceneMarkerGapWarnings({
    draft: baseDraft,
    sceneMarkers: [
      {
        id: "ignored-sex-child",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "sex-child", parents: [{ id: "sex" }] },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  }),
  undefined,
  "highlight markers do not warn against activity markers"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "oral",
    },
    sceneMarkers: [
      {
        id: "next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "oral", name: "Oral" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "Oral",
  },
  "activity markers warn against other activity markers"
);

assert.equal(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "oral",
    },
    sceneMarkers: [
      {
        id: "next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  }),
  undefined,
  "activity markers do not warn against highlight markers"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      primary_tag: { id: "oral-child", parents: [{ id: "oral" }] },
    },
    sceneMarkers: [
      {
        id: "next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: {
          id: "sex-child",
          name: "Sex child",
          parents: [{ id: "sex" }],
        },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "Sex child",
  },
  "activity marker descendants warn against other activity marker descendants"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: baseDraft,
    sceneMarkers: [],
    negativeMarkers: [
      {
        id: "negative-next",
        name: "Skip",
        start_seconds: 121,
        end_seconds: 130,
      },
    ],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "Negative marker: Skip",
  },
  "negative markers count as relevant coverage"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "sex",
    },
    sceneMarkers: [],
    negativeMarkers: [
      {
        id: "negative-next",
        name: "Skip",
        start_seconds: 121,
        end_seconds: 130,
      },
    ],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "Negative marker: Skip",
  },
  "activity markers warn against negative markers"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      seconds: 60,
      end_seconds: 120,
    },
    sceneMarkers: [
      {
        id: "activity-next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "sex", name: "Sex" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "Sex",
  },
  "negative markers warn against activity markers"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      seconds: 60,
      end_seconds: 120,
    },
    sceneMarkers: [
      {
        id: "highlight-next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "facial", name: "Facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "Facial",
  },
  "negative markers still warn against highlight markers"
);

assert.equal(
  findSceneMarkerGapWarnings({
    draft: {
      id: "current-negative",
      seconds: 60,
      end_seconds: 120,
    },
    sceneMarkers: [],
    negativeMarkers: [
      {
        id: "current-negative",
        name: "Skip",
        start_seconds: 60,
        end_seconds: 120,
      },
    ],
    roleTagIds,
  }),
  undefined,
  "editing a negative marker does not warn against itself"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: baseDraft,
    sceneMarkers: [
      {
        id: "next",
        seconds: 123,
        end_seconds: 130,
        primary_tag: { id: "facial", name: "Facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 3,
    markerBoundarySeconds: 123,
    closeToSeconds: 122.999,
    adjacentMarkerType: "Facial",
  },
  "three-second gaps are warned"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      seconds: 58,
    },
    sceneMarkers: [
      {
        id: "previous",
        seconds: 40,
        end_seconds: 60,
        primary_tag: { id: "facial", name: "Facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.previous,
  {
    issueType: "overlap",
    issueSeconds: 2,
    markerBoundarySeconds: 60,
    closeToSeconds: 60.001,
    adjacentMarkerType: "Facial",
  },
  "small previous overlaps are warned"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      end_seconds: 123,
    },
    sceneMarkers: [
      {
        id: "next",
        seconds: 120,
        end_seconds: 130,
        primary_tag: { id: "facial", name: "Facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.next,
  {
    issueType: "overlap",
    issueSeconds: 3,
    markerBoundarySeconds: 120,
    closeToSeconds: 119.999,
    adjacentMarkerType: "Facial",
  },
  "three-second next overlaps are warned"
);

assert.equal(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      end_seconds: 123.001,
    },
    sceneMarkers: [
      {
        id: "next",
        seconds: 120,
        end_seconds: 130,
        primary_tag: { id: "facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  }),
  undefined,
  "overlaps larger than three seconds are ignored"
);

assert.equal(
  findSceneMarkerGapWarnings({
    draft: baseDraft,
    sceneMarkers: [
      {
        id: "next",
        seconds: 123.001,
        end_seconds: 130,
        primary_tag: { id: "facial" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  }),
  undefined,
  "gaps larger than three seconds are ignored"
);
