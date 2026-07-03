export type SceneMarkerGapTag = {
  id: string;
  name?: string;
  parents?: Array<{ id: string }>;
};

export type SceneMarkerGapRoleTagIds = {
  sexTagId?: string;
  oralTagId?: string;
  soloTagId?: string;
};

export type SceneMarkerGapSceneMarker = {
  id: string;
  title?: string;
  seconds: number;
  end_seconds?: number | null;
  primary_tag?: SceneMarkerGapTag | null;
  tags?: SceneMarkerGapTag[] | null;
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
};

export type SceneMarkerGapWarning = {
  issueType: "gap" | "overlap";
  issueSeconds: number;
  markerBoundarySeconds: number;
  closeToSeconds: number;
  adjacentMarkerType: string;
};

export type SceneMarkerGapWarnings = {
  previous?: SceneMarkerGapWarning;
  next?: SceneMarkerGapWarning;
};

type SceneMarkerGapRange = {
  start: number;
  end: number;
  markerType: string;
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
  return [marker.primary_tag, ...(marker.tags ?? [])].some((tag) =>
    activityTagIds.some((tagId) => tagMatches(tag, tagId))
  );
}

function draftHasActivityTag(
  draft: SceneMarkerGapDraft,
  activityTagIds: string[]
) {
  const draftTagIds = new Set(
    [draft.primary_tag_id, ...(draft.tag_ids ?? [])].filter(Boolean)
  );

  return (
    activityTagIds.some((tagId) => draftTagIds.has(tagId)) ||
    [draft.primary_tag, ...(draft.tags ?? [])].some((tag) =>
      activityTagIds.some((tagId) => tagMatches(tag, tagId))
    )
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

function markerRange(
  marker: SceneMarkerGapSceneMarker
): SceneMarkerGapRange | undefined {
  const endSeconds =
    marker.end_seconds ?? marker.seconds + defaultMarkerDurationSeconds;
  if (!Number.isFinite(marker.seconds) || !Number.isFinite(endSeconds)) {
    return undefined;
  }

  if (endSeconds <= marker.seconds) return undefined;

  return {
    start: marker.seconds,
    end: endSeconds,
    markerType: markerType(marker),
  };
}

function negativeMarkerRange(
  marker: SceneMarkerGapNegativeMarker
): SceneMarkerGapRange | undefined {
  if (
    !Number.isFinite(marker.start_seconds) ||
    !Number.isFinite(marker.end_seconds)
  ) {
    return undefined;
  }

  if (marker.end_seconds <= marker.start_seconds) return undefined;

  return {
    start: marker.start_seconds,
    end: marker.end_seconds,
    markerType: negativeMarkerType(marker),
  };
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
  const activityTagIds = [
    roleTagIds.sexTagId,
    roleTagIds.oralTagId,
    roleTagIds.soloTagId,
  ].filter((tagId): tagId is string => !!tagId);

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
  const ranges = [
    ...sceneMarkers
      .filter((marker) => marker.id !== draft.id)
      .filter(
        (marker) =>
          draftKind === "negative" ||
          markerKind(marker, activityTagIds) === draftKind
      )
      .map(markerRange),
    ...negativeMarkers
      .filter((marker) => marker.id !== draft.id)
      .map(negativeMarkerRange),
  ].filter((range): range is SceneMarkerGapRange => !!range);

  const previousOverlapRange = ranges
    .filter((range) => range.start < draft.seconds && range.end > draft.seconds)
    .map((range) => ({
      range,
      overlapSeconds: Math.min(range.end, draftEndSeconds) - draft.seconds,
    }))
    .filter(({ overlapSeconds }) => overlapSeconds > 0)
    .sort((a, b) => a.overlapSeconds - b.overlapSeconds)[0];
  const nextOverlapRange = ranges
    .filter(
      (range) => range.start < draftEndSeconds && range.end > draftEndSeconds
    )
    .map((range) => ({
      range,
      overlapSeconds: draftEndSeconds - Math.max(range.start, draft.seconds),
    }))
    .filter(({ overlapSeconds }) => overlapSeconds > 0)
    .sort((a, b) => a.overlapSeconds - b.overlapSeconds)[0];
  const previousGapRange = ranges
    .filter((range) => range.end < draft.seconds)
    .sort((a, b) => b.end - a.end)[0];
  const nextGapRange = ranges
    .filter((range) => range.start > draftEndSeconds)
    .sort((a, b) => a.start - b.start)[0];

  const previousGapSeconds = previousGapRange
    ? draft.seconds - previousGapRange.end
    : 0;
  const nextGapSeconds = nextGapRange
    ? nextGapRange.start - draftEndSeconds
    : 0;
  const warnings: SceneMarkerGapWarnings = {};

  if (
    previousOverlapRange &&
    isSmallOverlap(previousOverlapRange.overlapSeconds)
  ) {
    warnings.previous = {
      issueType: "overlap",
      issueSeconds: roundToMilliseconds(previousOverlapRange.overlapSeconds),
      markerBoundarySeconds: previousOverlapRange.range.end,
      closeToSeconds: roundToMilliseconds(
        previousOverlapRange.range.end + markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: previousOverlapRange.range.markerType,
    };
  } else if (
    !previousOverlapRange &&
    previousGapRange &&
    isSmallGap(previousGapSeconds)
  ) {
    warnings.previous = {
      issueType: "gap",
      issueSeconds: roundToMilliseconds(previousGapSeconds),
      markerBoundarySeconds: previousGapRange.end,
      closeToSeconds: roundToMilliseconds(
        previousGapRange.end + markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: previousGapRange.markerType,
    };
  }

  if (nextOverlapRange && isSmallOverlap(nextOverlapRange.overlapSeconds)) {
    warnings.next = {
      issueType: "overlap",
      issueSeconds: roundToMilliseconds(nextOverlapRange.overlapSeconds),
      markerBoundarySeconds: nextOverlapRange.range.start,
      closeToSeconds: roundToMilliseconds(
        nextOverlapRange.range.start - markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: nextOverlapRange.range.markerType,
    };
  } else if (!nextOverlapRange && nextGapRange && isSmallGap(nextGapSeconds)) {
    warnings.next = {
      issueType: "gap",
      issueSeconds: roundToMilliseconds(nextGapSeconds),
      markerBoundarySeconds: nextGapRange.start,
      closeToSeconds: roundToMilliseconds(
        nextGapRange.start - markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: nextGapRange.markerType,
    };
  }

  if (!warnings.previous && !warnings.next) return undefined;

  return warnings;
}
