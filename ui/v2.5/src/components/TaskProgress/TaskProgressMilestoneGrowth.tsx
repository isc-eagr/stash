import React from "react";
import { useIntl } from "react-intl";
import type { TaskProgressMilestoneDataFragment as Milestone } from "src/core/generated-graphql";
import { formatTaskProgressDate } from "../taskProgress_custom";
import { progressToday } from "./progressMath_custom";
import {
  taskProgressHistoryEntries,
  useProgressText,
} from "./progressView_custom";
import {
  taskProgressCheckpoints,
  taskProgressCheckpointTiers,
} from "./taskProgressCheckpoints_custom";
import { taskProgressCompletionCloses } from "./taskProgressScoreboard_custom";

/** Fixed series order; validated for CVD separation on the dark surface. */
export const milestoneSeriesColors = [
  "#c0703f",
  "#2f9f7f",
  "#9a6bd0",
  "#a8892a",
  "#d0577e",
  "#5b8fd6",
];

/** Milestones with trackers, up to one per series color, in list order. */
export function chartedMilestones<T extends Pick<Milestone, "trackers">>(
  milestones: readonly T[]
): T[] {
  return milestones
    .filter((milestone) => milestone.trackers.length > 0)
    .slice(0, milestoneSeriesColors.length);
}

const DAY = 86400000;
const dateValue = (date: string) => Date.parse(`${date}T00:00:00Z`);
/** Histories longer than this switch from two-week to monthly steps. */
const FORTNIGHT_SPAN_DAYS = 183;
const SCALE_TOPS = [10, 25, 50, 75, 100];

