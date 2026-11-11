export interface ISceneMarkerInsertSourceRange {
  seconds: number;
  end_seconds?: number | null;
}

export interface ISceneMarkerInsertDraftRange {
  seconds: number;
  end_seconds?: number | null;
}

export interface ISceneMarkerInsertRangeErrors {
  seconds?: string;
  end_seconds?: string;
}

export type SceneMarkerInsertMode = "marker" | "negative-marker" | "gap";
export type SceneMarkerInsertRecordKind =
  | "scene-marker"
  | "negative-marker"
  | undefined;

export interface ISceneMarkerDuplicateSource {
  title: string;
  seconds: number;
  end_seconds?: number | null;
  primary_tag: { id: string };
  tags: Array<{ id: string }>;
  top_performers?: Array<{ id: string }>;
  bottom_performers?: Array<{ id: string }>;
}

export const INSERT_MARKER_SOURCE_END_REQUIRED =
  "The original marker needs an end time before another marker can be inserted inside it.";
export const INSERT_MARKER_START_OUT_OF_BOUNDS =
  "Start time must be on or after the original marker's start and before its end.";
export const INSERT_MARKER_END_REQUIRED =
  "Set an end time to add a marker in between.";
export const INSERT_MARKER_END_OUT_OF_BOUNDS =
  "End time must be after the original marker's start and on or before its end.";
export const INSERT_MARKER_COVERS_SOURCE =
  "The new range cannot cover the whole original marker. Keep at least one side of it.";

const toMilliseconds = (seconds: number) => Math.round(seconds * 1000);
const fromMilliseconds = (milliseconds: number) => milliseconds / 1000;

export function getSceneMarkerInsertRecordKind(
  mode: SceneMarkerInsertMode
): SceneMarkerInsertRecordKind {
  if (mode === "marker") return "scene-marker";
  if (mode === "negative-marker") return "negative-marker";
  return undefined;
}

export function getSceneMarkerDuplicateValues(
  marker: ISceneMarkerDuplicateSource
) {
  return {
    title: marker.title,
    seconds: marker.seconds,
    end_seconds: marker.end_seconds ?? null,
    primary_tag_id: marker.primary_tag.id,
    tag_ids: marker.tags.map((tag) => tag.id),
    top_performer_ids:
      marker.top_performers?.map((performer) => performer.id) ?? [],
    bottom_performer_ids:
      marker.bottom_performers?.map((performer) => performer.id) ?? [],
  };
}

export function getSceneMarkerGapDraftValues<
  T extends {
    insert_mode: SceneMarkerInsertMode;
    seconds: number;
    end_seconds?: number | null;
  },
>(values: T, selectedRange: { seconds: number; end_seconds: number }): T {
  return {
    ...values,
    insert_mode: "gap",
    seconds: selectedRange.seconds,
    end_seconds: selectedRange.end_seconds,
  };
}

export function getSceneMarkerInsertRangeErrors(
  source: ISceneMarkerInsertSourceRange,
  draft: ISceneMarkerInsertDraftRange
): ISceneMarkerInsertRangeErrors {
  if (source.end_seconds === null || source.end_seconds === undefined) {
    return { end_seconds: INSERT_MARKER_SOURCE_END_REQUIRED };
  }

  const sourceStart = toMilliseconds(source.seconds);
  const sourceEnd = toMilliseconds(source.end_seconds);
  const draftStart = toMilliseconds(draft.seconds);
  const draftEnd =
    draft.end_seconds === null || draft.end_seconds === undefined
      ? undefined
      : toMilliseconds(draft.end_seconds);
  const errors: ISceneMarkerInsertRangeErrors = {};

  // The new range may share the original's start or end, but not both.
  if (draftStart < sourceStart || draftStart >= sourceEnd) {
    errors.seconds = INSERT_MARKER_START_OUT_OF_BOUNDS;
  }
  if (draftEnd === undefined) {
    errors.end_seconds = INSERT_MARKER_END_REQUIRED;
  } else if (draftEnd <= sourceStart || draftEnd > sourceEnd) {
    errors.end_seconds = INSERT_MARKER_END_OUT_OF_BOUNDS;
  } else if (draftStart === sourceStart && draftEnd === sourceEnd) {
    errors.end_seconds = INSERT_MARKER_COVERS_SOURCE;
  }

  return errors;
}

/**
 * Returns the remaining sides of the original marker around the new range,
 * each one millisecond outside it. A side is omitted when the new range
 * shares that boundary with the original marker.
 */
export function getSceneMarkerSplitBounds(
  source: { seconds: number; end_seconds: number },
  draft: { seconds: number; end_seconds: number }
) {
  const draftStart = toMilliseconds(draft.seconds);
  const draftEnd = toMilliseconds(draft.end_seconds);

  return {
    leftEndSeconds:
      draftStart > toMilliseconds(source.seconds)
        ? fromMilliseconds(draftStart - 1)
        : undefined,
    rightStartSeconds:
      draftEnd < toMilliseconds(source.end_seconds)
        ? fromMilliseconds(draftEnd + 1)
        : undefined,
  };
}
