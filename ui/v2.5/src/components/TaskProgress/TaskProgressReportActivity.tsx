import React from "react";
import useResizeObserver from "@react-hook/resize-observer";
import { formatTaskProgressDate } from "../taskProgress_custom";
import {
  taskProgressDailyGoalState,
  useProgressText,
} from "./progressView_custom";
import {
  taskProgressActivityLevel,
  taskProgressReportMonths,
  taskProgressReportWeeks,
} from "./taskProgressReports_custom";
import type {
  ITaskProgressReportDay,
  TaskProgressReportRange,
} from "./taskProgressReports_custom";
import { taskProgressTrendGeometry } from "./taskProgressTrend_custom";

interface IActivityProps {
  range: TaskProgressReportRange;
  days: readonly ITaskProgressReportDay[];
  selectedDate?: string;
  onSelectDay?: (date: string) => void;
  renderDayTooltip?: (date: string) => React.ReactNode;
}

interface IDayInteraction {
  selectedDate?: string;
  onSelectDay?: (date: string) => void;
  onHover: (day: ITaskProgressReportDay, element: Element) => void;
  onLeave: () => void;
}

const ActivityDay: React.FC<{
  day: ITaskProgressReportDay;
  interaction: IDayInteraction;
}> = ({ day, interaction, children }) => {
  const label = dayTitle(day, useProgressText()("completed"));
  const hover = (event: React.SyntheticEvent<HTMLElement>) =>
    interaction.onHover(day, event.currentTarget);
  return interaction.onSelectDay ? (
    <button
      type="button"
      className="progress-activity-day"
      disabled={day.future}
      aria-label={label}
      aria-pressed={interaction.selectedDate === day.date}
      onClick={() => interaction.onSelectDay?.(day.date)}
      onMouseEnter={hover}
      onMouseLeave={interaction.onLeave}
      onFocus={hover}
      onBlur={interaction.onLeave}
    >
      {children}
    </button>
  ) : (
    <span
      className="progress-activity-day"
      role="img"
      aria-label={label}
      tabIndex={day.future ? undefined : 0}
      onMouseEnter={hover}
      onMouseLeave={interaction.onLeave}
      onFocus={hover}
      onBlur={interaction.onLeave}
    >
      {children}
    </span>
  );
};

interface IBar {
  key: string;
  label: string;
  value: number;
  goal?: number;
  future?: boolean;
  day?: ITaskProgressReportDay;
}

const weekdayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  timeZone: "UTC",
});
const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
  // 2024-01-01 was a Monday.
  weekdayFormat.format(new Date(Date.UTC(2024, 0, 1 + index)))
);

function dayTitle(day: ITaskProgressReportDay, completedLabel: string) {
  return `${formatTaskProgressDate(day.date)}: ${
    day.completed
  } ${completedLabel}${
    day.goal > 0 && !day.future
      ? ` / ${day.goal} (${Math.round((day.completed / day.goal) * 100)}%)`
      : ""
  }`;
}

function dayColorClass(day: ITaskProgressReportDay, max: number) {
  return !day.future && day.goal > 0
    ? `progress-report-goal-${taskProgressDailyGoalState(
        day.completed,
        day.goal
      )}`
    : `progress-report-heat-${
        day.future ? 0 : taskProgressActivityLevel(day, max)
      }`;
}

const ReportBars: React.FC<{
  bars: readonly IBar[];
  label: string;
  interaction: IDayInteraction;
}> = ({ bars, label, interaction }) => {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div className="progress-report-bars" role="list" aria-label={label}>
      {bars.map((bar) => (
        <div
          className={`progress-report-bar${
            bar.future ? " progress-report-future" : ""
          }`}
          key={bar.key}
          role="listitem"
          aria-label={`${bar.label}: ${bar.value}`}
        >
          {bar.day ? (
            <ActivityDay day={bar.day} interaction={interaction}>
              <BarContent bar={bar} max={max} />
            </ActivityDay>
          ) : (
            <BarContent bar={bar} max={max} />
          )}
        </div>
      ))}
    </div>
  );
};

function BarContent({ bar, max }: { bar: IBar; max: number }) {
  return (
    <>
      <span className="progress-report-bar-value">
        {bar.future ? "" : bar.value}
      </span>
      <span className="progress-report-bar-track">
        <span
          className={
            !bar.future && bar.goal && bar.goal > 0
              ? `progress-report-goal-${taskProgressDailyGoalState(
                  bar.value,
                  bar.goal
                )}`
              : undefined
          }
          style={{ height: `${(bar.value / max) * 100}%` }}
        />
      </span>
      <span className="progress-report-bar-label">{bar.label}</span>
    </>
  );
}

