import { toMarkerMilliseconds } from "./sceneMarkerTimestamp_custom";

export interface ISceneNegativeMarkerFormRange {
  start_seconds: number;
  end_seconds: number;
}

interface IAbLoopRange {
  start: number | boolean;
  end: number | boolean;
  enabled?: boolean;
}

export function getSceneNegativeMarkerInitialRange({
  marker,
  playerPosition,
  abLoop,
}: {
  marker?: ISceneNegativeMarkerFormRange;
  playerPosition?: number;
  abLoop?: IAbLoopRange;
}): ISceneNegativeMarkerFormRange {
  if (marker) {
    return {
      start_seconds: marker.start_seconds,
      end_seconds: marker.end_seconds,
    };
  }

  const current = toMarkerMilliseconds(playerPosition);
  const { start } = abLoop ?? {};
  if (abLoop?.enabled && typeof start === "number" && Number.isFinite(start)) {
    const loopEnd =
      typeof abLoop.end === "number" &&
      Number.isFinite(abLoop.end) &&
      abLoop.end > start
        ? abLoop.end
        : undefined;

    return {
      start_seconds: start,
      end_seconds: loopEnd ?? Math.max(start + 10, current),
    };
  }

  return {
    start_seconds: current,
    end_seconds: current + 10,
  };
}

export function getSceneNegativeMarkerDuration(
  startSeconds: number,
  endSeconds: number
) {
  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    endSeconds <= startSeconds
  ) {
    return undefined;
  }

  return endSeconds - startSeconds;
}
