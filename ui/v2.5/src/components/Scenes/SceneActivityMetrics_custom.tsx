import React, { useMemo } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  faBan,
  faCheckCircle,
  faClock,
  faHand,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { useConfigurationContext } from "src/hooks/Config";
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";
import {
  getSceneActivityMetrics,
  type SceneActivityMetric,
  type SceneActivityScene,
} from "./sceneActivityMetricsData_custom";
import { catalogCardSortHighlightClassCustom } from "../Shared/catalogCardSortHighlight_custom";
import cx from "classnames";

// CUSTOM: scene activity duration metrics
interface ISceneActivityMetricsProps {
  scene: SceneActivityScene;
  className?: string;
  activeSortBy?: string;
}

function renderSceneActivityMetric(
  scene: SceneActivityScene,
  metric: SceneActivityMetric,
  activeSortBy?: string
) {
  const tooltip = `${metric.label}: ${metric.percent}%`;
  const tooltipId = `scene-activity-${scene.id}-${metric.key}`;

  return (
    <OverlayTrigger
      key={metric.key}
      overlay={<Tooltip id={tooltipId}>{tooltip}</Tooltip>}
      placement="bottom"
    >
      <span
        className={cx(
          "scene-activity-metric",
          `scene-activity-metric--${metric.key}`,
          catalogCardSortHighlightClassCustom(
            activeSortBy,
            `${metric.key}_activity_percent`
          )
        )}
        aria-label={tooltip}
      >
        {metric.key === "sex" && (
          <img className="scene-activity-metric__svg" src={gaySvg} alt="" />
        )}
        {metric.key === "oral" && (
          <img className="scene-activity-metric__svg" src={mouthSvg} alt="" />
        )}
        {metric.key === "solo" && (
          <Icon icon={faHand} className="scene-activity-metric__hand" />
        )}
        {metric.key === "other" && (
          <Icon icon={faClock} className="scene-activity-metric__other" />
        )}
        {metric.key === "outstanding" && (
          <Icon icon={faStar} className="scene-activity-metric__outstanding" />
        )}
        {metric.key === "standard" && (
          <Icon
            icon={faCheckCircle}
            className="scene-activity-metric__standard"
          />
        )}
        {metric.key === "unusable" && (
          <Icon icon={faBan} className="scene-activity-metric__unusable" />
        )}
        <span>{metric.percent}%</span>
      </span>
    </OverlayTrigger>
  );
}

export const SceneActivityMetrics: React.FC<ISceneActivityMetricsProps> = ({
  scene,
  className,
  activeSortBy,
}) => {
  const { configuration } = useConfigurationContext();
  const activityMetrics = useMemo(
    () => getSceneActivityMetrics(scene, configuration?.ui?.roleTagIds ?? {}),
    [configuration?.ui?.roleTagIds, scene]
  );

  if (!activityMetrics) return null;

  return (
    <div
      className={["scene-activity-metrics", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="scene-activity-metrics__row">
        {activityMetrics.activity.map((metric) =>
          renderSceneActivityMetric(scene, metric, activeSortBy)
        )}
      </div>
      <div className="scene-activity-metrics__row">
        {activityMetrics.quality.map((metric) =>
          renderSceneActivityMetric(scene, metric, activeSortBy)
        )}
      </div>
    </div>
  );
};
