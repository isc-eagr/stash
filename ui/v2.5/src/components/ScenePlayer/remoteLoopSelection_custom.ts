import type { ILoopSegment } from "./multi-segment-loop";

export function remoteLoopRevisionCustom(
  enabled: boolean,
  segments: ILoopSegment[]
): string {
  return JSON.stringify([enabled, segments]);
}

export function nextSelectedSegmentCustom(
  segments: ILoopSegment[],
  selected: string[],
  current: number
): number {
  for (let offset = 1; offset <= segments.length; offset++) {
    const index = (current + offset) % segments.length;
    if (!selected.length || selected.includes(segments[index].id)) return index;
  }
  return (current + 1) % segments.length;
}
