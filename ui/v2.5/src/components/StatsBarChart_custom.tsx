import {
  statsSemanticColorCustom,
  statsQualityGlowCustom,
} from "src/utils/statsChartColors_custom"; // CUSTOM
import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import { StatsChartHeading } from "./StatsChartHeading_custom"; // CUSTOM
import cx from "classnames";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatStatsBarPercent,
  statsUnitLabel,
  sortStatsBarData,
  type StatsBarSort,
} from "src/utils/statsBarChart_custom";

import "./statsBarChart_custom.scss";

export type StatsBarLink = string | { pathname: string; search?: string };

// One colored slice of a stacked column, such as GOAT facials in "2 facials".
export interface IStatsBarSegment {
  key: string;
  label: string;
  count: number;
  color: string;
  to?: StatsBarLink;
  onSelect?: () => void;
}

export interface IStatsBarDatum {
  key: string;
  label: string;
  subLabel?: string;
  count: number;
  // A link destination, a click handler, or neither for a read-only bar.
  to?: StatsBarLink;
  onSelect?: () => void;
  actionLabel?: string;
  // Split bars use it per segment; other charts use the page accent.
  color?: string;
  // Shown before the label in ranked rows, such as a country flag.
  icon?: React.ReactNode;
  segments?: IStatsBarSegment[];
}

export interface IStatsChartUnknown {
  count: number;
  to?: StatsBarLink;
  onSelect?: () => void;
}

export interface IStatsLegendItem {
  key: string;
  label: string;
  color: string;
}

interface IProps {
  title: string;
  data: IStatsBarDatum[];
  // Singular and plural unit for totals, tooltips and screen readers.
  unit: [string, string];
  // Denominator for percentages; defaults to the sum of the bars.
  total?: number;
  formatValue?: (count: number) => string;
  maxValue?: number;
  // Shown when bars can overlap and do not add up to the total.
  totalNote?: string;
  unknown?: IStatsChartUnknown;
  actions?: React.ReactNode;
  emptyLabel?: string;
  // Offer a count-sorted view for charts whose natural order is not by count.
  sortable?: boolean;
  initialBarCount?: number;
  // Columns for ordered values; ranked rows for categories with no order.
  variant?: "columns" | "ranked";
  // Stacked columns explain their colors once under the title.
  legend?: IStatsLegendItem[];
  className?: string;
}

const DEFAULT_INITIAL_BAR_COUNT = 48;
const DEFAULT_INITIAL_RANKED_COUNT = 10;

export { statsUnitLabel } from "src/utils/statsBarChart_custom"; // CUSTOM

