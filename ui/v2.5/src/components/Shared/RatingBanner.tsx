import React from "react";
import { FormattedMessage } from "react-intl";

interface IProps {
  rating?: number | null;
  compact?: boolean;
}

export const RatingBanner: React.FC<IProps> = ({ rating, compact = false }) => {
  const classBucket = Math.min(20, Math.trunc((rating ?? 0) / 5));
  const isWideRating = (rating ?? 0) >= 100;

  return rating !== undefined && rating !== null ? (
    <div
      className={`rating-banner ${
        compact ? "rating-banner-compact" : ""
      } ${
        isWideRating ? "rating-banner-wide" : ""
      } rating-100-${classBucket}`}
    >
      {compact ? (
        <span className="rating-banner-compact-star" aria-label="Rating">
          {rating}
        </span>
      ) : (
        <>
          <FormattedMessage id="rating" />: {rating}
        </>
      )}
    </div>
  ) : (
    <></>
  );
};
