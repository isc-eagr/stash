import React from "react";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { RatingAdvisorStatsContent } from "src/components/Studios/StudioDetails/StudioRatingAdvisorStats";
import { useVatoStatsRatingAdvisorQuery } from "src/core/generated-graphql";
import type {
  StatsDateRangeInput,
  StatsCohortInput,
} from "src/core/generated-graphql";

interface IProps {
  studioScope?: {
    id: string;
    name: string;
    depth: number;
  };
  dateRange?: StatsDateRangeInput | null;
  cohort?: StatsCohortInput;
}

export const VatoStatsRatingAdvisor: React.FC<IProps> = ({
  studioScope,
  dateRange,
  cohort,
}) => {
  const { data, error, loading } = useVatoStatsRatingAdvisorQuery({
    variables: {
      dateRange,
      depth: studioScope?.depth,
      studioId: studioScope?.id,
      cohort,
    },
  });

  if (loading) {
    return <LoadingIndicator message="Pulling up the vato ratings…" inline />;
  }
  if (error) {
    return <ErrorMessage error={error.message} />;
  }
  if (!data) return null;

  return (
    <RatingAdvisorStatsContent
      description={
        studioScope
          ? `Averages for these ${studioScope.name} vatos, only counting vatos rated on each criterion.`
          : "Averages for these vatos, only counting vatos rated on each criterion."
      }
      sectionKeys={["performers"]}
      showOverallSceneAverage={false}
      stats={data.globalRatingAdvisorStats}
      title={
        studioScope
          ? `${studioScope.name} Vato Rating Criteria`
          : "Vato Rating Criteria"
      }
    />
  );
};
