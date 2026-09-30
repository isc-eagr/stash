import cx from "classnames";
import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { RatingBanner } from "src/components/Shared/RatingBanner";

import "./statsTopCards_custom.scss";

export interface IStatsTopCard {
  key: string;
  title: string;
  imagePath?: string | null;
  // Scene or vato rating, shown as the card rating star.
  rating100?: number | null;
  to: string;
  // The ranked metric, already formatted (e.g. "8 O's", "92/100").
  value: React.ReactNode;
  // Optional muted detail on the right, such as a share of the total.
  detail?: string;
}

// CUSTOM: ranked image cards shared by O, Scene, and Vato Stats. Scenes use
// wide covers and vatos portraits; both page through the full ranking.
export const StatsTopCards: React.FC<{
  title: React.ReactNode;
  items: IStatsTopCard[];
  variant: "scene" | "vato";
  emptyLabel: string;
  actions?: React.ReactNode;
  note?: string;
}> = ({ title, items, variant, emptyLabel, actions, note }) => {
  // Two rows per page at desktop widths: 3 scenes or 4 vatos per row.
  const pageSize = variant === "scene" ? 6 : 8;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  // Callers build items inline, so reset paging only when the ranking changes.
  const rankingKey = items.map((item) => item.key).join(",");

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [rankingKey, pageSize]);

  const visibleItems = items.slice(0, visibleCount);

  return (
    <section className={cx("stats-top", `stats-top--${variant}`)}>
      <div className="stats-top-heading">
        <div className="stats-top-title">
          <h2>{title}</h2>
          {note && <span className="stats-top-note">{note}</span>}
        </div>
        {actions}
      </div>
      {items.length === 0 ? (
        <div className="stats-top-empty">{emptyLabel}</div>
      ) : (
        <ol className="stats-top-grid">
          {visibleItems.map((item, index) => {
            const rank = index + 1;
            return (
              <li key={item.key}>
                <Link
                  className={cx("stats-top-card", {
                    "stats-top-card--podium": rank <= 3,
                  })}
                  title={`#${rank} ${item.title}`}
                  to={item.to}
                >
                  <span className="stats-top-image">
                    {item.imagePath ? (
                      <img alt="" loading="lazy" src={item.imagePath} />
                    ) : null}
                    <span className={`stats-top-rank rank-${rank}`}>
                      {rank}
                    </span>
                    <RatingBanner rating={item.rating100} compact />
                  </span>
                  <span className="stats-top-name">{item.title}</span>
                  <span className="stats-top-value">
                    <strong>{item.value}</strong>
                    {item.detail && (
                      <span className="stats-top-detail">{item.detail}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {items.length > visibleItems.length && (
        <div className="stats-top-more">
          <Button
            onClick={() => setVisibleCount((current) => current + pageSize)}
            size="sm"
            variant="secondary"
          >
            Show more ({(items.length - visibleItems.length).toLocaleString()}{" "}
            left)
          </Button>
        </div>
      )}
    </section>
  );
};
