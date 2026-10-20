import React from "react";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import type { IProgressLedgerSnapshot } from "./progressLedger_custom";
import { useProgressText } from "./progressView_custom";
import { TaskProgressMedalBar } from "./TaskProgressMedalBar";

/**
 * Previous close → current percentage with the medal bar, the period's gain
 * highlighted, and the points it added.
 */
export const TaskProgressPeriodProgress: React.FC<{
  snapshot: IProgressLedgerSnapshot;
  history: readonly ITaskProgressHistoryEntry[];
  /** Untranslated period name, such as "this week". */
  periodLabel: string;
}> = ({ snapshot, history, periodLabel }) => {
  const t = useProgressText();
  const { completed, total, percent, previousPercent, netCompletedGain } =
    snapshot;
  const points =
    previousPercent !== undefined ? percent - previousPercent : undefined;
  return (
    <div className="progress-score-progress">
      <div
        className="progress-score-percent progress-score-percent-change"
        aria-label={t("Previous close → current completion")}
      >
        <span>
          {previousPercent === undefined
            ? "—"
            : `${previousPercent.toFixed(2)}%`}
        </span>
        <span aria-hidden="true">→</span>
        <strong>{percent.toFixed(2)}%</strong>
      </div>
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
                {points >= 0 ? "+" : ""}
                {points.toFixed(2)}%
              </strong>{" "}
              {t(periodLabel)}
            </>
          )
        }
      />
    </div>
  );
};
