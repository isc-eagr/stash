import cx from "classnames";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  formatStatsBarPercent,
  sortStatsBarData,
  type StatsBarSort,
} from "src/utils/statsBarChart_custom";

import "./statsBarChart_custom.scss";

export type StatsBarLink = string | { pathname: string; search?: string };

export interface IStatsBarDatum {
  key: string;
  label: string;
  subLabel?: string;
  count: number;
  // A link destination, a click handler, or neither for a read-only bar.
  to?: StatsBarLink;
  onSelect?: () => void;
  actionLabel?: string;
}

interface IStatsBarChartUnknown {
  count: number;
  to?: StatsBarLink;
  onSelect?: () => void;
}

interface IProps {
  title: string;
  data: IStatsBarDatum[];
  // Singular and plural unit for totals, tooltips and screen readers.
  unit: [string, string];
  // Denominator for percentages; defaults to the sum of the bars.
  total?: number;
  // Shown when bars can overlap and do not add up to the total.
  totalNote?: string;
  unknown?: IStatsBarChartUnknown;
  actions?: React.ReactNode;
  emptyLabel?: string;
  // Offer a count-sorted view for charts whose natural order is not by count.
  sortable?: boolean;
  initialBarCount?: number;
  className?: string;
}

const DEFAULT_INITIAL_BAR_COUNT = 48;

function unitLabel(count: number, unit: [string, string]) {
  return `${count.toLocaleString()} ${count === 1 ? unit[0] : unit[1]}`;
}

export const StatsBarChart: React.FC<IProps> = ({
  title,
  data,
  unit,
  total,
  totalNote,
  unknown,
  actions,
  emptyLabel = "No data",
  sortable = false,
  initialBarCount = DEFAULT_INITIAL_BAR_COUNT,
  className,
}) => {
  const [sort, setSort] = useState<StatsBarSort>("natural");
  const [showAll, setShowAll] = useState(false);
  const sortedData = useMemo(() => sortStatsBarData(data, sort), [data, sort]);
  const barTotal = data.reduce((sum, datum) => sum + datum.count, 0);
  const denominator = total ?? barTotal;
  const visibleData = showAll
    ? sortedData
    : sortedData.slice(0, initialBarCount);
  const hiddenCount = sortedData.length - visibleData.length;
  const max = Math.max(...data.map((datum) => datum.count), 1);
  // "By Rating" reads as "Filter by Rating" in labels.
  const subject = title.replace(/^By /, "");

  // Callers build bars inline, so collapse only when the bars change.
  const barsKey = data.map((datum) => datum.key).join(",");

  useEffect(() => {
    setShowAll(false);
  }, [barsKey]);

  function renderUnknown() {
    if (!unknown || unknown.count <= 0) return null;
    const content = `Unknown: ${unknown.count.toLocaleString()}`;
    const label = `${unknown.to ? "View" : "Filter by"} ${subject}: Unknown`;
    if (unknown.to) {
      return (
        <Link
          className="stats-bar-chart-unknown"
          to={unknown.to}
          title={label}
          aria-label={label}
        >
          {content} →
        </Link>
      );
    }
    return (
      <button
        className="stats-bar-chart-unknown"
        type="button"
        onClick={unknown.onSelect}
        disabled={!unknown.onSelect}
        title={label}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return (
    <section className={cx("stats-bar-chart", className)}>
      <div className="stats-bar-chart-heading">
        <div className="stats-bar-chart-title">
          <h2>{title}</h2>
          {data.length > 0 && (
            <span
              className="stats-bar-chart-total"
              title={totalNote}
              aria-label={`Total: ${unitLabel(denominator, unit)}${
                totalNote ? `. ${totalNote}` : ""
              }`}
            >
              {unitLabel(denominator, unit)}
              {totalNote ? " *" : ""}
            </span>
          )}
        </div>
        <div className="stats-bar-chart-actions">
          {actions}
          {sortable && data.length > 2 && (
            <Button
              className="stats-bar-chart-sort"
              onClick={() =>
                setSort((current) =>
                  current === "natural" ? "count" : "natural"
                )
              }
              size="sm"
              variant="secondary"
              title="Flip between natural order and highest count first"
            >
              {sort === "natural" ? "Sort by count" : "Natural order"}
            </Button>
          )}
          {renderUnknown()}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="stats-bar-chart-empty">
          {unknown && unknown.count > 0 ? "Only unknown data" : emptyLabel}
        </div>
      ) : (
        <div className="stats-bar-chart-bars">
          {visibleData.map((datum) => {
            const percent = formatStatsBarPercent(datum.count, denominator);
            const summary = `${datum.label}${
              datum.subLabel ? ` ${datum.subLabel}` : ""
            }: ${unitLabel(datum.count, unit)} (${percent})`;
            const action = datum.actionLabel ?? `Filter by ${subject}`;
            const interactive =
              datum.count > 0 && (!!datum.to || !!datum.onSelect);
            const label = interactive ? `${action}: ${summary}` : summary;
            const content = (
              <>
                <span className="stats-bar-chart-count">
                  {datum.count.toLocaleString()}
                </span>
                <span className="stats-bar-chart-percent">{percent}</span>
                <span className="stats-bar-chart-track">
                  {datum.count > 0 && (
                    <span
                      className="stats-bar-chart-fill"
                      style={{
                        height: `${Math.max((datum.count / max) * 100, 4)}%`,
                      }}
                    />
                  )}
                </span>
                <span className="stats-bar-chart-label">{datum.label}</span>
                {datum.subLabel && (
                  <span className="stats-bar-chart-sublabel">
                    {datum.subLabel}
                  </span>
                )}
              </>
            );

            if (interactive && datum.to) {
              return (
                <Link
                  className="stats-bar-chart-cell"
                  key={datum.key}
                  to={datum.to}
                  title={label}
                  aria-label={label}
                >
                  {content}
                </Link>
              );
            }
            return (
              <button
                className="stats-bar-chart-cell"
                key={datum.key}
                type="button"
                disabled={!interactive}
                onClick={interactive ? datum.onSelect : undefined}
                title={label}
                aria-label={label}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="stats-bar-chart-more">
          <Button
            onClick={() => setShowAll(true)}
            size="sm"
            variant="secondary"
          >
            Show all {sortedData.length.toLocaleString()}
          </Button>
        </div>
      )}
    </section>
  );
};
