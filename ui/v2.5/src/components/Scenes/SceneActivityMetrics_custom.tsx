import React from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  faBan,
  faCheckCircle,
  faClock,
  faHand,
  faQuestionCircle,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { ACTIVITY_PIE_COLORS } from "src/components/Shared/activityColors_custom";
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";
import type {
  SceneActivityMetric,
  SceneActivityMetricRows,
} from "./sceneActivityMetricsData_custom";
import TextUtils from "src/utils/text";
import { catalogCardSortHighlightClassCustom } from "../Shared/catalogCardSortHighlight_custom";
import cx from "classnames";

// CUSTOM: scene activity duration metrics and composition bars
interface ISceneActivityMetricsProps {
  sceneId: string;
  className?: string;
  activityMetrics?: SceneActivityMetricRows;
  // Bars with a small legend instead of boxes (studio cards).
  compact?: boolean;
  // Just one of the two groups; both by default.
  only?: "activity" | "quality";
  activeSortBy?: string;
}

interface ISceneActivityMetricBoxProps {
  sceneId: string;
  metric: SceneActivityMetric;
  control?: React.ReactNode;
  // Legend-sized: color dot, icon, and percentage only.
  compact?: boolean;
  activeSortBy?: string;
}

const activityMetricKeys = new Set(["sex", "oral", "solo", "other"]);

function formatMetricValue(metric: SceneActivityMetric) {
  const duration = TextUtils.secondsToTimestamp(metric.duration ?? 0);
  return metric.showPercent === false
    ? duration
    : metric.percent + "% (" + duration + ")";
}

export const SceneActivityMetricBox: React.FC<ISceneActivityMetricBoxProps> = ({
  sceneId,
  metric,
  control,
  compact = false,
  activeSortBy,
}) => {
  const isActivity = activityMetricKeys.has(metric.key);
  const tooltip =
    metric.label +
    ": " +
    formatMetricValue(metric) +
    (isActivity && metric.outstandingPercent !== undefined
      ? "; Outstanding: " +
        metric.outstandingPercent +
        "% (" +
        TextUtils.secondsToTimestamp(metric.outstandingDuration ?? 0) +
        ")"
      : "");
  const tooltipId = "scene-activity-" + sceneId + "-" + metric.key;
  const qualityKey = metric.key.split("-").slice(-1)[0];

  const activityIcon = (
    <span className="scene-activity-metric__icon" aria-hidden="true">
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
    </span>
  );
  const qualityIcon = (
    <span
      className="scene-activity-metric__icon scene-activity-metric__icon--quality"
      aria-hidden="true"
    >
      {qualityKey === "outstanding" && (
        <Icon icon={faStar} className="scene-activity-metric__outstanding" />
      )}
      {qualityKey === "standard" && (
        <Icon
          icon={faCheckCircle}
          className="scene-activity-metric__standard"
        />
      )}
      {qualityKey === "unclassified" && (
        <Icon
          icon={faQuestionCircle}
          className="scene-activity-metric__unclassified"
        />
      )}
      {qualityKey === "unusable" && (
        <Icon icon={faBan} className="scene-activity-metric__unusable" />
      )}
    </span>
  );

  return (
    <OverlayTrigger
      overlay={<Tooltip id={tooltipId}>{tooltip}</Tooltip>}
      placement="bottom"
    >
      <div
        className={cx(
          "scene-activity-metric",
          "scene-activity-metric--" + metric.key,
          compact
            ? "scene-activity-metric--compact"
            : isActivity
            ? "scene-activity-metric--composition"
            : "scene-activity-metric--quality",
          catalogCardSortHighlightClassCustom(
            activeSortBy,
            `${metric.key}_activity_percent`
          )
        )}
        aria-label={tooltip}
        role="group"
      >
        {compact && (
          <span
            aria-hidden="true"
            className="scene-activity-metric__swatch"
            style={{
              backgroundColor: getMetricColor(metric, ACTIVITY_PIE_COLORS.solo),
            }}
          />
        )}
        {isActivity ? activityIcon : qualityIcon}
        <span className="scene-activity-metric__copy">
          <strong>
            {compact ? `${metric.percent}%` : formatMetricValue(metric)}
          </strong>
          {!compact &&
            isActivity &&
            metric.outstandingPercent !== undefined && (
              <small className="scene-activity-metric__outstanding-copy">
                <Icon icon={faStar} aria-hidden="true" />
                <span>
                  {metric.outstandingPercent}% (
                  {TextUtils.secondsToTimestamp(
                    metric.outstandingDuration ?? 0
                  )}
                  )
                </span>
              </small>
            )}
        </span>
        {control}
      </div>
    </OverlayTrigger>
  );
};

