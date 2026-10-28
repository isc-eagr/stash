import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { formatSceneOOrdinalLabelCustom } from "src/components/OStats/oStatsEventPresentation_custom";
import { getAppLocaleCustom } from "src/utils/appLocale_custom";
import { HoverPopover } from "./HoverPopover";
import {
  getRatingAdvisorOEventsCustom,
  getRatingAdvisorOTrackCustom,
  type RatingAdvisorEntityCustom,
} from "./ratingAdvisorScales_custom";

interface IOTrackEvent {
  id: string;
  o_date: string;
  release_id?: string | null;
  screenshot_path?: string | null;
  scene: {
    id: string;
    title?: string | null;
    paths: { screenshot?: string | null };
  };
}

const OTrackEventsQuery = gql`
  query RatingAdvisorOTrackEvents(
    $id: ID!
    $isScene: Boolean!
    $isPerformer: Boolean!
  ) {
    sceneEvents: sceneOEventsByScene(sceneID: $id) @include(if: $isScene) {
      ...RatingAdvisorOTrackEvent
    }
    performerEvents: sceneOEventsByPerformer(performerID: $id)
      @include(if: $isPerformer) {
      ...RatingAdvisorOTrackEvent
    }
  }

  fragment RatingAdvisorOTrackEvent on SceneOEvent {
    id
    o_date
    release_id
    screenshot_path
    scene {
      id
      title
      paths {
        screenshot
      }
    }
  }
`;

function formatODate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(getAppLocaleCustom(), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface IRatingAdvisorOTrackProps {
  entityType: RatingAdvisorEntityCustom;
  entityId: string;
  count: number;
}

// One dot per O, grouped by bonus tier; recorded O's fill in, and hovering
// one shows its O date and screenshot.
export const RatingAdvisorOTrackCustom: React.FC<IRatingAdvisorOTrackProps> = ({
  entityType,
  entityId,
  count,
}) => {
  const tiers = getRatingAdvisorOTrackCustom(entityType, count);
  const { data } = useQuery<{
    sceneEvents?: IOTrackEvent[];
    performerEvents?: IOTrackEvent[];
  }>(OTrackEventsQuery, {
    variables: {
      id: entityId,
      isScene: entityType === "scene",
      isPerformer: entityType === "performer",
    },
    skip: count === 0,
    fetchPolicy: "cache-and-network",
  });
  const eventsByO = useMemo(
    () =>
      getRatingAdvisorOEventsCustom(
        entityType,
        data?.sceneEvents ?? data?.performerEvents ?? []
      ),
    [data, entityType]
  );

  const renderTier = (tier: (typeof tiers)[number]) => (
    <div
      className="rating-advisor-o-tier"
      data-bonus={Math.min(tier.bonus, 3)}
      data-reached={tier.bonus > 0 && count >= tier.start}
      key={tier.start}
    >
      <div className="rating-advisor-o-dots">
        {tier.dots.map((dot) => {
          const marker = (
            <span
              data-earns={dot.earns > 0}
              data-next={dot.number === count + 1}
              data-recorded={dot.recorded}
              key={dot.number}
            />
          );
          const event = dot.recorded ? eventsByO.get(dot.number) : undefined;
          if (!event) return marker;
          // A vato's O without a screenshot falls back to its scene's image.
          const image =
            event.screenshot_path ??
            (entityType === "performer" ? event.scene.paths.screenshot : null);

          return (
            <HoverPopover
              className="rating-advisor-o-hover"
              content={
                <div className="rating-advisor-o-popover">
                  {image && <img alt="" src={image} />}
                  <strong>
                    {formatSceneOOrdinalLabelCustom(dot.number)} ·{" "}
                    {dot.earns ? `+${dot.earns}` : "no points"}
                  </strong>
                  <span>{formatODate(event.o_date)}</span>
                  {entityType === "performer" && event.scene.title && (
                    <span>{event.scene.title}</span>
                  )}
                </div>
              }
              enterDelay={80}
              key={dot.number}
              leaveDelay={0}
              popoverClassName="rating-advisor-o-popover-shell"
            >
              {marker}
            </HoverPopover>
          );
        })}
      </div>
      <span aria-hidden="true" className="rating-advisor-o-caption">
        {tier.bonus ? `+${tier.bonus}` : "0"}
      </span>
    </div>
  );

  return (
    <div className="rating-advisor-o-track">
      <div className="rating-advisor-o-row">
        {tiers.filter((tier) => tier.bonus <= 3).map(renderTier)}
      </div>
      {tiers
        .filter((tier) => tier.bonus > 3)
        .map((tier) => (
          <div className="rating-advisor-o-row" key={tier.start}>
            {renderTier(tier)}
          </div>
        ))}
    </div>
  );
};
