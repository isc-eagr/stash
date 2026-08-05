import React from "react";
import { ActivityStatsCharts } from "src/components/Shared/ActivityStatsCharts_custom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { RatingAdvisorStatsContent } from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import { useSceneStatsInsightsQuery } from "src/core/generated-graphql";

interface IProps {
  studioId?: string;
  depth?: number;
  studioName?: string;
}

export const SceneStatsInsights: React.FC<IProps> = ({
  studioId,
  depth,
  studioName,
}) => {
  const { data, error, loading } = useSceneStatsInsightsQuery({
    variables: { studioId, depth },
  });

  const scopeLabel = studioName ? `${studioName} scenes` : "every scene";
  const ratingDescription = studioName
    ? `Averages for ${studioName}, using only scenes where each criterion is set.`
    : "Global averages for each scene rubric, using only scenes where that criterion is set.";

  if (loading && !data) {
    return <LoadingIndicator message="Loading scene insights…" />;
  }
  if (error) {
    return <ErrorMessage error={error.message} />;
  }
  if (!data) return null;

  return (
    <div className="scenestats-insights">
      <section aria-labelledby="scenestats-activity-heading">
        <header className="scenestats-section-heading">
          <h2 id="scenestats-activity-heading">Activity &amp; Quality</h2>
          <p>
            Duration percentages across {scopeLabel} with configured activity
            markers.
          </p>
        </header>
        <ActivityStatsCharts
          className="scenestats-activity-charts"
          stats={data.sceneStatsActivity}
        />
      </section>
      <RatingAdvisorStatsContent
        description={ratingDescription}
        sectionKeys={["solo_scenes", "sex_scenes", "group_scenes"]}
        stats={data.globalRatingAdvisorStats}
        title={
          studioName
            ? `${studioName} Scene Rating Criteria`
            : "Global Scene Rating Criteria"
        }
      />
    </div>
  );
};
