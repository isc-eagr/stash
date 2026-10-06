import React, { useMemo } from "react";
import cx from "classnames";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { faHand, faStar } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";
import TextUtils from "src/utils/text";
import { useConfigurationContext } from "src/hooks/Config";
import { catalogCardSortHighlightClassCustom } from "../Shared/catalogCardSortHighlight_custom";
import {
  getSceneActivityMetrics,
  SCENE_ACTIVITY_LABELS_CUSTOM,
  type SceneActivityCategory,
  type SceneActivityMetric,
  type SceneActivityScene,
} from "./sceneActivityMetricsData_custom";
import {
  getSceneActivityBarCustom,
  type SceneActivityBarCustom,
  type SceneActivityBarEndCustom,
} from "./sceneActivityBarData_custom";

// CUSTOM: two-ended activity bar on scene cards and scene details, styled
// after the performer versatility bars but without top/bottom colors.
interface ISceneActivityBarProps {
  sceneId: string;
  bar?: SceneActivityBarCustom;
  activity: SceneActivityMetric[];
  activeSortBy?: string;
  className?: string;
  // Scene cards: a gold battery under each end shows its Outstanding share.
  outstandingBatteries?: boolean;
}

const ActivityIcon: React.FC<{ category: SceneActivityCategory }> = ({
  category,
}) =>
  category === "solo" ? (
    <Icon icon={faHand} className="scene-activity-bar__hand" />
  ) : (
    <img
      className="scene-activity-bar__svg"
      src={category === "sex" ? gaySvg : mouthSvg}
      alt=""
    />
  );

export const SceneActivityBar: React.FC<ISceneActivityBarProps> = ({
  sceneId,
  bar,
  activity,
  activeSortBy,
  className,
  outstandingBatteries = false,
}) => {
  if (!bar) return null;

  const renderEnd = (
    end: SceneActivityBarEndCustom | undefined,
    side: "left" | "right"
  ) => {
    if (!end) {
      return <span className={`scene-activity-bar__end is-${side}`} />;
    }

    const icon = (
      <span className="scene-activity-bar__icon">
        <ActivityIcon category={end.key} />
      </span>
    );
    return (
      <span
        className={cx(
          "scene-activity-bar__end",
          `is-${side}`,
          end.dominant && "is-dominant",
          end.duration <= 0 && "is-zero",
          catalogCardSortHighlightClassCustom(
            activeSortBy,
            `${end.key}_activity_percent`
          )
        )}
      >
        <span className="scene-activity-bar__end-main">
          {side === "left" && icon}
          <strong>{end.percent}%</strong>
          {side === "right" && icon}
        </span>
        {outstandingBatteries && end.duration > 0 && (
          <span
            className="scene-activity-bar__battery"
            title={`Outstanding: ${end.outstandingPercent}%`}
          >
            <span
              className="scene-activity-bar__battery-fill"
              style={{ width: `${end.outstandingPercent}%` }}
            />
          </span>
        )}
      </span>
    );
  };

  const summary = [bar.left, bar.right]
    .flatMap((end) =>
      end ? [`${SCENE_ACTIVITY_LABELS_CUSTOM[end.key]} ${end.percent}%`] : []
    )
    .join(", ");

  return (
    <OverlayTrigger
      overlay={
        <Tooltip id={`scene-activity-bar-tooltip-${sceneId}`}>
          {activity.map((metric) => (
            <div key={metric.key}>
              {metric.label}: {metric.percent}% (
              {TextUtils.secondsToTimestamp(metric.duration ?? 0)})
              {metric.outstandingPercent !== undefined && (
                <>
                  {" · "}
                  <Icon icon={faStar} /> {metric.outstandingPercent}%
                </>
              )}
            </div>
          ))}
        </Tooltip>
      }
      placement="bottom"
    >
      <div
        aria-label={`Activity: ${summary}`}
        className={cx("scene-activity-bar", className)}
        role="img"
      >
        {renderEnd(bar.left, "left")}
        <span className="scene-activity-bar__track">
          <span
            className="scene-activity-bar__dial"
            style={{ left: `${bar.rightShare * 100}%` }}
          />
        </span>
        {renderEnd(bar.right, "right")}
      </div>
    </OverlayTrigger>
  );
};

// Scene details compute the bar from the scene; cards reuse their metrics.
export const SceneDetailActivityBar: React.FC<{
  scene: SceneActivityScene;
}> = ({ scene }) => {
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds;
  const metrics = useMemo(
    () => getSceneActivityMetrics(scene, roleTagIds ?? {}),
    [roleTagIds, scene]
  );

  return (
    <SceneActivityBar
      activity={metrics?.activity ?? []}
      bar={getSceneActivityBarCustom(metrics)}
      className="scene-activity-bar--detail"
      outstandingBatteries
      sceneId={scene.id}
    />
  );
};
