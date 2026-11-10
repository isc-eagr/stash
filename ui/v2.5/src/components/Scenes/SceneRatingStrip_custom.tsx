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
// report on the right, on scene cards and scene details. Cards show the
// orgasm report beside the Nut criterion instead.
export const SceneRatingStrip: React.FC<{
  scene: SceneCardInsightScene &
    Pick<GQL.SlimSceneDataFragment, "o_counter" | "rating_scores">;
  sceneRatingMode?: SceneRatingModeCustom;
  className?: string;
  nutReportInline?: boolean;
}> = ({ scene, sceneRatingMode, className, nutReportInline = false }) => {
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
  // Crossed-out sperm icon only once a scene has markers to judge by.
  const showOrgasmReport =
    events.length > 0 ||
    (!!roleTagIds?.orgasmTagId && scene.scene_markers.length > 0);

  const orgasmReport = showOrgasmReport ? (
    <SceneCardOrgasmReport events={events} />
  ) : undefined;
  const trailingReport = nutReportInline ? undefined : orgasmReport;

  return (
    <RatingCriteriaStrip
      className={className}
      criterionAddon={
        nutReportInline && orgasmReport
          ? { key: "payoff", node: orgasmReport }
          : undefined
      }
      entityId={scene.id}
      entityType="scene"
      oCount={scene.o_counter}
      ratingScores={scene.rating_scores}
      sceneRatingMode={sceneRatingMode}
      trailing={
        trailingReport || goat.moments.length > 0 ? (
          <span className="scene-rating-strip__events">
            <SceneCardGoatMoments {...goat} />
            {trailingReport}
          </span>
        ) : undefined
      }
    />
  );
};
