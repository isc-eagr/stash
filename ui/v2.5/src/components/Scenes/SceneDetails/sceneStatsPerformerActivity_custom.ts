export interface ISceneStatsPerformerActivityMetric {
  bottomSeconds: number;
  topSeconds: number;
  totalSeconds: number;
}

export interface ISceneStatsCombinedPerformerActivityMetric
  extends ISceneStatsPerformerActivityMetric {
  bottomPercent: number;
  topPercent: number;
}

function percent(seconds: number, totalSeconds: number) {
  if (totalSeconds <= 0) return 0;

  return Math.round((seconds / totalSeconds) * 100);
}

export function getSceneStatsCombinedPerformerActivity(
  sex: ISceneStatsPerformerActivityMetric | undefined,
  oral: ISceneStatsPerformerActivityMetric | undefined
): ISceneStatsCombinedPerformerActivityMetric | undefined {
  if (!sex || !oral || sex.totalSeconds <= 0 || oral.totalSeconds <= 0) {
    return undefined;
  }

  const totalSeconds = sex.totalSeconds + oral.totalSeconds;
  const topSeconds = sex.topSeconds + oral.topSeconds;
  const bottomSeconds = sex.bottomSeconds + oral.bottomSeconds;

  return {
    bottomPercent: percent(bottomSeconds, totalSeconds),
    bottomSeconds,
    topPercent: percent(topSeconds, totalSeconds),
    topSeconds,
    totalSeconds,
  };
}
