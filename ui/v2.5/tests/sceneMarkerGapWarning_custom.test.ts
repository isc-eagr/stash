import assert from "node:assert/strict";

import {
  findSceneMarkerGapWarningDetails,
  findSceneMarkerGapWarnings,
  findSceneMarkerWarnings,
  prepareSceneMarkerWarnings,
  sceneMarkerWarningDraft,
} from "../src/components/Scenes/SceneDetails/sceneMarkerGapWarning_custom.ts";

const roleTagIds = {
  sexTagId: "sex",
  oralTagId: "oral",
  soloTagId: "solo",
};
const roleTagIdsWithFacial = { ...roleTagIds, facialTagId: "facial" };

// CUSTOM: begin – prepared warning calculation performance regression coverage
const preparedSceneMarkers = Array.from({ length: 40 }, (_, index) => ({
  id: `prepared-${index}`,
  seconds: index * 10,
  end_seconds: index * 10 + 9,
  primary_tag: { id: index % 2 === 0 ? "sex" : "highlight" },
  tags: [],
  top_performers: [{ id: "top" }],
  bottom_performers: [{ id: "bottom" }],
}));
const preparedNegativeMarkers = [
  { id: "prepared-negative", start_seconds: 95, end_seconds: 96 },
];
let preparedSourceReads = 0;
const observedPreparedSceneMarkers = preparedSceneMarkers.map(
  (marker) =>
    new Proxy(marker, {
      get(target, property, receiver) {
        preparedSourceReads += 1;
        return Reflect.get(target, property, receiver);
      },
    })
);
const preparedCalculator = prepareSceneMarkerWarnings({
  sceneMarkers: observedPreparedSceneMarkers,
  negativeMarkers: preparedNegativeMarkers,
  roleTagIds,
});
const sourceReadsAfterPreparation = preparedSourceReads;

preparedSceneMarkers.forEach((marker) => {
  const draft = sceneMarkerWarningDraft(marker);
  assert.deepEqual(
    preparedCalculator.findWarnings(draft),
    findSceneMarkerWarnings({
      draft,
      sceneMarkers: preparedSceneMarkers,
      negativeMarkers: preparedNegativeMarkers,
      roleTagIds,
    }),
    `prepared warnings match the standalone API for ${marker.id}`
  );
});

assert.equal(
  preparedSourceReads,
  sourceReadsAfterPreparation,
  "prepared warning lookups reuse indexed ranges without rereading source markers"
);
// CUSTOM: end

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

assert.deepEqual(
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

assert.deepEqual(
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
  })?.next,
  {
    issueType: "gap",
    issueSeconds: 1,
    markerBoundarySeconds: 121,
    closeToSeconds: 120.999,
    adjacentMarkerType: "marker",
  },
  "markers warn across activity and highlight types"
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
        primary_tag: { id: "facial" },
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
    adjacentMarkerType: "marker",
  },
  "activity markers warn against highlight markers"
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

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      seconds: 502,
      end_seconds: 510,
    },
    sceneMarkers: [
      {
        id: "highlight-before-negative",
        seconds: 490,
        end_seconds: 501.671,
        primary_tag: { id: "body", name: "Body" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.previous,
  {
    issueType: "gap",
    issueSeconds: 0.329,
    markerBoundarySeconds: 501.671,
    closeToSeconds: 501.672,
    adjacentMarkerType: "Body",
  },
  "negative markers warn about sub-second gaps after highlight markers"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      seconds: 502,
      end_seconds: 506,
    },
    sceneMarkers: [
      {
        id: "solo-containing-negative",
        seconds: 480,
        end_seconds: 540,
        primary_tag: { id: "solo", name: "Solo" },
        tags: [],
      },
      {
        id: "highlight-before-contained-negative",
        seconds: 490,
        end_seconds: 501.671,
        primary_tag: { id: "body", name: "Body" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.previous,
  {
    issueType: "gap",
    issueSeconds: 0.329,
    markerBoundarySeconds: 501.671,
    closeToSeconds: 501.672,
    adjacentMarkerType: "Body",
  },
  "a covering marker does not suppress a previous-gap warning"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "body",
    },
    sceneMarkers: [
      {
        id: "next-highlight",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "face", name: "Face" },
        tags: [],
      },
      {
        id: "activity-covering-next-gap",
        seconds: 110,
        end_seconds: 125,
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
    adjacentMarkerType: "Face",
  },
  "a covering marker does not suppress a next-gap warning"
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

assert.deepEqual(
  findSceneMarkerWarnings({
    draft: {
      ...baseDraft,
      end_seconds: null,
      top_performer_ids: ["top-a"],
      bottom_performer_ids: ["bottom-a"],
    },
    sceneMarkers: [],
    negativeMarkers: [],
    roleTagIds: roleTagIdsWithFacial,
  }).map((warning) => warning.issueType),
  ["missing-end-time"],
  "markers without end times get a non-blocking warning"
);

assert.deepEqual(
  findSceneMarkerWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "body",
      primary_tag: { id: "body" },
      top_performer_ids: [],
      bottom_performer_ids: [],
    },
    sceneMarkers: [],
    negativeMarkers: [],
    roleTagIds: roleTagIdsWithFacial,
  }).map((warning) => warning.issueType),
  ["missing-performers"],
  "markers without any performers get a warning"
);

assert.deepEqual(
  findSceneMarkerWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "sex",
      top_performer_ids: ["top-a"],
      bottom_performer_ids: [],
    },
    sceneMarkers: [],
    negativeMarkers: [],
    roleTagIds: roleTagIdsWithFacial,
  }).map((warning) => warning.issueType),
  ["missing-role-performers"],
  "sex/oral/facial markers require both role performer lanes"
);

