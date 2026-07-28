export type SceneStatsPodiumEligibilityScene = {
  is_past_year: boolean;
  is_release_past_year: boolean;
};

export function sceneStatsPodiumIncludesScene(
  scene: SceneStatsPodiumEligibilityScene,
  metric: string
) {
  switch (metric) {
    case "rating100_past_year":
      return scene.is_past_year;
    case "performer_count_past_year":
    case "facial_count_past_year":
      return scene.is_release_past_year;
    default:
      return true;
  }
}
