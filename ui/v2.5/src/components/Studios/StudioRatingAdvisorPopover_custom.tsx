import React from "react";
import { HoverPopover, PopoverCard } from "src/components/Shared/HoverPopover";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import * as GQL from "src/core/generated-graphql";
import {
  StudioRatingAdvisorSection,
  studioRatingAdvisorSectionDefinitions,
} from "./StudioDetails/StudioRatingAdvisorStats";
import type { StudioRatingAdvisorSectionKey } from "./StudioDetails/StudioRatingAdvisorStats";

interface IProps {
  studioId: string;
  sections: StudioRatingAdvisorSectionKey[];
}

export const StudioRatingAdvisorPopover: React.FC<IProps> = ({
  studioId,
  sections,
  children,
}) => {
  const [loadStats, { data, loading, error }] =
    GQL.useFindStudioRatingAdvisorStatsLazyQuery();

  const stats = data?.findStudio?.studio_rating_advisor_stats;
  const definitions = studioRatingAdvisorSectionDefinitions.filter(
    (definition) =>
      sections.includes(definition.key) &&
      (!stats ||
        definition.key === "performers" ||
        stats[definition.key].entity_count > 0)
  );
  const layoutClass =
    definitions.length === 1
      ? "studio-rating-advisor-popover-single"
      : definitions.length === 2
      ? "studio-rating-advisor-popover-double"
      : "studio-rating-advisor-popover-scenes";

  const content = (
    <PopoverCard
      className={`studio-rating-advisor-popover-card ${layoutClass}`}
    >
      {loading && !stats && (
        <LoadingIndicator message="Loading rating averages…" inline small />
      )}
      {error && (
        <div className="studio-rating-advisor-popover-error">
          Could not load rating averages.
        </div>
      )}
      {stats &&
        definitions.map((definition) => (
          <StudioRatingAdvisorSection
            definition={definition}
            key={definition.key}
            stats={stats[definition.key]}
          />
        ))}
    </PopoverCard>
  );

  return (
    <HoverPopover
      className="studio-rating-advisor-popover-trigger"
      content={content}
      enterDelay={250}
      leaveDelay={250}
      onOpen={() => {
        if (!data && !loading) {
          void loadStats({ variables: { id: studioId, depth: 0 } });
        }
      }}
      placement="top"
      popoverClassName={`studio-rating-advisor-popover ${layoutClass}`}
    >
      {children}
    </HoverPopover>
  );
};
