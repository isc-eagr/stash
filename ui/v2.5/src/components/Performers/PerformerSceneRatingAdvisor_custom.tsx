import React from "react";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { Icon } from "src/components/Shared/Icon";
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

function formatSceneAverageRating(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export const PerformerSceneAverageRating: React.FC<{
  performerId: string;
}> = ({ performerId }) => {
  const { data, error } = GQL.usePerformerRatingAdvisorStatsQuery({
    variables: { performerId },
  });
  const average =
    data?.performerRatingAdvisorStats.overall_scene_average_rating100;
  if (error || average === null || average === undefined) return null;

  const formattedAverage = formatSceneAverageRating(average);
  const tooltip = "Scene Average Rating";

  return (
    <OverlayTrigger
      placement="top"
      overlay={
        <Tooltip id={`performer-${performerId}-scene-average-rating-tooltip`}>
          {tooltip}
        </Tooltip>
      }
    >
      <span
        aria-label={`${tooltip}: ${formattedAverage} out of 100.`}
        className="performer-scene-average-rating"
      >
        <Icon icon={faStar} />
        <span className="performer-scene-average-rating-value">
          {formattedAverage}
        </span>
        <span className="performer-scene-average-rating-label">Scene avg</span>
      </span>
    </OverlayTrigger>
  );
};

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
