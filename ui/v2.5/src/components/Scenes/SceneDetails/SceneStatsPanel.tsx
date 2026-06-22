import React, { useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import TextUtils from "src/utils/text";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";
import {
  ACTIVITY_PIE_COLORS,
  ActivityPieChart,
} from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import type { IActivityPieSlice } from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM

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
  unusableSeconds: number;
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

function formatPercentValue(row: Pick<IStatsRow, "percent">) {
  return `${row.percent}%`;
}

function getActivityColor(key: string) {
  const colors: Record<string, string> = {
    sex: ACTIVITY_PIE_COLORS.sex,
    oral: ACTIVITY_PIE_COLORS.oral,
    solo: ACTIVITY_PIE_COLORS.solo,
    other: ACTIVITY_PIE_COLORS.other,
    unusable: ACTIVITY_PIE_COLORS.unusable,
  };

  return colors[key] ?? ACTIVITY_PIE_COLORS.other;
}

function getStatsRowColor(row: IStatsRow) {
  if (row.role === "top") return ACTIVITY_PIE_COLORS.top;
  if (row.role === "bottom") return ACTIVITY_PIE_COLORS.bottom;

  return getActivityColor(row.category ?? row.key);
}

function getActivityPieSlices(rows: IStatsRow[]): IActivityPieSlice[] {
  return rows
    .filter((row) => row.key !== "total" && row.seconds > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: row.seconds,
      color: getActivityColor(row.key),
      percentLabel: formatPercentValue(row),
      sliceLabel: TextUtils.secondsToTimestamp(row.seconds),
      valueLabel: formatStatValue(row),
    }));
}

function getRolePieSlices(
  rows: IStatsRow[],
  category: ActivityCategory
): IActivityPieSlice[] {
  return rows
    .filter((row) => row.category === category && row.role && row.seconds > 0)
    .map((row) => ({
      key: row.role ?? row.key,
      label: row.label,
      value: row.seconds,
      color:
        row.role === "top"
          ? ACTIVITY_PIE_COLORS.top
          : ACTIVITY_PIE_COLORS.bottom,
      percentLabel: formatPercentValue(row),
      sliceLabel: TextUtils.secondsToTimestamp(row.seconds),
      valueLabel: formatStatValue(row),
    }));
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
  const unusableIntervals =
    scene.negative_markers
      ?.map((marker) => ({
        start: Math.max(0, Math.min(marker.start_seconds, totalSeconds)),
        end: Math.max(0, Math.min(marker.end_seconds, totalSeconds)),
      }))
      .filter((interval) => interval.end > interval.start) ?? [];

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
    ...unusableIntervals,
  ]);

  return {
    totalSeconds,
    sexSeconds,
    oralSeconds,
    soloSeconds,
    unusableSeconds: mergeDuration(unusableIntervals),
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
    {
      key: "unusable",
      label: "Unusable",
      seconds: activityStats.unusableSeconds,
      percent: percent(
        activityStats.unusableSeconds,
        activityStats.totalSeconds
      ),
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
  const activityPieSlices = getActivityPieSlices(rows);

  function renderActivityChartFooter() {
    return (
      <div className="custom-stats-chart-table">
        {rows
          .filter((row) => row.key !== "total" && row.seconds > 0)
          .map((row) => (
            <div className="custom-stats-chart-row" key={row.key}>
              <span
                aria-hidden="true"
                className="custom-stats-color-swatch"
                style={{ backgroundColor: getStatsRowColor(row) }}
              />
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
              <span className="custom-stats-value">
                {TextUtils.secondsToTimestamp(row.seconds)}
              </span>
              <span className="custom-stats-value">
                {formatPercentValue(row)}
              </span>
            </div>
          ))}
      </div>
    );
  }

  function renderPerformerChartFooter(
    performerID: string,
    categoryRow: IStatsRow,
    roleRows: IStatsRow[]
  ) {
    const footerRows = [categoryRow, ...roleRows];

    return (
      <div className="custom-stats-chart-table">
        {footerRows.map((row) => {
          const selectionKey = getPerformerRowSelectionKey(
            performerID,
            row.key
          );

          return (
            <div className="custom-stats-chart-row" key={row.key}>
              <span
                aria-hidden="true"
                className="custom-stats-color-swatch"
                style={{ backgroundColor: getStatsRowColor(row) }}
              />
              <Form.Check
                className="custom-stats-check"
                id={`scene-stats-${scene.id}-${selectionKey}`}
                checked={selectedPerformerRows.has(selectionKey)}
                label={row.isChild ? row.label : `All ${row.label}`}
                onChange={() => togglePerformerRow(selectionKey)}
              />
              <span className="custom-stats-value">
                {TextUtils.secondsToTimestamp(row.seconds)}
              </span>
              <span className="custom-stats-value">
                {formatPercentValue(row)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="scene-stats-panel mt-3">
      <div className="custom-stats-overview mb-4">
        <ActivityPieChart
          centerLabel={TextUtils.secondsToTimestamp(activityStats.totalSeconds)}
          className="custom-stats-overview-chart"
          footer={renderActivityChartFooter()}
          showLegend={false}
          slices={activityPieSlices}
          title="Activity"
        />
      </div>

      {performerStats.length > 0 && (
        <>
          <h5>By Performer</h5>
          <div className="scene-stats-performer-list">
            {performerStats.map((entry) => (
              <div className="scene-stats-performer" key={entry.performer.id}>
                <div className="scene-stats-performer-header">
                  <div
                    aria-hidden="true"
                    className="scene-stats-performer-image"
                    style={{
                      backgroundImage: entry.performer.image_path
                        ? `url(${entry.performer.image_path})`
                        : undefined,
                    }}
                  />
                  <div className="scene-stats-performer-name">
                    {entry.performer.name}
                  </div>
                </div>
                <div className="scene-stats-performer-charts">
                  {entry.rows
                    .filter((row) => row.category && !row.isChild)
                    .map((row) => {
                      if (!row.category) return null;

                      const roleSlices = getRolePieSlices(
                        entry.rows,
                        row.category
                      );
                      const roleRows = entry.rows.filter(
                        (entryRow) =>
                          entryRow.category === row.category && entryRow.role
                      );
                      if (roleSlices.length === 0) return null;

                      return (
                        <ActivityPieChart
                          centerLabel={TextUtils.secondsToTimestamp(
                            row.seconds
                          )}
                          className="scene-stats-performer-chart"
                          footer={renderPerformerChartFooter(
                            entry.performer.id,
                            row,
                            roleRows
                          )}
                          key={row.key}
                          showLegend={false}
                          size={150}
                          slices={roleSlices}
                          title={row.label}
                        />
                      );
                    })}
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
