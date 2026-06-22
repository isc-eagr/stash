import React, { useMemo } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { faBan, faClock, faHand } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import { useConfigurationContext } from "src/hooks/Config";
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";

// CUSTOM: begin - scene activity duration metrics
type SceneActivityCategory = "sex" | "oral" | "solo";

type SceneActivityMetric = {
  key: SceneActivityCategory | "other" | "unusable";
  label: string;
  percent: number;
};

type SceneActivityInterval = {
  start: number;
  end: number;
};

type SceneActivityRoleTagIds = {
  sexTagId?: string;
  oralTagId?: string;
  soloTagId?: string;
};

type SceneActivityScene = Pick<GQL.SlimSceneDataFragment, "id"> & {
  files: Array<Pick<GQL.VideoFileDataFragment, "duration">>;
  scene_markers: Array<
    Pick<
      GQL.SlimSceneDataFragment["scene_markers"][number],
      "seconds" | "end_seconds" | "primary_tag" | "tags"
    >
  >;
  negative_markers?: Array<{
    start_seconds: number;
    end_seconds: number;
  }>;
};

function sceneActivityMarkerPrimaryTagIsOnlyTag(
  marker: SceneActivityScene["scene_markers"][number],
  targetId: string | undefined
): boolean {
  if (!targetId) return false;
  return marker.primary_tag.id === targetId && marker.tags.length === 0;
}

function mergeSceneActivityIntervals(
  intervals: SceneActivityInterval[]
): SceneActivityInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: SceneActivityInterval[] = [];

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged;
}

function getSceneActivityDuration(intervals: SceneActivityInterval[]) {
  return mergeSceneActivityIntervals(intervals).reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0
  );
}

function getSceneActivityPercent(duration: number, sceneDuration: number) {
  return Math.round((duration / sceneDuration) * 100);
}

function getSceneActivityMetrics(
  scene: SceneActivityScene,
  roleTagIds: SceneActivityRoleTagIds
): SceneActivityMetric[] | undefined {
  const sceneDuration = scene.files[0]?.duration ?? 0;
  if (sceneDuration <= 0) return undefined;

  const intervalsByCategory: Record<
    SceneActivityCategory,
    SceneActivityInterval[]
  > = {
    sex: [],
    oral: [],
    solo: [],
  };

  scene.scene_markers.forEach((marker) => {
    if (marker.end_seconds === null || marker.end_seconds === undefined) {
      return;
    }

    const interval = {
      start: Math.max(0, Math.min(marker.seconds, sceneDuration)),
      end: Math.max(0, Math.min(marker.end_seconds, sceneDuration)),
    };

    if (interval.end <= interval.start) return;

    if (sceneActivityMarkerPrimaryTagIsOnlyTag(marker, roleTagIds.sexTagId)) {
      intervalsByCategory.sex.push(interval);
    }

    if (sceneActivityMarkerPrimaryTagIsOnlyTag(marker, roleTagIds.oralTagId)) {
      intervalsByCategory.oral.push(interval);
    }

    if (sceneActivityMarkerPrimaryTagIsOnlyTag(marker, roleTagIds.soloTagId)) {
      intervalsByCategory.solo.push(interval);
    }
  });

  const unusableIntervals =
    scene.negative_markers
      ?.map((marker) => ({
        start: Math.max(0, Math.min(marker.start_seconds, sceneDuration)),
        end: Math.max(0, Math.min(marker.end_seconds, sceneDuration)),
      }))
      .filter((interval) => interval.end > interval.start) ?? [];

  const allActivityIntervals = [
    ...intervalsByCategory.sex,
    ...intervalsByCategory.oral,
    ...intervalsByCategory.solo,
  ];

  if (allActivityIntervals.length === 0 && unusableIntervals.length === 0) {
    return undefined;
  }

  const coveredDuration = getSceneActivityDuration([
    ...allActivityIntervals,
    ...unusableIntervals,
  ]);

  return [
    {
      key: "sex",
      label: "Sex",
      percent: getSceneActivityPercent(
        getSceneActivityDuration(intervalsByCategory.sex),
        sceneDuration
      ),
    },
    {
      key: "oral",
      label: "Oral",
      percent: getSceneActivityPercent(
        getSceneActivityDuration(intervalsByCategory.oral),
        sceneDuration
      ),
    },
    {
      key: "solo",
      label: "Solo",
      percent: getSceneActivityPercent(
        getSceneActivityDuration(intervalsByCategory.solo),
        sceneDuration
      ),
    },
    {
      key: "other",
      label: "Other",
      percent: getSceneActivityPercent(
        Math.max(0, sceneDuration - coveredDuration),
        sceneDuration
      ),
    },
    {
      key: "unusable",
      label: "Unusable",
      percent: getSceneActivityPercent(
        getSceneActivityDuration(unusableIntervals),
        sceneDuration
      ),
    },
  ];
}

interface ISceneActivityMetricsProps {
  scene: SceneActivityScene;
  className?: string;
}

export const SceneActivityMetrics: React.FC<ISceneActivityMetricsProps> = ({
  scene,
  className,
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
      {activityMetrics.map((metric) => {
        const tooltip = `${metric.label}: ${metric.percent}%`;
        const tooltipId = `scene-activity-${scene.id}-${metric.key}`;

        return (
          <OverlayTrigger
            key={metric.key}
            overlay={<Tooltip id={tooltipId}>{tooltip}</Tooltip>}
            placement="bottom"
          >
            <span
              className={`scene-activity-metric scene-activity-metric--${metric.key}`}
              aria-label={tooltip}
            >
              {metric.key === "sex" && (
                <img
                  className="scene-activity-metric__svg"
                  src={gaySvg}
                  alt=""
                />
              )}
              {metric.key === "oral" && (
                <img
                  className="scene-activity-metric__svg"
                  src={mouthSvg}
                  alt=""
                />
              )}
              {metric.key === "solo" && (
                <Icon icon={faHand} className="scene-activity-metric__hand" />
              )}
              {metric.key === "other" && (
                <Icon icon={faClock} className="scene-activity-metric__other" />
              )}
              {metric.key === "unusable" && (
                <Icon
                  icon={faBan}
                  className="scene-activity-metric__unusable"
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
// CUSTOM: end
