import React from "react";
import { ActivityStatsCharts } from "src/components/Shared/ActivityStatsCharts_custom"; // CUSTOM
import * as GQL from "src/core/generated-graphql";
import { StudioRatingAdvisorStats } from "./StudioRatingAdvisorStats"; // CUSTOM

interface IProps {
  studio: GQL.StudioDetailDataFragment;
  showChildStudioContent: boolean;
}

export const StudioStatsPanel: React.FC<IProps> = ({
  studio,
  showChildStudioContent,
}) => {
  const stats = showChildStudioContent
    ? studio.studio_activity_stats_all
    : studio.studio_activity_stats;

  return (
    <div className="studio-stats-panel mt-3">
      <ActivityStatsCharts stats={stats} />
      <StudioRatingAdvisorStats
        depth={showChildStudioContent ? -1 : 0}
        studioId={studio.id}
      />
    </div>
  );
};
