import React from "react";
import cx from "classnames";

// CUSTOM: stepped Rating Advisor criterion meter for the rating strips, one
// step per choice above the lowest, in the advisor heat color. Averages fill
// a partial step.
export const RatingCriterionMeter: React.FC<{
  steps: number;
  value: number;
  heatLevel?: number;
}> = ({ steps, value, heatLevel }) => (
  <span
    aria-hidden="true"
    className="rating-criterion-meter"
    data-rating-level={heatLevel}
  >
    {Array.from({ length: steps }, (_, step) => {
      const fill = Math.max(0, Math.min(1, value - step));
      const partial = fill > 0 && fill < 1;
      return (
        <span
          className={cx(
            "rating-criterion-meter__step",
            fill >= 1 && "is-filled",
            partial && "is-partial"
          )}
          key={step}
          style={
            partial
              ? ({
                  "--rating-criterion-step-fill": `${Math.round(fill * 100)}%`,
                } as React.CSSProperties)
              : undefined
          }
        />
      );
    })}
  </span>
);
