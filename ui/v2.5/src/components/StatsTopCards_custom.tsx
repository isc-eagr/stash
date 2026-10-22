import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import cx from "classnames";
import React, { useEffect, useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import {
  statsRankingViewCustom,
  statsRankingViewSearchCustom,
} from "src/utils/statsRankingView_custom";
import { RatingBanner } from "src/components/Shared/RatingBanner";
import { STATS_TOP_PAGING_CUSTOM } from "src/utils/statsTopPaging_custom";
import {
  StatsRankByChips,
  type IStatsRankByOption,
} from "./StatsCharts_custom";

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
  // Optional muted detail, such as a share of the total.
  detail?: string;
  // Optional muted line under the title, such as "2 vatos · 34m".
  meta?: string;
}

export type StatsTopView = "cards" | "table";

export interface IStatsTopRankBy<T extends string> {
  options: readonly IStatsRankByOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

// CUSTOM: ranked cards shared by every stats page: rank-by chips, numbered
// covers (scenes) or portraits (vatos), a table view, and Show more paging.
export function StatsTopCards<T extends string = string>({
  title,
  items,
  variant,
  emptyLabel,
  actions,
  note,
  rankBy,
  view: controlledView,
  onViewChange,
}: {
  title: React.ReactNode;
  items: IStatsTopCard[];
  variant: "scene" | "vato";
  emptyLabel: string;
  actions?: React.ReactNode;
  note?: string;
  rankBy?: IStatsTopRankBy<T>;
  // Existing page URL keys can override the shared rankingView URL key.
  view?: StatsTopView;
  onViewChange?: (view: StatsTopView) => void;
}) {
  const { initial, more } = STATS_TOP_PAGING_CUSTOM[variant];
  const [visibleCount, setVisibleCount] = useState<number>(initial);
  const history = useHistory();
  const location = useLocation();
  const view = controlledView ?? statsRankingViewCustom(location.search);
  const setView =
    onViewChange ??
    ((next: StatsTopView) =>
      history.push({
        ...history.location,
        search: statsRankingViewSearchCustom(history.location.search, next),
      }));
  // Callers build items inline, so reset paging only when the ranking changes.
  const rankingKey = items.map((item) => item.key).join(",");

  useEffect(() => {
    setVisibleCount(initial);
  }, [rankingKey, initial]);

  const visibleItems = items.slice(0, visibleCount);
  const nextCount = Math.min(more, items.length - visibleItems.length);

  return (
    <section className={cx("stats-top", `stats-top--${variant}`)}>
      <div className="stats-top-heading">
        <div className="stats-top-title">
          <h2>{title}</h2>
          {note && <span className="stats-top-note">{note}</span>}
        </div>
        {rankBy && (
          <StatsRankByChips
            options={rankBy.options}
            value={rankBy.value}
            onChange={rankBy.onChange}
          />
        )}
        {actions}
      </div>
      {items.length === 0 ? (
        <div className="stats-top-empty">{emptyLabel}</div>
      ) : view === "table" ? (
        <ol className="stats-top-table">
          {visibleItems.map((item, index) => {
            const rank = index + 1;
            return (
              <li key={item.key}>
                <Link className="stats-top-table-row" to={item.to}>
                  <span className={`stats-top-table-rank rank-${rank}`}>
                    {rank}
                  </span>
                  <span className="stats-top-table-image">
                    {item.imagePath ? (
                      <img alt="" loading="lazy" src={item.imagePath} />
                    ) : null}
                  </span>
                  <span className="stats-top-table-name">
                    <strong>{item.title}</strong>
                    {item.meta && <span>{item.meta}</span>}
                  </span>
                  <span className="stats-top-table-value">
                    <strong>{item.value}</strong>
                    {item.detail && <span>{item.detail}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="stats-top-grid">
          {visibleItems.map((item, index) => {
            const rank = index + 1;
            return (
              <li key={item.key}>
                <Link
                  className="stats-top-card"
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
                    <span className="stats-top-value">{item.value}</span>
                  </span>
                  <span className="stats-top-name">{item.title}</span>
                  {(item.meta || item.detail) && (
                    <span className="stats-top-meta">
                      {[item.meta, item.detail].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {items.length > 0 && (
        <div className="stats-top-more">
          {nextCount > 0 && (
            <button
              className="stats-chip"
              onClick={() => setVisibleCount((current) => current + more)}
              type="button"
            >
              Show {nextCount.toLocaleString(getAppLocaleCustom())} more
            </button>
          )}
          <button
            className="stats-chip"
            onClick={() => setView(view === "cards" ? "table" : "cards")}
            type="button"
          >
            {view === "cards" ? "View as table" : "View as cards"}
          </button>
          <span className="stats-top-count">
            {visibleItems.length.toLocaleString(getAppLocaleCustom())} of{" "}
            {items.length.toLocaleString(getAppLocaleCustom())}
          </span>
        </div>
      )}
    </section>
  );
}