// A bar is a router link, a button, or a read-only span.
export const StatsBarTarget: React.FC<{
  className: string;
  label: string;
  to?: StatsBarLink;
  onSelect?: () => void;
  style?: React.CSSProperties;
}> = ({ className, label, to, onSelect, style, children }) => {
  if (to) {
    return (
      <Link
        className={className}
        to={to}
        title={label}
        aria-label={label}
        style={style}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      className={className}
      type="button"
      disabled={!onSelect}
      onClick={onSelect}
      title={label}
      aria-label={label}
      style={style}
    >
      {children}
    </button>
  );
};

export const StatsChartUnknown: React.FC<{
  unknown?: IStatsChartUnknown;
  subject: string;
}> = ({ unknown, subject }) => {
  if (!unknown || unknown.count <= 0) return null;
  const label = `${unknown.to ? "View" : "Filter by"} ${subject}: Unknown`;
  return (
    <StatsBarTarget
      className="stats-bar-chart-unknown"
      label={label}
      to={unknown.to}
      onSelect={unknown.onSelect}
    >
      Unknown: {unknown.count.toLocaleString(getAppLocaleCustom())}
      {unknown.to ? " →" : ""}
    </StatsBarTarget>
  );
};

export const StatsChartLegend: React.FC<{ items?: IStatsLegendItem[] }> = ({
  items,
}) =>
  items && items.length > 0 ? (
    <ul className="stats-chart-legend">
      {items.map((item) => (
        <li key={item.key}>
          <span
            className="stats-chart-swatch"
            style={{
              background: item.color,
              boxShadow: statsQualityGlowCustom(item.color),
            }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  ) : null;

// "By Rating" reads as "Filter by Rating" in labels.
export function statsChartSubject(title: string) {
  return title.replace(/^By /, "");
}

export const StatsBarChart: React.FC<IProps> = ({
  title,
  data: rawData,
  unit,
  total,
  totalNote,
  formatValue,
  maxValue,
  unknown,
  actions,
  emptyLabel = "No data",
  sortable = false,
  initialBarCount,
  variant = "columns",
  legend,
  className,
}) => {
  const data = useMemo(
    () =>
      rawData.map((datum) => ({
        ...datum,
        color: datum.color ?? statsSemanticColorCustom(datum.key),
      })),
    [rawData]
  );
  const [sort, setSort] = useState<StatsBarSort>(
    variant === "ranked" ? "count" : "natural"
  );
  const [showAll, setShowAll] = useState(false);
  const sortedData = useMemo(() => sortStatsBarData(data, sort), [data, sort]);
  const barTotal = data.reduce((sum, datum) => sum + datum.count, 0);
  const denominator = total ?? barTotal;
  const initialCount =
    initialBarCount ??
    (variant === "ranked"
      ? DEFAULT_INITIAL_RANKED_COUNT
      : DEFAULT_INITIAL_BAR_COUNT);
  const visibleData = showAll ? sortedData : sortedData.slice(0, initialCount);
  const hiddenCount = sortedData.length - visibleData.length;
  const max = Math.max(maxValue ?? 0, ...data.map((datum) => datum.count), 1);
  const valueLabel = (count: number) =>
    formatValue ? formatValue(count) : statsUnitLabel(count, unit);
  // The tallest columns stand out, ties included, unless every column ties.
  const peakCount = data.filter((datum) => datum.count === max).length;
  const hasPeak = data.length > 2 && peakCount < data.length;
  const subject = statsChartSubject(title);

  // Callers build bars inline, so collapse only when the bars change.
  const barsKey = data.map((datum) => datum.key).join(",");

  useEffect(() => {
    setShowAll(false);
  }, [barsKey]);

  function summaryFor(datum: IStatsBarDatum) {
    const percent = formatStatsBarPercent(datum.count, denominator);
    return `${datum.label}${
      datum.subLabel ? ` ${datum.subLabel}` : ""
    }: ${valueLabel(datum.count)} (${percent})`;
  }

  function targetLabel(datum: IStatsBarDatum) {
    const summary = summaryFor(datum);
    const interactive = datum.count > 0 && (!!datum.to || !!datum.onSelect);
    if (!interactive) return summary;
    return `${datum.actionLabel ?? `Filter by ${subject}`}: ${summary}`;
  }

  function renderFill(datum: IStatsBarDatum, isPeak: boolean) {
    if (datum.count <= 0) return null;
    const size = `${Math.max((datum.count / max) * 100, 4)}%`;
    const style = variant === "ranked" ? { width: size } : { height: size };
    if (!datum.segments?.length) {
      // A datum color (such as a role color) replaces the accent and peak.
      return (
        <span
          className={cx("stats-bar-chart-fill", {
            peak: isPeak && !datum.color,
          })}
          style={
            datum.color
              ? {
                  ...style,
                  background: datum.color,
                  boxShadow: statsQualityGlowCustom(datum.color),
                }
              : style
          }
        />
      );
    }
    return (
      <span className="stats-bar-chart-fill stacked" style={style}>
        {datum.segments
          .filter((segment) => segment.count > 0)
          .map((segment) => (
            <StatsBarTarget
              key={segment.key}
              className="stats-bar-chart-segment"
              label={`Filter by ${subject}: ${datum.label}, ${
                segment.label
              }: ${valueLabel(segment.count)}`}
              to={segment.to}
              onSelect={segment.onSelect}
              style={{
                background: segment.color,
                boxShadow: statsQualityGlowCustom(segment.color),
                flexGrow: segment.count,
              }}
            />
          ))}
      </span>
    );
  }

  function renderColumn(datum: IStatsBarDatum) {
    const isPeak = hasPeak && datum.count === max;
    const percent = formatStatsBarPercent(datum.count, denominator);
    const head = (
      <>
        <span className="stats-bar-chart-count">
          {formatValue
            ? formatValue(datum.count)
            : datum.count.toLocaleString(getAppLocaleCustom())}
        </span>
        <span className="stats-bar-chart-percent">{percent}</span>
      </>
    );
    const foot = (
      <>
        <span className="stats-bar-chart-label">{datum.label}</span>
        {datum.subLabel && (
          <span className="stats-bar-chart-sublabel">{datum.subLabel}</span>
        )}
      </>
    );

    // Stacked columns make each slice clickable; the label filters the column.
    if (datum.segments?.length) {
      return (
        <div className="stats-bar-chart-cell" key={datum.key}>
          {head}
          <span className="stats-bar-chart-track">
            {renderFill(datum, false)}
          </span>
          <StatsBarTarget
            className="stats-bar-chart-label-target"
            label={targetLabel(datum)}
            to={datum.count > 0 ? datum.to : undefined}
            onSelect={datum.count > 0 ? datum.onSelect : undefined}
          >
            {foot}
          </StatsBarTarget>
        </div>
      );
    }

    return (
      <StatsBarTarget
        className="stats-bar-chart-cell"
        key={datum.key}
        label={targetLabel(datum)}
        to={datum.count > 0 ? datum.to : undefined}
        onSelect={datum.count > 0 ? datum.onSelect : undefined}
      >
        {head}
        <span className="stats-bar-chart-track">
          {renderFill(datum, isPeak)}
        </span>
        {foot}
      </StatsBarTarget>
    );
  }

  function renderRankedRow(datum: IStatsBarDatum) {
    return (
      <StatsBarTarget
        className="stats-bar-chart-row"
        key={datum.key}
        label={targetLabel(datum)}
        to={datum.count > 0 ? datum.to : undefined}
        onSelect={datum.count > 0 ? datum.onSelect : undefined}
      >
        <span className="stats-bar-chart-label">
          {datum.icon}
          {datum.label}
          {datum.subLabel && (
            <span className="stats-bar-chart-sublabel"> {datum.subLabel}</span>
          )}
        </span>
        <span className="stats-bar-chart-track">
          {renderFill(datum, false)}
        </span>
        <span className="stats-bar-chart-count">
          {formatValue
            ? formatValue(datum.count)
            : datum.count.toLocaleString(getAppLocaleCustom())}
        </span>
        <span className="stats-bar-chart-percent">
          {formatStatsBarPercent(datum.count, denominator)}
        </span>
      </StatsBarTarget>
    );
  }

  return (
    <section
      className={cx(
        "stats-bar-chart",
        `stats-bar-chart--${variant}`,
        className
      )}
    >
      <StatsChartHeading
        title={title}
        total={denominator}
        unit={unit}
        totalNote={totalNote}
        formatValue={formatValue}
        unknown={<StatsChartUnknown unknown={unknown} subject={subject} />}
        actions={
          <>
            {actions}
            {sortable && data.length > 2 && (
              <button
                className="stats-chip stats-bar-chart-sort"
                onClick={() =>
                  setSort((current) =>
                    current === "natural" ? "count" : "natural"
                  )
                }
                title="Flip between natural order and highest count first"
                type="button"
              >
                {sort === "natural" ? "Sort by count" : "Natural order"}
              </button>
            )}
          </>
        }
      />
      <StatsChartLegend items={legend} />
      {data.length === 0 ? (
        <div className="stats-bar-chart-empty">
          {unknown && unknown.count > 0 ? "Only unknown data" : emptyLabel}
        </div>
      ) : (
        <div className="stats-bar-chart-bars">
          {visibleData.map((datum) =>
            variant === "ranked" ? renderRankedRow(datum) : renderColumn(datum)
          )}
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="stats-bar-chart-more">
          <button
            className="stats-chip"
            onClick={() => setShowAll(true)}
            type="button"
          >
            Show all {sortedData.length.toLocaleString(getAppLocaleCustom())}
          </button>
        </div>
      )}
    </section>
  );
};
