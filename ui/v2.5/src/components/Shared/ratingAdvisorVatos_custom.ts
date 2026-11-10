import {
  getScenePerformerRoleSeconds,
  getSceneRoleActivitySeconds,
} from "../Scenes/scenePerformerRoleSeconds_custom";
import type {
  SceneActivityRoleTagIds,
  SceneActivityScene,
} from "../Scenes/sceneActivityMetricsData_custom";
import {
  GROUP_SCENE_RATING_KEYS_CUSTOM,
  type SceneRatingModeCustom,
} from "./groupSceneRating_custom";
import { SOLO_SCENE_RATING_KEYS_CUSTOM } from "./soloSceneRating_custom";

export interface IRatingAdvisorVatoCustom {
  id: string;
  name?: string | null;
  image_path?: string | null;
  // Share of the scene's sex (or oral) time spent in the criterion's role.
  percent?: number;
}

// Vato thumbnails per attractiveness criterion key.
export type RatingAdvisorCriterionVatosCustom = Record<
  string,
  IRatingAdvisorVatoCustom[]
>;

type RatingAdvisorVatosScene = Pick<SceneActivityScene, "files"> & {
  performers: ReadonlyArray<Omit<IRatingAdvisorVatoCustom, "percent">>;
  scene_markers: Array<
    SceneActivityScene["scene_markers"][number] & {
      top_performers: ReadonlyArray<{ id: string }>;
      bottom_performers: ReadonlyArray<{ id: string }>;
    }
  >;
};

// CUSTOM: solo scenes show their vato; sex scenes show the vatos who topped or
// bottomed in the sex, most time first. Oral only counts when there's no sex.
export function getRatingAdvisorCriterionVatosCustom(
  scene: RatingAdvisorVatosScene,
  roleTagIds: SceneActivityRoleTagIds,
  mode: SceneRatingModeCustom
): RatingAdvisorCriterionVatosCustom {
  const performers = scene.performers.map(({ id, name, image_path }) => ({
    id,
    name,
    image_path,
  }));
  if (mode === "solo") {
    return { [SOLO_SCENE_RATING_KEYS_CUSTOM.attractiveness]: performers };
  }

  const activitySeconds = getSceneRoleActivitySeconds(scene, roleTagIds);
  const category = activitySeconds.sex > 0 ? "sex" : "oral";
  const total = activitySeconds[category];
  if (total <= 0) return {};

  const roleSeconds = getScenePerformerRoleSeconds(scene, roleTagIds);
  const byRole = (role: "Top" | "Bottom") =>
    performers
      .map((performer, index) => ({
        performer,
        index,
        seconds:
          roleSeconds.get(performer.id)?.[`${category}${role}Seconds`] ?? 0,
      }))
      .filter(({ seconds }) => seconds > 0)
      .sort((a, b) => b.seconds - a.seconds || a.index - b.index)
      .map(({ performer, seconds }) => ({
        ...performer,
        percent: Math.round((seconds / total) * 100),
      }));

  if (mode === "group") {
    return {
      [GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.topAttractiveness]:
        byRole("Top"),
      [GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.bottomAttractiveness]:
        byRole("Bottom"),
    };
  }

  return {
    topAttractiveness: byRole("Top"),
    bottomAttractiveness: byRole("Bottom"),
  };
}