const HeatLegend: React.FC<{ goal: boolean }> = ({ goal }) => {
  const t = useProgressText();
  return (
    <div className="progress-report-heat-legend" aria-hidden="true">
      {t(goal ? "Daily goal" : "Less")}
      {goal
        ? [
            { state: "red", label: "≤25%" },
            { state: "orange", label: "25–50%" },
            { state: "yellow", label: "50–80%" },
            { state: "green", label: "80–100%" },
            { state: "sapphire", label: ">100%" },
          ].map(({ state, label }) => (
            <span
              className={`progress-report-goal-${state}`}
              title={label}
              key={state}
            />
          ))
        : [0, 1, 2, 3, 4].map((level) => (
            <span className={`progress-report-heat-${level}`} key={level} />
          ))}
      {!goal && t("More")}
    </div>
  );
};

const ActivityContents: React.FC<
  IActivityProps & { interaction: IDayInteraction; width: number }
> = ({ range, days, interaction, width }) => {
  const t = useProgressText();
  const completedLabel = t("completed");
  const max = Math.max(0, ...days.map((day) => day.completed));
  const hasGoal = days.some((day) => !day.future && day.goal > 0);

  if (!days.length) return null;

  if (range === "day") {
    const chart = taskProgressTrendGeometry(days, width);
    const tickCount = Math.min(width < 480 ? 3 : 6, days.length);
    const ticks = new Set(
      Array.from({ length: tickCount }, (_, index) =>
        Math.round((index * (days.length - 1)) / Math.max(1, tickCount - 1))
      )
    );
    return (
      <div className="progress-report-trend">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label={t("Daily completions")}
        >
          {[...new Set([0, Math.round(chart.max / 2), chart.max])].map(
            (value) => (
              <g key={value} aria-hidden="true">
                <line
                  className="progress-report-trend-grid"
                  x1={chart.left}
                  x2={chart.right}
                  y1={chart.y(value)}
                  y2={chart.y(value)}
                />
                <text
                  x={chart.left - 8}
                  y={chart.y(value) + 4}
                  textAnchor="end"
                >
                  {value}
                </text>
              </g>
            )
          )}
          <path
            className="progress-report-trend-area"
            d={chart.area}
            aria-hidden="true"
          />
          <path
            className="progress-report-trend-line"
            d={chart.line}
            aria-hidden="true"
          />
          {hasGoal && (
            <path
              className="progress-report-trend-goal"
              d={chart.goal}
              aria-hidden="true"
            />
          )}
          {chart.points.map((day, index) => (
            <g
              key={day.date}
              className={`progress-report-trend-point${
                interaction.selectedDate === day.date ? " selected" : ""
              }`}
              role={interaction.onSelectDay ? "button" : "img"}
              aria-label={dayTitle(day, completedLabel)}
              aria-pressed={
                interaction.onSelectDay
                  ? interaction.selectedDate === day.date
                  : undefined
              }
              tabIndex={day.future ? undefined : 0}
              onMouseEnter={(event) =>
                interaction.onHover(day, event.currentTarget)
              }
              onMouseLeave={interaction.onLeave}
              onFocus={(event) => interaction.onHover(day, event.currentTarget)}
              onBlur={interaction.onLeave}
              onClick={() => {
                if (!day.future) interaction.onSelectDay?.(day.date);
              }}
              onKeyDown={(event) => {
                if (
                  !day.future &&
                  interaction.onSelectDay &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  interaction.onSelectDay(day.date);
                }
              }}
            >
              <circle
                className="progress-report-trend-hit"
                cx={day.x}
                cy={day.y}
                r="12"
              />
              <circle
                className={
                  !day.future && day.goal > 0
                    ? `progress-report-goal-${taskProgressDailyGoalState(
                        day.completed,
                        day.goal
                      )}`
                    : "progress-report-trend-dot"
                }
                cx={day.x}
                cy={day.y}
                r={interaction.selectedDate === day.date ? 6 : 4}
              />
              {ticks.has(index) && (
                <text x={day.x} y={chart.height - 10} textAnchor="middle">
                  {formatTaskProgressDate(day.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
        {hasGoal && (
          <div className="progress-report-trend-goal-label">
            {t("Goal")} — —
          </div>
        )}
        <HeatLegend goal={hasGoal} />
      </div>
    );
  }

  if (range === "week") {
    return (
      <ReportBars
        label={t("Daily completions")}
        interaction={interaction}
        bars={days.map((day) => ({
          key: day.date,
          label: `${weekdayFormat.format(
            new Date(`${day.date}T00:00Z`)
          )} ${day.date.slice(8)}`,
          value: day.completed,
          goal: day.goal,
          future: day.future,
          day,
        }))}
      />
    );
  }

  if (range === "month") {
    return (
      <div className="progress-report-calendar">
        <div className="progress-report-calendar-grid" role="grid">
          <div role="row" className="progress-report-calendar-row">
            {weekdayLabels.map((label) => (
              <span role="columnheader" key={label}>
                {label}
              </span>
            ))}
          </div>
          {taskProgressReportWeeks(days).map((week, index) => (
            <div
              role="row"
              className="progress-report-calendar-row"
              key={week.find(Boolean)?.date ?? index}
            >
              {week.map((day, slot) =>
                day ? (
                  <span
                    role="gridcell"
                    className={`${dayColorClass(day, max)}${
                      day.future ? " progress-report-future" : ""
                    }`}
                    key={day.date}
                  >
                    <ActivityDay day={day} interaction={interaction}>
                      <small>{Number(day.date.slice(8))}</small>
                      {day.completed > 0 && <strong>{day.completed}</strong>}
                    </ActivityDay>
                  </span>
                ) : (
                  <span role="gridcell" key={`empty-${slot}`} />
                )
              )}
            </div>
          ))}
        </div>
        <HeatLegend goal={hasGoal} />
      </div>
    );
  }

  const weeks = taskProgressReportWeeks(days);
  return (
    <div className="progress-report-year">
      <div className="progress-report-heatmap-scroll">
        <div
          className="progress-report-heatmap"
          role="img"
          aria-label={t("Daily completions")}
        >
          <div className="progress-report-heatmap-days" aria-hidden="true">
            {weekdayLabels.map((label, index) => (
              <span key={label}>{index % 2 === 0 ? label : ""}</span>
            ))}
          </div>
          {weeks.map((week, index) => {
            const monthStart = week.find((day) => day?.date.endsWith("-01"));
            return (
              <div
                className="progress-report-heatmap-week"
                key={week.find(Boolean)?.date ?? index}
              >
                <span className="progress-report-heatmap-month">
                  {monthStart
                    ? monthFormat.format(new Date(`${monthStart.date}T00:00Z`))
                    : ""}
                </span>
                {week.map((day, slot) => (
                  <span
                    className={
                      day
                        ? `${dayColorClass(day, max)}${
                            day.future ? " progress-report-future" : ""
                          }`
                        : "progress-report-heatmap-empty"
                    }
                    key={day?.date ?? `empty-${slot}`}
                  >
                    {day && <ActivityDay day={day} interaction={interaction} />}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <HeatLegend goal={hasGoal} />
      <ReportBars
        label={t("Monthly completions")}
        interaction={interaction}
        bars={taskProgressReportMonths(days).map((value, index) => {
          const start = `${days[0].date.slice(0, 4)}-${String(
            index + 1
          ).padStart(2, "0")}-01`;
          return {
            key: start,
            label: monthFormat.format(new Date(`${start}T00:00Z`)),
            value,
            goal: days.reduce(
              (sum, day) =>
                !day.future && Number(day.date.slice(5, 7)) === index + 1
                  ? sum + day.goal
                  : sum,
              0
            ),
            future: days.find((day) => day.date === start)?.future,
          };
        })}
      />
    </div>
  );
};

export const TaskProgressReportActivity: React.FC<IActivityProps> = (props) => {
  const t = useProgressText();
  const root = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(720);
  useResizeObserver(root, (entry) =>
    setWidth(Math.max(280, entry.contentRect.width))
  );
  React.useEffect(() => {
    if (root.current) setWidth(Math.max(280, root.current.clientWidth));
  }, []);
  const [hover, setHover] = React.useState<{
    day: ITaskProgressReportDay;
    left: number;
    top: number;
  }>();
  const interaction: IDayInteraction = {
    selectedDate: props.selectedDate,
    onSelectDay: props.onSelectDay,
    onHover: (day, element) => {
      if (day.future || !root.current) return;
      const bounds = root.current.getBoundingClientRect();
      const target = element.getBoundingClientRect();
      setHover({
        day,
        left: target.left + target.width / 2 - bounds.left,
        top: target.bottom - bounds.top,
      });
    },
    onLeave: () => setHover(undefined),
  };
  return (
    <div className="progress-activity-chart" ref={root}>
      <ActivityContents {...props} interaction={interaction} width={width} />
      {hover && props.days.some((day) => day.date === hover.day.date) && (
        <div
          className="task-progress-history-chart-tooltip below"
          role="tooltip"
          style={{
            left: `clamp(7rem, ${hover.left}px, calc(100% - 7rem))`,
            top: hover.top,
          }}
        >
          {props.renderDayTooltip?.(hover.day.date) ?? (
            <>
              <strong className="task-progress-history-chart-tooltip-title">
                {formatTaskProgressDate(hover.day.date)}
              </strong>
              <div className="task-progress-history-chart-tooltip-metric">
                <span>{t("completed")}</span>
                <strong>{hover.day.completed}</strong>
              </div>
              {hover.day.goal > 0 && (
                <div>
                  {t("Daily goal")}: {hover.day.goal} (
                  {Math.round((hover.day.completed / hover.day.goal) * 100)}%)
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
