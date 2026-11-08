import { formatAppDecimalCustom } from "src/utils/appLocale_custom"; // CUSTOM
import React from "react";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import type { IProgressLedgerSnapshot } from "./progressLedger_custom";
import { useProgressText } from "./progressView_custom";
import { TaskProgressCounts } from "./TaskProgressCounts";
import { TaskProgressMedalBar } from "./TaskProgressMedalBar";
import { taskProgressDisplayPercentChange } from "./taskProgressScoreboard_custom"; // CUSTOM

/** Previous close → current percentage. */
const TaskProgressPercentChange: React.FC<{
  snapshot: IProgressLedgerSnapshot;
}> = ({ snapshot: { percent, previousPercent } }) => {
  const t = useProgressText();
  return (
    <div
      className="progress-score-percent progress-score-percent-change"
      aria-label={t("Previous close → current completion")}
    >
      <span>
        {previousPercent === undefined
          ? "—"
          : `${formatAppDecimalCustom(previousPercent, 2)}%`}
      </span>
      <span aria-hidden="true">→</span>
      <strong>{formatAppDecimalCustom(percent, 2)}%</strong>
    </div>
  );
};

/**
 * Previous close → current percentage and the counts above the medal bar, the
 * period's gain highlighted, and the points it added.
 */
export const TaskProgressPeriodProgress: React.FC<{
  snapshot: IProgressLedgerSnapshot;
  history: readonly ITaskProgressHistoryEntry[];
  /** Untranslated period name, such as "this week". */
  periodLabel: string;
  /** Current done and left counts; omitted while there is nothing to count. */
  counts?: { done: number; left: number };
}> = ({ snapshot, history, periodLabel, counts }) => {
  const t = useProgressText();
  const { completed, total, percent, previousPercent, netCompletedGain } =
    snapshot;
  // CUSTOM: Round before formatting and choosing the change color.
  const points = taskProgressDisplayPercentChange(
    previousPercent !== undefined ? percent - previousPercent : undefined
  );
  return (
    <div className="progress-score-progress">
      {counts ? (
        <TaskProgressCounts
          percent={<TaskProgressPercentChange snapshot={snapshot} />}
          done={counts.done}
          previousDone={snapshot.previousCompleted}
          left={counts.left}
        />
      ) : (
        <TaskProgressPercentChange snapshot={snapshot} />
      )}
      <TaskProgressMedalBar
        completed={completed}
        total={total}
        percent={percent}
        gain={netCompletedGain}
        history={history}
        complete={total > 0 && completed >= total}
        caption={
          points !== undefined && (
            <>
              <strong
                className={
                  points >= 0 ? "progress-score-gain" : "progress-score-loss"
                }
              >
                {points > 0 ? "+" : ""}
                {formatAppDecimalCustom(points, 2)}%
              </strong>{" "}
              {t(periodLabel)}
            </>
          )
        }
      />
    </div>
  );
};
