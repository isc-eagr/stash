import React from "react";
import { SceneStatsDashboard } from "src/components/SceneStats/SceneStats"; // CUSTOM
import * as GQL from "src/core/generated-graphql";

interface IProps {
  studio: GQL.StudioDetailDataFragment;
  showChildStudioContent: boolean;
  year?: string; // CUSTOM
  month?: string; // CUSTOM
}

export const StudioStatsPanel: React.FC<IProps> = ({
  studio,
  showChildStudioContent,
  year,
  month,
}) => (
  <div className="studio-stats-panel mt-3">
    <SceneStatsDashboard
      navigationBase={`/studios/${studio.id}/stats`}
      selectedMonth={month}
      selectedYear={year}
      studioScope={{
        id: studio.id,
        name: studio.name ?? `Studio ${studio.id}`,
        depth: showChildStudioContent ? -1 : 0,
      }}
    />
  </div>
);
