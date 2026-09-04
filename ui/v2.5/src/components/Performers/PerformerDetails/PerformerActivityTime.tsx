import React from "react";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { getScenePerformerOverviewActivityMetrics } from "src/utils/scenePerformerOverview_custom";
import TextUtils from "src/utils/text";

interface IProps {
  activityStats: GQL.PerformerActivityStats;
  className?: string;
  headingId: string;
}

export const PerformerActivityTime: React.FC<IProps> = ({
  activityStats,
  className,
  headingId,
}) => {
  const metrics = getScenePerformerOverviewActivityMetrics(activityStats);

  return (
    <section
      aria-labelledby={headingId}
      className={cx("performer-activity-time", className)}
    >
      <h3 id={headingId}>Activity Time</h3>
      <div className="performer-activity-time-grid">
        {metrics.map((metric) => (
          <div
            className={`performer-activity-time-metric is-${metric.role}`}
            key={metric.key}
          >
            <span>{metric.label}</span>
            <strong>{TextUtils.secondsToTimestamp(metric.seconds)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
};
