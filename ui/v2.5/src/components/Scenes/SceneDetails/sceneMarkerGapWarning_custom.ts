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
  gapSeconds: number;
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

const maxGapSeconds = 2;
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

function markerHasIgnoredTag(
  marker: SceneMarkerGapSceneMarker,
  ignoredTagIds: string[]
) {
  return [marker.primary_tag, ...(marker.tags ?? [])].some((tag) =>
    ignoredTagIds.some((tagId) => tagMatches(tag, tagId))
  );
}

function draftHasIgnoredTag(
  draft: SceneMarkerGapDraft,
  ignoredTagIds: string[]
) {
  const draftTagIds = new Set(
    [draft.primary_tag_id, ...(draft.tag_ids ?? [])].filter(Boolean)
  );

  return (
    ignoredTagIds.some((tagId) => draftTagIds.has(tagId)) ||
    [draft.primary_tag, ...(draft.tags ?? [])].some((tag) =>
      ignoredTagIds.some((tagId) => tagMatches(tag, tagId))
    )
  );
}

function isSmallGap(gapSeconds: number) {
  const roundedGapSeconds = roundToMilliseconds(gapSeconds);
  return (
    roundedGapSeconds > markerGapCloseOffsetSeconds &&
    roundedGapSeconds <= maxGapSeconds
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
  const ignoredTagIds = [
    roleTagIds.sexTagId,
    roleTagIds.oralTagId,
    roleTagIds.soloTagId,
  ].filter((tagId): tagId is string => !!tagId);

  if (draftHasIgnoredTag(draft, ignoredTagIds)) return undefined;

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

  const ranges = [
    ...sceneMarkers
      .filter((marker) => marker.id !== draft.id)
      .filter((marker) => !markerHasIgnoredTag(marker, ignoredTagIds))
      .map(markerRange),
    ...negativeMarkers.map(negativeMarkerRange),
  ].filter((range): range is SceneMarkerGapRange => !!range);

  const previousRange = ranges
    .filter((range) => range.end < draft.seconds)
    .sort((a, b) => b.end - a.end)[0];
  const nextRange = ranges
    .filter((range) => range.start > draftEndSeconds)
    .sort((a, b) => a.start - b.start)[0];

  const previousGapSeconds = previousRange
    ? draft.seconds - previousRange.end
    : 0;
  const nextGapSeconds = nextRange ? nextRange.start - draftEndSeconds : 0;
  const warnings: SceneMarkerGapWarnings = {};

  if (previousRange && isSmallGap(previousGapSeconds)) {
    warnings.previous = {
      gapSeconds: roundToMilliseconds(previousGapSeconds),
      markerBoundarySeconds: previousRange.end,
      closeToSeconds: roundToMilliseconds(
        previousRange.end + markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: previousRange.markerType,
    };
  }

  if (nextRange && isSmallGap(nextGapSeconds)) {
    warnings.next = {
      gapSeconds: roundToMilliseconds(nextGapSeconds),
      markerBoundarySeconds: nextRange.start,
      closeToSeconds: roundToMilliseconds(
        nextRange.start - markerGapCloseOffsetSeconds
      ),
      adjacentMarkerType: nextRange.markerType,
    };
  }

  if (!warnings.previous && !warnings.next) return undefined;

  return warnings;
}
