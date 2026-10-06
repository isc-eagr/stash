import React, { useMemo } from "react";
import type * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import type { SceneRatingModeCustom } from "../Shared/groupSceneRating_custom";
import { RatingCriteriaStrip } from "../Shared/RatingCriteriaStrip_custom";
import {
  getSceneGoatMomentsCustom,
  getSceneOrgasmFacialEvents,
} from "./sceneCardInsightsData_custom";
import type { SceneCardInsightScene } from "./sceneCardInsightTypes_custom";
import { SceneCardGoatMoments } from "./SceneCardGoatMoments_custom";
import { SceneCardOrgasmReport } from "./SceneCardOrgasmReport_custom";

// CUSTOM: a scene's rating criteria strip with its GOAT moments and orgasm
// report on the right, on scene cards and scene details.
export const SceneRatingStrip: React.FC<{
  scene: SceneCardInsightScene &
    Pick<GQL.SlimSceneDataFragment, "o_counter" | "rating_scores">;
  sceneRatingMode?: SceneRatingModeCustom;
  className?: string;
}> = ({ scene, sceneRatingMode, className }) => {
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds;
  const events = useMemo(
    () => getSceneOrgasmFacialEvents(scene, roleTagIds),
    [roleTagIds, scene]
  );
  const goat = useMemo(
    () => getSceneGoatMomentsCustom(scene, roleTagIds),
    [roleTagIds, scene]
  );
  // Crossed-out drops only once a scene has markers to judge by.
  const showOrgasmReport =
    events.length > 0 ||
    (!!roleTagIds?.orgasmTagId && scene.scene_markers.length > 0);

  return (
    <RatingCriteriaStrip
      className={className}
      entityId={scene.id}
      entityType="scene"
      oCount={scene.o_counter}
      ratingScores={scene.rating_scores}
      sceneRatingMode={sceneRatingMode}
      trailing={
        showOrgasmReport || goat.moments.length > 0 ? (
          <span className="scene-rating-strip__events">
            <SceneCardGoatMoments {...goat} />
            {showOrgasmReport && <SceneCardOrgasmReport events={events} />}
          </span>
        ) : undefined
      }
    />
  );
};
