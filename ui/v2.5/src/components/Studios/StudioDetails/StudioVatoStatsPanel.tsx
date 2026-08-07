import React from "react";
import { VatoStatsDashboard } from "src/components/VatoStats/VatoStats";
import { getVatoStatsStudioScope } from "src/components/VatoStats/vatoStatsStudioScope_custom";
import * as GQL from "src/core/generated-graphql";

interface IProps {
  studio: GQL.StudioDetailDataFragment;
  showChildStudioContent: boolean;
}

export const StudioVatoStatsPanel: React.FC<IProps> = ({
  studio,
  showChildStudioContent,
}) => (
  <div className="studio-vato-stats-panel mt-3">
    <VatoStatsDashboard
      studioScope={getVatoStatsStudioScope(studio, showChildStudioContent)}
    />
  </div>
);
