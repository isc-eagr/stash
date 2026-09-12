import { SceneRatingCriteriaCriterionOption } from "src/models/list-filter/criteria/rating-criteria_custom";
import {
  GROUP_SCENE_RATING_KEYS_CUSTOM,
  type SceneRatingModeCustom,
} from "../Shared/groupSceneRating_custom";
import { SOLO_SCENE_RATING_KEYS_CUSTOM } from "../Shared/soloSceneRating_custom";
import type { IPlaygroundMetric } from "./playgroundData_custom";

export function playgroundMetrics(
  mode: SceneRatingModeCustom
): IPlaygroundMetric[] {
  const keys: readonly string[] =
    mode === "group"
      ? Object.values(GROUP_SCENE_RATING_KEYS_CUSTOM.criteria)
      : mode === "solo"
      ? Object.values(SOLO_SCENE_RATING_KEYS_CUSTOM)
      : [
          "topAttractiveness",
          "bottomAttractiveness",
          "chemistry",
          "payoff",
          "standout",
        ];
  return [
    ...SceneRatingCriteriaCriterionOption.criteria
      .filter((criterion) => keys.includes(criterion.key))
      .map((criterion) => ({
        ...criterion,
        label:
          criterion.key === "chemistry"
            ? "Energy / Sex Quality"
            : criterion.label.replace(/^(Standard|Solo|Group) /, ""),
        max: Math.max(...criterion.choices.map((choice) => choice.value)),
      })),
    { key: "rating100", label: "Scene Overall Rating", max: 100 },
  ];
}

export function playgroundAdjustments(mode: SceneRatingModeCustom) {
  const bonuses =
    mode === "solo"
      ? ["orgasmBonus", "feetBonus", "theme", "goatElement"]
      : mode === "group"
      ? [
          "groupBottomAttractiveness",
          "groupOralOnly",
          "theme",
          "godTierOrgasm",
          "goatElement",
        ]
      : ["theme", "oralOnly", "godTierOrgasm", "goatElement", "unlikelyTop"];
  return [
    ...SceneRatingCriteriaCriterionOption.bonuses
      .filter((bonus) => bonuses.includes(bonus.key))
      .map((bonus) => ({ value: `bonus:${bonus.key}`, label: bonus.label })),
    ...SceneRatingCriteriaCriterionOption.penalties.map((penalty) => ({
      value: `penalty:${penalty.key}`,
      label: penalty.label,
    })),
  ];
}

export const playgroundMetallicOptions = [
  { value: "royal_sapphire", label: "Royal Sapphire" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "bronze", label: "Bronze" },
  { value: "none", label: "None" },
  { value: "unrated", label: "Unrated" },
];

export const playgroundFacialOptions = [
  { value: "any", label: "Has facial (any)" },
  { value: "regular", label: "Facial, no really hot facial" },
  { value: "rh", label: "Really hot facial" },
  { value: "no", label: "No facial" },
];

export const playgroundSceneTypeOptions = [
  { value: "solo", label: "Solo" },
  { value: "oral", label: "Oral" },
  { value: "sex", label: "Sex" },
];
