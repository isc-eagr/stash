import React, { useMemo } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  faBan,
  faCheckCircle,
  faClock,
  faHand,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import { useConfigurationContext } from "src/hooks/Config";
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";

// CUSTOM: begin - scene activity duration metrics
type SceneActivityCategory = "sex" | "oral" | "solo";
type SceneQualityCategory = "outstanding" | "standard" | "unusable";
type SceneActivityMetricKey =
  | SceneActivityCategory
  | "other"
  | SceneQualityCategory;

type SceneActivityMetric = {
  key: SceneActivityMetricKey;
  label: string;
  percent: number;
};

type SceneActivityMetricRows = {
  activity: SceneActivityMetric[];
  quality: SceneActivityMetric[];
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

function sceneActivityMarkerHasPrimaryTag(
  marker: SceneActivityScene["scene_markers"][number],
  targetId: string | undefined
): boolean {
  return !!targetId && marker.primary_tag.id === targetId;
}

function sceneActivityMarkerCategory(
  marker: SceneActivityScene["scene_markers"][number],
  roleTagIds: SceneActivityRoleTagIds
): SceneActivityCategory | undefined {
  if (sceneActivityMarkerHasPrimaryTag(marker, roleTagIds.sexTagId)) {
    return "sex";
  }
  if (sceneActivityMarkerHasPrimaryTag(marker, roleTagIds.oralTagId)) {
    return "oral";
  }
  if (sceneActivityMarkerHasPrimaryTag(marker, roleTagIds.soloTagId)) {
    return "solo";
  }

  return undefined;
}

function sceneActivityMarkerIsOutstanding(
  marker: SceneActivityScene["scene_markers"][number],
  roleTagIds: SceneActivityRoleTagIds
): boolean {
  return (
    !sceneActivityMarkerCategory(marker, roleTagIds) || marker.tags.length > 0
  );
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

function subtractSceneActivityIntervals(
  intervals: SceneActivityInterval[],
  subtractIntervals: SceneActivityInterval[]
): SceneActivityInterval[] {
  const blockers = mergeSceneActivityIntervals(subtractIntervals);

  return mergeSceneActivityIntervals(intervals).flatMap((interval) => {
    let cursor = interval.start;
    const remaining: SceneActivityInterval[] = [];

    blockers.forEach((blocker) => {
      if (blocker.end <= cursor || blocker.start >= interval.end) return;

      if (blocker.start > cursor) {
        remaining.push({
          start: cursor,
          end: Math.min(blocker.start, interval.end),
        });
      }
      cursor = Math.max(cursor, blocker.end);
    });

    if (cursor < interval.end) {
      remaining.push({ start: cursor, end: interval.end });
    }

    return remaining;
  });
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
): SceneActivityMetricRows | undefined {
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
  const outstandingIntervals: SceneActivityInterval[] = [];

  scene.scene_markers.forEach((marker) => {
    if (marker.end_seconds === null || marker.end_seconds === undefined) {
      return;
    }

    const interval = {
      start: Math.max(0, Math.min(marker.seconds, sceneDuration)),
      end: Math.max(0, Math.min(marker.end_seconds, sceneDuration)),
    };

    if (interval.end <= interval.start) return;

    const category = sceneActivityMarkerCategory(marker, roleTagIds);
    if (category) {
      intervalsByCategory[category].push(interval);
    }

    if (sceneActivityMarkerIsOutstanding(marker, roleTagIds)) {
      outstandingIntervals.push(interval);
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
  const activityCoveredDuration =
    getSceneActivityDuration(allActivityIntervals);
  const outstandingDuration = getSceneActivityDuration(
    subtractSceneActivityIntervals(outstandingIntervals, unusableIntervals)
  );
  const unusableDuration = getSceneActivityDuration(unusableIntervals);
  const qualityCoveredDuration = getSceneActivityDuration([
    ...outstandingIntervals,
    ...unusableIntervals,
  ]);

  return {
    activity: [
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
          Math.max(0, sceneDuration - activityCoveredDuration),
          sceneDuration
        ),
      },
    ],
    quality: [
      {
        key: "outstanding",
        label: "Outstanding",
        percent: getSceneActivityPercent(outstandingDuration, sceneDuration),
      },
      {
        key: "standard",
        label: "Standard",
        percent: getSceneActivityPercent(
          Math.max(0, sceneDuration - qualityCoveredDuration),
          sceneDuration
        ),
      },
      {
        key: "unusable",
        label: "Unusable",
        percent: getSceneActivityPercent(unusableDuration, sceneDuration),
      },
    ],
  };
}

interface ISceneActivityMetricsProps {
  scene: SceneActivityScene;
  className?: string;
}

function renderSceneActivityMetric(
  scene: SceneActivityScene,
  metric: SceneActivityMetric
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
        className={`scene-activity-metric scene-activity-metric--${metric.key}`}
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
          renderSceneActivityMetric(scene, metric)
        )}
      </div>
      <div className="scene-activity-metrics__row">
        {activityMetrics.quality.map((metric) =>
          renderSceneActivityMetric(scene, metric)
        )}
      </div>
    </div>
  );
};
// CUSTOM: end
