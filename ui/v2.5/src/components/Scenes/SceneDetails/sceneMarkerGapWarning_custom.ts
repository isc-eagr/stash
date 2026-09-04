export type SceneMarkerGapTag = {
  id: string;
  name?: string;
  parents?: Array<{ id: string }>;
};

export type SceneMarkerGapRoleTagIds = {
  sexTagId?: string;
  oralTagId?: string;
  soloTagId?: string;
  feetTagId?: string;
  orgasmTagId?: string;
  facialTagId?: string;
};

export type SceneMarkerGapSceneMarker = {
  id: string;
  title?: string;
  seconds: number;
  end_seconds?: number | null;
  primary_tag?: SceneMarkerGapTag | null;
  tags?: SceneMarkerGapTag[] | null;
  top_performers?: Array<{ id: string }> | null;
  bottom_performers?: Array<{ id: string }> | null;
};

export type SceneMarkerGapNegativeMarker = {
  id?: string;
  name?: string;
  start_seconds: number;
  end_seconds: number;
};

export type SceneMarkerGapDraft = {
  id?: string;
  seconds: number;
  end_seconds?: number | null;
  primary_tag_id?: string;
  tag_ids?: string[];
  primary_tag?: SceneMarkerGapTag | null;
  tags?: SceneMarkerGapTag[] | null;
  top_performer_ids?: string[];
  bottom_performer_ids?: string[];
};

export type SceneMarkerGapWarning = {
  issueType: "gap" | "overlap";
  issueSeconds: number;
  markerBoundarySeconds: number;
  closeToSeconds: number;
  adjacentMarkerType: string;
};

export type SceneMarkerGapWarningDetail = SceneMarkerGapWarning & {
  adjacentMarkerId?: string;
  adjacentMarkerKind: "scene-marker" | "negative-marker";
  otherCloseToSeconds: number;
};

export type SceneMarkerGapWarnings = {
  previous?: SceneMarkerGapWarning;
  next?: SceneMarkerGapWarning;
};

export type SceneMarkerWarningIssueType =
  | "missing-end-time"
  | "missing-performers"
  | "missing-role-performers"
  | SceneMarkerGapWarning["issueType"];

export type SceneMarkerWarning = {
  issueType: SceneMarkerWarningIssueType;
  message: string;
  boundary?: "previous" | "next";
  gapWarning?: SceneMarkerGapWarningDetail;
};

type SceneMarkerGapRange = {
  markerId?: string;
  markerKind: "scene-marker" | "negative-marker";
  start: number;
  end: number;
  markerType: string;
  sourceOrder: number;
};

type SceneMarkerGapMarkerKind = "activity" | "highlight" | "negative";

const maxGapSeconds = 3;
const defaultMarkerDurationSeconds = 20;
const markerGapCloseOffsetSeconds = 0.001;

