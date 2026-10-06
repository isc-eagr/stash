import React from "react";
import cx from "classnames";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { RatingCriterionMeter } from "./RatingCriterionMeter_custom";

// CUSTOM: inline rating strip. Criteria sit side by side as short labels over
// stepped heat meters; bonuses/penalties fill a row below, with an optional
// slot on the right. Shared by per-item ratings and Rating Advisor averages.
export interface IRatingStripCriterion {
  key: string;
  label: string;
  // Full name and value, shown on hover.
  detail: string;
  steps: number;
  // Filled steps; averages may fill part of a step.
  value: number;
  heatLevel?: number;
  rated: boolean;
}

export interface IRatingStripAdjustment {
  key: string;
  label: string;
  section: "bonus" | "penalty";
  value: string;
  detail: string;
}

export const RatingStrip: React.FC<{
  idPrefix: string;
  criteria: IRatingStripCriterion[];
  adjustments: IRatingStripAdjustment[];
  trailing?: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
}> = ({ idPrefix, criteria, adjustments, trailing, className, header }) => {
  const hasCriteria = criteria.some((criterion) => criterion.rated);
  if (!hasCriteria && adjustments.length === 0 && !trailing) return null;

  return (
    <div className={cx("rating-criteria-strip", className)}>
      {header}
      {hasCriteria && (
        <div
          aria-label="Rating criteria"
          className="rating-criteria-strip__criteria"
          role="list"
          style={{
            gridTemplateColumns: `repeat(${criteria.length}, minmax(0, 1fr))`,
          }}
        >
          {criteria.map((criterion) => (
            <OverlayTrigger
              key={criterion.key}
              overlay={
                <Tooltip id={`${idPrefix}-${criterion.key}`}>
                  {criterion.detail}
                </Tooltip>
              }
              placement="bottom"
            >
              <div
                aria-label={criterion.detail}
                className={cx("rating-criterion", {
                  "is-unrated": !criterion.rated,
                })}
                role="listitem"
              >
                <span className="rating-criterion__label">
                  {criterion.label}
                </span>
                <RatingCriterionMeter
                  heatLevel={criterion.heatLevel}
                  steps={criterion.steps}
                  value={criterion.value}
                />
              </div>
            </OverlayTrigger>
          ))}
        </div>
      )}
      {(adjustments.length > 0 || trailing) && (
        <div className="rating-criteria-strip__footer">
          <div
            aria-label="Bonuses and penalties"
            className="rating-criteria-strip__adjustments"
          >
            {adjustments.map((row) => (
              <span
                aria-label={row.detail}
                className={cx("rating-adjustment", `is-${row.section}`)}
                key={`${row.section}-${row.key}`}
                role="img"
                title={row.detail}
              >
                <span aria-hidden="true" className="rating-adjustment__mark">
                  {row.section === "bonus" ? "✓" : "−"}
                </span>
                <span aria-hidden="true">{row.label}</span>
                <strong aria-hidden="true">{row.value}</strong>
              </span>
            ))}
          </div>
          {trailing}
        </div>
      )}
    </div>
  );
};
