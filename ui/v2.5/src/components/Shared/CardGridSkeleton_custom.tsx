// CUSTOM: card-shaped loading placeholders. See cardSkeletonLayout_custom.ts.
import React from "react";
import cx from "classnames";
import { useIntl } from "react-intl";
import type { ICardGridSkeleton } from "./cardSkeletonLayout_custom";

import "./cardGridSkeleton_custom.scss";

const SkeletonStatus: React.FC<{ message?: string }> = ({ message }) => {
  const intl = useIntl();
  return (
    <span className="sr-only">
      {message ?? intl.formatMessage({ id: "loading.generic" })}
    </span>
  );
};

export const CardGridSkeleton: React.FC<ICardGridSkeleton> = ({
  layout,
  shape,
  cardWidth,
  count,
}) => (
  <div
    aria-busy="true"
    className={cx("card-skeleton", `card-skeleton--${layout}`)}
    role="status"
    style={{ "--card-skeleton-width": `${cardWidth}px` } as React.CSSProperties}
  >
    <SkeletonStatus />
    {Array.from({ length: count }, (_, index) =>
      layout === "rows" ? (
        <div aria-hidden="true" className="card-skeleton-row" key={index}>
          <span className="card-skeleton-block card-skeleton-row-thumb" />
          <span className="card-skeleton-block card-skeleton-line" />
          <span className="card-skeleton-block card-skeleton-line card-skeleton-line--short" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className={cx("card-skeleton-card", `card-skeleton-card--${shape}`)}
          key={index}
        >
          <span className="card-skeleton-block card-skeleton-media" />
          <span className="card-skeleton-block card-skeleton-line" />
          <span className="card-skeleton-block card-skeleton-line card-skeleton-line--short" />
        </div>
      )
    )}
  </div>
);

// One section of a stats page while it loads: two charts.
export const StatsSectionSkeleton: React.FC<{ message?: string }> = ({
  message,
}) => (
  <div aria-busy="true" className="stats-skeleton" role="status">
    <SkeletonStatus message={message} />
    <div aria-hidden="true" className="stats-skeleton-charts">
      {Array.from({ length: 2 }, (_, index) => (
        <span
          className="card-skeleton-block stats-skeleton-chart"
          key={index}
        />
      ))}
    </div>
  </div>
);

// A stats page while it loads: big numbers, five ranked cards, two charts.
export const StatsPageSkeleton: React.FC<{ message?: string }> = ({
  message,
}) => (
  <div aria-busy="true" className="stats-skeleton" role="status">
    <SkeletonStatus message={message} />
    <div aria-hidden="true" className="stats-skeleton-kpis">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index}>
          <span className="card-skeleton-block card-skeleton-line card-skeleton-line--short" />
          <span className="card-skeleton-block stats-skeleton-number" />
        </div>
      ))}
    </div>
    <div aria-hidden="true" className="stats-skeleton-cards">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          className="card-skeleton-card card-skeleton-card--landscape"
          key={index}
        >
          <span className="card-skeleton-block card-skeleton-media" />
          <span className="card-skeleton-block card-skeleton-line" />
        </div>
      ))}
    </div>
    <div aria-hidden="true" className="stats-skeleton-charts">
      {Array.from({ length: 2 }, (_, index) => (
        <span
          className="card-skeleton-block stats-skeleton-chart"
          key={index}
        />
      ))}
    </div>
  </div>
);
