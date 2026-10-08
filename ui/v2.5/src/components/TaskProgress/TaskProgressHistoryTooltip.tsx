import React from "react";
import { useIntl } from "react-intl";
import {
  formatTaskProgressDate,
  taskProgressHistoryPercentages,
} from "../taskProgress_custom";
import type { ITaskProgressHistoryPoint } from "../taskProgress_custom";
import { useProgressText } from "./progressView_custom";

export type TaskProgressHistoryView = "remaining" | "cumulative";

export const TaskProgressHistoryTooltip: React.FC<{
  point: ITaskProgressHistoryPoint;
  view: TaskProgressHistoryView;
  showIncoming?: boolean;
}> = ({ point, view, showIncoming }) => {
  const intl = useIntl();
  const t = useProgressText();
  const percentages = taskProgressHistoryPercentages(point);
  const percentage = (value: number, signed = false) =>
    `${signed && value > 0 ? "+" : ""}${intl.formatNumber(value, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}%`;
  return (
    <>
      <strong className="task-progress-history-chart-tooltip-title">
        {formatTaskProgressDate(point.date)}
      </strong>
      <div className="task-progress-history-chart-tooltip-metric">
        <span>{t("Completed this day")}</span>
        <strong>{intl.formatNumber(point.completed)}</strong>
      </div>
      <dl>
        <div>
          <dt>
            {t(view === "remaining" ? "Remaining" : "Cumulative by this day")}
          </dt>
          <dd>
            {intl.formatNumber(
              view === "remaining" ? point.remaining : point.cumulativeCompleted
            )}
            <small>
              {percentage(
                view === "remaining"
                  ? percentages.remainingPercentage
                  : percentages.completedPercentage
              )}
            </small>
          </dd>
        </div>
        <div>
          <dt>{t("Progress this day")}</dt>
          <dd>{percentage(percentages.periodProgressPercentage, true)}</dd>
        </div>
        {showIncoming && (
          <div>
            <dt>{t("Incoming")}</dt>
            <dd>{intl.formatNumber(point.incoming)}</dd>
          </div>
        )}
        {!!point.goalPerDay && (
          <div>
            <dt>{t("Goal")}</dt>
            <dd>{intl.formatNumber(point.goalPerDay)}</dd>
          </div>
        )}
        {point.baselineCount !== undefined && (
          <div>
            <dt>{t("Baseline")}</dt>
            <dd>{intl.formatNumber(point.baselineCount)}</dd>
          </div>
        )}
      </dl>
    </>
  );
};
