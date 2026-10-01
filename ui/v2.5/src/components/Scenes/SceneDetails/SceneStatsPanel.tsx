import React, { useEffect, useMemo, useState } from "react";
import cx from "classnames";
import {
  Button,
  ButtonGroup,
  Form,
  Nav,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { ModalComponent } from "src/components/Shared/Modal";
import { VatoPortraitHover } from "src/components/Shared/VatoPortraitHover_custom"; // CUSTOM
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import TextUtils from "src/utils/text";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";
import { ACTIVITY_PIE_COLORS } from "src/components/Shared/activityColors_custom"; // CUSTOM
import {
  buildIntersectedLoopSegments,
  buildIntervalLoopSegments,
} from "./sceneStatsLoopSegments_custom"; // CUSTOM
import {
  getSceneStatsCombinedPerformerActivity,
  getSceneStatsPerformerActivityPercent,
  type ISceneStatsPerformerActivityMetric,
} from "./sceneStatsPerformerActivity_custom"; // CUSTOM
import {
  getSceneStatsAvailableInteractionViews,
  getSceneStatsAvailablePartnerViews,
  getSceneStatsInteractionPairKey,
  getSceneStatsInteractionPairs,
  getSceneStatsLeadingRoleInteractionSeconds,
  getSceneStatsOverallPartnerDistribution,
  getSceneStatsPartnerBarPercent,
  getSceneStatsPartnerInteractions,
  getSceneStatsPartnerRoleBreakdown,
  getSceneStatsRoleInteractionKey,
  getSceneStatsRoleInteractions,
  getSceneStatsRoleInteractionView,
  isSceneStatsLeadingPartner,
  shouldShowSceneStatsDetails,
  shouldShowSceneStatsPartnerInteractions,
  type ISceneStatsInteractionPair,
  type ISceneStatsPartnerDistribution,
  type ISceneStatsPartnerSlice,
  type ISceneStatsRoleInteraction,
  type SceneStatsPartnerCategory,
} from "./sceneStatsPartnerInteractions_custom"; // CUSTOM
import { OutstandingActivityMatrixTable } from "../OutstandingActivityMatrix_custom"; // CUSTOM
import { getOutstandingActivityMatrix } from "../sceneCardInsightsData_custom"; // CUSTOM
import { SceneActivityMetricBox } from "../SceneActivityMetrics_custom"; // CUSTOM
import { PerformerVersatilityByTime } from "src/components/Performers/PerformerDetails/PerformerVersatility_custom"; // CUSTOM
import {
  sceneActivityMarkerCategory,
  sceneActivityMarkerIsOutstanding,
  sceneActivityTagAncestors,
  type SceneActivityMetric,
  type SceneActivityMetricKey,
} from "../sceneActivityMetricsData_custom"; // CUSTOM: shared marker classification
import {
  getActivityTypePercentagesCustom,
  getPartitionPercentagesCustom,
} from "src/components/Shared/activityTypePercentages_custom"; // CUSTOM

interface IProps {
  scene: GQL.SceneDataFragment;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void;
}

type ActivityCategory = "sex" | "oral" | "solo";
type PerformerActivityCategory = ActivityCategory | "both";
type SceneStatsDetailView =
  | "performer"
  | "partners"
  | "interactions"
  | "activity"; // CUSTOM
type SceneStatsInteractionView = SceneStatsPartnerCategory | "both";

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
  activityTimeSeconds: number; // CUSTOM: union duration for overlapping types
  sexSeconds: number;
  oralSeconds: number;
  soloSeconds: number;
  otherSeconds: number;
  outstandingSeconds: number;
  standardSeconds: number;
  unclassifiedSeconds: number;
  unusableSeconds: number;
  qualityByActivity: Record<ActivityCategory, IActivityQualityStats>;
  markers: IActivityMarker[];
  loopSegments: Record<string, ILoopSegmentInput[]>;
}

interface IActivityQualityStats {
  totalSeconds: number;
  outstandingSeconds: number;
  standardSeconds: number;
  unusableSeconds: number;
}

