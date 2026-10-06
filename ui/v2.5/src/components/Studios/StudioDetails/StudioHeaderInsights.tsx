import React from "react";
import { faFilm, faUser } from "@fortawesome/free-solid-svg-icons";
import { ActivityStatsCharts } from "src/components/Shared/ActivityStatsCharts_custom";
import { Icon } from "src/components/Shared/Icon";
import * as GQL from "src/core/generated-graphql";
import {
  StudioRatingAdvisorSection,
  studioRatingAdvisorSectionDefinitions,
} from "./StudioRatingAdvisorStats";
import {
  formatStudioHeaderRatingCustom,
  getStudioHeaderRatingPanelsCustom,
} from "./studioHeaderInsights_custom";

// CUSTOM: Activity Type boxes and Rating Advisor averages in the studio
// header. Scene rubrics share a blue panel; the vato strip has a gold edge.
// Quality lives in the Scene Stats tab.
interface IProps {
  studio: GQL.StudioDetailDataFragment;
  includeChildStudios: boolean;
}

export const StudioHeaderInsights: React.FC<IProps> = ({
  studio,
  includeChildStudios,
}) => {
  const activity = includeChildStudios
    ? studio.studio_activity_stats_all
    : studio.studio_activity_stats;

  const { data } = GQL.useFindStudioRatingAdvisorStatsQuery({
    variables: { id: studio.id, depth: includeChildStudios ? -1 : 0 },
  });
  const stats = data?.findStudio?.studio_rating_advisor_stats;
  const { sceneKeys, showVatos } = getStudioHeaderRatingPanelsCustom(stats);
  const definition = (key: string) =>
    studioRatingAdvisorSectionDefinitions.find((d) => d.key === key)!;

  const hasActivity = !!activity && activity.total_seconds > 0;
  const hasRatings = sceneKeys.length > 0 || showVatos;
  if (!hasActivity && !hasRatings) return null;

  return (
    <div className="studio-header-insights">
      {hasActivity && (
        <ActivityStatsCharts
          className="studio-header-activity"
          only="activity"
          stats={activity}
        />
      )}
      {stats && hasRatings && (
        <div className="studio-header-ratings">
          {sceneKeys.length > 0 && (
            <section
              aria-label="Scene rating averages"
              className="rating-panel rating-panel--scenes"
            >
              <h4 className="rating-panel__title">
                <Icon icon={faFilm} />
                Scene averages
                <strong title="Overall scene rating">
                  {formatStudioHeaderRatingCustom(
                    stats.overall_scene_average_rating100
                  )}
                  /100
                </strong>
              </h4>
              <div className="rating-panel__sections">
                {sceneKeys.map((key) => (
                  <StudioRatingAdvisorSection
                    definition={definition(key)}
                    key={key}
                    stats={stats[key]}
                  />
                ))}
              </div>
            </section>
          )}
          {showVatos && (
            <StudioRatingAdvisorSection
              className="rating-panel rating-panel--vato"
              definition={definition("performers")}
              stats={stats.performers}
              title={
                <>
                  <Icon icon={faUser} />
                  Vato averages
                </>
              }
            />
          )}
        </div>
      )}
    </div>
  );
};
