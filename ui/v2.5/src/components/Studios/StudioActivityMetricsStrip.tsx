import React from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  faBan,
  faCheckCircle,
  faHand,
  faQuestionCircle,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import * as GQL from "src/core/generated-graphql";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import { getPartitionPercentagesCustom } from "src/components/Shared/activityTypePercentages_custom";

type StudioActivityMetricKey =
  | "sex"
  | "oral"
  | "solo"
  | "outstanding"
  | "standard"
  | "unclassified"
  | "unusable";

type StudioActivityMetric = {
  key: StudioActivityMetricKey;
  label: string;
  percent: number;
  sceneCount: number | null;
};

type StudioActivityStats = Pick<
  GQL.StudioActivityStats,
  | "total_seconds"
  | "sex_percent"
  | "oral_percent"
  | "solo_percent"
  | "sex_seconds"
  | "oral_seconds"
  | "solo_seconds"
  | "outstanding_percent"
  | "standard_percent"
  | "unusable_percent"
  | "other_seconds"
  | "outstanding_seconds"
  | "standard_seconds"
  | "unusable_seconds"
  | "sex_scene_count"
  | "oral_scene_count"
  | "solo_scene_count"
>;

interface IProps {
  stats?: StudioActivityStats | null;
  idPrefix: string;
  showHeadings?: boolean;
}

function renderStudioActivityMetric(
  idPrefix: string,
  metric: StudioActivityMetric
) {
  const tooltip =
    metric.sceneCount === null
      ? `${metric.label}: ${metric.percent}%`
      : `${metric.label}: ${metric.percent}% (${metric.sceneCount} scenes)`;
  const tooltipId = `${idPrefix}-${metric.key}`;

  return (
    <OverlayTrigger
      key={metric.key}
      overlay={<Tooltip id={tooltipId}>{tooltip}</Tooltip>}
      placement="bottom"
    >
      <span
        className={`studio-activity-metric studio-activity-metric--${metric.key}`}
        aria-label={tooltip}
      >
        {metric.key === "sex" && (
          <img className="studio-activity-metric__svg" src={gaySvg} alt="" />
        )}
        {metric.key === "oral" && (
          <img className="studio-activity-metric__svg" src={mouthSvg} alt="" />
        )}
        {metric.key === "solo" && (
          <Icon icon={faHand} className="studio-activity-metric__hand" />
        )}
        {metric.key === "outstanding" && (
          <Icon icon={faStar} className="studio-activity-metric__outstanding" />
        )}
        {metric.key === "standard" && (
          <Icon
            icon={faCheckCircle}
            className="studio-activity-metric__standard"
          />
        )}
        {metric.key === "unusable" && (
          <Icon icon={faBan} className="studio-activity-metric__unusable" />
        )}
        {metric.key === "unclassified" && (
          <Icon
            icon={faQuestionCircle}
            className="studio-activity-metric__unclassified"
          />
        )}
        <span>{metric.percent}%</span>
      </span>
    </OverlayTrigger>
  );
}

export const StudioActivityMetricsStrip: React.FC<IProps> = ({
  stats,
  idPrefix,
  showHeadings = false,
}) => {
  if (!stats || stats.total_seconds <= 0) return null;
  const activityMetrics: StudioActivityMetric[] = [
    {
      key: "sex",
      label: "Sex",
      percent: Math.round(stats.sex_percent),
      sceneCount: stats.sex_scene_count,
    },
    {
      key: "oral",
      label: "Oral",
      percent: Math.round(stats.oral_percent),
      sceneCount: stats.oral_scene_count,
    },
    {
      key: "solo",
      label: "Solo",
      percent: Math.round(stats.solo_percent),
      sceneCount: stats.solo_scene_count,
    },
  ];

  const qualityPercentages = getPartitionPercentagesCustom(
    {
      outstanding: stats.outstanding_seconds,
      standard: stats.standard_seconds,
      unclassified: stats.other_seconds,
      unusable: stats.unusable_seconds,
    },
    ["outstanding", "standard", "unclassified", "unusable"]
  );
  const qualityMetrics: StudioActivityMetric[] = [
    {
      key: "outstanding",
      label: "Outstanding",
      percent: qualityPercentages.outstanding,
      sceneCount: null,
    },
    {
      key: "standard",
      label: "Standard",
      percent: qualityPercentages.standard,
      sceneCount: null,
    },
    {
      key: "unclassified",
      label: "Unclassified",
      percent: qualityPercentages.unclassified,
      sceneCount: null,
    },
    {
      key: "unusable",
      label: "Unusable",
      percent: qualityPercentages.unusable,
      sceneCount: null,
    },
  ];

  return (
    <div className="studio-activity-metrics">
      <div className="studio-activity-metrics__group">
        {showHeadings && (
          <strong className="studio-activity-metrics__heading">
            Activity Type
          </strong>
        )}
        <div className="studio-activity-metrics__row">
          {activityMetrics.map((metric) =>
            renderStudioActivityMetric(idPrefix, metric)
          )}
        </div>
      </div>
      <div className="studio-activity-metrics__group">
        {showHeadings && (
          <strong className="studio-activity-metrics__heading">Quality</strong>
        )}
        <div className="studio-activity-metrics__row">
          {qualityMetrics.map((metric) =>
            renderStudioActivityMetric(idPrefix, metric)
          )}
        </div>
      </div>
    </div>
  );
};
