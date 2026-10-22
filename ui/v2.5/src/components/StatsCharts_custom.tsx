import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import { StatsChartHeading } from "./StatsChartHeading_custom"; // CUSTOM
// CUSTOM: chart parts shared by Scene, Vato, O, Nut and Facial Stats. Each
// page groups them by topic with StatsChartGroup; StatsBarChart covers
// columns (ordered values) and ranked rows (unordered categories).
import cx from "classnames";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { formatStatsBarPercent } from "src/utils/statsBarChart_custom";
import {
  STATS_CATEGORY_COLORS,
  statsSemanticColorCustom,
  statsQualityGlowCustom,
  statsPaletteColor,
  statsSegmentInk,
} from "src/utils/statsChartColors_custom";
import {
  StatsBarTarget,
  StatsChartUnknown,
  statsChartSubject,
  statsUnitLabel,
  type IStatsBarDatum,
  type IStatsChartUnknown,
  type StatsBarLink,
} from "./StatsBarChart_custom";

import "./statsCharts_custom.scss";

function interactive(datum?: {
  count: number;
  to?: unknown;
  onSelect?: unknown;
}) {
  return !!datum && datum.count > 0 && (!!datum.to || !!datum.onSelect);
}

// Tiny flag before a country label; unknown codes render nothing.
export const StatsCountryFlag: React.FC<{ country?: string | null }> = ({
  country,
}) => <CountryFlag className="stats-flag" country={country} />;

// A titled block of related charts, such as everything about the vatos.
// Charts are medium by default; "stats-small" and "stats-wide" resize them.
export const StatsChartGroup: React.FC<{
  title: string;
  description?: string;
  className?: string;
}> = ({ title, description, className, children }) => (
  <section className={cx("stats-group", className)}>
    <header className="stats-group-heading">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </header>
    <div className="stats-group-grid">{children}</div>
  </section>
);

export interface IStatsKpi {
  key: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  title?: string;
  to?: string;
  action?: string;
  // Swatch beside the label, matching a split bar below the row.
  color?: string;
}

// Big numbers across the top of a stats page.
export const StatsKpiRow: React.FC<{
  items: IStatsKpi[];
  label?: string;
}> = ({ items, label = "Key numbers", children }) => (
  <section className="stats-kpis" aria-label={label}>
    <div className="stats-kpi-row">
      {items.map((item) => {
        const content = (
          <>
            <span className="stats-kpi-label">
              {item.color && (
                <span
                  className="stats-chart-swatch"
                  style={{ background: item.color }}
                />
              )}
              {item.label}
            </span>
            <span className="stats-kpi-value">{item.value}</span>
            {item.detail && (
              <span className="stats-kpi-detail">{item.detail}</span>
            )}
            {item.action && (
              <span className="stats-kpi-action">{item.action} →</span>
            )}
          </>
        );
        return item.to ? (
          <Link
            className="stats-kpi linked"
            key={item.key}
            title={item.title}
            to={item.to}
          >
            {content}
          </Link>
        ) : (
          <div className="stats-kpi" key={item.key} title={item.title}>
            {content}
          </div>
        );
      })}
    </div>
    {children}
  </section>
);

export interface IStatsRankByOption<T extends string> {
  key: T;
  label: string;
}