assert.equal(
  findSceneMarkerWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "sex",
      top_performer_ids: ["top-a"],
      bottom_performer_ids: ["bottom-a"],
    },
    sceneMarkers: [],
    negativeMarkers: [],
    roleTagIds,
  }).some((warning) => warning.issueType === "missing-role-performers"),
  false,
  "sex/oral/facial markers with both role lanes do not get the role warning"
);

assert.deepEqual(
  findSceneMarkerWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "facial",
      top_performer_ids: [],
      bottom_performer_ids: ["bottom-a"],
    },
    sceneMarkers: [],
    negativeMarkers: [],
    roleTagIds: roleTagIdsWithFacial,
  }).map((warning) => warning.issueType),
  ["missing-role-performers"],
  "facial markers also require both role performer lanes"
);

assert.deepEqual(
  findSceneMarkerWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "body",
      tag_ids: ["oral"],
      top_performer_ids: ["top-a"],
      bottom_performer_ids: ["bottom-a"],
    },
    sceneMarkers: [
      {
        id: "activity-next",
        seconds: 121,
        end_seconds: 130,
        primary_tag: { id: "oral", name: "Oral" },
        tags: [],
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })
    .filter((warning) => warning.issueType === "gap")
    .map((warning) => warning.boundary),
  ["next"],
  "highlight markers with activity context tags warn across marker types"
);

const nextSceneWarning = findSceneMarkerWarnings({
  draft: {
    ...baseDraft,
    primary_tag_id: "sex",
    top_performer_ids: ["top-a"],
    bottom_performer_ids: ["bottom-a"],
  },
  sceneMarkers: [
    {
      id: "next-scene-marker",
      seconds: 121,
      end_seconds: 130,
      primary_tag: { id: "oral", name: "Oral" },
      tags: [],
    },
  ],
  negativeMarkers: [],
  roleTagIds,
}).find((warning) => warning.boundary === "next");

assert.equal(
  nextSceneWarning?.message,
  "Next gap of 1s with Oral",
  "gap warning messages are concise"
);
assert.deepEqual(
  nextSceneWarning?.gapWarning && {
    adjacentMarkerId: nextSceneWarning.gapWarning.adjacentMarkerId,
    adjacentMarkerKind: nextSceneWarning.gapWarning.adjacentMarkerKind,
    otherCloseToSeconds: nextSceneWarning.gapWarning.otherCloseToSeconds,
  },
  {
    adjacentMarkerId: "next-scene-marker",
    adjacentMarkerKind: "scene-marker",
    otherCloseToSeconds: 120.001,
  },
  "broader marker warnings include metadata for fixing the other scene marker"
);

// CUSTOM: a short gap must be reported even when its two markers use
// different primary-tag classifications (scene 353 regression).
assert.equal(
  findSceneMarkerGapWarnings({
    draft: {
      id: "orgasm",
      seconds: 1452,
      end_seconds: 1453,
      primary_tag_id: "orgasm",
      primary_tag: { id: "orgasm", name: "Orgasm" },
    },
    sceneMarkers: [
      {
        id: "pito-body",
        seconds: 1400,
        end_seconds: 1451.781,
        primary_tag: { id: "pito", name: "Pito" },
      },
    ],
    negativeMarkers: [],
    roleTagIds,
  })?.previous?.issueSeconds,
  0.219,
  "Pito/Body-to-Orgasm gaps are warned across marker types"
);

