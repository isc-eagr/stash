import React from "react";
import * as GQL from "src/core/generated-graphql";
import { SceneStatsActivityMatrix } from "src/components/SceneStats/SceneStatsActivityMatrix_custom"; // CUSTOM
import { PerformerSceneRatingAdvisorStats } from "../PerformerSceneRatingAdvisor_custom"; // CUSTOM
import { PerformerVersatilityByTime } from "./PerformerVersatility_custom"; // CUSTOM

interface IProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

export const PerformerStatsPanel: React.FC<IProps> = ({
  active,
  performer,
}) => {
  const stats = performer.activity_stats;

  return (
    <div className="performer-stats-panel mt-3">
      {/* CUSTOM: top vs bottom time replaces the activity/role time bars. */}
      <PerformerVersatilityByTime
        className="performer-versatility--detail"
        oralBottomSeconds={stats.oral_bottom_seconds}
        oralTopSeconds={stats.oral_top_seconds}
        sexBottomSeconds={stats.sex_bottom_seconds}
        sexTopSeconds={stats.sex_top_seconds}
      />
      {/* CUSTOM */}
      <PerformerSceneRatingAdvisorStats
        active={active}
        performerId={performer.id}
      />
      {/* CUSTOM */}
      <SceneStatsActivityMatrix
        active={active}
        performerId={performer.id}
        performerName={performer.name}
      />
    </div>
  );
};
