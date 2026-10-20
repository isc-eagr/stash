import React, { useState } from "react";
import { Button, Card } from "react-bootstrap";
import { FormattedNumber, useIntl } from "react-intl";
import {
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faPencilAlt,
} from "@fortawesome/free-solid-svg-icons";
import type {
  TaskProgressMilestoneDataFragment as Milestone,
  TaskProgressTrackerDataFragment as Tracker,
} from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import { formatTaskProgressDate } from "../taskProgress_custom";
import {
  milestoneForecast,
  milestoneTargetProgress,
} from "./milestoneView_custom";
import { progressToday } from "./progressMath_custom";
import { progressLedgerSnapshot } from "./progressLedger_custom";
import {
  taskProgressHistoryEntries,
  useProgressText,
} from "./progressView_custom";
import { TaskProgressItemsDelta } from "./TaskProgressDelta";
import { TaskProgressPeriodProgress } from "./TaskProgressPeriodProgress";
import { TaskProgressFinishLabel } from "./TaskProgressForecast";
import {
  chartedMilestones,
  milestoneSeriesColors,
} from "./TaskProgressMilestoneGrowth";
import {
  TaskProgressContributions,
  taskProgressPeriodName,
} from "./TaskProgressContributions";
import {
  boundedTaskProgressReportAnchor,
  firstTaskProgressReportActivity,
  shiftTaskProgressReportPeriod,
  taskProgressPeriodComparisons,
  taskProgressReportPeriod,
} from "./taskProgressReports_custom";
import type { TaskProgressComparisonPeriod } from "./taskProgressReports_custom";

