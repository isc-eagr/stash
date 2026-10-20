import React from "react";
import { useIntl } from "react-intl";
import { formatTaskProgressDate } from "../taskProgress_custom";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import { useProgressText } from "./progressView_custom";
import {
  taskProgressCheckpoints,
  taskProgressCheckpointTiers,
} from "./taskProgressCheckpoints_custom";
import { taskProgressNextMedal } from "./taskProgressScoreboard_custom";

/** Progress bar with the Bronze/Silver/Gold/Alpha Sapphire medals on it. */
export const TaskProgressMedalBar: React.FC<{
  completed: number;
  total: number;
  percent: number;
  history: readonly ITaskProgressHistoryEntry[];
  /** Completed items gained in the current week, drawn as a brighter segment. */
  gain?: number;
  complete?: boolean;
  large?: boolean;
  caption?: React.ReactNode;
}> = ({
  completed,
  total,
  percent,
  history,
  gain = 0,
  complete = false,
  large = false,
  caption,
}) => {
  const t = useProgressText();
  const intl = useIntl();
  const checkpoints = taskProgressCheckpoints(history, percent);
  const next = complete ? undefined : taskProgressNextMedal(completed, total);
  const recent = total > 0 ? Math.max(0, Math.min(gain, completed)) : 0;
  const recentWidth = total > 0 ? (recent / total) * 100 : 0;
  const earlierWidth = Math.max(0, percent - recentWidth);
  const close = !!next && next.need <= Math.max(5, total * 0.02);
  return (
    <div
      className={`progress-medal-bar${
        large ? " progress-medal-bar-large" : ""
      }${complete ? " progress-medal-bar-complete" : ""}`}
    >
      <div
        className="progress-medal-track"
        role="img"
        aria-label={`${intl.formatNumber(completed)} / ${intl.formatNumber(
          total
        )} ${t("completed")}`}
      >
        <span
          className="progress-medal-fills"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        >
          <span
            className="progress-medal-fill"
            style={{ flexGrow: earlierWidth }}
          />
          <span
            className="progress-medal-gain"
            style={{ flexGrow: recentWidth }}
          />
        </span>
        {checkpoints.map(({ threshold, date, reached }) => {
          const label = t(
            taskProgressCheckpointTiers.find(
              (tier) => tier.threshold === threshold
            )!.label
          );
          const detail = date
            ? formatTaskProgressDate(date)
            : reached
            ? t("Reached")
            : next?.threshold === threshold
            ? `${intl.formatNumber(next.need)} ${t("to go")}`
            : t("Not yet");
          return (
            <span
              key={threshold}
              className={`progress-medal-coin milestone-checkpoint-${threshold}${
                reached ? " progress-medal-coin-reached" : ""
              }${
                next?.threshold === threshold ? " progress-medal-coin-next" : ""
              }`}
              style={{ left: `${threshold}%` }}
              title={`${label} · ${detail}`}
            />
          );
        })}
      </div>
      <div className="progress-medal-caption">
        <span>{caption}</span>
        <span
          className={`progress-medal-next${
            close ? " progress-medal-next-close" : ""
          }`}
        >
          {next
            ? `${intl.formatNumber(next.need)} ${t("to")} ${t(next.label)}`
            : t("Every medal earned")}
        </span>
      </div>
    </div>
  );
};
