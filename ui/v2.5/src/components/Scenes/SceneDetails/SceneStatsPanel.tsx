import React, { useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useRoleTags } from "src/hooks/useRoleTags";
import TextUtils from "src/utils/text";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";
import {
  ACTIVITY_PIE_COLORS,
  ActivityPieChart,
  getSceneMarkerTagColorCustom,
} from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import type { IActivityPieSlice } from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import {
  buildIntersectedLoopSegments,
  buildIntervalLoopSegments,
} from "./sceneStatsLoopSegments_custom"; // CUSTOM

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
  outstandingSeconds: number;
  standardSeconds: number;
  unusableSeconds: number;
  markers: IActivityMarker[];
  loopSegments: Record<string, ILoopSegmentInput[]>;
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
  selectableKey?: string;
  loopSegments?: ILoopSegmentInput[];
  color?: string;
}

interface IPerformerStats {
  performer: {
    id: string;
    name: string;
    image_path?: string | null;
  };
  rows: IStatsRow[];
}

function mergeIntervals(intervals: IInterval[]) {
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

  return merged;
}

function mergeDuration(intervals: IInterval[]) {
  return mergeIntervals(intervals).reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0
  );
}

function subtractIntervals(
  intervals: IInterval[],
  subtractIntervalsList: IInterval[]
) {
  const blockers = mergeIntervals(subtractIntervalsList);

  return mergeIntervals(intervals).flatMap((interval) => {
    let cursor = interval.start;
    const remaining: IInterval[] = [];

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

function uncoveredIntervals(totalSeconds: number, intervals: IInterval[]) {
  return subtractIntervals([{ start: 0, end: totalSeconds }], intervals);
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

function getActivityColor(key: string, soloColor = ACTIVITY_PIE_COLORS.solo) {
  const colors: Record<string, string> = {
    sex: ACTIVITY_PIE_COLORS.sex,
    oral: ACTIVITY_PIE_COLORS.oral,
    solo: soloColor,
    other: ACTIVITY_PIE_COLORS.other,
    outstanding: ACTIVITY_PIE_COLORS.outstanding,
    standard: ACTIVITY_PIE_COLORS.standard,
    unusable: ACTIVITY_PIE_COLORS.unusable,
  };

  return colors[key] ?? ACTIVITY_PIE_COLORS.other;
}

function getStatsRowColor(row: IStatsRow, soloColor?: string) {
  if (row.color) return row.color;
  if (row.role === "top") return ACTIVITY_PIE_COLORS.top;
  if (row.role === "bottom") return ACTIVITY_PIE_COLORS.bottom;

  return getActivityColor(row.category ?? row.key, soloColor);
}

function getActivityPieSlices(
  rows: IStatsRow[],
  soloColor?: string
): IActivityPieSlice[] {
  return rows
    .filter((row) => row.key !== "total" && row.seconds > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: row.seconds,
      color: row.color ?? getActivityColor(row.key, soloColor),
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

function isPrimaryMarker(
  marker: GQL.SceneDataFragment["scene_markers"][number],
  targetTagId: string | undefined
) {
  return !!targetTagId && marker.primary_tag.id === targetTagId;
}

function getMarkerActivityCategory(
  marker: GQL.SceneDataFragment["scene_markers"][number],
  roleTagIds: {
    sexTagId?: string;
    oralTagId?: string;
    soloTagId?: string;
  }
): ActivityCategory | undefined {
  if (isPrimaryMarker(marker, roleTagIds.sexTagId)) return "sex";
  if (isPrimaryMarker(marker, roleTagIds.oralTagId)) return "oral";
  if (isPrimaryMarker(marker, roleTagIds.soloTagId)) return "solo";
  return undefined;
}

function isOutstandingMarker(
  marker: GQL.SceneDataFragment["scene_markers"][number],
  roleTagIds: {
    sexTagId?: string;
    oralTagId?: string;
    soloTagId?: string;
  }
) {
  return (
    !getMarkerActivityCategory(marker, roleTagIds) || marker.tags.length > 0
  );
}

function buildMarkerLoopSegment(
  marker: IActivityMarker,
  label: string
): ILoopSegmentInput {
  return {
    start: marker.interval.start,
    end: marker.interval.end,
    title: `${label}: ${marker.marker.title}`,
  };
}

function sortLoopSegments(segments: ILoopSegmentInput[]) {
  return [...segments].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return a.end - b.end;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
}

function dedupeLoopSegments(segments: ILoopSegmentInput[]) {
  const coveredIntervals: IInterval[] = [];
  const dedupedSegments: ILoopSegmentInput[] = [];
  const orderedSegments = [...segments].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  orderedSegments.forEach((segment) => {
    const start = Math.min(segment.start, segment.end);
    const end = Math.max(segment.start, segment.end);
    if (end <= start) return;

    const uncoveredSegmentIntervals = subtractIntervals(
      [{ start, end }],
      coveredIntervals
    );

    uncoveredSegmentIntervals.forEach((interval) => {
      dedupedSegments.push({
        ...segment,
        start: interval.start,
        end: interval.end,
      });
    });

    coveredIntervals.push({ start, end });
  });

  return sortLoopSegments(dedupedSegments);
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
  const outstandingIntervals: IInterval[] = [];
  const outstandingLoopSegments: ILoopSegmentInput[] = [];
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
    const activityMarker = category
      ? { marker, category, interval }
      : undefined;
    if (activityMarker) {
      intervals[activityMarker.category].push(interval);
      markers.push(activityMarker);
    }

    if (isOutstandingMarker(marker, roleTagIds)) {
      outstandingIntervals.push(interval);
      outstandingLoopSegments.push({
        start: interval.start,
        end: interval.end,
        title: `OUTSTANDING: ${marker.title}`,
      });
    }
  });

  const sexSeconds = mergeDuration(intervals.sex);
  const oralSeconds = mergeDuration(intervals.oral);
  const soloSeconds = mergeDuration(intervals.solo);
  const activityIntervals = [
    ...intervals.sex,
    ...intervals.oral,
    ...intervals.solo,
  ];
  const activityOtherIntervals = uncoveredIntervals(
    totalSeconds,
    activityIntervals
  );
  const outstandingVisibleIntervals = subtractIntervals(
    outstandingIntervals,
    unusableIntervals
  );
  const standardIntervals = uncoveredIntervals(totalSeconds, [
    ...outstandingIntervals,
    ...unusableIntervals,
  ]);

  const loopSegments: Record<string, ILoopSegmentInput[]> = {
    sex: markers
      .filter((marker) => marker.category === "sex")
      .map((marker) => buildMarkerLoopSegment(marker, "SEX")),
    oral: markers
      .filter((marker) => marker.category === "oral")
      .map((marker) => buildMarkerLoopSegment(marker, "ORAL")),
    solo: markers
      .filter((marker) => marker.category === "solo")
      .map((marker) => buildMarkerLoopSegment(marker, "SOLO")),
    other: buildIntervalLoopSegments("OTHER", activityOtherIntervals),
    outstanding: outstandingLoopSegments,
    standard: buildIntervalLoopSegments("STANDARD", standardIntervals),
  };

  return {
    totalSeconds,
    sexSeconds,
    oralSeconds,
    soloSeconds,
    unusableSeconds: mergeDuration(unusableIntervals),
    otherSeconds: mergeDuration(activityOtherIntervals),
    outstandingSeconds: mergeDuration(outstandingVisibleIntervals),
    standardSeconds: mergeDuration(standardIntervals),
    markers,
    loopSegments,
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
  const { soloTag } = useRoleTags();
  const sceneMarkerTagNames = useMemo(
    () =>
      scene.scene_markers
        .map((marker) => marker.primary_tag.name)
        .filter((tagName): tagName is string => !!tagName),
    [scene.scene_markers]
  );
  const soloMarkerColor = getSceneMarkerTagColorCustom(
    soloTag?.name,
    sceneMarkerTagNames
  );
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(
    new Set()
  );
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

  const activityRows: IStatsRow[] = [
    {
      key: "sex",
      label: "Sex",
      seconds: activityStats.sexSeconds,
      percent: percent(activityStats.sexSeconds, activityStats.totalSeconds),
      category: "sex",
      selectableKey: "sex",
      loopSegments: activityStats.loopSegments.sex,
    },
    {
      key: "oral",
      label: "Oral",
      seconds: activityStats.oralSeconds,
      percent: percent(activityStats.oralSeconds, activityStats.totalSeconds),
      category: "oral",
      selectableKey: "oral",
      loopSegments: activityStats.loopSegments.oral,
    },
    {
      key: "solo",
      label: "Solo",
      seconds: activityStats.soloSeconds,
      percent: percent(activityStats.soloSeconds, activityStats.totalSeconds),
      category: "solo",
      selectableKey: "solo",
      loopSegments: activityStats.loopSegments.solo,
      color: soloMarkerColor,
    },
    {
      key: "other",
      label: "Other",
      seconds: activityStats.otherSeconds,
      percent: percent(activityStats.otherSeconds, activityStats.totalSeconds),
      selectableKey: "other",
      loopSegments: activityStats.loopSegments.other,
    },
  ];
  const qualityRows: IStatsRow[] = [
    {
      key: "outstanding",
      label: "Outstanding",
      seconds: activityStats.outstandingSeconds,
      percent: percent(
        activityStats.outstandingSeconds,
        activityStats.totalSeconds
      ),
      selectableKey: "outstanding",
      loopSegments: activityStats.loopSegments.outstanding,
    },
    {
      key: "standard",
      label: "Standard",
      seconds: activityStats.standardSeconds,
      percent: percent(
        activityStats.standardSeconds,
        activityStats.totalSeconds
      ),
      selectableKey: "standard",
      loopSegments: activityStats.loopSegments.standard,
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

  function toggleActivity(category: string) {
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

  function getSelectedRows(rows: IStatsRow[]) {
    return rows.filter(
      (row) => row.selectableKey && selectedActivities.has(row.selectableKey)
    );
  }

  function buildSelectedActivityLoopSegments() {
    const selectedActivityRows = getSelectedRows(activityRows);
    const selectedQualityRows = getSelectedRows(qualityRows);

    if (selectedActivityRows.length > 0 && selectedQualityRows.length > 0) {
      return selectedActivityRows.flatMap((activityRow) =>
        selectedQualityRows.flatMap((qualityRow) =>
          buildIntersectedLoopSegments(
            `${qualityRow.label.toUpperCase()} ${activityRow.label.toUpperCase()}`,
            activityRow.loopSegments ?? [],
            qualityRow.loopSegments ?? []
          )
        )
      );
    }

    return [...selectedActivityRows, ...selectedQualityRows].flatMap(
      (row) => row.loopSegments ?? []
    );
  }

  function addSelectedActivitiesToLoop() {
    if (selectedActivities.size === 0 && selectedPerformerRows.size === 0)
      return;

    const selectedSegments = buildSelectedActivityLoopSegments();
    const selectedMarkers = new Map<string, IActivityMarker>();

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
      dedupeLoopSegments([
        ...selectedSegments,
        ...buildLoopSegments([...selectedMarkers.values()]),
      ])
    );
    setSelectedActivities(new Set());
    setSelectedPerformerRows(new Set());
  }

  const canAddToLoop =
    selectedActivities.size > 0 || selectedPerformerRows.size > 0;
  const activityPieSlices = getActivityPieSlices(activityRows, soloMarkerColor);
  const qualityPieSlices = getActivityPieSlices(qualityRows, soloMarkerColor);

  function renderActivityChartFooter(rows: IStatsRow[]) {
    return (
      <div className="custom-stats-chart-table">
        {rows
          .filter((row) => row.key !== "total" && row.seconds > 0)
          .map((row) => (
            <div className="custom-stats-chart-row" key={row.key}>
              <span
                aria-hidden="true"
                className="custom-stats-color-swatch"
                style={{
                  backgroundColor: getStatsRowColor(row, soloMarkerColor),
                }}
              />
              {row.selectableKey && row.loopSegments?.length ? (
                <Form.Check
                  className="custom-stats-check"
                  id={`scene-stats-${scene.id}-${row.selectableKey}`}
                  checked={selectedActivities.has(row.selectableKey)}
                  label={row.label}
                  onChange={() =>
                    row.selectableKey && toggleActivity(row.selectableKey)
                  }
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
                style={{
                  backgroundColor: row.isChild
                    ? getStatsRowColor(row, soloMarkerColor)
                    : "transparent",
                }}
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
          footer={renderActivityChartFooter(activityRows)}
          showLegend={false}
          slices={activityPieSlices}
          title="Activity Type"
        />
        <ActivityPieChart
          centerLabel={TextUtils.secondsToTimestamp(activityStats.totalSeconds)}
          className="custom-stats-overview-chart"
          footer={renderActivityChartFooter(qualityRows)}
          showLegend={false}
          slices={qualityPieSlices}
          title="Quality"
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