function roundToMilliseconds(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

function tagMatches(tag: SceneMarkerGapTag | null | undefined, tagId: string) {
  return (
    tag?.id === tagId || tag?.parents?.some((parent) => parent.id === tagId)
  );
}

function markerHasActivityTag(
  marker: SceneMarkerGapSceneMarker,
  activityTagIds: string[]
) {
  return activityTagIds.some((tagId) => tagMatches(marker.primary_tag, tagId));
}

function draftHasActivityTag(
  draft: SceneMarkerGapDraft,
  activityTagIds: string[]
) {
  return (
    activityTagIds.some((tagId) => draft.primary_tag_id === tagId) ||
    activityTagIds.some((tagId) => tagMatches(draft.primary_tag, tagId))
  );
}

function draftHasSceneMarkerTagFields(draft: SceneMarkerGapDraft) {
  return (
    draft.primary_tag_id !== undefined ||
    draft.tag_ids !== undefined ||
    draft.primary_tag !== undefined ||
    draft.tags !== undefined
  );
}

function draftMarkerKind(
  draft: SceneMarkerGapDraft,
  activityTagIds: string[]
): SceneMarkerGapMarkerKind {
  if (!draftHasSceneMarkerTagFields(draft)) return "negative";

  return draftHasActivityTag(draft, activityTagIds) ? "activity" : "highlight";
}

function markerKind(
  marker: SceneMarkerGapSceneMarker,
  activityTagIds: string[]
): SceneMarkerGapMarkerKind {
  return markerHasActivityTag(marker, activityTagIds)
    ? "activity"
    : "highlight";
}

function isSmallGap(gapSeconds: number) {
  const roundedGapSeconds = roundToMilliseconds(gapSeconds);
  return (
    roundedGapSeconds > markerGapCloseOffsetSeconds &&
    roundedGapSeconds <= maxGapSeconds
  );
}

function isSmallOverlap(overlapSeconds: number) {
  const roundedOverlapSeconds = roundToMilliseconds(overlapSeconds);
  return (
    roundedOverlapSeconds > markerGapCloseOffsetSeconds &&
    roundedOverlapSeconds <= maxGapSeconds
  );
}

function markerType(marker: SceneMarkerGapSceneMarker) {
  return marker.primary_tag?.name || marker.title || "marker";
}

function negativeMarkerType(marker: SceneMarkerGapNegativeMarker) {
  return marker.name ? `Negative marker: ${marker.name}` : "Negative marker";
}

function activityTypeTagIds(roleTagIds: SceneMarkerGapRoleTagIds) {
  return [
    roleTagIds.sexTagId,
    roleTagIds.oralTagId,
    roleTagIds.soloTagId,
    roleTagIds.feetTagId,
    roleTagIds.orgasmTagId,
    roleTagIds.facialTagId,
  ].filter((tagId): tagId is string => !!tagId);
}

function roleRequiredTagIds(roleTagIds: SceneMarkerGapRoleTagIds) {
  return [
    roleTagIds.sexTagId,
    roleTagIds.oralTagId,
    roleTagIds.facialTagId,
  ].filter((tagId): tagId is string => !!tagId);
}

function draftHasConfiguredPrimaryTag(
  draft: SceneMarkerGapDraft,
  tagIds: string[]
) {
  return tagIds.some(
    (tagId) =>
      draft.primary_tag_id === tagId || tagMatches(draft.primary_tag, tagId)
  );
}

function draftPerformerCounts(draft: SceneMarkerGapDraft) {
  return {
    top: draft.top_performer_ids?.length ?? 0,
    bottom: draft.bottom_performer_ids?.length ?? 0,
  };
}

function formatIssueSeconds(seconds: number) {
  return seconds < 1 ? `${Math.round(seconds * 1000)}ms` : `${seconds}s`;
}

function gapWarningMessage(
  boundary: "previous" | "next",
  warning: SceneMarkerGapWarningDetail
) {
  const boundaryLabel = boundary === "previous" ? "Previous" : "Next";

  return `${boundaryLabel} ${warning.issueType} of ${formatIssueSeconds(
    warning.issueSeconds
  )} with ${warning.adjacentMarkerType}`;
}

function markerRange(
  marker: SceneMarkerGapSceneMarker,
  sourceOrder = 0
): SceneMarkerGapRange | undefined {
  const endSeconds =
    marker.end_seconds ?? marker.seconds + defaultMarkerDurationSeconds;
  if (!Number.isFinite(marker.seconds) || !Number.isFinite(endSeconds)) {
    return undefined;
  }

  if (endSeconds <= marker.seconds) return undefined;

  return {
    markerId: marker.id,
    markerKind: "scene-marker",
    start: marker.seconds,
    end: endSeconds,
    markerType: markerType(marker),
    sourceOrder,
  };
}

function negativeMarkerRange(
  marker: SceneMarkerGapNegativeMarker,
  sourceOrder = 0
): SceneMarkerGapRange | undefined {
  if (
    !Number.isFinite(marker.start_seconds) ||
    !Number.isFinite(marker.end_seconds)
  ) {
    return undefined;
  }

  if (marker.end_seconds <= marker.start_seconds) return undefined;

  return {
    markerId: marker.id,
    markerKind: "negative-marker",
    start: marker.start_seconds,
    end: marker.end_seconds,
    markerType: negativeMarkerType(marker),
    sourceOrder,
  };
}

type SceneMarkerGapRangeIndex = {
  byStart: SceneMarkerGapRange[];
  byEnd: SceneMarkerGapRange[];
  maxEndRangeByStartIndex: SceneMarkerGapRange[];
};

export type SceneMarkerWarningCalculator = {
  findGapWarningDetails: (draft: SceneMarkerGapDraft) =>
    | {
        previous?: SceneMarkerGapWarningDetail;
        next?: SceneMarkerGapWarningDetail;
      }
    | undefined;
  findGapWarnings: (
    draft: SceneMarkerGapDraft
  ) => SceneMarkerGapWarnings | undefined;
  findWarnings: (draft: SceneMarkerGapDraft) => SceneMarkerWarning[];
};

function createRangeIndex(
  ranges: SceneMarkerGapRange[]
): SceneMarkerGapRangeIndex {
  const byStart = [...ranges].sort(
    (a, b) => a.start - b.start || a.sourceOrder - b.sourceOrder
  );

  return {
    byStart,
    byEnd: [...ranges].sort(
      (a, b) => a.end - b.end || b.sourceOrder - a.sourceOrder
    ),
    maxEndRangeByStartIndex: byStart.reduce<SceneMarkerGapRange[]>(
      (maximums, range) => {
        const previousMaximum = maximums[maximums.length - 1];
        maximums.push(
          !previousMaximum || range.end > previousMaximum.end
            ? range
            : previousMaximum
        );
        return maximums;
      },
      []
    ),
  };
}

function firstIndexAfter(
  ranges: SceneMarkerGapRange[],
  value: number,
  select: (range: SceneMarkerGapRange) => number
) {
  let low = 0;
  let high = ranges.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (select(ranges[middle]) <= value) low = middle + 1;
    else high = middle;
  }

  return low;
}

