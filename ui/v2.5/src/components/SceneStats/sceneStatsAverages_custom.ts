export type SceneStatsAverageScene = {
  duration: number;
  performer_count: number;
  performer_ids: readonly string[];
};

export type SceneStatsAverages = {
  averageSceneLength?: number;
  averageScenesPerPerformer?: number;
  uniquePerformerCount: number;
};

// Computed from the scenes currently shown, so chart filters and release
// drilldowns change the averages too.
export function sceneStatsAverages(
  scenes: readonly SceneStatsAverageScene[]
): SceneStatsAverages {
  let knownDurationCount = 0;
  let totalDuration = 0;
  let performerSceneCount = 0;
  const performerIDs = new Set<string>();

  scenes.forEach((scene) => {
    if (scene.duration > 0) {
      knownDurationCount += 1;
      totalDuration += scene.duration;
    }
    performerSceneCount += scene.performer_count;
    scene.performer_ids.forEach((id) => performerIDs.add(id));
  });

  return {
    averageSceneLength:
      knownDurationCount > 0 ? totalDuration / knownDurationCount : undefined,
    averageScenesPerPerformer:
      performerIDs.size > 0
        ? performerSceneCount / performerIDs.size
        : undefined,
    uniquePerformerCount: performerIDs.size,
  };
}
