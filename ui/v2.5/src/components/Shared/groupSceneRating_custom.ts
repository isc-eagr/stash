// CUSTOM: group scene rating rubric constants and mode selection
export type SceneRatingModeCustom = "default" | "solo" | "group";

export const GROUP_SCENE_MIN_PERFORMERS_CUSTOM = 4;

export const GROUP_SCENE_WEIGHTS_CUSTOM = {
  topAttractiveness: 0.4,
  energyCoordination: 0.8,
  payoff: 0.5,
  usability: 0.5,
} as const;

export const GROUP_SCENE_BONUSES_CUSTOM = {
  bottomAttractiveness: 1,
  oralOnly: 2,
} as const;

export const GROUP_SCENE_RATING_KEYS_CUSTOM = {
  criteria: {
    topAttractiveness: "groupTopAttractiveness",
    energyCoordination: "groupEnergy",
    payoff: "groupPayoff",
    usability: "groupUsability",
  },
  bonuses: {
    bottomAttractiveness: "groupBottomAttractiveness",
    oralOnly: "groupOralOnly",
  },
} as const;

export function getSceneRatingModeCustom(
  performerCount: number,
  isSolo: boolean
): SceneRatingModeCustom {
  if (performerCount >= GROUP_SCENE_MIN_PERFORMERS_CUSTOM) {
    return "group";
  }

  return performerCount === 1 || isSolo ? "solo" : "default";
}

export function getGroupSceneBaseMaximumCustom() {
  return (
    5 * GROUP_SCENE_WEIGHTS_CUSTOM.topAttractiveness +
    5 * GROUP_SCENE_WEIGHTS_CUSTOM.energyCoordination +
    4 * GROUP_SCENE_WEIGHTS_CUSTOM.payoff +
    4 * GROUP_SCENE_WEIGHTS_CUSTOM.usability
  );
}
