import React from "react";
import { OStatsDashboard } from "src/components/OStats/OStats";
import { getOStatsStudioScope } from "src/components/OStats/oStatsStudioScope_custom";
import * as GQL from "src/core/generated-graphql";

interface IProps {
  studio: GQL.StudioDetailDataFragment;
  showChildStudioContent: boolean;
}

export const StudioOStatsPanel: React.FC<IProps> = ({
  studio,
  showChildStudioContent,
}) => (
  <div className="studio-o-stats-panel mt-3">
    <OStatsDashboard
      studioScope={getOStatsStudioScope(studio, showChildStudioContent)}
    />
  </div>
);