function getMetricColor(metric: SceneActivityMetric, soloColor: string) {
  const colors: Record<string, string> = {
    sex: ACTIVITY_PIE_COLORS.sex,
    oral: ACTIVITY_PIE_COLORS.oral,
    solo: soloColor,
    outstanding: ACTIVITY_PIE_COLORS.outstanding,
    standard: ACTIVITY_PIE_COLORS.standard,
    unclassified: ACTIVITY_PIE_COLORS.other,
    unusable: ACTIVITY_PIE_COLORS.unusable,
  };
  return metric.color ?? colors[metric.key] ?? ACTIVITY_PIE_COLORS.other;
}

function renderDistributionBar(
  label: string,
  metrics: SceneActivityMetric[],
  soloColor: string
) {
  const rows = metrics.filter(
    (metric) => metric.showPercent !== false && (metric.duration ?? 0) > 0
  );
  if (rows.length === 0) return null;

  const summary = rows
    .map((metric) => metric.label + " " + metric.percent + "%")
    .join(", ");

  return (
    <div
      aria-label={label + ": " + summary}
      className="scene-activity-metrics__distribution"
      role="img"
    >
      {rows.map((metric) => (
        <span
          className={
            "scene-activity-metrics__segment scene-activity-metrics__segment--" +
            metric.key
          }
          key={metric.key}
          style={{
            backgroundColor: getMetricColor(metric, soloColor),
            width: Math.max(0, Math.min(100, metric.percent)) + "%",
          }}
          title={metric.label + ": " + metric.percent + "%"}
        />
      ))}
    </div>
  );
}

// Aggregate Activity Type and Quality boxes with their distribution bars.
export const SceneActivityMetrics: React.FC<ISceneActivityMetricsProps> = ({
  sceneId,
  className,
  activityMetrics,
  compact = false,
  only,
  activeSortBy,
}) => {
  const soloColor = ACTIVITY_PIE_COLORS.solo;

  if (!activityMetrics) return null;

  // The compact legend only lists what the bars draw.
  const isShown = (metric: SceneActivityMetric) =>
    (metric.duration ?? 0) > 0 && (!compact || metric.showPercent !== false);
  const qualityMetrics =
    only === "activity" ? [] : activityMetrics.quality.filter(isShown);
  const visibleActivityMetrics =
    only === "quality" ? [] : activityMetrics.activity.filter(isShown);

  return (
    <div
      className={cx(
        "scene-activity-metrics",
        compact && "scene-activity-metrics--compact",
        className
      )}
    >
      {visibleActivityMetrics.length > 0 && (
        <div className="scene-activity-metrics__group scene-activity-metrics__group--composition">
          <div className="scene-activity-metrics__group-label">
            Activity Type
          </div>
          {renderDistributionBar(
            "Activity Type",
            visibleActivityMetrics,
            soloColor
          )}
          <div className="scene-activity-metrics__row scene-activity-metrics__row--composition">
            {visibleActivityMetrics.map((metric) => (
              <SceneActivityMetricBox
                compact={compact}
                activeSortBy={activeSortBy}
                key={metric.key}
                metric={metric}
                sceneId={sceneId}
              />
            ))}
          </div>
        </div>
      )}
      {qualityMetrics.length > 0 && (
        <div className="scene-activity-metrics__group scene-activity-metrics__group--quality">
          <div className="scene-activity-metrics__group-label">Quality</div>
          {renderDistributionBar("Quality", qualityMetrics, soloColor)}
          <div className="scene-activity-metrics__row scene-activity-metrics__row--quality">
            {qualityMetrics.map((metric) => (
              <SceneActivityMetricBox
                compact={compact}
                activeSortBy={activeSortBy}
                key={metric.key}
                metric={metric}
                sceneId={sceneId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
