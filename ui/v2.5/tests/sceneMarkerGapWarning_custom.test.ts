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
  "sex/oral/solo markers and their descendants do not count as relevant coverage"
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
  "draft sex/oral/solo markers do not count as relevant coverage"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: baseDraft,
    sceneMarkers: [],
    negativeMarkers: [
      {
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
