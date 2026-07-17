// CUSTOM: solo scene rating rubric constants

export const SOLO_SCENE_WEIGHTS_CUSTOM = {
  attractiveness: 1,
  performance: 0.75,
  usability: 0.5,
} as const;

export const SOLO_SCENE_RATING_KEYS_CUSTOM = {
  attractiveness: "soloPerformerAppeal",
  performance: "soloPerformance",
  usability: "soloUsability",
} as const;

export function getSoloSceneBaseMaximumCustom() {
  return (
    5 * SOLO_SCENE_WEIGHTS_CUSTOM.attractiveness +
    4 * SOLO_SCENE_WEIGHTS_CUSTOM.performance +
    4 * SOLO_SCENE_WEIGHTS_CUSTOM.usability
  );
}
