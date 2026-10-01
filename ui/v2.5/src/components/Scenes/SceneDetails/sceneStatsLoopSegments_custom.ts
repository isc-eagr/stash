import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";

// CUSTOM: begin - shared scene stats loop segment helpers
export interface ISceneStatsLoopInterval {
  start: number;
  end: number;
}

const minimumLoopSegmentMilliseconds = 1;

function mergeLoopIntervals(intervals: ISceneStatsLoopInterval[]) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: ISceneStatsLoopInterval[] = [];

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged;
}

export function isSelectableLoopSegmentInterval(
  interval: ISceneStatsLoopInterval
) {
  return (
    Math.round((interval.end - interval.start) * 1000) >
    minimumLoopSegmentMilliseconds
  );
}

export function buildIntervalLoopSegments(
  label: string,
  intervals: ISceneStatsLoopInterval[]
): ILoopSegmentInput[] {
  const selectableIntervals = mergeLoopIntervals(intervals).filter(
    isSelectableLoopSegmentInterval
  );

  return selectableIntervals.map((interval, index) => ({
    start: interval.start,
    end: interval.end,
    title: `${label}${selectableIntervals.length > 1 ? ` ${index + 1}` : ""}`,
  }));
}

function loopSegmentTitleDetail(segment: ILoopSegmentInput) {
  const separatorIndex = segment.title?.indexOf(":") ?? -1;
  if (separatorIndex < 0) return undefined;

  const detail = segment.title?.slice(separatorIndex + 1).trim();
  return detail || undefined;
}

export function buildIntersectedLoopSegments(
  label: string,
  primarySegments: ILoopSegmentInput[],
  secondarySegments: ILoopSegmentInput[]
): ILoopSegmentInput[] {
  return primarySegments.flatMap((primarySegment) =>
    secondarySegments.flatMap((secondarySegment) => {
      const start = Math.max(primarySegment.start, secondarySegment.start);
      const end = Math.min(primarySegment.end, secondarySegment.end);
      if (!isSelectableLoopSegmentInterval({ start, end })) return [];

      const detail =
        loopSegmentTitleDetail(primarySegment) ??
        loopSegmentTitleDetail(secondarySegment);

      return [
        {
          start,
          end,
          title: detail ? `${label}: ${detail}` : label,
        },
      ];
    })
  );
}
// CUSTOM: end
