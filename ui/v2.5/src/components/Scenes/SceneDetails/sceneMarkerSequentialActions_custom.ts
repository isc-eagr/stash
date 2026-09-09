import { toMarkerMilliseconds } from "./sceneMarkerTimestamp_custom";

export type SceneMarkerSequentialRecordKind = "marker" | "negative-marker";

export interface ISceneMarkerCreateRequest {
  seconds: number;
  requestId: number;
}

export interface ISceneMarkerSequentialDraft {
  insert_mode: "marker" | "negative-marker" | "gap";
  title: string;
  seconds: number;
  end_seconds: number | null;
  primary_tag_id: string;
  tag_ids: string[];
  top_performer_ids: string[];
  bottom_performer_ids: string[];
}

type ClosedSceneMarkerSequentialDraft = Omit<
  ISceneMarkerSequentialDraft,
  "end_seconds"
> & {
  end_seconds: number;
};

export function hasSequentialMarkerEnd(
  endSeconds: number | null | undefined
): endSeconds is number {
  return endSeconds !== null && Number.isFinite(endSeconds);
}

export function getSequentialMarkerStart(endSeconds: number): number {
  return toMarkerMilliseconds(endSeconds + 0.001);
}

export function getSequentialMarkerDraft<
  T extends ClosedSceneMarkerSequentialDraft
>(
  current: T,
  recordKind: SceneMarkerSequentialRecordKind
): ISceneMarkerSequentialDraft {
  const common = {
    seconds: getSequentialMarkerStart(current.end_seconds),
    end_seconds: null,
  };

  if (recordKind === "negative-marker") {
    return {
      ...common,
      insert_mode: "negative-marker",
      title: "",
      primary_tag_id: "",
      tag_ids: [],
      top_performer_ids: [],
      bottom_performer_ids: [],
    };
  }

  return {
    ...current,
    ...common,
    insert_mode: "marker",
  };
}
