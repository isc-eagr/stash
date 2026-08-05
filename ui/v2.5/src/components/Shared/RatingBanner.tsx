import React from "react";
import { FormattedMessage } from "react-intl";
import cx from "classnames"; // CUSTOM

interface IProps {
  rating?: number | null;
  compact?: boolean;
  className?: string; // CUSTOM
}

export const RatingBanner: React.FC<IProps> = ({
  rating,
  compact = false,
  className, // CUSTOM
}) => {
  const classBucket = Math.min(20, Math.trunc((rating ?? 0) / 5));
  const isWideRating = (rating ?? 0) >= 100;

  return rating !== undefined && rating !== null ? (
    <div
      className={cx(
        "rating-banner",
        {
          "rating-banner-compact": compact,
          "rating-banner-wide": isWideRating,
        },
        `rating-100-${classBucket}`,
        className
      )} // CUSTOM
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
