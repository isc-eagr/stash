import React from "react";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { RatingAdvisorStatsContent } from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import { useVatoStatsRatingAdvisorQuery } from "src/core/generated-graphql";

export const VatoStatsRatingAdvisor: React.FC = () => {
  const { data, error, loading } = useVatoStatsRatingAdvisorQuery();

  if (loading && !data) {
    return <LoadingIndicator message="Loading global vato ratings…" inline />;
  }
  if (error) {
    return <ErrorMessage error={error.message} />;
  }
  if (!data) return null;

  return (
    <RatingAdvisorStatsContent
      description="Global performer averages using only vatos where each criterion is set."
      sectionKeys={["performers"]}
      showOverallSceneAverage={false}
      stats={data.globalRatingAdvisorStats}
      title="Global Vato Rating Criteria"
    />
  );
};