function firstIndexAtLeast(
  ranges: SceneMarkerGapRange[],
  value: number,
  select: (range: SceneMarkerGapRange) => number
) {
  let low = 0;
  let high = ranges.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (select(ranges[middle]) < value) low = middle + 1;
    else high = middle;
  }

  return low;
}

function isGapCoveredByIndex(
  gapStartSeconds: number,
  gapEndSeconds: number,
  allRanges: SceneMarkerGapRangeIndex,
  excludedMarkerId?: string
) {
  const endIndex = firstIndexAfter(
    allRanges.byStart,
    gapStartSeconds,
    (range) => range.start
  );

  const maximumRange = allRanges.maxEndRangeByStartIndex[endIndex - 1];
  if (!maximumRange || maximumRange.end < gapEndSeconds) return false;
  if (maximumRange.markerId !== excludedMarkerId) return true;

  // ID spaces can overlap between regular and negative markers. The fallback
  // preserves the legacy behavior of excluding every range with the draft ID.
  return allRanges.byStart
    .slice(0, endIndex)
    .some(
      (range) =>
        range.markerId !== excludedMarkerId && range.end >= gapEndSeconds
    );
}

function stripGapWarningDetail(
  warning: SceneMarkerGapWarningDetail
): SceneMarkerGapWarning {
  return {
    issueType: warning.issueType,
    issueSeconds: warning.issueSeconds,
    markerBoundarySeconds: warning.markerBoundarySeconds,
    closeToSeconds: warning.closeToSeconds,
    adjacentMarkerType: warning.adjacentMarkerType,
  };
}

