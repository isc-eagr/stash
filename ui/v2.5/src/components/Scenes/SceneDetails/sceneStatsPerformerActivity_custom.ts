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

export interface ISceneStatsPerformerActivityLabels {
  performerParticipationLabel: string;
  sceneTotalLabel: string;
}

function percent(seconds: number, totalSeconds: number) {
  if (totalSeconds <= 0) return 0;

  return Math.round((seconds / totalSeconds) * 100);
}

export function getSceneStatsPerformerActivityLabels(
  category: "both" | "oral" | "sex" | "solo"
): ISceneStatsPerformerActivityLabels {
  const activityLabel =
    category === "both"
      ? "Overall"
      : category[0].toUpperCase() + category.slice(1);

  return {
    performerParticipationLabel: `Performer ${activityLabel} Participation`,
    sceneTotalLabel:
      category === "both"
        ? "Total Scene Overall Activity (Sex + Oral)"
        : `Total Scene ${activityLabel} Activity`,
  };
}

export function getSceneStatsPerformerActivityPercent(
  performerSeconds: number,
  activitySeconds: number
) {
  return percent(performerSeconds, activitySeconds);
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
