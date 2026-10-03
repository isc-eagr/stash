import React from "react";
import { FormattedNumber } from "react-intl";
import type { ITaskProgressReportRow } from "./taskProgressReports_custom";
import {
  taskProgressDailyGoalState,
  useProgressText,
} from "./progressView_custom";
import {
  TaskProgressItemsDelta,
  TaskProgressPercentDelta,
} from "./TaskProgressDelta";

export const SignedPercent: React.FC<{ value: number }> = ({ value }) => (
  <FormattedNumber
    value={value / 100}
    style="percent"
    signDisplay="exceptZero"
    minimumFractionDigits={2}
    maximumFractionDigits={2}
  />
);

export const ReportMetrics: React.FC<{
  item: ITaskProgressReportRow & { previous: ITaskProgressReportRow };
  comparison: string;
}> = ({ item, comparison }) => (
  <>
    <td className="text-right">
      <FormattedNumber value={item.totalCompleted} />
    </td>
    <td className="text-right">
      {item.goalDays > 0 ? `${item.goalDaysMet}/${item.goalDays}` : "—"}
    </td>
    <td className="progress-report-goal-cell">
      <span>
        <FormattedNumber value={item.completed} />
        {item.goalDays > 0 && (
          <>
            {" / "}
            <FormattedNumber value={item.expected} />
          </>
        )}
      </span>
      {item.goalDays > 0 && (
        <span className="progress-report-meter" aria-hidden="true">
          <span
            className={`progress-report-goal-${taskProgressDailyGoalState(
              item.completed,
              item.expected
            )}`}
            style={{
              width: `${Math.min(
                100,
                item.expected > 0 ? (item.completed / item.expected) * 100 : 0
              )}%`,
            }}
          />
        </span>
      )}
    </td>
    <td className="text-right">
      <FormattedNumber value={item.completed} />
      <TaskProgressItemsDelta
        current={item.completed}
        previous={item.previous.completed}
        label={comparison}
        compact
      />
    </td>
    <td className="text-right">
      <SignedPercent value={item.advanced} />
      <TaskProgressPercentDelta
        current={item.advanced}
        previous={item.previous.advanced}
        label={comparison}
        compact
      />
    </td>
  </>
);

export const ReportHeadings: React.FC<{ name: string; share?: boolean }> = ({
  name,
  share,
}) => {
  const t = useProgressText();
  return (
    <thead>
      <tr>
        <th scope="col">{t(name)}</th>
        <th className="text-right" scope="col">
          {t("Total completed")}
        </th>
        <th className="text-right" scope="col">
          {t("Goal days met")}
        </th>
        <th scope="col">{t("Actual / Goal")}</th>
        <th className="text-right" scope="col">
          {t("Items Completed")}
        </th>
        <th className="text-right" scope="col">
          {t("% Advanced")}
        </th>
        {share && <th scope="col">{t("Share")}</th>}
      </tr>
    </thead>
  );
};