const periods: { key: TaskProgressComparisonPeriod; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const targetLabels = {
  complete: "Complete",
  overdue: "Overdue",
  unavailable: "Pace unavailable",
  ahead: "Ahead",
  on_track: "On track",
  behind: "Behind",
};

const movedOnlyKey = "task-progress-milestones-moved-only";

function readMovedOnly() {
  try {
    return localStorage.getItem(movedOnlyKey) === "true";
  } catch {
    return false;
  }
}

const MilestoneRow: React.FC<{
  milestone: Milestone;
  color?: string;
  range: TaskProgressComparisonPeriod;
  anchor: string;
  busy: boolean;
  onDetails: () => void;
  onEdit: () => void;
  onOpenTracker: (id: string) => void;
}> = ({
  milestone,
  color,
  range,
  anchor,
  busy,
  onDetails,
  onEdit,
  onOpenTracker,
}) => {
  const t = useProgressText();
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const today = progressToday();
  const snapshot = progressLedgerSnapshot(
    milestone.history,
    taskProgressReportPeriod(range, anchor, today),
    today,
    { completed: milestone.completed_count, remaining: milestone.current_count }
  );
  const comparisons = taskProgressPeriodComparisons(
    milestone.history,
    today,
    anchor
  );
  const forecast = milestoneForecast(milestone, today);
  const target = milestoneTargetProgress(
    milestone,
    forecast.days >= 3 ? forecast.netRate : 0,
    today
  );
  const empty = !milestone.trackers.length;

  return (
    <Card className="progress-tracker-card progress-score-row milestone-score-row">
      <div className="progress-score-identity">
        <div className="progress-score-title-row">
          <Button
            variant="link"
            size="sm"
            className="milestone-ledger-toggle"
            aria-expanded={expanded}
            aria-label={t("Tracker contributions")}
            title={t("Tracker contributions")}
            disabled={empty}
            onClick={() => setExpanded(!expanded)}
          >
            <Icon icon={expanded ? faChevronDown : faChevronRight} />
          </Button>
          {color && (
            <span
              className="milestone-growth-swatch"
              style={{ background: color }}
              aria-hidden="true"
            />
          )}
          <Button
            variant="link"
            className="milestone-ledger-title progress-tracker-title"
            onClick={onDetails}
          >
            {milestone.name}
          </Button>
        </div>
        {empty ? (
          <small>{t("Add trackers to see this milestone's progress.")}</small>
        ) : (
          <>
            <div className="progress-score-counts">
              <span className="progress-score-done">
                <strong>
                  <FormattedNumber value={milestone.completed_count} />
                </strong>{" "}
                {t("done")}
              </span>
              {milestone.current_count > 0 && (
                <span>
                  <strong>
                    <FormattedNumber value={milestone.current_count} />
                  </strong>{" "}
                  {t("left")}
                </span>
              )}
            </div>
            <small>
              {milestone.trackers.length}{" "}
              {t(milestone.trackers.length === 1 ? "tracker" : "trackers")}
              {milestone.target_date && target && (
                <>
                  {" · "}
                  <span
                    className={`milestone-target-${target.state.replace(
                      "_",
                      "-"
                    )}`}
                  >
                    {t(targetLabels[target.state])}
                  </span>{" "}
                  {formatTaskProgressDate(milestone.target_date)}
                  {target.state !== "complete" &&
                    target.state !== "overdue" &&
                    ` · ${target.requiredRate}/${t("day")}`}
                </>
              )}
            </small>
            {milestone.current_count > 0 && (
              <TaskProgressFinishLabel
                storageKey={`task-progress-milestone-plan-${milestone.id}`}
                history={milestone.history}
                remaining={milestone.current_count}
              />
            )}
          </>
        )}
        <div className="progress-score-actions">
          <Button size="sm" variant="primary" onClick={onDetails}>
            {t("Details")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onEdit}
            aria-label={t("Edit")}
            title={t("Edit")}
          >
            <Icon icon={faPencilAlt} />
          </Button>
        </div>
      </div>
      <TaskProgressPeriodProgress
        snapshot={snapshot}
        history={taskProgressHistoryEntries(milestone.history)}
        periodLabel={taskProgressPeriodName(range, anchor, today)}
      />
      <section
        className="progress-period-tiles progress-period-tiles-row"
        aria-label={t("Completed vs the previous period")}
      >
        {periods.map(({ key, label }) => (
          <div
            key={key}
            className={`progress-period-tile${
              key === range ? " progress-period-tile-selected" : ""
            }`}
          >
            <div className="progress-period-tile-heading">
              <span>
                {t(key === "day" && anchor === today ? "Today" : label)}
              </span>
            </div>
            <div className="progress-period-tile-value">
              <strong>
                <FormattedNumber value={comparisons[key].current.completed} />
              </strong>
              <TaskProgressItemsDelta
                current={comparisons[key].current.completed}
                previous={comparisons[key].previous.completed}
                label={comparisons[key].label}
                compact
              />
            </div>
            <small className="progress-period-tile-previous">
              {t("prev")}{" "}
              {intl.formatNumber(comparisons[key].previous.completed)}
            </small>
          </div>
        ))}
      </section>
      {expanded && (
        <div className="milestone-ledger-contributions">
          <TaskProgressContributions
            trackers={milestone.trackers}
            range={range}
            anchor={anchor}
            onOpenTracker={onOpenTracker}
          />
        </div>
      )}
    </Card>
  );
};

/** Milestones compared with their previous period, optionally only those that moved. */
export const TaskProgressMilestoneLedger: React.FC<{
  milestones: readonly Milestone[];
  trackers: readonly Tracker[];
  busy: boolean;
  onDetails: (id: string) => void;
  onEdit: (milestone: Milestone) => void;
  onOpenTracker: (id: string) => void;
}> = ({ milestones, trackers, busy, onDetails, onEdit, onOpenTracker }) => {
  const t = useProgressText();
  const intl = useIntl();
  const today = progressToday();
  const [range, setRange] = useState<TaskProgressComparisonPeriod>("week");
  const [anchor, setAnchor] = useState(today);
  const [movedOnly, setMovedOnly] = useState(readMovedOnly);
  const firstActivity =
    firstTaskProgressReportActivity([
      ...trackers.map((tracker) => tracker.history),
      ...milestones.map((milestone) => milestone.history),
    ]) ?? today;
  const period = taskProgressReportPeriod(range, anchor, today);
  const isCurrent = period.end >= today;
  const isFirst =
    period.start <= taskProgressReportPeriod(range, firstActivity, today).start;
  const step = (offset: number) =>
    setAnchor(
      boundedTaskProgressReportAnchor(
        range,
        shiftTaskProgressReportPeriod(range, period.start, offset),
        firstActivity,
        today
      )
    );
  const periodLabel = isCurrent
    ? t(range === "day" ? "Today" : `This ${range}`)
    : range === "day"
    ? formatTaskProgressDate(period.start)
    : range === "week"
    ? `${formatTaskProgressDate(period.start).slice(
        0,
        5
      )} – ${formatTaskProgressDate(period.end)}`
    : range === "month"
    ? intl.formatDate(`${period.start}T12:00:00Z`, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : period.start.slice(0, 4);
  const moved = (history: Milestone["history"]) =>
    taskProgressPeriodComparisons(history, today, anchor)[range].current
      .completed > 0;
  const visible = movedOnly
    ? milestones.filter((milestone) => moved(milestone.history))
    : milestones;
  const charted = chartedMilestones(milestones).map(
    (milestone) => milestone.id
  );
  const toggleMovedOnly = () => {
    const next = !movedOnly;
    setMovedOnly(next);
    try {
      localStorage.setItem(movedOnlyKey, String(next));
    } catch {
      /* The filter works without storage. */
    }
  };

  return (
    <section className="milestone-ledger-section">
      <div className="milestone-ledger-toolbar">
        <div
          className="progress-segmented"
          role="group"
          aria-label={t("Period")}
        >
          {periods.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={range === key ? "active" : undefined}
              aria-pressed={range === key}
              onClick={() => {
                setRange(key);
                setAnchor(today);
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="milestone-period-nav">
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("Previous period")}
            title={t("Previous period")}
            disabled={isFirst}
            onClick={() => step(-1)}
          >
            <Icon icon={faChevronLeft} />
          </Button>
          <strong aria-live="polite">{periodLabel}</strong>
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("Next period")}
            title={t("Next period")}
            disabled={isCurrent}
            onClick={() => step(1)}
          >
            <Icon icon={faChevronRight} />
          </Button>
          {!isCurrent && (
            <Button variant="link" size="sm" onClick={() => setAnchor(today)}>
              {t("Current")}
            </Button>
          )}
        </div>
        <div className="progress-segmented">
          <button
            type="button"
            className={movedOnly ? "active" : undefined}
            aria-pressed={movedOnly}
            onClick={toggleMovedOnly}
          >
            {t("Moved only")}
          </button>
        </div>
      </div>
      <div className="progress-tracker-list">
        {visible.map((milestone) => {
          const index = charted.indexOf(milestone.id);
          return (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              color={index >= 0 ? milestoneSeriesColors[index] : undefined}
              range={range}
              anchor={anchor}
              busy={busy}
              onDetails={() => onDetails(milestone.id)}
              onEdit={() => onEdit(milestone)}
              onOpenTracker={onOpenTracker}
            />
          );
        })}
      </div>
      {movedOnly && !visible.length && (
        <p className="milestone-ledger-empty">
          {t("No milestone moved in this period.")}
        </p>
      )}
    </section>
  );
};
