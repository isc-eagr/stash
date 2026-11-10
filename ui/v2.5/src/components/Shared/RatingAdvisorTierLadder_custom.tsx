import React from "react";
import {
  getRatingAdvisorTierLadderCustom,
  type IRatingAdvisorTierThresholdsCustom,
  type RatingAdvisorTierCustom,
} from "./ratingAdvisorScales_custom";

interface IRatingAdvisorTierLadderProps {
  rating100: number;
  thresholds: IRatingAdvisorTierThresholdsCustom;
  previewRating100?: number;
  previewTier?: RatingAdvisorTierCustom;
}

export const RatingAdvisorTierLadderCustom: React.FC<
  IRatingAdvisorTierLadderProps
> = ({ rating100, thresholds, previewRating100, previewTier }) => {
  const ladder = getRatingAdvisorTierLadderCustom(thresholds);
  const markerPercent = Math.max(
    0,
    Math.min(100, previewRating100 ?? rating100)
  );

  return (
    <div aria-hidden="true" className="rating-advisor-ladder">
      <div className="rating-advisor-ladder-track">
        {ladder.map((zone) => (
          <span
            data-preview={
              previewRating100 !== undefined && previewTier === zone.tier
            }
            data-reached={rating100 >= zone.start}
            key={zone.tier}
            style={{
              backgroundColor: "currentColor",
              color: `var(--semantic-${
                zone.tier === "plain" ? "no-tier" : zone.tier
              })`,
              left: `${zone.start}%`,
              width: `${zone.width}%`,
            }}
          />
        ))}
        <i style={{ left: `${markerPercent}%` }} />
      </div>
      <div className="rating-advisor-ladder-ticks">
        {ladder.slice(1).map((zone) => (
          <span key={zone.tier} style={{ left: `${zone.start}%` }}>
            {zone.start}
          </span>
        ))}
      </div>
    </div>
  );
};
