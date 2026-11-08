// CUSTOM: group scene rating rubric constants and mode selection
export type SceneRatingModeCustom = "default" | "solo" | "group";

export const GROUP_SCENE_MIN_PERFORMERS_CUSTOM = 4;

export const GROUP_SCENE_WEIGHTS_CUSTOM = {
  topAttractiveness: 0.6,
  energyCoordination: 0.6,
  payoff: 0.5,
  usability: 0.5,
} as const;

export const GROUP_SCENE_BONUSES_CUSTOM = {
  bottomAttractiveness: 0.5,
  oralOnly: 2,
} as const;

export const GROUP_SCENE_ENERGY_COORDINATION_CHOICES_CUSTOM = [
  {
    label: "Disconnected",
    description:
      "Pura hueva. Messy flow, and most of these vatos are basically muebles.",
  },
  {
    label: "Uneven",
    description: "Ahí van. Some action lands, but it's all over the place.",
  },
  {
    label: "Good",
    description: "Normalito. Solid involvement, decent flow.",
  },
  {
    label: "Strong",
    description: "Most vatos get in on it. Está rico.",
  },
  {
    label: "Excellent",
    description:
      "Every verga gets used right and the heat stays up the whole time.",
  },
  {
    label: "Perfect execution",
    description: "Pinche perfecto. Every vato matters, de principio a fin.",
  },
];

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

const SCENE_RATING_MODE_LABELS_CUSTOM: Record<SceneRatingModeCustom, string> = {
  default: "Standard",
  solo: "Solo",
  group: "Group",
};

// Saving a cast change that switches rubrics clears the Rating Advisor.
export function getSceneRatingModeChangeCustom(
  previousPerformerCount: number,
  nextPerformerCount: number,
  isSolo: boolean
) {
  const from = getSceneRatingModeCustom(previousPerformerCount, isSolo);
  const to = getSceneRatingModeCustom(nextPerformerCount, isSolo);
  return from === to
    ? undefined
    : {
        from: SCENE_RATING_MODE_LABELS_CUSTOM[from],
        to: SCENE_RATING_MODE_LABELS_CUSTOM[to],
      };
}
