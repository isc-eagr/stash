import React from "react";
import { formatTaskProgressDate } from "../taskProgress_custom";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import { useProgressText } from "./progressView_custom";
import {
  taskProgressCheckpoints,
  taskProgressCheckpointTiers,
} from "./taskProgressCheckpoints_custom";

export const TaskProgressCheckpoints: React.FC<{
  history: readonly ITaskProgressHistoryEntry[];
  percentage: number;
  today?: string;
  compact?: boolean;
}> = ({ history, percentage, today, compact }) => {
  const t = useProgressText();
  const checkpoints = taskProgressCheckpoints(history, percentage, today);
  return (
    <ul
      className={`milestone-checkpoints${
        compact ? " progress-checkpoints-compact" : ""
      }`}
      aria-label={t("Checkpoints")}
    >
      {checkpoints.map(({ threshold, date, reached }) => (
        <li
          className={`milestone-checkpoint milestone-checkpoint-${threshold}${
            reached ? " milestone-checkpoint-reached" : ""
          }`}
          key={threshold}
          title={t(
            taskProgressCheckpointTiers.find(
              (tier) => tier.threshold === threshold
            )!.label
          )}
        >
          <strong className="milestone-checkpoint-medal">{threshold}%</strong>
          <small>
            {date
              ? formatTaskProgressDate(date)
              : t(reached ? "Reached" : "Not yet")}
          </small>
        </li>
      ))}
    </ul>
  );
};