function findPreparedSceneMarkerGapWarningDetails(
  draft: SceneMarkerGapDraft,
  activityTagIds: string[],
  allRanges: SceneMarkerGapRangeIndex,
  activityRanges: SceneMarkerGapRangeIndex,
  highlightRanges: SceneMarkerGapRangeIndex
):
  | {
      previous?: SceneMarkerGapWarningDetail;
      next?: SceneMarkerGapWarningDetail;
    }
  | undefined {
  const draftEndSeconds = draft.end_seconds;
  if (
    !Number.isFinite(draft.seconds) ||
    draftEndSeconds === null ||
    draftEndSeconds === undefined ||
    !Number.isFinite(draftEndSeconds) ||
    draftEndSeconds < draft.seconds
  ) {
    return undefined;
  }

  const draftKind = draftMarkerKind(draft, activityTagIds);
  const ranges =
    draftKind === "negative"
      ? allRanges
      : draftKind === "activity"
      ? activityRanges
      : highlightRanges;
  let previousOverlapRange:
    | { range: SceneMarkerGapRange; overlapSeconds: number }
    | undefined;
  const previousOverlapStart = firstIndexAfter(
    ranges.byEnd,
    draft.seconds,
    (range) => range.end
  );
  for (
    let index = previousOverlapStart;
    index < ranges.byEnd.length;
    index += 1
  ) {
    const range = ranges.byEnd[index];
    if (range.markerId === draft.id || range.start >= draft.seconds) continue;

    const overlapSeconds = Math.min(range.end, draftEndSeconds) - draft.seconds;
    if (!isSmallOverlap(overlapSeconds)) {
      if (overlapSeconds > maxGapSeconds) break;
      continue;
    }
    if (
      !previousOverlapRange ||
      overlapSeconds < previousOverlapRange.overlapSeconds ||
      (overlapSeconds === previousOverlapRange.overlapSeconds &&
        range.sourceOrder < previousOverlapRange.range.sourceOrder)
    ) {
      previousOverlapRange = { range, overlapSeconds };
    }
  }

  let nextOverlapRange:
    | { range: SceneMarkerGapRange; overlapSeconds: number }
    | undefined;
  const nextOverlapEnd = firstIndexAfter(
    ranges.byStart,
    draftEndSeconds,
    (range) => range.start
  );
  for (let index = nextOverlapEnd - 1; index >= 0; index -= 1) {
    const range = ranges.byStart[index];
    if (range.markerId === draft.id || range.end <= draftEndSeconds) continue;

    const overlapSeconds =
      draftEndSeconds - Math.max(range.start, draft.seconds);
    if (!isSmallOverlap(overlapSeconds)) {
      if (overlapSeconds > maxGapSeconds) break;
      continue;
    }
    if (
      !nextOverlapRange ||
      overlapSeconds < nextOverlapRange.overlapSeconds ||
      (overlapSeconds === nextOverlapRange.overlapSeconds &&
        range.sourceOrder < nextOverlapRange.range.sourceOrder)
    ) {
      nextOverlapRange = { range, overlapSeconds };
    }
  }

  let previousGapRange: SceneMarkerGapRange | undefined;
  const previousGapEnd = firstIndexAtLeast(
    ranges.byEnd,
    draft.seconds,
    (range) => range.end
  );
  for (let index = previousGapEnd - 1; index >= 0; index -= 1) {
    if (ranges.byEnd[index].markerId !== draft.id) {
      previousGapRange = ranges.byEnd[index];
      break;
    }
  }

  let nextGapRange: SceneMarkerGapRange | undefined;
  const nextGapStart = firstIndexAfter(
    ranges.byStart,
    draftEndSeconds,
    (range) => range.start
  );
  for (let index = nextGapStart; index < ranges.byStart.length; index += 1) {
    if (ranges.byStart[index].markerId !== draft.id) {
      nextGapRange = ranges.byStart[index];
      break;
    }
  }

  const previousGapSeconds = previousGapRange
    ? draft.seconds - previousGapRange.end
    : 0;
  const nextGapSeconds = nextGapRange
    ? nextGapRange.start - draftEndSeconds
    : 0;
  const warnings: {
    previous?: SceneMarkerGapWarningDetail;
    next?: SceneMarkerGapWarningDetail;
  } = {};

  if (previousOverlapRange) {
    warnings.previous = {
      issueType: "overlap",
      issueSeconds: roundToMilliseconds(previousOverlapRange.overlapSeconds),
      markerBoundarySeconds: previousOverlapRange.range.end,
      closeToSeconds: roundToMilliseconds(
        previousOverlapRange.range.end + markerGapCloseOffsetSeconds
      ),
      otherCloseToSeconds: roundToMilliseconds(
        draft.seconds - markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: previousOverlapRange.range.markerType,
      adjacentMarkerId: previousOverlapRange.range.markerId,
      adjacentMarkerKind: previousOverlapRange.range.markerKind,
    };
  } else if (
    !previousOverlapRange &&
    previousGapRange &&
    isSmallGap(previousGapSeconds) &&
    !isGapCoveredByIndex(
      previousGapRange.end,
      draft.seconds,
      allRanges,
      draft.id
    )
  ) {
    warnings.previous = {
      issueType: "gap",
      issueSeconds: roundToMilliseconds(previousGapSeconds),
      markerBoundarySeconds: previousGapRange.end,
      closeToSeconds: roundToMilliseconds(
        previousGapRange.end + markerGapCloseOffsetSeconds
      ),
      otherCloseToSeconds: roundToMilliseconds(
        draft.seconds - markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: previousGapRange.markerType,
      adjacentMarkerId: previousGapRange.markerId,
      adjacentMarkerKind: previousGapRange.markerKind,
    };
  }

  if (nextOverlapRange) {
    warnings.next = {
      issueType: "overlap",
      issueSeconds: roundToMilliseconds(nextOverlapRange.overlapSeconds),
      markerBoundarySeconds: nextOverlapRange.range.start,
      closeToSeconds: roundToMilliseconds(
        nextOverlapRange.range.start - markerGapCloseOffsetSeconds
      ),
      otherCloseToSeconds: roundToMilliseconds(
        draftEndSeconds + markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: nextOverlapRange.range.markerType,
      adjacentMarkerId: nextOverlapRange.range.markerId,
      adjacentMarkerKind: nextOverlapRange.range.markerKind,
    };
  } else if (
    !nextOverlapRange &&
    nextGapRange &&
    isSmallGap(nextGapSeconds) &&
    !isGapCoveredByIndex(
      draftEndSeconds,
      nextGapRange.start,
      allRanges,
      draft.id
    )
  ) {
    warnings.next = {
      issueType: "gap",
      issueSeconds: roundToMilliseconds(nextGapSeconds),
      markerBoundarySeconds: nextGapRange.start,
      closeToSeconds: roundToMilliseconds(
        nextGapRange.start - markerGapCloseOffsetSeconds
      ),
      otherCloseToSeconds: roundToMilliseconds(
        draftEndSeconds + markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: nextGapRange.markerType,
      adjacentMarkerId: nextGapRange.markerId,
      adjacentMarkerKind: nextGapRange.markerKind,
    };
  }

  if (!warnings.previous && !warnings.next) return undefined;

  return warnings;
}

export function prepareSceneMarkerWarnings({
  sceneMarkers,
  negativeMarkers,
  roleTagIds,
}: {
  sceneMarkers: SceneMarkerGapSceneMarker[];
  negativeMarkers: SceneMarkerGapNegativeMarker[];
  roleTagIds: SceneMarkerGapRoleTagIds;
}): SceneMarkerWarningCalculator {
  const activityTagIds = activityTypeTagIds(roleTagIds);
  const sceneRanges = sceneMarkers
    .map((marker, index) => markerRange(marker, index))
    .filter((range): range is SceneMarkerGapRange => !!range);
  const negativeRanges = negativeMarkers
    .map((marker, index) =>
      negativeMarkerRange(marker, sceneMarkers.length + index)
    )
    .filter((range): range is SceneMarkerGapRange => !!range);
  const allRanges = createRangeIndex([...sceneRanges, ...negativeRanges]);
  const activityRanges = createRangeIndex([
    ...sceneRanges.filter(
      (range) =>
        markerKind(sceneMarkers[range.sourceOrder], activityTagIds) ===
        "activity"
    ),
    ...negativeRanges,
  ]);
  const highlightRanges = createRangeIndex([
    ...sceneRanges.filter(
      (range) =>
        markerKind(sceneMarkers[range.sourceOrder], activityTagIds) ===
        "highlight"
    ),
    ...negativeRanges,
  ]);

  const findGapWarningDetails = (draft: SceneMarkerGapDraft) =>
    findPreparedSceneMarkerGapWarningDetails(
      draft,
      activityTagIds,
      allRanges,
      activityRanges,
      highlightRanges
    );
  const findGapWarnings = (draft: SceneMarkerGapDraft) => {
    const details = findGapWarningDetails(draft);
    if (!details) return undefined;

    return {
      previous: details.previous && stripGapWarningDetail(details.previous),
      next: details.next && stripGapWarningDetail(details.next),
    };
  };
  const findWarnings = (draft: SceneMarkerGapDraft) =>
    findSceneMarkerWarningsForDraft(draft, roleTagIds, findGapWarningDetails);

  return { findGapWarningDetails, findGapWarnings, findWarnings };
}

export function findSceneMarkerGapWarningDetails({
  draft,
  sceneMarkers,
  negativeMarkers,
  roleTagIds,
}: {
  draft: SceneMarkerGapDraft;
  sceneMarkers: SceneMarkerGapSceneMarker[];
  negativeMarkers: SceneMarkerGapNegativeMarker[];
  roleTagIds: SceneMarkerGapRoleTagIds;
}) {
  return prepareSceneMarkerWarnings({
    sceneMarkers,
    negativeMarkers,
    roleTagIds,
  }).findGapWarningDetails(draft);
}

export function findSceneMarkerGapWarnings({
  draft,
  sceneMarkers,
  negativeMarkers,
  roleTagIds,
}: {
  draft: SceneMarkerGapDraft;
  sceneMarkers: SceneMarkerGapSceneMarker[];
  negativeMarkers: SceneMarkerGapNegativeMarker[];
  roleTagIds: SceneMarkerGapRoleTagIds;
}): SceneMarkerGapWarnings | undefined {
  const details = findSceneMarkerGapWarningDetails({
    draft,
    sceneMarkers,
    negativeMarkers,
    roleTagIds,
  });

  if (!details) return undefined;

  return {
    previous: details.previous && stripGapWarningDetail(details.previous),
    next: details.next && stripGapWarningDetail(details.next),
  };
}

export function sceneMarkerWarningDraft(
  marker: SceneMarkerGapSceneMarker
): SceneMarkerGapDraft {
  return {
    id: marker.id,
    seconds: marker.seconds,
    end_seconds: marker.end_seconds,
    primary_tag_id: marker.primary_tag?.id,
    tag_ids: marker.tags?.map((tag) => tag.id) ?? [],
    primary_tag: marker.primary_tag,
    tags: marker.tags,
    top_performer_ids:
      marker.top_performers?.map((performer) => performer.id) ?? [],
    bottom_performer_ids:
      marker.bottom_performers?.map((performer) => performer.id) ?? [],
  };
}

function findSceneMarkerWarningsForDraft(
  draft: SceneMarkerGapDraft,
  roleTagIds: SceneMarkerGapRoleTagIds,
  findGapWarningDetails: (draft: SceneMarkerGapDraft) =>
    | {
        previous?: SceneMarkerGapWarningDetail;
        next?: SceneMarkerGapWarningDetail;
      }
    | undefined
): SceneMarkerWarning[] {
  const warnings: SceneMarkerWarning[] = [];
  const performerCounts = draftPerformerCounts(draft);

  if (draft.end_seconds === null || draft.end_seconds === undefined) {
    warnings.push({
      issueType: "missing-end-time",
      message: "Marker has no end time.",
    });
  }

  if (performerCounts.top + performerCounts.bottom === 0) {
    warnings.push({
      issueType: "missing-performers",
      message: "Marker has no top or bottom performers.",
    });
  }

  if (
    draftHasConfiguredPrimaryTag(draft, roleRequiredTagIds(roleTagIds)) &&
    (performerCounts.top === 0 || performerCounts.bottom === 0)
  ) {
    warnings.push({
      issueType: "missing-role-performers",
      message:
        "Sex, oral, and facial markers should include at least one top and one bottom performer.",
    });
  }

  const gapWarnings = findGapWarningDetails(draft);

  if (gapWarnings?.previous) {
    warnings.push({
      issueType: gapWarnings.previous.issueType,
      boundary: "previous",
      gapWarning: gapWarnings.previous,
      message: gapWarningMessage("previous", gapWarnings.previous),
    });
  }

  if (gapWarnings?.next) {
    warnings.push({
      issueType: gapWarnings.next.issueType,
      boundary: "next",
      gapWarning: gapWarnings.next,
      message: gapWarningMessage("next", gapWarnings.next),
    });
  }

  return warnings;
}

export function findSceneMarkerWarnings({
  draft,
  sceneMarkers,
  negativeMarkers,
  roleTagIds,
}: {
  draft: SceneMarkerGapDraft;
  sceneMarkers: SceneMarkerGapSceneMarker[];
  negativeMarkers: SceneMarkerGapNegativeMarker[];
  roleTagIds: SceneMarkerGapRoleTagIds;
}): SceneMarkerWarning[] {
  return prepareSceneMarkerWarnings({
    sceneMarkers,
    negativeMarkers,
    roleTagIds,
  }).findWarnings(draft);
}
