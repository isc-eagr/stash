import React from "react";
import {
  FacialStatsDashboard,
  NutStatsDashboard,
} from "src/components/MarkerEventStats/MarkerEventStats";
import { getVatoStatsStudioScope } from "src/components/VatoStats/vatoStatsStudioScope_custom";
import * as GQL from "src/core/generated-graphql";

// CUSTOM: Nut Stats and Facial Stats scoped to one studio.
interface IProps {
  studio: GQL.StudioDetailDataFragment;
  showChildStudioContent: boolean;
  kind: "nut" | "facial";
}

export const StudioMarkerEventStatsPanel: React.FC<IProps> = ({
  studio,
  showChildStudioContent,
  kind,
}) => {
  const studioScope = getVatoStatsStudioScope(studio, showChildStudioContent);
  return (
    <div className="studio-marker-event-stats-panel mt-3">
      {kind === "nut" ? (
        <NutStatsDashboard studioScope={studioScope} />
      ) : (
        <FacialStatsDashboard studioScope={studioScope} />
      )}
    </div>
  );
};
