import React from "react";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { RatingAdvisorStatsContent } from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import { useVatoStatsRatingAdvisorQuery } from "src/core/generated-graphql";

interface IProps {
  studioScope?: {
    id: string;
    name: string;
    depth: number;
  };
}

export const VatoStatsRatingAdvisor: React.FC<IProps> = ({ studioScope }) => {
  const { data, error, loading } = useVatoStatsRatingAdvisorQuery({
    variables: {
      depth: studioScope?.depth,
      studioId: studioScope?.id,
    },
  });

  if (loading && !data) {
    return <LoadingIndicator message="Loading vato ratings…" inline />;
  }
  if (error) {
    return <ErrorMessage error={error.message} />;
  }
  if (!data) return null;

  return (
    <RatingAdvisorStatsContent
      description={
        studioScope
          ? `Performer averages for vatos with ${studioScope.name} scenes, using only vatos where each criterion is set.`
          : "Global performer averages using only vatos where each criterion is set."
      }
      sectionKeys={["performers"]}
      showOverallSceneAverage={false}
      stats={data.globalRatingAdvisorStats}
      title={
        studioScope
          ? `${studioScope.name} Vato Rating Criteria`
          : "Global Vato Rating Criteria"
      }
    />
  );
};
