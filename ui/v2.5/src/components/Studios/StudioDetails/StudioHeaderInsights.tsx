import React from "react";
import { ActivityStatsCharts } from "src/components/Shared/ActivityStatsCharts_custom";
import * as GQL from "src/core/generated-graphql";
import { getStudioHeaderRatingTilesCustom } from "./studioHeaderInsights_custom";

// CUSTOM: Activity & Quality boxes and rating averages in the studio header.
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
  const ratingTiles = getStudioHeaderRatingTilesCustom(
    data?.findStudio?.studio_rating_advisor_stats
  );

  const hasActivity = !!activity && activity.total_seconds > 0;
  if (!hasActivity && ratingTiles.length === 0) return null;

  return (
    <div className="studio-header-insights">
      {hasActivity && (
        <ActivityStatsCharts
          className="studio-header-activity"
          stats={activity}
        />
      )}
      {ratingTiles.length > 0 && (
        <div className="studio-header-ratings">
          {ratingTiles.map((tile) => (
            <div
              className={
                "studio-header-rating" +
                (tile.highlight ? " studio-header-rating--main" : "")
              }
              key={tile.key}
              title={
                tile.count === undefined
                  ? undefined
                  : `${tile.count} rated ${tile.noun}`
              }
            >
              <span className="studio-header-rating-label">{tile.label}</span>
              <strong>{tile.value}</strong>
              {!!tile.count && (
                <span className="studio-header-rating-count">{tile.count}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
