import React from "react";
import { ActivityStatsCharts } from "src/components/Shared/ActivityStatsCharts_custom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { RatingAdvisorStatsContent } from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import { useSceneStatsInsightsQuery } from "src/core/generated-graphql";

export const SceneStatsInsights: React.FC = () => {
  const { data, error, loading } = useSceneStatsInsightsQuery();

  if (loading && !data) {
    return <LoadingIndicator message="Loading global scene insights…" />;
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
            Duration percentages across every scene with configured activity
            markers.
          </p>
        </header>
        <ActivityStatsCharts
          className="scenestats-activity-charts"
          stats={data.sceneStatsActivity}
        />
      </section>
      <RatingAdvisorStatsContent
        description="Global averages for each scene rubric, using only scenes where that criterion is set."
        sectionKeys={["solo_scenes", "sex_scenes", "group_scenes"]}
        stats={data.globalRatingAdvisorStats}
        title="Global Scene Rating Criteria"
      />
    </div>
  );
};