// Rank-by chips shared by every ranking.
export function StatsRankByChips<T extends string>({
  options,
  value,
  onChange,
  label = "Rank by",
}: {
  options: readonly IStatsRankByOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="stats-rank-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          aria-pressed={option.key === value}
          className={cx("stats-chip", { active: option.key === value })}
          key={option.key}
          onClick={() => onChange(option.key)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Text inside a segment only when it fits (width share of the bar), with the
// same percent as the legend.
function segmentText(label: string, share: number, percent: string) {
  if (share >= 9) return `${label} ${percent}`;
  if (share >= 5) return percent;
  return "";
}

// Parts of one whole as one bar; each segment and legend entry filters.
export const StatsSplitBar: React.FC<{
  title: string;
  data: IStatsBarDatum[];
  unit: [string, string];
  total?: number;
  totalNote?: string;
  unknown?: IStatsChartUnknown;
  palette?: readonly string[];
  actions?: React.ReactNode;
  emptyLabel?: string;
  // Durations and other non-count values format their own numbers.
  formatValue?: (count: number) => string;
  className?: string;
}> = ({
  title,
  data,
  unit,
  total,
  totalNote,
  unknown,
  palette = STATS_CATEGORY_COLORS,
  actions,
  emptyLabel = "No data",
  formatValue,
  className,
}) => {
  const valueLabel = (count: number) =>
    formatValue ? formatValue(count) : statsUnitLabel(count, unit);
  const visible = data.filter((datum) => datum.count > 0);
  const sum = visible.reduce((acc, datum) => acc + datum.count, 0);
  const denominator = total ?? sum;
  const subject = statsChartSubject(title);
  const colored = visible.map((datum, index) => ({
    ...datum,
    color:
      datum.color ??
      statsSemanticColorCustom(datum.key) ??
      statsPaletteColor(palette, index),
    share: sum > 0 ? (datum.count / sum) * 100 : 0,
  }));

  function label(datum: IStatsBarDatum) {
    const summary = `${datum.label}: ${valueLabel(
      datum.count
    )} (${formatStatsBarPercent(datum.count, denominator)})`;
    return interactive(datum)
      ? `${datum.actionLabel ?? `Filter by ${subject}`}: ${summary}`
      : summary;
  }

  return (
    <section className={cx("stats-bar-chart stats-split", className)}>
      <StatsChartHeading
        title={title}
        total={denominator}
        unit={unit}
        totalNote={totalNote}
        unknown={
          <StatsChartUnknown
            unknown={unknown}
            subject={statsChartSubject(title)}
          />
        }
        actions={actions}
        formatValue={formatValue}
      />
      {colored.length === 0 ? (
        <div className="stats-bar-chart-empty">
          {unknown && unknown.count > 0 ? "Only unknown data" : emptyLabel}
        </div>
      ) : (
        <>
          <div className="stats-split-bar">
            {colored.map((datum) => (
              <StatsBarTarget
                className="stats-split-segment"
                key={datum.key}
                label={label(datum)}
                to={datum.to}
                onSelect={datum.onSelect}
                style={{
                  background: datum.color,
                  boxShadow: statsQualityGlowCustom(datum.color),
                  color: statsSegmentInk(datum.color),
                  flexGrow: datum.count,
                }}
              >
                {segmentText(
                  datum.label,
                  datum.share,
                  formatStatsBarPercent(datum.count, denominator)
                )}
              </StatsBarTarget>
            ))}
          </div>
          <ul className="stats-split-legend">
            {colored.map((datum) => (
              <li key={datum.key}>
                <StatsBarTarget
                  className="stats-split-legend-item"
                  label={label(datum)}
                  to={datum.to}
                  onSelect={datum.onSelect}
                >
                  <span
                    className="stats-chart-swatch"
                    style={{ background: datum.color }}
                  />
                  <span className="stats-split-legend-label">
                    {datum.label}
                  </span>
                  <span className="stats-split-legend-count">
                    {formatValue
                      ? formatValue(datum.count)
                      : datum.count.toLocaleString(getAppLocaleCustom())}{" "}
                    · {formatStatsBarPercent(datum.count, denominator)}
                  </span>
                </StatsBarTarget>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export interface IStatsDivergingRow {
  key: string;
  label: string;
  // Shown before the label, such as a country flag.
  icon?: React.ReactNode;
  left?: IStatsBarDatum;
  right?: IStatsBarDatum;
}

const DEFAULT_DIVERGING_ROWS = 12;

// Two sides of one question per row: tops vs bottoms, givers vs receivers.
export const StatsDivergingChart: React.FC<{
  title: string;
  leftLabel: string;
  rightLabel: string;
  rows: IStatsDivergingRow[];
  // Values with no side, such as Solo Only, sit under the rows.
  extras?: IStatsBarDatum[];
  unit: [string, string];
  total?: number;
  totalNote?: string;
  unknown?: IStatsChartUnknown;
  initialRowCount?: number;
  // Role charts use the app's role colors: bottoms green, tops blue.
  leftColor?: string;
  rightColor?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({
  title,
  leftLabel,
  rightLabel,
  rows,
  extras = [],
  unit,
  total,
  totalNote,
  unknown,
  initialRowCount = DEFAULT_DIVERGING_ROWS,
  leftColor,
  rightColor,
  actions,
  className,
}) => {
  const [showAll, setShowAll] = useState(false);
  const counts = rows.flatMap((row) => [
    row.left?.count ?? 0,
    row.right?.count ?? 0,
  ]);
  const max = Math.max(...counts, 1);
  const sum =
    counts.reduce((acc, count) => acc + count, 0) +
    extras.reduce((acc, datum) => acc + datum.count, 0);
  const denominator = total ?? sum;
  const subject = statsChartSubject(title);
  const visibleRows = showAll ? rows : rows.slice(0, initialRowCount);

  function side(
    datum: IStatsBarDatum | undefined,
    direction: "left" | "right"
  ) {
    const color = direction === "left" ? leftColor : rightColor;
    const count = datum?.count ?? 0;
    const summary = datum
      ? `${datum.label}: ${statsUnitLabel(count, unit)}`
      : "None";
    return (
      <StatsBarTarget
        className={`stats-diverging-side stats-diverging-side--${direction}`}
        label={
          interactive(datum)
            ? `${datum?.actionLabel ?? `Filter by ${subject}`}: ${summary}`
            : summary
        }
        to={count > 0 ? datum?.to : undefined}
        onSelect={count > 0 ? datum?.onSelect : undefined}
      >
        <span className="stats-diverging-count">
          {count.toLocaleString(getAppLocaleCustom())}
        </span>
        <span className="stats-diverging-track">
          {count > 0 && (
            <span
              className="stats-diverging-fill"
              style={{
                width: `${Math.max((count / max) * 100, 3)}%`,
                background: color,
              }}
            />
          )}
        </span>
      </StatsBarTarget>
    );
  }

  return (
    <section className={cx("stats-bar-chart stats-diverging", className)}>
      <StatsChartHeading
        title={title}
        total={denominator}
        unit={unit}
        totalNote={totalNote}
        unknown={
          <StatsChartUnknown
            unknown={unknown}
            subject={statsChartSubject(title)}
          />
        }
        actions={actions}
      />
      {rows.length === 0 && extras.length === 0 ? (
        <div className="stats-bar-chart-empty">No data</div>
      ) : (
        <div className="stats-diverging-rows">
          <div className="stats-diverging-axis" aria-hidden="true">
            <span style={{ color: leftColor }}>← {leftLabel}</span>
            <span />
            <span style={{ color: rightColor }}>{rightLabel} →</span>
          </div>
          {visibleRows.map((row) => (
            <div className="stats-diverging-row" key={row.key}>
              {side(row.left, "left")}
              <span className="stats-diverging-label">
                {row.icon}
                {row.label}
              </span>
              {side(row.right, "right")}
            </div>
          ))}
        </div>
      )}
      {rows.length > visibleRows.length && (
        <div className="stats-bar-chart-more">
          <button
            className="stats-chip"
            onClick={() => setShowAll(true)}
            type="button"
          >
            Show all {rows.length.toLocaleString(getAppLocaleCustom())}
          </button>
        </div>
      )}
      {extras.length > 0 && (
        <div className="stats-diverging-extras">
          {extras.map((datum) => (
            <StatsBarTarget
              className="stats-chip"
              key={datum.key}
              label={`Filter by ${subject}: ${datum.label}: ${statsUnitLabel(
                datum.count,
                unit
              )}`}
              to={datum.count > 0 ? datum.to : undefined}
              onSelect={datum.count > 0 ? datum.onSelect : undefined}
            >
              {datum.label} · {datum.count.toLocaleString(getAppLocaleCustom())}
            </StatsBarTarget>
          ))}
        </div>
      )}
    </section>
  );
};

export interface IStatsPairCell {
  count: number;
  to?: StatsBarLink;
  onSelect?: () => void;
}

// Rows × columns shaded by count, such as giver × receiver ethnicity.
export const StatsPairGrid: React.FC<{
  title: string;
  rowTitle: string;
  columnTitle: string;
  rows: { key: string; label: string }[];
  columns: { key: string; label: string }[];
  cell: (rowKey: string, columnKey: string) => IStatsPairCell | undefined;
  unit: [string, string];
  total?: number;
  totalNote?: string;
  unknown?: IStatsChartUnknown;
  className?: string;
}> = ({
  title,
  rowTitle,
  columnTitle,
  rows,
  columns,
  cell,
  unit,
  total,
  totalNote,
  unknown,
  className,
}) => {
  const cells = rows.map((row) =>
    columns.map((column) => cell(row.key, column.key))
  );
  const counts = cells.flat().map((value) => value?.count ?? 0);
  const max = Math.max(...counts, 1);
  const sum = counts.reduce((acc, count) => acc + count, 0);
  const subject = statsChartSubject(title);

  return (
    <section className={cx("stats-bar-chart stats-pair-grid", className)}>
      <StatsChartHeading
        title={title}
        total={total ?? sum}
        unit={unit}
        totalNote={totalNote}
        unknown={
          <StatsChartUnknown
            unknown={unknown}
            subject={statsChartSubject(title)}
          />
        }
      />
      {rows.length === 0 ? (
        <div className="stats-bar-chart-empty">No data</div>
      ) : (
        <div className="stats-pair-grid-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col" className="stats-pair-grid-corner">
                  {rowTitle} ↓ · {columnTitle} →
                </th>
                {columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {columns.map((column, columnIndex) => {
                    const value = cells[rowIndex][columnIndex];
                    const count = value?.count ?? 0;
                    const strength = count > 0 ? 12 + (count / max) * 78 : 0;
                    return (
                      <td key={column.key}>
                        <StatsBarTarget
                          className={cx("stats-pair-grid-cell", {
                            strong: strength > 55,
                          })}
                          label={`${count > 0 ? `Filter by ${subject}: ` : ""}${
                            row.label
                          } → ${column.label}: ${statsUnitLabel(count, unit)}`}
                          to={count > 0 ? value?.to : undefined}
                          onSelect={count > 0 ? value?.onSelect : undefined}
                          style={
                            {
                              "--stats-pair-strength": `${strength}%`,
                            } as React.CSSProperties
                          }
                        >
                          {count > 0
                            ? count.toLocaleString(getAppLocaleCustom())
                            : "·"}
                        </StatsBarTarget>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
