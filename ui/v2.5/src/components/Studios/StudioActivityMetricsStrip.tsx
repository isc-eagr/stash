import React from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { faBan, faClock, faHand } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import * as GQL from "src/core/generated-graphql";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";

type StudioActivityStats = Pick<
  GQL.StudioActivityStats,
  | "total_seconds"
  | "sex_percent"
  | "oral_percent"
  | "solo_percent"
  | "other_percent"
  | "unusable_percent"
  | "sex_scene_count"
  | "oral_scene_count"
  | "solo_scene_count"
>;

interface IProps {
  stats?: StudioActivityStats | null;
  idPrefix: string;
  showUnusable?: boolean;
}

export const StudioActivityMetricsStrip: React.FC<IProps> = ({
  stats,
  idPrefix,
  showUnusable = true,
}) => {
  if (!stats || stats.total_seconds <= 0) return null;

  const metrics = [
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
    {
      key: "other",
      label: "Other",
      percent: Math.round(stats.other_percent),
      sceneCount: null,
    },
    ...(showUnusable
      ? [
          {
            key: "unusable",
            label: "Unusable",
            percent: Math.round(stats.unusable_percent),
            sceneCount: null,
          },
        ]
      : []),
  ];

  return (
    <div className="studio-activity-metrics">
      {metrics.map((metric) => {
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
                <img
                  className="studio-activity-metric__svg"
                  src={gaySvg}
                  alt=""
                />
              )}
              {metric.key === "oral" && (
                <img
                  className="studio-activity-metric__svg"
                  src={mouthSvg}
                  alt=""
                />
              )}
              {metric.key === "solo" && (
                <Icon icon={faHand} className="studio-activity-metric__hand" />
              )}
              {metric.key === "other" && (
                <Icon
                  icon={faClock}
                  className="studio-activity-metric__other"
                />
              )}
              {metric.key === "unusable" && (
                <Icon
                  icon={faBan}
                  className="studio-activity-metric__unusable"
                />
              )}
              <span>{metric.percent}%</span>
            </span>
          </OverlayTrigger>
        );
      })}
    </div>
  );
};
