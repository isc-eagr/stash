import React from "react";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import {
  RatingAdvisorStatsContent,
  StudioRatingAdvisorSection,
  studioRatingAdvisorSectionDefinitions,
} from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import type { StudioRatingAdvisorSectionKey } from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import * as GQL from "src/core/generated-graphql";

type PerformerSceneRatingAdvisorSectionKey = Exclude<
  StudioRatingAdvisorSectionKey,
  "performers"
>;

export const performerSceneRatingAdvisorSectionKeys: PerformerSceneRatingAdvisorSectionKey[] =
  ["solo_scenes", "sex_scenes", "group_scenes"];

type PerformerRatingAdvisorStatsData =
  GQL.PerformerRatingAdvisorStatsQuery["performerRatingAdvisorStats"];

export function getVisiblePerformerSceneRatingAdvisorDefinitions(
  stats?: PerformerRatingAdvisorStatsData
) {
  return studioRatingAdvisorSectionDefinitions.filter((definition) => {
    const key = definition.key as PerformerSceneRatingAdvisorSectionKey;
    return (
      performerSceneRatingAdvisorSectionKeys.includes(key) &&
      !!stats &&
      stats[key].entity_count > 0
    );
  });
}

export const PerformerSceneRatingAdvisorSections: React.FC<{
  stats: PerformerRatingAdvisorStatsData;
}> = ({ stats }) => {
  const definitions = getVisiblePerformerSceneRatingAdvisorDefinitions(stats);
  if (definitions.length === 0) return null;

  return (
    <div
      className="performer-scene-rating-advisor-grid"
      data-section-count={definitions.length}
    >
      {definitions.map((definition) => (
        <StudioRatingAdvisorSection
          definition={definition}
          key={definition.key}
          stats={stats[definition.key as PerformerSceneRatingAdvisorSectionKey]}
        />
      ))}
    </div>
  );
};

export const PerformerSceneRatingAdvisorStats: React.FC<{
  active: boolean;
  performerId: string;
}> = ({ active, performerId }) => {
  const { data, loading, error } = GQL.usePerformerRatingAdvisorStatsQuery({
    variables: { performerId },
    skip: !active,
  });

  if (loading && !data) {
    return (
      <LoadingIndicator message="Loading scene rating averages…" inline small />
    );
  }
  if (error) {
    return <ErrorMessage error={error.message} />;
  }

  const stats = data?.performerRatingAdvisorStats;
  if (!stats) return null;
  if (getVisiblePerformerSceneRatingAdvisorDefinitions(stats).length === 0) {
    return null;
  }

  return (
    <RatingAdvisorStatsContent
      description="Each bar averages only this vato's scenes where that criterion is set."
      hideEmptySceneSections
      sectionKeys={performerSceneRatingAdvisorSectionKeys}
      stats={stats}
      title="Scene Rating Advisor Averages"
    />
  );
};