/** Every milestone's % complete every two weeks or each month, with medal days. */
export const TaskProgressMilestoneGrowth: React.FC<{
  milestones: readonly Milestone[];
}> = ({ milestones }) => {
  const t = useProgressText();
  const intl = useIntl();
  const today = progressToday();
  const shown = chartedMilestones(milestones);
  const firstDay = shown
    .flatMap((milestone) => milestone.history.map((day) => day.date))
    .reduce<string | undefined>(
      (first, date) => (!first || date < first ? date : first),
      undefined
    );
  if (!firstDay) return null;
  const step =
    dateValue(today) - dateValue(firstDay) > FORTNIGHT_SPAN_DAYS * DAY
      ? "month"
      : "fortnight";
  const series = shown.map((milestone, index) => {
    const history = taskProgressHistoryEntries(milestone.history);
    const percent =
      milestone.total_count > 0
        ? (milestone.completed_count / milestone.total_count) * 100
        : 0;
    return {
      id: milestone.id,
      name: milestone.name,
      color: milestoneSeriesColors[index],
      percent,
      points: taskProgressCompletionCloses(
        history,
        today,
        step,
        step === "month" ? 12 : 13
      ),
      medals: taskProgressCheckpoints(history, percent, today),
    };
  });
  // The chart starts on the first plotted day.
  const dates = series.flatMap((item) => item.points.map((p) => p.date));
  if (!dates.length) return null;
  const start = dates.reduce((first, date) => (date < first ? date : first));
  const span = Math.max(DAY, dateValue(today) - dateValue(start));
  const x = (date: string) =>
    Math.max(
      0,
      Math.min(100, ((dateValue(date) - dateValue(start)) / span) * 100)
    );
  // Scale to the data so small percentages still read as growth.
  const highest = Math.max(
    0,
    ...series.flatMap((item) => item.points.map((p) => p.percent))
  );
  const top = SCALE_TOPS.find((value) => highest <= value * 0.9) ?? 100;
  const y = (percent: number) =>
    100 - Math.max(0, Math.min(100, (percent / top) * 100));
  const gridlines = [0.25, 0.5, 0.75].map((fraction) => top * fraction);
  const tiers = [25, 50, 75].filter((value) => value < top);
  // Labels closer than 6% would overlap; the latest date wins.
  const ticks = [...new Set(dates)].sort().reduce<string[]>((kept, date) => {
    const last = kept[kept.length - 1];
    if (last !== undefined && x(date) - x(last) < 6) kept.pop();
    return [...kept, date];
  }, []);
  const tickLabel = (date: string) =>
    step === "month"
      ? intl.formatDate(`${date}T12:00:00Z`, {
          month: "short",
          timeZone: "UTC",
        })
      : formatTaskProgressDate(date).slice(0, 5);
  const percentLabel = (value: number) =>
    `${intl.formatNumber(value, { maximumFractionDigits: 1 })}%`;

  return (
    <section className="milestone-growth" aria-label={t("Growth over time")}>
      <div className="milestone-growth-heading">
        <div>
          <h3>{t("Growth over time")}</h3>
          <small>
            {t(
              step === "month"
                ? "% complete at each month's close"
                : "% complete every two weeks"
            )}
          </small>
        </div>
        <ul className="milestone-growth-legend">
          {series.map((item) => (
            <li key={item.id}>
              <span
                className="milestone-growth-swatch"
                style={{ background: item.color }}
              />
              {item.name} <strong>{item.percent.toFixed(1)}%</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="milestone-growth-chart">
        <div className="milestone-growth-axis" aria-hidden="true">
          {[top, ...gridlines, 0].map((value) => (
            <span key={value} style={{ top: `${y(value)}%` }}>
              {percentLabel(value)}
            </span>
          ))}
        </div>
        <div
          className="milestone-growth-plot"
          role="img"
          aria-label={series
            .map((item) => `${item.name} ${item.percent.toFixed(1)}%`)
            .join(", ")}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {gridlines.map((value) => (
              <line
                key={`grid-${value}`}
                className="milestone-growth-grid"
                x1="0"
                x2="100"
                y1={y(value)}
                y2={y(value)}
              />
            ))}
            {tiers.map((value) => (
              <line
                key={value}
                className={`milestone-growth-tier milestone-checkpoint-${value}`}
                x1="0"
                x2="100"
                y1={y(value)}
                y2={y(value)}
              />
            ))}
            {series.map(
              (item) =>
                item.points.length > 1 && (
                  <polyline
                    key={item.id}
                    points={item.points
                      .map((point) => `${x(point.date)},${y(point.percent)}`)
                      .join(" ")}
                    stroke={item.color}
                  />
                )
            )}
          </svg>
          {series.flatMap((item) =>
            item.points.map((point) => (
              <span
                key={`${item.id}-${point.date}`}
                className="milestone-growth-point"
                style={{
                  left: `${x(point.date)}%`,
                  top: `${y(point.percent)}%`,
                  background: item.color,
                }}
                title={`${item.name} · ${formatTaskProgressDate(
                  point.date
                )} · ${point.percent.toFixed(2)}%`}
              />
            ))
          )}
          {series.flatMap((item) =>
            item.medals
              .filter(({ date }) => !!date && date >= start)
              .map(({ threshold, date }) => (
                <span
                  key={`${item.id}-medal-${threshold}`}
                  className={`milestone-growth-medal milestone-checkpoint-${threshold}`}
                  style={{ left: `${x(date!)}%`, top: `${y(threshold)}%` }}
                  title={`${item.name} · ${t(
                    taskProgressCheckpointTiers.find(
                      (tier) => tier.threshold === threshold
                    )!.label
                  )} · ${formatTaskProgressDate(date!)}`}
                />
              ))
          )}
        </div>
      </div>
      <div className="milestone-growth-months" aria-hidden="true">
        {ticks.map((date) => (
          <span key={date} style={{ left: `${x(date)}%` }}>
            {tickLabel(date)}
          </span>
        ))}
      </div>
      {milestones.filter((milestone) => milestone.trackers.length > 0).length >
        shown.length && (
        <small className="milestone-growth-note">
          {t("Showing the first")} {shown.length} {t("milestones")}
        </small>
      )}
    </section>
  );
};
