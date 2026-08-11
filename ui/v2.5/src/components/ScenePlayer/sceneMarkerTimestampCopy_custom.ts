export type SceneMarkerTimestampField = "seconds" | "end_seconds";

export type SceneMarkerTimestampBoundary = "start" | "end";

export type SceneMarkerTimestampSourceKind = "scene-marker" | "negative-marker";

export interface ISceneMarkerTimestampCopyRequest {
  field: SceneMarkerTimestampField;
  requestId: number;
}

export interface ISceneMarkerTimestampCopySelection
  extends ISceneMarkerTimestampCopyRequest {
  boundary: SceneMarkerTimestampBoundary;
  markerId: string;
  seconds: number;
}

export interface ISceneMarkerTimestampSource {
  id?: string;
  seconds: number;
  end_seconds?: number | null;
}

export interface ISceneMarkerTimestampOption {
  boundary: SceneMarkerTimestampBoundary;
  label: "Start" | "End";
  seconds: number;
}

export interface ISceneMarkerTimestampPickerHorizontalLayout {
  left: number;
  caretLeft: number;
}

export function shouldScheduleSceneMarkerTimestampPickerHide(
  activeOwner: unknown,
  requestedOwner?: unknown
): boolean {
  return requestedOwner === undefined || activeOwner === requestedOwner;
}

export function getSceneMarkerTimestampPickerHorizontalLayout({
  parentWidth,
  pickerWidth,
  cursorX,
  padding = 6,
  caretInset = 18,
}: {
  parentWidth: number;
  pickerWidth: number;
  cursorX: number;
  padding?: number;
  caretInset?: number;
}): ISceneMarkerTimestampPickerHorizontalLayout {
  const maxLeft = Math.max(padding, parentWidth - pickerWidth - padding);
  const left = Math.max(padding, Math.min(cursorX - pickerWidth / 2, maxLeft));
  const effectiveCaretInset = Math.min(caretInset, pickerWidth / 2);
  const caretLeft = Math.max(
    effectiveCaretInset,
    Math.min(cursorX - left, pickerWidth - effectiveCaretInset)
  );

  return { left, caretLeft };
}

export function getSceneMarkerTimestampOptions(
  marker: ISceneMarkerTimestampSource
): ISceneMarkerTimestampOption[] {
  const options: ISceneMarkerTimestampOption[] = [
    { boundary: "start", label: "Start", seconds: marker.seconds },
  ];

  if (
    marker.end_seconds !== null &&
    marker.end_seconds !== undefined &&
    Number.isFinite(marker.end_seconds)
  ) {
    options.push({
      boundary: "end",
      label: "End",
      seconds: marker.end_seconds,
    });
  }

  return options;
}

export function resolveSceneMarkerTimestampCopySelection(
  request: ISceneMarkerTimestampCopyRequest,
  marker: ISceneMarkerTimestampSource,
  boundary: SceneMarkerTimestampBoundary
): ISceneMarkerTimestampCopySelection | undefined {
  const seconds = getSceneMarkerTimestampOptions(marker).find(
    (option) => option.boundary === boundary
  )?.seconds;

  if (!marker.id || seconds === undefined || !Number.isFinite(seconds)) {
    return undefined;
  }

  return {
    ...request,
    boundary,
    markerId: marker.id,
    seconds,
  };
}
