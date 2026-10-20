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

// Content shown beside one criterion's label, such as a count.
export interface IRatingStripCriterionAddon {
  key: string;
  node: React.ReactNode;
}

export const RatingStrip: React.FC<{
  idPrefix: string;
  criteria: IRatingStripCriterion[];
  adjustments: IRatingStripAdjustment[];
  trailing?: React.ReactNode;
  criterionAddon?: IRatingStripCriterionAddon;
  className?: string;
  header?: React.ReactNode;
}> = ({
  idPrefix,
  criteria,
  adjustments,
  trailing: trailingProp,
  criterionAddon,
  className,
  header,
}) => {
  const hasCriteria = criteria.some((criterion) => criterion.rated);
  const addonInline =
    hasCriteria &&
    !!criterionAddon &&
    criteria.some((criterion) => criterion.key === criterionAddon.key);
  // Without its criterion on show, the addon joins the trailing slot.
  const trailing =
    criterionAddon && !addonInline ? (
      <>
        {trailingProp}
        {criterionAddon.node}
      </>
    ) : (
      trailingProp
    );
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
            // The addon's column grows to fit it; the rest share the width.
            gridTemplateColumns: criteria
              .map((criterion) =>
                addonInline && criterion.key === criterionAddon?.key
                  ? "minmax(min-content, 1fr)"
                  : "minmax(0, 1fr)"
              )
              .join(" "),
          }}
        >
          {criteria.map((criterion) => {
            const tooltip = (
              <Tooltip id={`${idPrefix}-${criterion.key}`}>
                {criterion.detail}
              </Tooltip>
            );
            const label = (
              <span className="rating-criterion__label">{criterion.label}</span>
            );
            const meter = (
              <RatingCriterionMeter
                heatLevel={criterion.heatLevel}
                steps={criterion.steps}
                value={criterion.value}
              />
            );
            const criterionClassName = cx("rating-criterion", {
              "is-unrated": !criterion.rated,
            });

            if (!addonInline || criterion.key !== criterionAddon?.key) {
              return (
                <OverlayTrigger
                  key={criterion.key}
                  overlay={tooltip}
                  placement="bottom"
                >
                  <div
                    aria-label={criterion.detail}
                    className={criterionClassName}
                    role="listitem"
                  >
                    {label}
                    {meter}
                  </div>
                </OverlayTrigger>
              );
            }

            // The addon keeps its own hover, so only the label and meter
            // show the criterion tooltip.
            return (
              <div
                className={cx(criterionClassName, "has-addon")}
                key={criterion.key}
                role="listitem"
              >
                <span className="rating-criterion__head">
                  <OverlayTrigger overlay={tooltip} placement="bottom">
                    <span
                      aria-label={criterion.detail}
                      className="rating-criterion__label"
                    >
                      {criterion.label}
                    </span>
                  </OverlayTrigger>
                  {criterionAddon?.node}
                </span>
                <OverlayTrigger overlay={tooltip} placement="bottom">
                  <div>{meter}</div>
                </OverlayTrigger>
              </div>
            );
          })}
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