interface IStatsRow {
  key: string;
  label: string;
  seconds: number;
  percent: number;
  showPercent?: boolean;
  category?: PerformerActivityCategory;
  totalActivitySeconds?: number;
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
  partnerInteractions: Partial<
    Record<SceneStatsPartnerCategory, ISceneStatsPartnerDistribution>
  >;
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

function intersectIntervals(first: IInterval[], second: IInterval[]) {
  return mergeIntervals(first).flatMap((firstInterval) =>
    mergeIntervals(second).flatMap((secondInterval) => {
      const start = Math.max(firstInterval.start, secondInterval.start);
      const end = Math.min(firstInterval.end, secondInterval.end);
      return end > start ? [{ start, end }] : [];
    })
  );
}

function percent(seconds: number, totalSeconds: number) {
  if (totalSeconds <= 0) return 0;
  return Math.round((seconds / totalSeconds) * 100);
}

function formatPercentValue(row: Pick<IStatsRow, "percent">) {
  return `${row.percent}%`;
}

function getActivityColor(key: string, soloColor = ACTIVITY_PIE_COLORS.solo) {
  const colors: Record<string, string> = {
    both: "#8f7ee7",
    sex: ACTIVITY_PIE_COLORS.sex,
    oral: ACTIVITY_PIE_COLORS.oral,
    solo: soloColor,
    other: ACTIVITY_PIE_COLORS.other,
    outstanding: ACTIVITY_PIE_COLORS.outstanding,
    standard: ACTIVITY_PIE_COLORS.standard,
    unclassified: ACTIVITY_PIE_COLORS.other,
    unusable: ACTIVITY_PIE_COLORS.unusable,
  };

  return colors[key] ?? ACTIVITY_PIE_COLORS.other;
}

function getStatsRowColor(row: IStatsRow, soloColor?: string) {
  if (row.color) return row.color;
  if (row.role === "top") return ACTIVITY_PIE_COLORS.top;
  if (row.role === "bottom") return ACTIVITY_PIE_COLORS.bottom;

  // CUSTOM: activity-specific quality rows use keys such as
  // "sex-outstanding"; retain the global Quality chart palette.
  const qualityKey = row.key.split("-").at(-1);
  if (
    qualityKey === "outstanding" ||
    qualityKey === "standard" ||
    qualityKey === "unclassified" ||
    qualityKey === "unusable"
  ) {
    return getActivityColor(qualityKey, soloColor);
  }

  return getActivityColor(row.category ?? row.key, soloColor);
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
    goatTagId?: string;
    orgasmTagId?: string;
    reallyHotTagId?: string;
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
  const ancestors = sceneActivityTagAncestors(scene);
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

    const category = sceneActivityMarkerCategory(marker, roleTagIds);
    const activityMarker = category
      ? { marker, category, interval }
      : undefined;
    if (activityMarker) {
      intervals[activityMarker.category].push(interval);
      markers.push(activityMarker);
    }

    if (sceneActivityMarkerIsOutstanding(marker, roleTagIds, ancestors)) {
      outstandingIntervals.push(interval);
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
  // CUSTOM: retain overlapping non-activity coverage and include any portion
  // outside Sex/Oral/Solo instead of clipping Outstanding to activity.
  const outstandingVisibleIntervals = subtractIntervals(
    outstandingIntervals,
    unusableIntervals
  );
  const standardIntervals = subtractIntervals(activityIntervals, [
    ...outstandingIntervals,
    ...unusableIntervals,
  ]);
  const unclassifiedIntervals = uncoveredIntervals(totalSeconds, [
    ...activityIntervals,
    ...outstandingIntervals,
    ...unusableIntervals,
  ]);
  const qualityByActivity = (
    Object.keys(intervals) as ActivityCategory[]
  ).reduce((byActivity, category) => {
    const categoryActivityIntervals = intervals[category];
    const outstanding = intersectIntervals(
      categoryActivityIntervals,
      outstandingVisibleIntervals
    );
    const unusable = intersectIntervals(
      categoryActivityIntervals,
      unusableIntervals
    );
    byActivity[category] = {
      totalSeconds: mergeDuration(categoryActivityIntervals),
      outstandingSeconds: mergeDuration(outstanding),
      unusableSeconds: mergeDuration(unusable),
      standardSeconds: mergeDuration(
        subtractIntervals(categoryActivityIntervals, [
          ...outstandingIntervals,
          ...unusableIntervals,
        ])
      ),
    };
    return byActivity;
  }, {} as Record<ActivityCategory, IActivityQualityStats>);

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
    outstanding: buildIntervalLoopSegments(
      "OUTSTANDING",
      outstandingVisibleIntervals
    ),
    standard: buildIntervalLoopSegments("STANDARD", standardIntervals),
    unclassified: buildIntervalLoopSegments(
      "UNCLASSIFIED",
      unclassifiedIntervals
    ),
  };

  return {
    totalSeconds,
    activityTimeSeconds: mergeDuration(activityIntervals), // CUSTOM
    sexSeconds,
    oralSeconds,
    soloSeconds,
    unusableSeconds: mergeDuration(unusableIntervals),
    otherSeconds: mergeDuration(activityOtherIntervals),
    outstandingSeconds: mergeDuration(outstandingVisibleIntervals),
    standardSeconds: mergeDuration(standardIntervals),
    unclassifiedSeconds: mergeDuration(unclassifiedIntervals),
    qualityByActivity,
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
        partnerInteractions: {},
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
  const partnerInteractions = getSceneStatsPartnerInteractions(
    stats.markers.map(({ marker, category, interval }) => ({
      category,
      interval,
      topPerformers: marker.top_performers.map((performer) => ({
        id: performer.id,
        name: performer.name,
        imagePath: performer.image_path,
      })),
      bottomPerformers: marker.bottom_performers.map((performer) => ({
        id: performer.id,
        name: performer.name,
        imagePath: performer.image_path,
      })),
    }))
  );

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
      const categories: ActivityCategory[] = ["sex", "oral", "solo"];
      const categoryMetrics = Object.fromEntries(
        categories.map((category) => [
          category,
          {
            bottomSeconds: mergeDuration(
              entry.intervals[`${category}_bottom`] ?? []
            ),
            topSeconds: mergeDuration(entry.intervals[`${category}_top`] ?? []),
            totalSeconds: mergeDuration(entry.intervals[category] ?? []),
          },
        ])
      ) as Record<ActivityCategory, ISceneStatsPerformerActivityMetric>;
      const activityTotalSeconds: Record<ActivityCategory, number> = {
        sex: stats.sexSeconds,
        oral: stats.oralSeconds,
        solo: stats.soloSeconds,
      };
      const appendActivityRows = (
        category: PerformerActivityCategory,
        label: string,
        metric: ISceneStatsPerformerActivityMetric,
        totalActivitySeconds: number,
        sourceCategories: ActivityCategory[],
        rolePercents?: { bottomPercent: number; topPercent: number }
      ) => {
        if (metric.totalSeconds <= 0) return;

        rows.push({
          key: `${category}-total`,
          label,
          seconds: metric.totalSeconds,
          percent: getSceneStatsPerformerActivityPercent(
            metric.totalSeconds,
            totalActivitySeconds
          ),
          category,
          totalActivitySeconds,
          markers: sourceCategories.flatMap(
            (sourceCategory) => entry.markers[sourceCategory] ?? []
          ),
        });

        if (metric.topSeconds > 0) {
          rows.push({
            key: `${category}-top`,
            label: "Top",
            seconds: metric.topSeconds,
            percent:
              rolePercents?.topPercent ??
              percent(metric.topSeconds, metric.totalSeconds),
            category,
            role: "top",
            isChild: true,
            markers: sourceCategories.flatMap(
              (sourceCategory) => entry.markers[`${sourceCategory}_top`] ?? []
            ),
          });
        }
        if (metric.bottomSeconds > 0) {
          rows.push({
            key: `${category}-bottom`,
            label: "Bottom",
            seconds: metric.bottomSeconds,
            percent:
              rolePercents?.bottomPercent ??
              percent(metric.bottomSeconds, metric.totalSeconds),
            category,
            role: "bottom",
            isChild: true,
            markers: sourceCategories.flatMap(
              (sourceCategory) =>
                entry.markers[`${sourceCategory}_bottom`] ?? []
            ),
          });
        }
      };
      const combinedMetric = getSceneStatsCombinedPerformerActivity(
        categoryMetrics.sex,
        categoryMetrics.oral
      );

      if (combinedMetric) {
        appendActivityRows(
          "both",
          "Overall",
          combinedMetric,
          stats.sexSeconds + stats.oralSeconds,
          ["sex", "oral"],
          combinedMetric
        );
      }
      categories.forEach((category) => {
        appendActivityRows(
          category,
          category[0].toUpperCase() + category.slice(1),
          categoryMetrics[category],
          activityTotalSeconds[category],
          [category]
        );
      });

      return {
        performer: entry.performer,
        partnerInteractions: partnerInteractions[entry.performer.id] ?? {},
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
  const soloMarkerColor = ACTIVITY_PIE_COLORS.solo;
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(
    new Set()
  );
  const [detailView, setDetailView] =
    useState<SceneStatsDetailView>("performer");
  const [interactionView, setInteractionView] =
    useState<SceneStatsInteractionView>("both");
  const [activePerformerID, setActivePerformerID] = useState<
    string | undefined
  >();
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    setSelectedActivities(new Set());
    setDetailView("performer");
    setInteractionView("both");
    setActivePerformerID(undefined);
    setShowDetailsModal(false);
  }, [scene.id]);

  const stats = useMemo(
    () => getActivityStats(scene, configuration?.ui?.roleTagIds ?? {}),
    [configuration?.ui?.roleTagIds, scene]
  );
  const outstandingActivityMatrix = useMemo(
    () =>
      getOutstandingActivityMatrix(
        scene,
        configuration?.ui?.roleTagIds,
        configuration?.ui?.sceneCardInsightThresholds
      ),
    [
      configuration?.ui?.roleTagIds,
      configuration?.ui?.sceneCardInsightThresholds,
      scene,
    ]
  );
  const performerStats = useMemo(
    () => (stats ? getPerformerStats(stats) : []),
    [stats]
  );
  const interactionPairs = useMemo(
    () =>
      getSceneStatsInteractionPairs(
        performerStats.map((entry) => ({
          id: entry.performer.id,
          imagePath: entry.performer.image_path,
          name: entry.performer.name,
        })),
        Object.fromEntries(
          performerStats.map((entry) => [
            entry.performer.id,
            entry.partnerInteractions,
          ])
        )
      ),
    [performerStats]
  );
  const roleInteractions = useMemo(
    () =>
      stats
        ? getSceneStatsRoleInteractions(
            stats.markers.map(({ marker, category, interval }) => ({
              category,
              interval,
              topPerformers: marker.top_performers.map((performer) => ({
                id: performer.id,
                imagePath: performer.image_path,
                name: performer.name,
              })),
              bottomPerformers: marker.bottom_performers.map((performer) => ({
                id: performer.id,
                imagePath: performer.image_path,
                name: performer.name,
              })),
            }))
          )
        : [],
    [stats]
  );
  const availableInteractionViews = useMemo(
    () => getSceneStatsAvailableInteractionViews(roleInteractions),
    [roleInteractions]
  );

  useEffect(() => {
    if (!availableInteractionViews.includes(interactionView)) {
      setInteractionView(availableInteractionViews[0] ?? "both");
    }
  }, [availableInteractionViews, interactionView]);

  if (!stats) return null;
  const activityStats = stats;
  const activePerformer =
    performerStats.find((entry) => entry.performer.id === activePerformerID) ??
    performerStats[0];
  const interactionPairByKey = new Map(
    interactionPairs.map((pair) => [pair.key, pair])
  );
  const roleInteractionByKey = new Map(
    roleInteractions.map((interaction) => [interaction.key, interaction])
  );
  // CUSTOM: use unique covered time so activity percentages can exceed 100%.
  const classifiedActivitySeconds = activityStats.activityTimeSeconds;
  // CUSTOM: calculate each category against the union of classified intervals.
  const activityPercentages = getActivityTypePercentagesCustom(
    {
      sex: activityStats.sexSeconds,
      oral: activityStats.oralSeconds,
      solo: activityStats.soloSeconds,
    },
    activityStats.activityTimeSeconds
  );
  const qualityPercentages = getPartitionPercentagesCustom(
    {
      outstanding: activityStats.outstandingSeconds,
      standard: activityStats.standardSeconds,
      unclassified: activityStats.unclassifiedSeconds,
      unusable: activityStats.unusableSeconds,
    },
    ["outstanding", "standard", "unclassified", "unusable"]
  );

  // CUSTOM: align activity metric tooltips with the scene card terminology.
  const activityRows: IStatsRow[] = [
    {
      key: "sex",
      label: "Fucking",
      seconds: activityStats.sexSeconds,
      percent: activityPercentages.sex,
      category: "sex",
      selectableKey: "sex",
      loopSegments: activityStats.loopSegments.sex,
    },
    {
      key: "oral",
      label: "Eating pito",
      seconds: activityStats.oralSeconds,
      percent: activityPercentages.oral,
      category: "oral",
      selectableKey: "oral",
      loopSegments: activityStats.loopSegments.oral,
    },
    {
      key: "solo",
      label: "Jerking",
      seconds: activityStats.soloSeconds,
      percent: activityPercentages.solo,
      category: "solo",
      selectableKey: "solo",
      loopSegments: activityStats.loopSegments.solo,
      color: soloMarkerColor,
    },
    {
      key: "other",
      label: "Other",
      seconds: activityStats.otherSeconds,
      percent: 0,
      showPercent: false,
      selectableKey: "other",
      loopSegments: activityStats.loopSegments.other,
    },
  ];
  const qualityRows: IStatsRow[] = [
    {
      key: "outstanding",
      label: "Outstanding",
      seconds: activityStats.outstandingSeconds,
      percent: qualityPercentages.outstanding,
      selectableKey: "outstanding",
      loopSegments: activityStats.loopSegments.outstanding,
    },
    {
      key: "standard",
      label: "Standard",
      seconds: activityStats.standardSeconds,
      percent: qualityPercentages.standard,
      selectableKey: "standard",
      loopSegments: activityStats.loopSegments.standard,
    },
    {
      key: "unclassified",
      label: "Unclassified",
      seconds: activityStats.unclassifiedSeconds,
      percent: qualityPercentages.unclassified,
      selectableKey: "unclassified",
      loopSegments: activityStats.loopSegments.unclassified,
    },
    {
      key: "unusable",
      label: "Unusable",
      seconds: activityStats.unusableSeconds,
      percent: qualityPercentages.unusable,
    },
  ];
  const qualityRowsByActivity = (
    Object.keys(activityStats.qualityByActivity) as ActivityCategory[]
  )
    .map((category) => {
      const quality = activityStats.qualityByActivity[category];
      if (quality.totalSeconds <= 0) return undefined;
      const label = category[0].toUpperCase() + category.slice(1);
      // CUSTOM: same spans as selecting the activity and the quality above.
      const qualityLoopSegments = (qualityKey: "outstanding" | "standard") =>
        buildIntersectedLoopSegments(
          `${qualityKey.toUpperCase()} ${category.toUpperCase()}`,
          activityStats.loopSegments[category],
          activityStats.loopSegments[qualityKey]
        );
      return {
        title: `${label} Quality`,
        totalSeconds: quality.totalSeconds,
        rows: [
          {
            key: `${category}-outstanding`,
            label: "Outstanding",
            seconds: quality.outstandingSeconds,
            percent: percent(quality.outstandingSeconds, quality.totalSeconds),
            selectableKey: `${category}-outstanding`,
            loopSegments: qualityLoopSegments("outstanding"),
          },
          {
            key: `${category}-standard`,
            label: "Standard",
            seconds: quality.standardSeconds,
            percent: percent(quality.standardSeconds, quality.totalSeconds),
            selectableKey: `${category}-standard`,
            loopSegments: qualityLoopSegments("standard"),
          },
          {
            key: `${category}-unusable`,
            label: "Unusable",
            seconds: quality.unusableSeconds,
            percent: percent(quality.unusableSeconds, quality.totalSeconds),
          },
        ] as IStatsRow[],
      };
    })
    .filter(
      (
        value
      ): value is { title: string; totalSeconds: number; rows: IStatsRow[] } =>
        !!value
    );

  function toggleActivity(category: string) {
    setSelectedActivities((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function getSelectedRows(rows: IStatsRow[]) {
    return rows.filter(
      (row) => row.selectableKey && selectedActivities.has(row.selectableKey)
    );
  }

  function buildSelectedActivityLoopSegments() {
    const selectedActivityRows = getSelectedRows(activityRows);
    const selectedQualityRows = getSelectedRows(qualityRows);
    // CUSTOM: Sex/Oral/Solo quality rows are already activity intersections.
    const activityQualitySegments = qualityRowsByActivity
      .flatMap((quality) => getSelectedRows(quality.rows))
      .flatMap((row) => row.loopSegments ?? []);

    if (selectedActivityRows.length > 0 && selectedQualityRows.length > 0) {
      return [
        ...selectedActivityRows.flatMap((activityRow) =>
          selectedQualityRows.flatMap((qualityRow) =>
            buildIntersectedLoopSegments(
              `${qualityRow.label.toUpperCase()} ${activityRow.label.toUpperCase()}`,
              activityRow.loopSegments ?? [],
              qualityRow.loopSegments ?? []
            )
          )
        ),
        ...activityQualitySegments,
      ];
    }

    return [
      ...[...selectedActivityRows, ...selectedQualityRows].flatMap(
        (row) => row.loopSegments ?? []
      ),
      ...activityQualitySegments,
    ];
  }

  // CUSTOM: only the Stats panel adds to the loop; Detailed Scene Stats is read-only.
  const overviewLoopSegments = dedupeLoopSegments(
    buildSelectedActivityLoopSegments()
  );
  const overviewSelectionCount = selectedActivities.size;

  function clearLoopSelection() {
    setSelectedActivities(new Set());
  }

  function addSelectedStatsToLoop() {
    if (overviewLoopSegments.length === 0) return;

    addMultiSegmentLoopSegments(overviewLoopSegments);
    clearLoopSelection();
  }

  // CUSTOM: keep scene overview stats as selectable card-style metrics below the bars.
  function renderOverviewPanel(
    title: string,
    rows: IStatsRow[],
    stacked = false,
    totalSeconds = activityStats.totalSeconds
  ) {
    const visibleRows = rows.filter(
      (row) => row.seconds > 0 && (row.showPercent === false || row.percent > 0)
    );
    const chartRows = visibleRows.filter((row) => row.showPercent !== false);

    return (
      <section className="scene-stats-overview-panel">
        <div className="scene-stats-section-heading">
          <h5>{title}</h5>
          <span>{TextUtils.secondsToTimestamp(totalSeconds)}</span>
        </div>
        {stacked && (
          <div
            aria-label={`${title} distribution`}
            className="scene-stats-stacked-bar"
            role="img"
          >
            {chartRows.map((row) => (
              <span
                className={`scene-stats-stacked-segment scene-stats-stacked-segment--${row.key}`}
                key={row.key}
                style={{
                  backgroundColor: getStatsRowColor(row, soloMarkerColor),
                  width: `${Math.max(0, Math.min(100, row.percent))}%`,
                }}
                title={`${row.label}: ${TextUtils.secondsToTimestamp(
                  row.seconds
                )} (${formatPercentValue(row)})`}
              />
            ))}
          </div>
        )}
        <div className="scene-stats-overview-rows scene-stats-overview-metric-boxes">
          {visibleRows.map((row) => {
            const selectable =
              !!row.selectableKey && !!row.loopSegments?.length;
            const metric: SceneActivityMetric = {
              key: row.key as SceneActivityMetricKey,
              label: row.label,
              duration: row.seconds,
              percent: row.percent,
              showPercent: row.showPercent,
              color: getStatsRowColor(row, soloMarkerColor),
            };
            const control = selectable ? (
              <div className="scene-activity-metric__control">
                <Form.Check
                  checked={selectedActivities.has(row.selectableKey!)}
                  className="custom-stats-check"
                  id={"scene-stats-" + scene.id + "-" + row.selectableKey}
                  label={<span className="sr-only">{row.label}</span>}
                  onChange={() => toggleActivity(row.selectableKey!)}
                />
              </div>
            ) : undefined;

            return (
              <SceneActivityMetricBox
                control={control}
                key={row.key}
                metric={metric}
                sceneId={scene.id}
              />
            );
          })}
        </div>
      </section>
    );
  }

  // CUSTOM: role seconds feed Versatility by Time.
  function getPerformerRowSeconds(entry: IPerformerStats, key: string) {
    return entry.rows.find((row) => row.key === key)?.seconds ?? 0;
  }

  function getPartnerDistribution(
    entry: IPerformerStats,
    view: SceneStatsInteractionView
  ) {
    return view === "both"
      ? getSceneStatsOverallPartnerDistribution(entry.partnerInteractions)
      : entry.partnerInteractions[view];
  }

  function renderPartnerRoleLane(
    label: string,
    interaction: ISceneStatsRoleInteraction | undefined,
    seconds: number,
    rolePercent: number,
    role: "topped" | "bottomed"
  ) {
    if (!interaction || seconds <= 0) {
      return (
        <span
          aria-hidden="true"
          className={`scene-stats-partner-lane scene-stats-partner-lane-${role} scene-stats-partner-lane-empty`}
        />
      );
    }

    return (
      <span
        aria-label={`${label}: ${TextUtils.secondsToTimestamp(
          seconds
        )}, ${rolePercent}%`}
        className={`scene-stats-partner-lane scene-stats-partner-lane-${role}`}
        role="img"
      >
        <span
          aria-hidden="true"
          className="scene-stats-partner-lane-fill"
          style={{ width: `${Math.max(0, Math.min(100, rolePercent))}%` }}
        />
      </span>
    );
  }

  function renderPartnerActivityCell(
    performerID: string,
    view: SceneStatsInteractionView,
    pair: ISceneStatsInteractionPair,
    distribution: ISceneStatsPartnerDistribution | undefined,
    partner: ISceneStatsPartnerSlice | undefined
  ) {
    if (!distribution || !partner || partner.seconds <= 0) {
      return (
        <td
          aria-label={`${view} interactions: none`}
          className="scene-stats-partner-table-empty"
        />
      );
    }

    const viewLabel =
      view === "both" ? "Overall" : view[0].toUpperCase() + view.slice(1);
    const roleBreakdown = getSceneStatsPartnerRoleBreakdown(
      performerID,
      partner.performer.id,
      view,
      pair,
      roleInteractions
    );
    const toppedInteraction = roleInteractionByKey.get(
      getSceneStatsRoleInteractionKey(performerID, partner.performer.id)
    );
    const bottomedForInteraction = roleInteractionByKey.get(
      getSceneStatsRoleInteractionKey(partner.performer.id, performerID)
    );
    const tooltipID = `scene-stats-partner-${scene.id}-${performerID}-${partner.performer.id}-${view}`;
    const totalComparisonPercent = getSceneStatsPartnerBarPercent(
      partner.seconds,
      distribution
    );
    const totalBarPercent = Math.max(0, Math.min(100, totalComparisonPercent));
    const isLeadingPartner = isSceneStatsLeadingPartner(
      partner.seconds,
      distribution
    );

    return (
      <td
        className={cx("scene-stats-partner-table-activity", {
          "scene-stats-partner-table-activity-leading": isLeadingPartner,
        })}
      >
        <OverlayTrigger
          overlay={
            <Tooltip id={tooltipID}>
              <div className="scene-stats-partner-tooltip">
                <strong>
                  {viewLabel} with {partner.performer.name}
                </strong>
                {isLeadingPartner && <span>Most time in {viewLabel}</span>}
                <span>
                  Total: {TextUtils.secondsToTimestamp(partner.seconds)} (
                  {partner.percent}%)
                </span>
                {roleBreakdown.topped.seconds > 0 && (
                  <span>
                    Topped:{" "}
                    {TextUtils.secondsToTimestamp(roleBreakdown.topped.seconds)}{" "}
                    ({roleBreakdown.topped.percent}%)
                  </span>
                )}
                {roleBreakdown.bottomedFor.seconds > 0 && (
                  <span>
                    Bottomed For:{" "}
                    {TextUtils.secondsToTimestamp(
                      roleBreakdown.bottomedFor.seconds
                    )}{" "}
                    ({roleBreakdown.bottomedFor.percent}%)
                  </span>
                )}
              </div>
            </Tooltip>
          }
          placement="top"
        >
          <div
            aria-label={`${viewLabel} with ${
              partner.performer.name
            }: ${TextUtils.secondsToTimestamp(partner.seconds)}, ${
              partner.percent
            }%`}
            className="scene-stats-partner-composite"
            style={{ width: `${totalBarPercent}%` }}
          >
            <span
              aria-hidden="true"
              className="scene-stats-partner-composite-value"
            >
              {TextUtils.secondsToTimestamp(partner.seconds)} ·{" "}
              {partner.percent}%
            </span>
            <div className="scene-stats-partner-composite-track">
              <div className="scene-stats-partner-composite-total">
                {renderPartnerRoleLane(
                  `${viewLabel} Topped ${partner.performer.name}`,
                  toppedInteraction,
                  roleBreakdown.topped.seconds,
                  roleBreakdown.topped.percent,
                  "topped"
                )}
                {renderPartnerRoleLane(
                  `${viewLabel} Bottomed For ${partner.performer.name}`,
                  bottomedForInteraction,
                  roleBreakdown.bottomedFor.seconds,
                  roleBreakdown.bottomedFor.percent,
                  "bottomed"
                )}
              </div>
              <div
                aria-hidden="true"
                className="scene-stats-partner-role-values"
              >
                <span
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, roleBreakdown.topped.percent)
                    )}%`,
                  }}
                >
                  {roleBreakdown.topped.seconds > 0 && (
                    <>
                      {TextUtils.secondsToTimestamp(
                        roleBreakdown.topped.seconds
                      )}{" "}
                      · {roleBreakdown.topped.percent}%
                    </>
                  )}
                </span>
                <span
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, roleBreakdown.bottomedFor.percent)
                    )}%`,
                  }}
                >
                  {roleBreakdown.bottomedFor.seconds > 0 && (
                    <>
                      {TextUtils.secondsToTimestamp(
                        roleBreakdown.bottomedFor.seconds
                      )}{" "}
                      · {roleBreakdown.bottomedFor.percent}%
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </OverlayTrigger>
      </td>
    );
  }

  function renderPartnerTableRow(
    entry: IPerformerStats,
    partner: ISceneStatsPartnerSlice,
    availablePartnerViews: SceneStatsInteractionView[]
  ) {
    const pairKey = getSceneStatsInteractionPairKey(
      entry.performer.id,
      partner.performer.id
    );
    const pair = interactionPairByKey.get(pairKey);
    if (!pair) return null;

    return (
      <tr className="scene-stats-partner-table-row" key={partner.performer.id}>
        <th className="scene-stats-partner-table-partner" scope="row">
          <span className="scene-stats-partner-label">
            <VatoPortraitHover
              imagePath={partner.performer.imagePath}
              name={partner.performer.name}
            >
              <span
                aria-hidden="true"
                className="scene-stats-partner-image"
                style={{
                  backgroundImage: partner.performer.imagePath
                    ? `url(${partner.performer.imagePath})`
                    : undefined,
                }}
              />
            </VatoPortraitHover>
            <span>{partner.performer.name}</span>
          </span>
        </th>
        {availablePartnerViews.map((view) => {
          const distribution = getPartnerDistribution(entry, view);
          const viewPartner = distribution?.partners.find(
            (candidate) =>
              candidate.performer.id === partner.performer.id &&
              candidate.percent > 0
          );

          return (
            <React.Fragment key={view}>
              {renderPartnerActivityCell(
                entry.performer.id,
                view,
                pair,
                distribution,
                viewPartner
              )}
            </React.Fragment>
          );
        })}
      </tr>
    );
  }

  function renderPartnerTable(entry: IPerformerStats) {
    const availablePartnerViews = getSceneStatsAvailablePartnerViews(
      entry.partnerInteractions
    );
    const primaryDistribution = availablePartnerViews[0]
      ? getPartnerDistribution(entry, availablePartnerViews[0])
      : undefined;
    if (!primaryDistribution) {
      return (
        <span className="scene-stats-no-interactions">
          No partner interactions
        </span>
      );
    }
    const visiblePartners = primaryDistribution.partners.filter(
      (partner) => partner.percent > 0
    );
    if (visiblePartners.length === 0) {
      return (
        <span className="scene-stats-no-interactions">
          No partner interactions
        </span>
      );
    }

    return (
      <>
        <div className="scene-stats-partner-table-toolbar">
          <span className="scene-stats-partner-legend-item scene-stats-partner-legend-item-topped">
            Topped
          </span>
          <span className="scene-stats-partner-legend-item scene-stats-partner-legend-item-bottomed">
            Bottomed For
          </span>
        </div>
        <div className="scene-stats-partner-table-scroll">
          <table className="scene-stats-partner-table">
            <colgroup>
              <col style={{ width: "28%" }} />
              {availablePartnerViews.map((view) => (
                <col key={view} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Partner</th>
                {availablePartnerViews.map((view) => (
                  <th key={view} scope="col">
                    {view === "both"
                      ? "Overall"
                      : view[0].toUpperCase() + view.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePartners.map((partner) =>
                renderPartnerTableRow(entry, partner, availablePartnerViews)
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function renderMatrixInteraction(
    interaction: ISceneStatsRoleInteraction,
    leadingInteractionSeconds: number
  ) {
    const viewStats = getSceneStatsRoleInteractionView(
      interaction,
      interactionView,
      roleInteractions
    );
    if (viewStats.seconds <= 0) {
      return <span className="scene-stats-matrix-empty">—</span>;
    }

    const viewLabel =
      interactionView === "both" ? "combined Sex and Oral" : interactionView;
    const timestamp = TextUtils.secondsToTimestamp(viewStats.seconds);
    const isLeadingInteraction =
      leadingInteractionSeconds > 0 &&
      viewStats.seconds === leadingInteractionSeconds;

    return (
      <span
        aria-label={`${viewLabel} interactions with ${interaction.topPerformer.name} as Top and ${interaction.bottomPerformer.name} as Bottom (${timestamp})`}
        className={cx("scene-stats-matrix-pair", {
          "scene-stats-matrix-pair-leading": isLeadingInteraction,
        })}
        role="img"
      >
        <span className="scene-stats-matrix-time">{timestamp}</span>
      </span>
    );
  }

  function renderInteractionMatrix() {
    const leadingInteractionSeconds =
      getSceneStatsLeadingRoleInteractionSeconds(
        roleInteractions,
        interactionView
      );

    return (
      <section className="scene-stats-interactions">
        <div className="scene-stats-interaction-toolbar">
          <h5>Interaction Matrix</h5>
          <ButtonGroup aria-label="Interaction activity" size="sm">
            {availableInteractionViews.map((view) => (
              <Button
                aria-pressed={interactionView === view}
                key={view}
                onClick={() => setInteractionView(view)}
                variant={interactionView === view ? "primary" : "secondary"}
              >
                {view[0].toUpperCase() + view.slice(1)}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <div className="scene-stats-matrix-scroll">
          <table className="scene-stats-matrix">
            <thead>
              <tr>
                <th
                  aria-label="Rows are Top performers and columns are Bottom performers"
                  className="scene-stats-matrix-corner"
                />
                {performerStats.map((entry) => (
                  <th
                    className="scene-stats-matrix-bottom-header"
                    key={entry.performer.id}
                    scope="col"
                  >
                    <VatoPortraitHover
                      imagePath={entry.performer.image_path}
                      name={entry.performer.name}
                    >
                      <span
                        aria-hidden="true"
                        className="scene-stats-matrix-performer-image"
                        style={{
                          backgroundImage: entry.performer.image_path
                            ? `url(${entry.performer.image_path})`
                            : undefined,
                        }}
                      />
                    </VatoPortraitHover>
                    <span className="scene-stats-matrix-performer-name">
                      {entry.performer.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performerStats.map((rowEntry) => (
                <tr key={rowEntry.performer.id}>
                  <th className="scene-stats-matrix-top-header" scope="row">
                    <VatoPortraitHover
                      imagePath={rowEntry.performer.image_path}
                      name={rowEntry.performer.name}
                    >
                      <span
                        aria-hidden="true"
                        className="scene-stats-matrix-performer-image"
                        style={{
                          backgroundImage: rowEntry.performer.image_path
                            ? `url(${rowEntry.performer.image_path})`
                            : undefined,
                        }}
                      />
                    </VatoPortraitHover>
                    <span className="scene-stats-matrix-performer-name">
                      {rowEntry.performer.name}
                    </span>
                  </th>
                  {performerStats.map((columnEntry) => {
                    if (columnEntry.performer.id === rowEntry.performer.id) {
                      return (
                        <td
                          className="scene-stats-matrix-diagonal"
                          key={columnEntry.performer.id}
                        >
                          —
                        </td>
                      );
                    }

                    const interactionKey = getSceneStatsRoleInteractionKey(
                      rowEntry.performer.id,
                      columnEntry.performer.id
                    );
                    const interaction =
                      roleInteractionByKey.get(interactionKey);

                    return (
                      <td key={columnEntry.performer.id}>
                        {interaction ? (
                          renderMatrixInteraction(
                            interaction,
                            leadingInteractionSeconds
                          )
                        ) : (
                          <span className="scene-stats-matrix-empty">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="scene-stats-matrix-mobile">
          {roleInteractions.map((interaction) => (
            <div
              className="scene-stats-matrix-mobile-pair"
              key={interaction.key}
            >
              <div className="scene-stats-matrix-mobile-names">
                <span className="scene-stats-matrix-mobile-top">
                  <strong>Top</strong>
                  <VatoPortraitHover
                    imagePath={interaction.topPerformer.imagePath}
                    name={interaction.topPerformer.name}
                  >
                    <span
                      aria-hidden="true"
                      className="scene-stats-matrix-performer-image"
                      style={{
                        backgroundImage: interaction.topPerformer.imagePath
                          ? `url(${interaction.topPerformer.imagePath})`
                          : undefined,
                      }}
                    />
                  </VatoPortraitHover>
                  {interaction.topPerformer.name}
                </span>
                <span className="scene-stats-matrix-mobile-bottom">
                  <strong>Bottom</strong>
                  <VatoPortraitHover
                    imagePath={interaction.bottomPerformer.imagePath}
                    name={interaction.bottomPerformer.name}
                  >
                    <span
                      aria-hidden="true"
                      className="scene-stats-matrix-performer-image"
                      style={{
                        backgroundImage: interaction.bottomPerformer.imagePath
                          ? `url(${interaction.bottomPerformer.imagePath})`
                          : undefined,
                      }}
                    />
                  </VatoPortraitHover>
                  {interaction.bottomPerformer.name}
                </span>
              </div>
              {renderMatrixInteraction(interaction, leadingInteractionSeconds)}
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderLoopTray() {
    const selectedLoopDuration = mergeDuration(overviewLoopSegments);

    return (
      <div
        aria-label="Stats panel loop selection"
        className="scene-stats-loop-tray"
        role="group"
      >
        <div className="scene-stats-loop-status">
          {overviewSelectionCount > 0 && (
            <>
              <strong>
                {overviewSelectionCount} selection
                {overviewSelectionCount === 1 ? "" : "s"}
              </strong>
              <span>
                {overviewLoopSegments.length} segment
                {overviewLoopSegments.length === 1 ? "" : "s"}
              </span>
              <span>{TextUtils.secondsToTimestamp(selectedLoopDuration)}</span>
            </>
          )}
        </div>
        <div className="scene-stats-loop-actions">
          <Button
            disabled={overviewSelectionCount === 0}
            onClick={clearLoopSelection}
            size="sm"
            type="button"
            variant="outline-secondary"
          >
            Clear
          </Button>
          <Button
            disabled={overviewLoopSegments.length === 0}
            onClick={addSelectedStatsToLoop}
            size="sm"
            type="button"
            variant="primary"
          >
            Add to Loop
          </Button>
        </div>
      </div>
    );
  }

  // CUSTOM: every vato side by side, each with his Versatility by Time bars.
  function renderPerformerExplorer() {
    return (
      <section className="scene-stats-performer-explorer">
        <div className="scene-stats-section-heading">
          <h5>Versatility by Time</h5>
        </div>
        <div className="scene-stats-performer-columns">
          {performerStats.map((entry) => {
            const sexTopSeconds = getPerformerRowSeconds(entry, "sex-top");
            const sexBottomSeconds = getPerformerRowSeconds(
              entry,
              "sex-bottom"
            );
            const oralTopSeconds = getPerformerRowSeconds(entry, "oral-top");
            const oralBottomSeconds = getPerformerRowSeconds(
              entry,
              "oral-bottom"
            );
            const hasRoleTime =
              sexTopSeconds +
                sexBottomSeconds +
                oralTopSeconds +
                oralBottomSeconds >
              0;

            return (
              <div
                className="scene-stats-performer-column"
                key={entry.performer.id}
              >
                <div className="scene-stats-performer-column-header">
                  {/* CUSTOM: hovering the portrait shows it large */}
                  <VatoPortraitHover
                    imagePath={entry.performer.image_path}
                    name={entry.performer.name}
                  >
                    <span
                      aria-hidden="true"
                      className="scene-stats-performer-choice-image"
                      style={{
                        backgroundImage: entry.performer.image_path
                          ? `url(${entry.performer.image_path})`
                          : undefined,
                      }}
                    />
                  </VatoPortraitHover>
                  <span>{entry.performer.name}</span>
                </div>
                {hasRoleTime ? (
                  <PerformerVersatilityByTime
                    className="scene-stats-performer-versatility"
                    oralBottomSeconds={oralBottomSeconds}
                    oralTopSeconds={oralTopSeconds}
                    sexBottomSeconds={sexBottomSeconds}
                    sexTopSeconds={sexTopSeconds}
                    showTitle={false}
                  />
                ) : (
                  <span className="scene-stats-no-interactions">
                    No top or bottom time
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // CUSTOM: the former Performer Explorer layout, now its own tab.
  function renderPartnerInteractions() {
    return (
      <>
        <div className="scene-stats-performer-navigation">
          <div className="scene-stats-performer-ribbon">
            {performerStats.map((entry) => (
              <button
                aria-pressed={
                  activePerformer?.performer.id === entry.performer.id
                }
                className={cx("scene-stats-performer-choice", {
                  "scene-stats-performer-choice-active":
                    activePerformer?.performer.id === entry.performer.id,
                })}
                key={entry.performer.id}
                onClick={() => setActivePerformerID(entry.performer.id)}
                type="button"
              >
                <VatoPortraitHover
                  imagePath={entry.performer.image_path}
                  name={entry.performer.name}
                >
                  <span
                    aria-hidden="true"
                    className="scene-stats-performer-choice-image"
                    style={{
                      backgroundImage: entry.performer.image_path
                        ? `url(${entry.performer.image_path})`
                        : undefined,
                    }}
                  />
                </VatoPortraitHover>
                <span>{entry.performer.name}</span>
              </button>
            ))}
          </div>
        </div>

        {activePerformer && (
          <div className="scene-stats-partner-interactions">
            <div className="scene-stats-section-heading">
              <h5>Partner Interactions</h5>
            </div>
            {renderPartnerTable(activePerformer)}
          </div>
        )}
      </>
    );
  }

  const detailTabs: { key: SceneStatsDetailView; label: string }[] = [
    ...(performerStats.length > 0
      ? [{ key: "performer" as const, label: "Performer Explorer" }]
      : []),
    ...(performerStats.length > 0 &&
    shouldShowSceneStatsPartnerInteractions(scene.performers.length)
      ? [{ key: "partners" as const, label: "Partner Interactions" }]
      : []),
    ...(roleInteractions.length > 0
      ? [{ key: "interactions" as const, label: "Interaction Matrix" }]
      : []),
    ...(outstandingActivityMatrix.rows.length > 0
      ? [{ key: "activity" as const, label: "Activity Matrix" }]
      : []),
  ];
  const activeDetailView = detailTabs.some((tab) => tab.key === detailView)
    ? detailView
    : detailTabs[0]?.key;

  return (
    <div className="scene-stats-panel mt-3">
      <div className="scene-stats-overview-grid">
        {renderOverviewPanel(
          "Activity Type",
          activityRows,
          true,
          classifiedActivitySeconds
        )}
        {renderOverviewPanel("Quality", qualityRows, true)}
      </div>

      {qualityRowsByActivity.length > 0 && (
        <div className="scene-stats-overview-grid mt-3">
          {qualityRowsByActivity.map((quality) =>
            renderOverviewPanel(
              quality.title,
              quality.rows,
              true,
              quality.totalSeconds
            )
          )}
        </div>
      )}

      {renderLoopTray()}

      {(outstandingActivityMatrix.rows.length > 0 ||
        (performerStats.length > 0 &&
          shouldShowSceneStatsDetails(scene.performers.length))) && (
        <Button
          block
          className="scene-stats-details-launch"
          onClick={() => {
            setDetailView(performerStats.length > 0 ? "performer" : "activity");
            setShowDetailsModal(true);
          }}
          type="button"
          variant="outline-primary"
        >
          Open Detailed Stats
        </Button>
      )}

      <ModalComponent
        accept={{
          onClick: () => setShowDetailsModal(false),
          text: "Close",
        }}
        closeButton
        dialogClassName="scene-stats-details-dialog"
        header="Detailed Scene Stats"
        modalProps={{ keyboard: true, size: "xl" }}
        onHide={() => setShowDetailsModal(false)}
        show={showDetailsModal}
      >
        <section className="scene-stats-detail-workspace">
          {/* CUSTOM: left-aligned tabs; the details are read-only (no loop selection). */}
          <Nav
            activeKey={activeDetailView}
            className="scene-stats-detail-tabs"
            onSelect={(key) =>
              key && setDetailView(key as SceneStatsDetailView)
            }
            variant="tabs"
          >
            {detailTabs.map((tab) => (
              <Nav.Item key={tab.key}>
                <Nav.Link eventKey={tab.key}>{tab.label}</Nav.Link>
              </Nav.Item>
            ))}
          </Nav>

          {activeDetailView === "performer" && renderPerformerExplorer()}
          {activeDetailView === "partners" && renderPartnerInteractions()}
          {activeDetailView === "interactions" && renderInteractionMatrix()}
          {/* CUSTOM: keep the large activity table out of the compact panel. */}
          {activeDetailView === "activity" && (
            <OutstandingActivityMatrixTable
              matrix={outstandingActivityMatrix}
              title="Activity matrix"
            />
          )}
        </section>
      </ModalComponent>
    </div>
  );
};

export default SceneStatsPanel;
