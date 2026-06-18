import React, { useMemo } from "react";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import TextUtils from "src/utils/text";

interface IProps {
  scene: GQL.SceneDataFragment;
}

type ActivityCategory = "sex" | "oral" | "solo";

interface IInterval {
  start: number;
  end: number;
}

interface IActivityStats {
  totalSeconds: number;
  sexSeconds: number;
  oralSeconds: number;
  soloSeconds: number;
  otherSeconds: number;
}

function mergeDuration(intervals: IInterval[]) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: IInterval[] = [];

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged.reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0
  );
}

function percent(seconds: number, totalSeconds: number) {
  if (totalSeconds <= 0) return 0;
  return Math.round((seconds / totalSeconds) * 100);
}

function isExactPrimaryOnlyMarker(
  marker: GQL.SceneDataFragment["scene_markers"][number],
  targetTagId: string | undefined
) {
  return (
    !!targetTagId &&
    marker.primary_tag.id === targetTagId &&
    marker.tags.length === 0
  );
}

function getActivityStats(
  scene: GQL.SceneDataFragment,
  roleTagIds: {
    sexTagId?: string;
    oralTagId?: string;
    soloTagId?: string;
  }
): IActivityStats | undefined {
  const totalSeconds = scene.files[0]?.duration ?? 0;
  if (totalSeconds <= 0) return undefined;

  const intervals: Record<ActivityCategory, IInterval[]> = {
    sex: [],
    oral: [],
    solo: [],
  };

  scene.scene_markers.forEach((marker) => {
    if (marker.end_seconds === null || marker.end_seconds === undefined) {
      return;
    }

    const interval = {
      start: Math.max(0, Math.min(marker.seconds, totalSeconds)),
      end: Math.max(0, Math.min(marker.end_seconds, totalSeconds)),
    };
    if (interval.end <= interval.start) return;

    if (isExactPrimaryOnlyMarker(marker, roleTagIds.sexTagId)) {
      intervals.sex.push(interval);
    }
    if (isExactPrimaryOnlyMarker(marker, roleTagIds.oralTagId)) {
      intervals.oral.push(interval);
    }
    if (isExactPrimaryOnlyMarker(marker, roleTagIds.soloTagId)) {
      intervals.solo.push(interval);
    }
  });

  const sexSeconds = mergeDuration(intervals.sex);
  const oralSeconds = mergeDuration(intervals.oral);
  const soloSeconds = mergeDuration(intervals.solo);
  const coveredSeconds = mergeDuration([
    ...intervals.sex,
    ...intervals.oral,
    ...intervals.solo,
  ]);

  return {
    totalSeconds,
    sexSeconds,
    oralSeconds,
    soloSeconds,
    otherSeconds: Math.max(0, totalSeconds - coveredSeconds),
  };
}

const SceneStatsPanel: React.FC<IProps> = ({ scene }) => {
  const { configuration } = useConfigurationContext();
  const stats = useMemo(
    () => getActivityStats(scene, configuration?.ui?.roleTagIds ?? {}),
    [configuration?.ui?.roleTagIds, scene]
  );

  if (!stats) return null;

  const rows = [
    {
      label: "Total scene length",
      seconds: stats.totalSeconds,
      percent: 100,
    },
    {
      label: "Sex",
      seconds: stats.sexSeconds,
      percent: percent(stats.sexSeconds, stats.totalSeconds),
    },
    {
      label: "Oral",
      seconds: stats.oralSeconds,
      percent: percent(stats.oralSeconds, stats.totalSeconds),
    },
    {
      label: "Solo",
      seconds: stats.soloSeconds,
      percent: percent(stats.soloSeconds, stats.totalSeconds),
    },
    {
      label: "Other",
      seconds: stats.otherSeconds,
      percent: percent(stats.otherSeconds, stats.totalSeconds),
    },
  ];

  return (
    <div className="scene-stats-panel mt-3">
      <table className="table table-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{TextUtils.secondsToTimestamp(row.seconds)}</td>
              <td>{row.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SceneStatsPanel;