assert.deepEqual(
  findSceneMarkerGapWarnings({
    draft: {
      ...baseDraft,
      primary_tag_id: "sex",
    },
    sceneMarkers: [
      {
        id: "next-scene-marker",
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
  "public gap warning shape stays stable"
);

const previousNegativeWarning = findSceneMarkerWarnings({
  draft: {
    ...baseDraft,
    primary_tag_id: "body",
    primary_tag: { id: "body" },
    top_performer_ids: ["top-a"],
    bottom_performer_ids: ["bottom-a"],
  },
  sceneMarkers: [],
  negativeMarkers: [
    {
      id: "previous-negative",
      name: "fingering",
      start_seconds: 40,
      end_seconds: 59.7,
    },
  ],
  roleTagIds,
}).find((warning) => warning.boundary === "previous");

assert.deepEqual(
  previousNegativeWarning?.gapWarning && {
    adjacentMarkerId: previousNegativeWarning.gapWarning.adjacentMarkerId,
    adjacentMarkerKind: previousNegativeWarning.gapWarning.adjacentMarkerKind,
    otherCloseToSeconds: previousNegativeWarning.gapWarning.otherCloseToSeconds,
  },
  {
    adjacentMarkerId: "previous-negative",
    adjacentMarkerKind: "negative-marker",
    otherCloseToSeconds: 59.999,
  },
  "broader marker warnings include metadata for fixing the other negative marker"
);

const negativeMarkerAdjacentActions = findSceneMarkerGapWarningDetails({
  draft: {
    id: "negative-draft",
    seconds: 60,
    end_seconds: 120,
  },
  sceneMarkers: [
    {
      id: "previous-scene-marker",
      seconds: 40,
      end_seconds: 59,
      primary_tag: { id: "oral", name: "Oral" },
      tags: [],
    },
  ],
  negativeMarkers: [
    {
      id: "next-negative-marker",
      name: "Skip",
      start_seconds: 121,
      end_seconds: 130,
    },
  ],
  roleTagIds,
});

assert.deepEqual(
  negativeMarkerAdjacentActions && {
    previous: {
      adjacentMarkerId:
        negativeMarkerAdjacentActions.previous?.adjacentMarkerId,
      adjacentMarkerKind:
        negativeMarkerAdjacentActions.previous?.adjacentMarkerKind,
      otherCloseToSeconds:
        negativeMarkerAdjacentActions.previous?.otherCloseToSeconds,
    },
    next: {
      adjacentMarkerId: negativeMarkerAdjacentActions.next?.adjacentMarkerId,
      adjacentMarkerKind:
        negativeMarkerAdjacentActions.next?.adjacentMarkerKind,
      otherCloseToSeconds:
        negativeMarkerAdjacentActions.next?.otherCloseToSeconds,
    },
  },
  {
    previous: {
      adjacentMarkerId: "previous-scene-marker",
      adjacentMarkerKind: "scene-marker",
      otherCloseToSeconds: 59.999,
    },
    next: {
      adjacentMarkerId: "next-negative-marker",
      adjacentMarkerKind: "negative-marker",
      otherCloseToSeconds: 120.001,
    },
  },
  "negative marker warnings expose both adjacent-marker update actions"
);

const bothAdjacentWarnings = findSceneMarkerWarnings({
  draft: {
    ...baseDraft,
    primary_tag_id: "sex",
    top_performer_ids: ["top-a"],
    bottom_performer_ids: ["bottom-a"],
  },
  sceneMarkers: [
    {
      id: "previous-scene-marker",
      seconds: 40,
      end_seconds: 59,
      primary_tag: { id: "oral", name: "Oral" },
      tags: [],
    },
    {
      id: "next-scene-marker",
      seconds: 121,
      end_seconds: 130,
      primary_tag: { id: "oral", name: "Oral" },
      tags: [],
    },
  ],
  negativeMarkers: [],
  roleTagIds,
}).filter((warning) => warning.gapWarning);

assert.deepEqual(
  bothAdjacentWarnings.map((warning) => ({
    boundary: warning.boundary,
    adjacentMarkerId: warning.gapWarning?.adjacentMarkerId,
    otherCloseToSeconds: warning.gapWarning?.otherCloseToSeconds,
  })),
  [
    {
      boundary: "previous",
      adjacentMarkerId: "previous-scene-marker",
      otherCloseToSeconds: 59.999,
    },
    {
      boundary: "next",
      adjacentMarkerId: "next-scene-marker",
      otherCloseToSeconds: 120.001,
    },
  ],
  "warnings expose both adjacent marker fixes for the batch other-marker action"
);

assert.deepEqual(
  sceneMarkerWarningDraft({
    id: "marker-with-performers",
    seconds: 1,
    end_seconds: 2,
    primary_tag: { id: "sex" },
    tags: [{ id: "tag-a" }],
    top_performers: [{ id: "top-a" }],
    bottom_performers: [{ id: "bottom-a" }],
  }),
  {
    id: "marker-with-performers",
    seconds: 1,
    end_seconds: 2,
    primary_tag_id: "sex",
    tag_ids: ["tag-a"],
    primary_tag: { id: "sex" },
    tags: [{ id: "tag-a" }],
    top_performer_ids: ["top-a"],
    bottom_performer_ids: ["bottom-a"],
  },
  "scene marker warning drafts preserve performer lanes"
);
