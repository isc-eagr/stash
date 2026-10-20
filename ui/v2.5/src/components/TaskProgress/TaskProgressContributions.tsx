import React from "react";
import { Button } from "react-bootstrap";
import { FormattedNumber } from "react-intl";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import {
  progressToday,
  taskProgressCompletedCount,
} from "./progressMath_custom";
import { progressLedgerSnapshot } from "./progressLedger_custom";
import {
  taskProgressHistoryEntries,
  useProgressText,
} from "./progressView_custom";
import { TaskProgressItemsDelta } from "./TaskProgressDelta";
import { TaskProgressPeriodProgress } from "./TaskProgressPeriodProgress";
import {
  taskProgressPeriodComparisons,
  taskProgressReportPeriod,
} from "./taskProgressReports_custom";
import type { TaskProgressComparisonPeriod } from "./taskProgressReports_custom";

type ContributionTracker = Pick<
  Tracker,
  | "id"
  | "title"
  | "history"
  | "mode"
  | "goal"
  | "current_count"
  | "completed_count"
>;

/** Untranslated name for the period containing `anchor`, such as "this week". */
export function taskProgressPeriodName(
  range: TaskProgressComparisonPeriod,
  anchor: string,
  today = progressToday()
) {
  const { end } = taskProgressReportPeriod(range, anchor, today);
  if (end >= today) return range === "day" ? "today" : `this ${range}`;
  return `selected ${range}`;
}

/**
 * A milestone's trackers as nested scoreboard rows for the period containing
 * `anchor`: busiest first, trackers that completed nothing folded away.
 */
export const TaskProgressContributions: React.FC<{
  trackers: readonly ContributionTracker[];
  range: TaskProgressComparisonPeriod;
  anchor: string;
  onOpenTracker: (id: string) => void;
}> = ({ trackers, range, anchor, onOpenTracker }) => {
  const t = useProgressText();
  const today = progressToday();
  const period = taskProgressReportPeriod(range, anchor, today);
  const periodName = taskProgressPeriodName(range, anchor, today);
  const rows = trackers
    .map((tracker) => {
      const comparison = taskProgressPeriodComparisons(
        tracker.history,
        today,
        anchor
      )[range];
      const completed = taskProgressCompletedCount(tracker);
      return {
        tracker,
        completed,
        snapshot: progressLedgerSnapshot(tracker.history, period, today, {
          completed,
          remaining: tracker.current_count,
        }),
        comparison,
      };
    })
    .sort(
      (a, b) =>
        b.comparison.current.completed - a.comparison.current.completed ||
        a.tracker.title.localeCompare(b.tracker.title)
    );
  const active = rows.filter((row) => row.comparison.current.completed > 0);
  const idle = rows.filter((row) => row.comparison.current.completed === 0);
  const renderRow = ({
    tracker,
    completed,
    snapshot,
    comparison,
  }: (typeof rows)[number]) => (
    <div className="progress-score-row milestone-subrow" key={tracker.id}>
      <div className="progress-score-identity">
        <Button
          variant="link"
          className="milestone-ledger-title progress-tracker-title"
          onClick={() => onOpenTracker(tracker.id)}
        >
          {tracker.title}
        </Button>
        <div className="progress-score-counts">
          <span className="progress-score-done">
            <strong>
              <FormattedNumber value={completed} />
            </strong>{" "}
            {t("done")}
          </span>
          {tracker.current_count > 0 && (
            <span>
              <strong>
                <FormattedNumber value={tracker.current_count} />
              </strong>{" "}
              {t("left")}
            </span>
          )}
        </div>
      </div>
      <TaskProgressPeriodProgress
        snapshot={snapshot}
        history={taskProgressHistoryEntries(tracker.history)}
        periodLabel={periodName}
      />
      <div className="milestone-subrow-period">
        <span>
          <strong>
            <FormattedNumber value={comparison.current.completed} />
          </strong>{" "}
          {t(periodName)}
        </span>
        <small>
          <TaskProgressItemsDelta
            current={comparison.current.completed}
            previous={comparison.previous.completed}
            label={comparison.label}
            compact
          />{" "}
          {t("prev")} <FormattedNumber value={comparison.previous.completed} />
        </small>
      </div>
    </div>
  );

  return (
    <div className="milestone-subrows">
      {active.length ? (
        active.map(renderRow)
      ) : (
        <p className="milestone-subrows-empty">
          {t("No tracker completed anything in this period.")}
        </p>
      )}
      {!!idle.length && (
        <details className="milestone-subrows-idle">
          <summary>
            {idle.length} {t("trackers with no activity")} · {t(periodName)}
          </summary>
          {idle.map(renderRow)}
        </details>
      )}
    </div>
  );
};
