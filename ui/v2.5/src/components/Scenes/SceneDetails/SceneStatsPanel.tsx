import React, { useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import TextUtils from "src/utils/text";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";

interface IProps {
  scene: GQL.SceneDataFragment;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void;
}

type ActivityCategory = "sex" | "oral" | "solo";

interface IInterval {
  start: number;
  end: number;
}

interface IActivityMarker {
  marker: GQL.SceneDataFragment["scene_markers"][number];
  category: ActivityCategory;
  interval: IInterval;
}

interface IActivityStats {
  totalSeconds: number;
  sexSeconds: number;
  oralSeconds: number;
  soloSeconds: number;
  otherSeconds: number;
  markers: IActivityMarker[];
}

interface IStatsRow {
  key: string;
  label: string;
  seconds: number;
  percent: number;
  category?: ActivityCategory;
  role?: "top" | "bottom";
  isChild?: boolean;
  markers?: IActivityMarker[];
}

interface IPerformerStats {
  performer: {
    id: string;
    name: string;
    image_path?: string | null;
  };
  rows: IStatsRow[];
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

function formatStatValue(row: Pick<IStatsRow, "seconds" | "percent">) {
  return `${TextUtils.secondsToTimestamp(row.seconds)} (${row.percent}%)`;
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

function getMarkerActivityCategory(
  marker: GQL.SceneDataFragment["scene_markers"][number],
  roleTagIds: {
    sexTagId?: string;
    oralTagId?: string;
    soloTagId?: string;
  }
): ActivityCategory | undefined {
  if (isExactPrimaryOnlyMarker(marker, roleTagIds.sexTagId)) return "sex";
  if (isExactPrimaryOnlyMarker(marker, roleTagIds.oralTagId)) return "oral";
  if (isExactPrimaryOnlyMarker(marker, roleTagIds.soloTagId)) return "solo";
  return undefined;
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
  const markers: IActivityMarker[] = [];

  scene.scene_markers.forEach((marker) => {
    if (marker.end_seconds === null || marker.end_seconds === undefined) {
      return;
    }

    const interval = {
      start: Math.max(0, Math.min(marker.seconds, totalSeconds)),
      end: Math.max(0, Math.min(marker.end_seconds, totalSeconds)),
    };
    if (interval.end <= interval.start) return;

    const category = getMarkerActivityCategory(marker, roleTagIds);
    if (!category) return;

    intervals[category].push(interval);
    markers.push({ marker, category, interval });
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
    markers,
  };
}

function addPerformerIntervals(
  map: Map<
    string,
    IPerformerStats & {
      intervals: Record<string, IInterval[]>;
      markers: Record<string, IActivityMarker[]>;
    }
  >,
  performers: Array<{ id: string; name: string; image_path?: string | null }>,
  activityMarker: IActivityMarker,
  category: ActivityCategory,
  role: "top" | "bottom",
  interval: IInterval
) {
  performers.forEach((performer) => {
    const existing =
      map.get(performer.id) ??
      ({
        performer,
        intervals: {},
        markers: {},
        rows: [],
      } as IPerformerStats & {
        intervals: Record<string, IInterval[]>;
        markers: Record<string, IActivityMarker[]>;
      });

    const categoryKey = category;
    const roleKey = `${category}_${role}`;
    existing.intervals[categoryKey] = [
      ...(existing.intervals[categoryKey] ?? []),
      interval,
    ];
    existing.intervals[roleKey] = [
      ...(existing.intervals[roleKey] ?? []),
      interval,
    ];
    existing.markers[categoryKey] = [
      ...(existing.markers[categoryKey] ?? []),
      activityMarker,
    ];
    existing.markers[roleKey] = [
      ...(existing.markers[roleKey] ?? []),
      activityMarker,
    ];
    map.set(performer.id, existing);
  });
}

function getPerformerStats(stats: IActivityStats): IPerformerStats[] {
  const performerMap = new Map<
    string,
    IPerformerStats & {
      intervals: Record<string, IInterval[]>;
      markers: Record<string, IActivityMarker[]>;
    }
  >();

  stats.markers.forEach((activityMarker) => {
    const { marker, category, interval } = activityMarker;
    addPerformerIntervals(
      performerMap,
      marker.top_performers,
      activityMarker,
      category,
      "top",
      interval
    );
    addPerformerIntervals(
      performerMap,
      marker.bottom_performers,
      activityMarker,
      category,
      "bottom",
      interval
    );
  });

  return [...performerMap.values()]
    .map((entry) => {
      const rows: IStatsRow[] = [];
      (["sex", "oral", "solo"] as ActivityCategory[]).forEach((category) => {
        const totalSeconds = mergeDuration(entry.intervals[category] ?? []);
        if (totalSeconds <= 0) return;

        rows.push({
          key: `${category}-total`,
          label: category[0].toUpperCase() + category.slice(1),
          seconds: totalSeconds,
          percent: percent(totalSeconds, stats.totalSeconds),
          category,
          markers: entry.markers[category] ?? [],
        });

        const topSeconds = mergeDuration(
          entry.intervals[`${category}_top`] ?? []
        );
        const bottomSeconds = mergeDuration(
          entry.intervals[`${category}_bottom`] ?? []
        );

        if (topSeconds > 0) {
          rows.push({
            key: `${category}-top`,
            label: "Top",
            seconds: topSeconds,
            percent: percent(topSeconds, totalSeconds),
            category,
            role: "top",
            isChild: true,
            markers: entry.markers[`${category}_top`] ?? [],
          });
        }
        if (bottomSeconds > 0) {
          rows.push({
            key: `${category}-bottom`,
            label: "Bottom",
            seconds: bottomSeconds,
            percent: percent(bottomSeconds, totalSeconds),
            category,
            role: "bottom",
            isChild: true,
            markers: entry.markers[`${category}_bottom`] ?? [],
          });
        }
      });

      return {
        performer: entry.performer,
        rows,
      };
    })
    .filter((entry) => entry.rows.length > 0)
    .sort((a, b) => a.performer.name.localeCompare(b.performer.name));
}

const SceneStatsPanel: React.FC<IProps> = ({
  scene,
  addMultiSegmentLoopSegments,
}) => {
  const { configuration } = useConfigurationContext();
  const [selectedActivities, setSelectedActivities] = useState<
    Set<ActivityCategory>
  >(new Set());
  const [selectedPerformerRows, setSelectedPerformerRows] = useState<
    Set<string>
  >(new Set());
  const stats = useMemo(
    () => getActivityStats(scene, configuration?.ui?.roleTagIds ?? {}),
    [configuration?.ui?.roleTagIds, scene]
  );
  const performerStats = useMemo(
    () => (stats ? getPerformerStats(stats) : []),
    [stats]
  );

  if (!stats) return null;
  const activityStats = stats;

  const rows: IStatsRow[] = [
    {
      key: "total",
      label: "Total scene length",
      seconds: activityStats.totalSeconds,
      percent: 100,
    },
    {
      key: "sex",
      label: "Sex",
      seconds: activityStats.sexSeconds,
      percent: percent(activityStats.sexSeconds, activityStats.totalSeconds),
      category: "sex",
    },
    {
      key: "oral",
      label: "Oral",
      seconds: activityStats.oralSeconds,
      percent: percent(activityStats.oralSeconds, activityStats.totalSeconds),
      category: "oral",
    },
    {
      key: "solo",
      label: "Solo",
      seconds: activityStats.soloSeconds,
      percent: percent(activityStats.soloSeconds, activityStats.totalSeconds),
      category: "solo",
    },
    {
      key: "other",
      label: "Other",
      seconds: activityStats.otherSeconds,
      percent: percent(activityStats.otherSeconds, activityStats.totalSeconds),
    },
  ];

  function toggleActivity(category: ActivityCategory) {
    setSelectedActivities((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function togglePerformerRow(key: string) {
    setSelectedPerformerRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function getPerformerRowSelectionKey(performerID: string, rowKey: string) {
    return `${performerID}-${rowKey}`;
  }

  function buildLoopSegments(markers: IActivityMarker[]) {
    return markers
      .sort((a, b) => a.interval.start - b.interval.start)
      .map(({ marker, category, interval }) => ({
        start: interval.start,
        end: interval.end,
        title: `${category.toUpperCase()}: ${marker.title}`,
      }));
  }

  function addSelectedActivitiesToLoop() {
    if (selectedActivities.size === 0 && selectedPerformerRows.size === 0)
      return;

    const selectedMarkers = new Map<string, IActivityMarker>();

    activityStats.markers
      .filter(({ category }) => selectedActivities.has(category))
      .forEach((activityMarker) => {
        selectedMarkers.set(activityMarker.marker.id, activityMarker);
      });

    performerStats.forEach((entry) => {
      entry.rows.forEach((row) => {
        const selectionKey = getPerformerRowSelectionKey(
          entry.performer.id,
          row.key
        );
        if (!selectedPerformerRows.has(selectionKey)) return;

        row.markers?.forEach((activityMarker) => {
          selectedMarkers.set(activityMarker.marker.id, activityMarker);
        });
      });
    });

    addMultiSegmentLoopSegments(
      buildLoopSegments([...selectedMarkers.values()])
    );
    setSelectedActivities(new Set());
    setSelectedPerformerRows(new Set());
  }

  const canAddToLoop =
    selectedActivities.size > 0 || selectedPerformerRows.size > 0;

  return (
    <div className="scene-stats-panel mt-3">
      <div className="custom-stats-list mb-4">
        {rows.map((row) => (
          <div className="custom-stats-row" key={row.key}>
            {row.category ? (
              <Form.Check
                className="custom-stats-check"
                id={`scene-stats-${scene.id}-${row.category}`}
                checked={selectedActivities.has(row.category)}
                label={row.label}
                onChange={() => row.category && toggleActivity(row.category)}
              />
            ) : (
              <span className="custom-stats-label">{row.label}</span>
            )}
            <span className="custom-stats-value">{formatStatValue(row)}</span>
          </div>
        ))}
      </div>

      {performerStats.length > 0 && (
        <>
          <h5>By Performer</h5>
          <div className="scene-stats-performer-list">
            {performerStats.map((entry) => (
              <div className="scene-stats-performer" key={entry.performer.id}>
                <div
                  aria-hidden="true"
                  className="scene-stats-performer-image"
                  style={{
                    backgroundImage: entry.performer.image_path
                      ? `url(${entry.performer.image_path})`
                      : undefined,
                  }}
                />
                <div className="scene-stats-performer-data">
                  <div className="scene-stats-performer-name">
                    {entry.performer.name}
                  </div>
                  <div className="custom-stats-list">
                    {entry.rows.map((row) => {
                      const selectionKey = getPerformerRowSelectionKey(
                        entry.performer.id,
                        row.key
                      );

                      return (
                        <div
                          className={`custom-stats-row${
                            row.isChild ? " custom-stats-row--child" : ""
                          }`}
                          key={row.key}
                        >
                          <Form.Check
                            className="custom-stats-check"
                            id={`scene-stats-${scene.id}-${selectionKey}`}
                            checked={selectedPerformerRows.has(selectionKey)}
                            label={row.label}
                            onChange={() => togglePerformerRow(selectionKey)}
                          />
                          <span className="custom-stats-value">
                            {formatStatValue(row)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Button
        className="mt-3"
        disabled={!canAddToLoop}
        onClick={addSelectedActivitiesToLoop}
        variant="secondary"
      >
        Add to Loop
      </Button>
    </div>
  );
};

export default SceneStatsPanel;
