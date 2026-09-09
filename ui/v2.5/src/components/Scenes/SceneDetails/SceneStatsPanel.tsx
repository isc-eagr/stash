import React, { useEffect, useMemo, useState } from "react";
import cx from "classnames";
import {
  Button,
  ButtonGroup,
  Form,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { ModalComponent } from "src/components/Shared/Modal";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useRoleTags } from "src/hooks/useRoleTags";
import TextUtils from "src/utils/text";
import type { ILoopSegmentInput } from "src/components/ScenePlayer/multi-segment-loop";
import {
  ACTIVITY_PIE_COLORS,
  getSceneMarkerTagColorCustom,
} from "src/components/Shared/ActivityPieChart_custom"; // CUSTOM
import {
  buildIntersectedLoopSegments,
  buildIntervalLoopSegments,
  getSceneStatsScopedLoopSegments,
  type SceneStatsLoopSelectionScope,
} from "./sceneStatsLoopSegments_custom"; // CUSTOM
import {
  getSceneStatsCombinedPerformerActivity,
  getSceneStatsPerformerActivityLabels,
  getSceneStatsPerformerActivityPercent,
  shouldShowSceneStatsPerformerParticipation,
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
  getSceneStatsRoleInteractionCategories,
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
import { isChronologicalSceneMarkerGoatTagged } from "./sceneMarkerChronologyLayout_custom"; // CUSTOM
import { OutstandingActivityMatrixTable } from "../OutstandingActivityMatrix_custom"; // CUSTOM
import { getOutstandingActivityMatrix } from "../sceneCardInsightsData_custom"; // CUSTOM

interface IProps {
  scene: GQL.SceneDataFragment;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void;
}

type ActivityCategory = "sex" | "oral" | "solo";
type PerformerActivityCategory = ActivityCategory | "both";
type SceneStatsDetailView = "performer" | "interactions" | "activity"; // CUSTOM
type SceneStatsInteractionView = SceneStatsPartnerCategory | "both";

interface IInterval {
  start: number;
  end: number;
}

type SceneStatsMarkerTag = {
  id: string;
  parents?: SceneStatsMarkerTag[] | null;
};

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
    qualityKey === "unusable"
  ) {
    return getActivityColor(qualityKey, soloColor);
  }

  return getActivityColor(row.category ?? row.key, soloColor);
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
    goatTagId?: string;
    orgasmTagId?: string;
    reallyHotTagId?: string;
  }
) {
  const tagMatches = (
    tag: SceneStatsMarkerTag,
    targetTagId: string | undefined
  ): boolean =>
    !!targetTagId &&
    (tag.id === targetTagId ||
      !!tag.parents?.some((parent) => tagMatches(parent, targetTagId)));
  const hasTag = (targetTagId: string | undefined) =>
    [marker.primary_tag, ...marker.tags].some((tag) =>
      tagMatches(tag, targetTagId)
    );
  // CUSTOM: a bare Orgasm/Facial no longer upgrades quality by itself.
  if (hasTag(roleTagIds.orgasmTagId)) {
    return (
      isChronologicalSceneMarkerGoatTagged(marker, roleTagIds.goatTagId) ||
      hasTag(roleTagIds.reallyHotTagId)
    );
  }
  return (
    isChronologicalSceneMarkerGoatTagged(marker, roleTagIds.goatTagId) ||
    !getMarkerActivityCategory(marker, roleTagIds) ||
    marker.tags.length > 0
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
  const [selectedRoleInteractions, setSelectedRoleInteractions] = useState<
    Set<string>
  >(new Set());
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
    setSelectedPerformerRows(new Set());
    setSelectedRoleInteractions(new Set());
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
  const qualityRowsByActivity = (
    Object.keys(activityStats.qualityByActivity) as ActivityCategory[]
  )
    .map((category) => {
      const quality = activityStats.qualityByActivity[category];
      if (quality.totalSeconds <= 0) return undefined;
      const label = category[0].toUpperCase() + category.slice(1);
      return {
        title: `${label} Quality`,
        totalSeconds: quality.totalSeconds,
        rows: [
          {
            key: `${category}-outstanding`,
            label: "Outstanding",
            seconds: quality.outstandingSeconds,
            percent: percent(quality.outstandingSeconds, quality.totalSeconds),
          },
          {
            key: `${category}-standard`,
            label: "Standard",
            seconds: quality.standardSeconds,
            percent: percent(quality.standardSeconds, quality.totalSeconds),
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
    return [...markers]
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

  function getInteractionSelectionKey(
    pairKey: string,
    category: SceneStatsPartnerCategory
  ) {
    return `${pairKey}::${category}`;
  }

  function getRoleInteractionSelectionKeys(
    interaction: ISceneStatsRoleInteraction,
    view: SceneStatsInteractionView
  ) {
    return getSceneStatsRoleInteractionCategories(interaction, view).map(
      (category) => getInteractionSelectionKey(interaction.key, category)
    );
  }

  function toggleRoleInteraction(
    interaction: ISceneStatsRoleInteraction,
    view: SceneStatsInteractionView
  ) {
    const selectionKeys = getRoleInteractionSelectionKeys(interaction, view);
    if (selectionKeys.length === 0) return;

    setSelectedRoleInteractions((current) => {
      const next = new Set(current);
      const removeSelection = selectionKeys.every((key) => next.has(key));

      selectionKeys.forEach((key) => {
        if (removeSelection) next.delete(key);
        else next.add(key);
      });

      return next;
    });
  }

  function getRoleInteractionSelectionState(
    interaction: ISceneStatsRoleInteraction,
    view: SceneStatsInteractionView
  ) {
    const selectionKeys = getRoleInteractionSelectionKeys(interaction, view);
    const selectedCount = selectionKeys.filter((key) =>
      selectedRoleInteractions.has(key)
    ).length;

    return {
      active:
        selectionKeys.length > 0 && selectedCount === selectionKeys.length,
      partial: selectedCount > 0 && selectedCount < selectionKeys.length,
    };
  }

  function getPartnerRoleSelectionKeys(
    performerID: string,
    partnerID: string,
    view: SceneStatsInteractionView
  ) {
    return [
      roleInteractionByKey.get(
        getSceneStatsRoleInteractionKey(performerID, partnerID)
      ),
      roleInteractionByKey.get(
        getSceneStatsRoleInteractionKey(partnerID, performerID)
      ),
    ].flatMap((interaction) =>
      interaction ? getRoleInteractionSelectionKeys(interaction, view) : []
    );
  }

  function togglePartnerRoleSelection(
    performerID: string,
    partnerID: string,
    view: SceneStatsInteractionView
  ) {
    const selectionKeys = getPartnerRoleSelectionKeys(
      performerID,
      partnerID,
      view
    );
    if (selectionKeys.length === 0) return;

    setSelectedRoleInteractions((current) => {
      const next = new Set(current);
      const removeSelection = selectionKeys.every((key) => next.has(key));

      selectionKeys.forEach((key) => {
        if (removeSelection) next.delete(key);
        else next.add(key);
      });

      return next;
    });
  }

  function getPartnerRoleSelectionState(
    performerID: string,
    partnerID: string,
    view: SceneStatsInteractionView
  ) {
    const selectionKeys = getPartnerRoleSelectionKeys(
      performerID,
      partnerID,
      view
    );
    const selectedCount = selectionKeys.filter((key) =>
      selectedRoleInteractions.has(key)
    ).length;

    return {
      active:
        selectionKeys.length > 0 && selectedCount === selectionKeys.length,
      partial: selectedCount > 0 && selectedCount < selectionKeys.length,
    };
  }

  function buildSelectedLoopSegments(scope: SceneStatsLoopSelectionScope) {
    const overviewSegments = buildSelectedActivityLoopSegments();
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

    const roleInteractionSegments = roleInteractions.flatMap((interaction) =>
      (["sex", "oral"] as SceneStatsPartnerCategory[]).flatMap((category) => {
        const selectionKey = getInteractionSelectionKey(
          interaction.key,
          category
        );
        if (!selectedRoleInteractions.has(selectionKey)) return [];

        const categoryStats = interaction.categories[category];
        if (!categoryStats) return [];

        const label = `${category.toUpperCase()} ${
          interaction.topPerformer.name
        } → ${interaction.bottomPerformer.name}`;

        return buildIntervalLoopSegments(label, categoryStats.intervals);
      })
    );

    return dedupeLoopSegments(
      getSceneStatsScopedLoopSegments(scope, {
        overview: overviewSegments,
        performer: buildLoopSegments([...selectedMarkers.values()]),
        interaction: roleInteractionSegments,
      })
    );
  }

  function clearLoopSelection(scope: SceneStatsLoopSelectionScope) {
    if (scope === "overview") {
      setSelectedActivities(new Set());
      return;
    }

    setSelectedPerformerRows(new Set());
    setSelectedRoleInteractions(new Set());
  }

  function addSelectedStatsToLoop(scope: SceneStatsLoopSelectionScope) {
    const loopSegments = buildSelectedLoopSegments(scope);
    if (loopSegments.length === 0) return;

    addMultiSegmentLoopSegments(loopSegments);
    clearLoopSelection(scope);
  }

  const overviewLoopSegments = buildSelectedLoopSegments("overview");
  const detailLoopSegments = buildSelectedLoopSegments("details");
  const overviewSelectionCount = selectedActivities.size;
  const detailSelectionCount =
    selectedPerformerRows.size + selectedRoleInteractions.size;

  function renderOverviewPanel(
    title: string,
    rows: IStatsRow[],
    stacked = false,
    totalSeconds = activityStats.totalSeconds
  ) {
    const visibleRows = rows.filter(
      (row) => row.seconds > 0 && row.percent > 0
    );

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
            {visibleRows.map((row) => (
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
        <div className="scene-stats-overview-rows">
          {visibleRows.map((row) => {
            const selectable =
              !!row.selectableKey && !!row.loopSegments?.length;

            return (
              <div className="scene-stats-overview-row" key={row.key}>
                <div className="scene-stats-overview-row-meta">
                  {selectable ? (
                    <Form.Check
                      checked={selectedActivities.has(row.selectableKey!)}
                      className="custom-stats-check"
                      id={`scene-stats-${scene.id}-${row.selectableKey}`}
                      label={row.label}
                      onChange={() => toggleActivity(row.selectableKey!)}
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
                {!stacked && (
                  <div
                    aria-label={`${row.label}: ${formatPercentValue(row)}`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={row.percent}
                    className="scene-stats-progress-track"
                    role="progressbar"
                  >
                    <span
                      className="scene-stats-progress-fill"
                      style={{
                        backgroundColor: getStatsRowColor(row, soloMarkerColor),
                        width: `${Math.max(0, Math.min(100, row.percent))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderPerformerActivity(
    entry: IPerformerStats,
    categoryRow: IStatsRow
  ) {
    const roleRows = entry.rows.filter(
      (row) =>
        row.category === categoryRow.category && row.role && row.percent > 0
    );
    const categorySelectionKey = getPerformerRowSelectionKey(
      entry.performer.id,
      categoryRow.key
    );
    const activityLabels = getSceneStatsPerformerActivityLabels(
      categoryRow.category ?? "sex"
    );
    const showParticipation = shouldShowSceneStatsPerformerParticipation(
      scene.performers.length,
      categoryRow.category ?? "sex"
    );

    return (
      <section className="scene-stats-performer-activity" key={categoryRow.key}>
        {/* CUSTOM: restore the activity category title */}
        <div className="scene-stats-performer-activity-title">
          {categoryRow.label}
        </div>
        {/* CUSTOM: begin */}
        {showParticipation && (
          <>
            <div className="scene-stats-performer-activity-total">
              <span>{activityLabels.sceneTotalLabel}</span>
              <span className="custom-stats-value">
                {TextUtils.secondsToTimestamp(
                  categoryRow.totalActivitySeconds ?? 0
                )}
              </span>
            </div>
            <div className="scene-stats-performer-activity-heading">
              <Form.Check
                checked={selectedPerformerRows.has(categorySelectionKey)}
                className="custom-stats-check"
                id={`scene-stats-${scene.id}-${categorySelectionKey}`}
                label={activityLabels.performerParticipationLabel}
                onChange={() => togglePerformerRow(categorySelectionKey)}
              />
              <span className="custom-stats-value">
                {TextUtils.secondsToTimestamp(categoryRow.seconds)}
              </span>
              <span className="custom-stats-value">
                {formatPercentValue(categoryRow)}
              </span>
            </div>
            <div
              aria-label={`${
                activityLabels.performerParticipationLabel
              }: ${formatPercentValue(categoryRow)}`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={categoryRow.percent}
              className="scene-stats-progress-track"
              role="progressbar"
            >
              <span
                className="scene-stats-progress-fill"
                style={{
                  backgroundColor: getStatsRowColor(
                    categoryRow,
                    soloMarkerColor
                  ),
                  width: `${Math.max(0, Math.min(100, categoryRow.percent))}%`,
                }}
              />
            </div>
          </>
        )}
        {/* CUSTOM: end */}
        <div className="scene-stats-role-rows">
          {roleRows.map((row) => {
            const selectionKey = getPerformerRowSelectionKey(
              entry.performer.id,
              row.key
            );
            const color = getStatsRowColor(row, soloMarkerColor);

            return (
              <div className="scene-stats-role-row" key={row.key}>
                <div className="scene-stats-role-row-meta">
                  <Form.Check
                    checked={selectedPerformerRows.has(selectionKey)}
                    className="custom-stats-check"
                    id={`scene-stats-${scene.id}-${selectionKey}`}
                    label={row.label}
                    onChange={() => togglePerformerRow(selectionKey)}
                  />
                  <span className="custom-stats-value">
                    {TextUtils.secondsToTimestamp(row.seconds)}
                  </span>
                  <span className="custom-stats-value">
                    {formatPercentValue(row)}
                  </span>
                </div>
                <div
                  aria-label={`${row.label}: ${formatPercentValue(row)}`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={row.percent}
                  className="scene-stats-progress-track scene-stats-progress-track-role"
                  role="progressbar"
                >
                  <span
                    className="scene-stats-progress-fill"
                    style={{
                      backgroundColor: color,
                      width: `${Math.max(0, Math.min(100, row.percent))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
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
    view: SceneStatsInteractionView,
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

    const selectionState = getRoleInteractionSelectionState(interaction, view);

    return (
      <button
        aria-label={`Select ${label}: ${TextUtils.secondsToTimestamp(
          seconds
        )}, ${rolePercent}%`}
        aria-pressed={selectionState.active}
        className={cx(
          `scene-stats-partner-lane scene-stats-partner-lane-${role}`,
          {
            "scene-stats-partner-lane-active": selectionState.active,
          }
        )}
        onClick={() => toggleRoleInteraction(interaction, view)}
        type="button"
      >
        <span
          aria-hidden="true"
          className="scene-stats-partner-lane-fill"
          style={{ width: `${Math.max(0, Math.min(100, rolePercent))}%` }}
        />
      </button>
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
                  view,
                  "topped"
                )}
                {renderPartnerRoleLane(
                  `${viewLabel} Bottomed For ${partner.performer.name}`,
                  bottomedForInteraction,
                  roleBreakdown.bottomedFor.seconds,
                  roleBreakdown.bottomedFor.percent,
                  view,
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

    const selectionState = getPartnerRoleSelectionState(
      entry.performer.id,
      partner.performer.id,
      "both"
    );
    return (
      <tr className="scene-stats-partner-table-row" key={partner.performer.id}>
        <th className="scene-stats-partner-table-partner" scope="row">
          <Form.Check
            checked={selectionState.active}
            className={cx("custom-stats-check scene-stats-partner-check", {
              "scene-stats-partner-check-partial": selectionState.partial,
            })}
            id={`scene-stats-${scene.id}-${pairKey}-all`}
            label={
              <span className="scene-stats-partner-label">
                <span
                  aria-hidden="true"
                  className="scene-stats-partner-image"
                  style={{
                    backgroundImage: partner.performer.imagePath
                      ? `url(${partner.performer.imagePath})`
                      : undefined,
                  }}
                />
                <span>{partner.performer.name}</span>
              </span>
            }
            onChange={() =>
              togglePartnerRoleSelection(
                entry.performer.id,
                partner.performer.id,
                "both"
              )
            }
          />
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

  function renderMatrixInteractionButton(
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

    const selectionState = getRoleInteractionSelectionState(
      interaction,
      interactionView
    );
    const viewLabel =
      interactionView === "both" ? "combined Sex and Oral" : interactionView;
    const timestamp = TextUtils.secondsToTimestamp(viewStats.seconds);
    const isLeadingInteraction =
      leadingInteractionSeconds > 0 &&
      viewStats.seconds === leadingInteractionSeconds;

    return (
      <button
        aria-label={`Select ${viewLabel} interactions with ${interaction.topPerformer.name} as Top and ${interaction.bottomPerformer.name} as Bottom (${timestamp})`}
        aria-pressed={selectionState.active}
        className={cx("scene-stats-matrix-pair", {
          "scene-stats-matrix-pair-active": selectionState.active,
          "scene-stats-matrix-pair-leading": isLeadingInteraction,
          "scene-stats-matrix-pair-partial": selectionState.partial,
        })}
        onClick={() => toggleRoleInteraction(interaction, interactionView)}
        type="button"
      >
        <span aria-hidden="true" className="scene-stats-matrix-selector">
          {selectionState.active ? "✓" : selectionState.partial ? "−" : ""}
        </span>
        <span className="scene-stats-matrix-time">{timestamp}</span>
      </button>
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
                    <span
                      aria-hidden="true"
                      className="scene-stats-matrix-performer-image"
                      style={{
                        backgroundImage: entry.performer.image_path
                          ? `url(${entry.performer.image_path})`
                          : undefined,
                      }}
                    />
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
                    <span
                      aria-hidden="true"
                      className="scene-stats-matrix-performer-image"
                      style={{
                        backgroundImage: rowEntry.performer.image_path
                          ? `url(${rowEntry.performer.image_path})`
                          : undefined,
                      }}
                    />
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
                          renderMatrixInteractionButton(
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
                  <span
                    aria-hidden="true"
                    className="scene-stats-matrix-performer-image"
                    style={{
                      backgroundImage: interaction.topPerformer.imagePath
                        ? `url(${interaction.topPerformer.imagePath})`
                        : undefined,
                    }}
                  />
                  {interaction.topPerformer.name}
                </span>
                <span className="scene-stats-matrix-mobile-bottom">
                  <strong>Bottom</strong>
                  <span
                    aria-hidden="true"
                    className="scene-stats-matrix-performer-image"
                    style={{
                      backgroundImage: interaction.bottomPerformer.imagePath
                        ? `url(${interaction.bottomPerformer.imagePath})`
                        : undefined,
                    }}
                  />
                  {interaction.bottomPerformer.name}
                </span>
              </div>
              {renderMatrixInteractionButton(
                interaction,
                leadingInteractionSeconds
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderLoopTray(scope: SceneStatsLoopSelectionScope) {
    const isOverview = scope === "overview";
    const selectedLoopSegments = isOverview
      ? overviewLoopSegments
      : detailLoopSegments;
    const selectedLoopDuration = mergeDuration(selectedLoopSegments);
    const selectionCount = isOverview
      ? overviewSelectionCount
      : detailSelectionCount;

    return (
      <div
        aria-label={
          isOverview
            ? "Stats panel loop selection"
            : "Detailed Scene Stats loop selection"
        }
        className={cx("scene-stats-loop-tray", {
          "scene-stats-loop-tray-panel": isOverview,
        })}
        role="group"
      >
        <div className="scene-stats-loop-status">
          {selectionCount > 0 && (
            <>
              <strong>
                {selectionCount} selection
                {selectionCount === 1 ? "" : "s"}
              </strong>
              <span>
                {selectedLoopSegments.length} segment
                {selectedLoopSegments.length === 1 ? "" : "s"}
              </span>
              <span>{TextUtils.secondsToTimestamp(selectedLoopDuration)}</span>
            </>
          )}
        </div>
        <div className="scene-stats-loop-actions">
          <Button
            disabled={selectionCount === 0}
            onClick={() => clearLoopSelection(scope)}
            size="sm"
            type="button"
            variant="outline-secondary"
          >
            Clear
          </Button>
          <Button
            disabled={selectedLoopSegments.length === 0}
            onClick={() => addSelectedStatsToLoop(scope)}
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

  return (
    <div className="scene-stats-panel mt-3">
      <div className="scene-stats-overview-grid">
        {renderOverviewPanel("Activity Type", activityRows, true)}
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

      {renderLoopTray("overview")}

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
          {renderLoopTray("details")}

          <div className="scene-stats-detail-toolbar">
            <ButtonGroup aria-label="Scene stats detail view" size="sm">
              {performerStats.length > 0 && (
                <Button
                  aria-pressed={detailView === "performer"}
                  onClick={() => setDetailView("performer")}
                  variant={detailView === "performer" ? "primary" : "secondary"}
                >
                  Performer Explorer
                </Button>
              )}
              {roleInteractions.length > 0 && (
                <Button
                  aria-pressed={detailView === "interactions"}
                  onClick={() => setDetailView("interactions")}
                  variant={
                    detailView === "interactions" ? "primary" : "secondary"
                  }
                >
                  Interaction Matrix
                </Button>
              )}
              {/* CUSTOM: dedicated full activity matrix view */}
              {outstandingActivityMatrix.rows.length > 0 && (
                <Button
                  aria-pressed={detailView === "activity"}
                  onClick={() => setDetailView("activity")}
                  variant={detailView === "activity" ? "primary" : "secondary"}
                >
                  Activity Matrix
                </Button>
              )}
            </ButtonGroup>
          </div>

          {/* CUSTOM: keep the large activity table out of the compact panel. */}
          {detailView === "activity" ? (
            <OutstandingActivityMatrixTable
              matrix={outstandingActivityMatrix}
              title="Activity matrix"
            />
          ) : detailView === "performer" || roleInteractions.length === 0 ? (
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
                      <span
                        aria-hidden="true"
                        className="scene-stats-performer-choice-image"
                        style={{
                          backgroundImage: entry.performer.image_path
                            ? `url(${entry.performer.image_path})`
                            : undefined,
                        }}
                      />
                      <span>{entry.performer.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {activePerformer && (
                <div className="scene-stats-performer-explorer">
                  <div className="scene-stats-performer-focus-grid">
                    <div className="scene-stats-performer-activities">
                      <div className="scene-stats-section-heading">
                        <h5>Activity & Roles</h5>
                      </div>
                      <div className="scene-stats-performer-activity-grid">
                        {activePerformer.rows
                          .filter(
                            (row) =>
                              row.category && !row.isChild && row.percent > 0
                          )
                          .map((row) =>
                            renderPerformerActivity(activePerformer, row)
                          )}
                      </div>
                    </div>
                    {shouldShowSceneStatsPartnerInteractions(
                      scene.performers.length
                    ) && (
                      <div className="scene-stats-performer-partners">
                        <div className="scene-stats-section-heading">
                          <h5>Partner Interactions</h5>
                        </div>
                        {renderPartnerTable(activePerformer)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            renderInteractionMatrix()
          )}
        </section>
      </ModalComponent>
    </div>
  );
};

export default SceneStatsPanel;
