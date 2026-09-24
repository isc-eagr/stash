import type { ILoopSegmentInput } from "./multi-segment-loop";

export function sceneMarkerLoopSegmentCustom(
  marker: { seconds: number; end_seconds?: number | null },
  title: string
): ILoopSegmentInput {
  const start = marker.seconds;
  const endRaw = marker.end_seconds ?? start + 20;
  return { start, end: endRaw > start ? endRaw : start + 1, title };
}
