export type SceneStatsAverageScene = {
  duration: number;
  performer_count: number;
};

export type SceneStatsAverages = {
  averageSceneLength?: number;
  averageScenesPerPerformer?: number;
};

export function sceneStatsAverages(
  scenes: SceneStatsAverageScene[],
  uniquePerformerCount: number
): SceneStatsAverages {
  let knownDurationCount = 0;
  let totalDuration = 0;
  let performerSceneCount = 0;

  scenes.forEach((scene) => {
    if (scene.duration > 0) {
      knownDurationCount += 1;
      totalDuration += scene.duration;
    }
    performerSceneCount += scene.performer_count;
  });

  return {
    averageSceneLength:
      knownDurationCount > 0 ? totalDuration / knownDurationCount : undefined,
    averageScenesPerPerformer:
      uniquePerformerCount > 0
        ? performerSceneCount / uniquePerformerCount
        : undefined,
  };
}
