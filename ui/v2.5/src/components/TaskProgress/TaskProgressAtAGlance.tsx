import React from "react";
import { FormattedNumber } from "react-intl";
import type { TaskProgressTrackerDataFragment as Tracker } from "src/core/generated-graphql";
import {
  progressPercentage,
  taskProgressCompletedCount,
} from "./progressMath_custom";
import { useProgressText } from "./progressView_custom";

interface IProps {
  tracker: Tracker;
}

export const TaskProgressAtAGlance: React.FC<IProps> = ({ tracker }) => {
  const t = useProgressText();
  const percentage = progressPercentage(tracker);
  const completed = tracker.status === "COMPLETED";
  const metrics = [
    {
      label: t("Items completed"),
      value: <FormattedNumber value={taskProgressCompletedCount(tracker)} />,
    },
    ...(!completed
      ? [
          {
            label: t("Items remaining"),
            value: <FormattedNumber value={tracker.current_count} />,
          },
        ]
      : []),
    {
      label: t("Percentage completed"),
      value: `${percentage.toFixed(2)}%`,
    },
    ...(!completed
      ? [
          {
            label: t("Percentage remaining"),
            value: `${Math.max(0, 100 - percentage).toFixed(2)}%`,
          },
        ]
      : []),
  ];

  return (
    <section
      className={`progress-tracker-at-a-glance${
        completed ? " progress-tracker-at-a-glance-completed" : ""
      }`}
      aria-label={t("Tracker summary")}
    >
      {metrics.map((metric) => (
        <div className="progress-tracker-at-a-glance-card" key={metric.label}>
          <strong>{metric.value}</strong>
          <span>{metric.label}</span>
        </div>
      ))}
    </section>
  );
};
