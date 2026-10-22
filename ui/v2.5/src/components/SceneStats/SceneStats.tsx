import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import { ACTIVITY_LABELS_CUSTOM } from "src/utils/activityLabels_custom";
import { cleanStatsValueCustom as cleanValue } from "src/utils/statsValues_custom"; // CUSTOM
import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  mostRecentOTieBreaker,
  rankStatsItems,
} from "src/utils/statsRanking_custom";
import { Alert, Nav } from "react-bootstrap";
import { Helmet } from "react-helmet";
import {
  Link,
  RouteComponentProps,
  useHistory,
  useLocation,
} from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import {
  MarkerEventStatsKind,
  useMarkerEventStatsQuery,
} from "src/core/generated-graphql"; // CUSTOM
import { StatsPage } from "src/components/StatsPage_custom";
import { StatsStudioSelector } from "src/components/StatsStudioSelector_custom";
import { StatsFilterBar } from "src/components/StatsFilterBar_custom";
import {
  StatsBarChart,
  type IStatsBarDatum,
} from "src/components/StatsBarChart_custom"; // CUSTOM
import { StatsTopCards } from "src/components/StatsTopCards_custom"; // CUSTOM
import {
  StatsChartGroup,
  StatsCountryFlag,
  StatsKpiRow,
  type IStatsKpi,
} from "src/components/StatsCharts_custom"; // CUSTOM
import { formatStatsBarPercent } from "src/utils/statsBarChart_custom";
import {
  STATS_QUALITY_COLORS,
  STATS_QUALITY_LEGEND,
  statsMetallicColor,
} from "src/utils/statsChartColors_custom";
import { StatsDateRangeFilter } from "src/components/StatsDateRangeFilter_custom"; // CUSTOM
import { useStatsViewState } from "src/hooks/useStatsViewState_custom";
import { useStatsDateRange } from "src/hooks/useStatsDateRange_custom"; // CUSTOM
import {
  removeStatsFilter,
  writeStatsView,
} from "src/utils/statsViewState_custom";
import type { Studio } from "src/components/Studios/StudioSelect";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
import TextUtils from "src/utils/text";
import { metallicRatingChartBucket } from "src/utils/metallicRatingChart_custom";
import { sceneMetallicRating } from "src/utils/sceneMetallicRating_custom"; // CUSTOM
import { statsCountryName } from "src/utils/statsCountry_custom";
import {
  formatStatsDrilldownTotal,
  formatStatsTotal,
} from "src/utils/statsDrilldown_custom";
import { FileSize } from "src/components/Shared/FileSize";
import {
  facialCount,
  markerHasTag,
  reallyHotFacialCount,
} from "./sceneStatsFacialCounts_custom";
import { durationBucketForMinutes } from "./sceneStatsDuration_custom";
import {
  sceneStatsActivityType,
  sceneStatsCount,
  sceneStatsRatingBucket,
  sceneStatsReleaseDay,
  sceneStatsReleaseMonth,
  sceneStatsReleaseYear,
} from "./sceneStatsChartBuckets_custom";
import { sceneStatsVatoCountBuckets } from "./sceneStatsSummary_custom";
import { type SceneStatsScene } from "./sceneStatsCompactData_custom"; // CUSTOM
import { useSceneStatsCompactQuery } from "./useSceneStatsCompactQuery_custom"; // CUSTOM
import { SceneStatsInsights } from "./SceneStatsInsights_custom";
import { SceneStatsActivityMatrix } from "./SceneStatsActivityMatrix_custom"; // CUSTOM
import { SceneStatsStashDBMatches } from "./SceneStatsStashDBMatches_custom"; // CUSTOM
import type {
  StashDBMatchesGroupsCustom,
  StashDBMatchesPageDimensionCustom,
} from "./sceneStatsStashDBMatchesData_custom"; // CUSTOM
import {
  sceneStatsSearchForSection,
  sceneStatsSectionFromKey,
  sceneStatsSectionFromSearch,
  type SceneStatsSection,
} from "./sceneStatsSection_custom"; // CUSTOM
import { sceneStatsAverages } from "./sceneStatsAverages_custom"; // CUSTOM
import {
  fillSceneStatsReleaseBuckets,
  type SceneStatsReleaseLevel,
} from "./sceneStatsReleaseBuckets_custom"; // CUSTOM

import "./SceneStats.scss";
import {
  isSceneStatsUnknownValue,
  STATS_UNKNOWN_FILTER_VALUE,
} from "./sceneStatsUnknownFilters_custom";

// CUSTOM: Keep expensive marker-duration totals off the first-render request.
const SCENE_STATS_TOTALS = gql`
  query SceneStatsTotals(
    $studioId: ID
    $depth: Int
    $dateRange: StatsDateRangeInput
    $cohort: StatsCohortInput
  ) {
    activity: sceneStatsActivity(
      studio_id: $studioId
      depth: $depth
      date_range: $dateRange
      cohort: $cohort
    ) {
      totalSeconds: total_seconds
      otherSeconds: activity_other_seconds
      totalSexTime: sex_seconds
      totalOralTime: oral_seconds
      totalSoloTime: solo_seconds
    }
  }
`;

// Role families only need their root IDs: the backend rolls every descendant
// marker tag up to the configured family tag.
const SCENE_STATS_ROLE_TAGS = gql`
  query SceneStatsRoleTags($ids: [ID!]) {
    findTags(ids: $ids) {
      tags {
        id
        name
      }
    }
  }
`;

type SceneStatsTotalsData = {
  activity: {
    totalSeconds: number;
    otherSeconds: number;
    totalSexTime: number;
    totalOralTime: number;
    totalSoloTime: number;
  };
};

type SceneStatsRoleTagsData = {
  findTags: {
    tags: SceneStatsRoleTag[];
  };
};

type SceneStatsRoleTag = {
  id: string;
  name: string;
};

type PodiumMetric =
  | "o_counter"
  | "rating100"
  | "duration"
  | "filesize"
  | "most_recent_o"
  | "performer_count"
  | "facial_count";

type ChartCategory =
  | "ethnicity"
  | "country"
  | "o_count"
  | "performer_count"
  | "rating"
  | "metallic_rating"
  | "release_day"
  | "facial_status"
  | "facial_count"
  | "nut_count"
  | "nut_status"
  | "organized"
  | "scene_type"
  | "duration"
  | "resolution";

type ChartFilter = {
  category: ChartCategory;
  label: string;
  value: string;
};

type ChartDatum = {
  key: string;
  label: string;
  count: number;
  sortValue: number;
  filter?: ChartFilter;
  path?: string;
};

type RoleTagIDSets = {
  sex?: Set<string>;
  oral?: Set<string>;
  solo?: Set<string>;
  facial?: Set<string>;
  reallyHot?: Set<string>;
  goat?: Set<string>;
};

interface IRouteParams {
  year?: string;
  month?: string;
}

export interface ISceneStatsStudioScope {
  id: string;
  name: string;
  depth: number;
}

interface ISceneStatsDashboardProps {
  selectedYear?: string;
  selectedMonth?: string;
  navigationBase?: string;
  studioScope?: ISceneStatsStudioScope;
}

const metricOptions: Array<{
  key: PodiumMetric;
  label: string;
  valueLabel: string;
}> = [
  { key: "o_counter", label: "O Count", valueLabel: "O's" },
  { key: "rating100", label: "Rating", valueLabel: "rating" },
  { key: "duration", label: "Duration", valueLabel: "" },
  { key: "filesize", label: "File Size", valueLabel: "" },
  { key: "most_recent_o", label: "Most Recent O", valueLabel: "" },
  { key: "performer_count", label: "Vato Count", valueLabel: "vatos" },
  { key: "facial_count", label: "Facial Count", valueLabel: "facials" },
];

const chartDefinitions: Record<ChartCategory, string> = {
  ethnicity: "Vato Ethnicity",
  country: "Vato Country",
  o_count: "O Count",
  performer_count: "Vato Count",
  rating: "Rating",
  metallic_rating: "Metallic Rating",
  release_day: "Release Day",
  facial_status: "Best Facial",
  facial_count: "Facials",
  nut_count: "Nuts",
  nut_status: "Best Nut",
  organized: "Organized",
  scene_type: "Scene Type",
  duration: "Duration",
  resolution: "Resolution",
};

const SCENE_UNIT: [string, string] = ["scene", "scenes"];
const VATO_GROUP_FILTER_VALUE = "4+";
const sceneViewOptions = {
  prefix: "scene",
  categories: Object.keys(chartDefinitions) as ChartCategory[],
  metrics: metricOptions.map((option) => option.key),
  defaultMetric: "o_counter" as PodiumMetric,
};

function stringRoleTagId(value?: string | string[]) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function tagIDsFor(roleTag?: SceneStatsRoleTag) {
  return roleTag ? new Set([roleTag.id]) : undefined;
}

function sceneHasTag(scene: SceneStatsScene, targetIds?: Set<string>) {
  return scene.scene_markers.some((marker) => markerHasTag(marker, targetIds));
}

function releaseDate(scene: SceneStatsScene) {
  return cleanValue(scene.effective_date) ?? cleanValue(scene.date);
}

function releaseYear(scene: SceneStatsScene) {
  return sceneStatsReleaseYear(releaseDate(scene));
}

function releaseMonth(scene: SceneStatsScene) {
  return sceneStatsReleaseMonth(releaseDate(scene));
}

function releaseDay(scene: SceneStatsScene) {
  return sceneStatsReleaseDay(releaseDate(scene));
}

function monthName(month: number, format: "short" | "long" = "short") {
  return new Date(Date.UTC(2024, month - 1, 1)).toLocaleString(
    getAppLocaleCustom(),
    {
      month: format,
      timeZone: "UTC",
    }
  );
}

function dayLabel(year: number, month: number, day: number) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toLocaleString(getAppLocaleCustom(), {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function mostRecentOTime(scene: SceneStatsScene) {
  const timestamp = Date.parse(scene.most_recent_o_date ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mostRecentOLabel(scene: SceneStatsScene) {
  const timestamp = mostRecentOTime(scene);
  if (timestamp <= 0) return "Unknown";
  return new Date(timestamp).toLocaleDateString(getAppLocaleCustom());
}

function metricValue(
  scene: SceneStatsScene,
  metric: PodiumMetric,
  roleTagIDs: RoleTagIDSets
) {
  switch (metric) {
    case "o_counter":
      return scene.o_counter ?? 0;
    case "rating100":
      return scene.rating100 ?? 0;
    case "duration":
      return scene.duration;
    case "filesize":
      return scene.filesize;
    case "most_recent_o":
      return mostRecentOTime(scene);
    case "performer_count":
      return scene.performer_count;
    case "facial_count":
      return facialCount(scene, roleTagIDs.facial);
    default:
      return 0;
  }
}

function formatMetricValue(
  scene: SceneStatsScene,
  metric: PodiumMetric,
  roleTagIDs: RoleTagIDSets
) {
  const value = metricValue(scene, metric, roleTagIDs);
  if (metric === "duration") return TextUtils.secondsAsTimeString(value, 3);
  if (metric === "filesize") return <FileSize size={value} />;
  if (metric === "rating100") return `${value}/100`;
  if (metric === "most_recent_o") return mostRecentOLabel(scene);
  return value.toLocaleString(getAppLocaleCustom());
}

function metricOptionValueLabel(metric: PodiumMetric) {
  return metricOptions.find((option) => option.key === metric)?.valueLabel;
}

// Muted line under each ranked scene card.
function sceneCardMeta(scene: SceneStatsScene) {
  const vatos = `${scene.performer_count.toLocaleString(
    getAppLocaleCustom()
  )} ${scene.performer_count === 1 ? "vato" : "vatos"}`;
  return scene.duration > 0
    ? `${vatos} · ${TextUtils.secondsAsTimeString(scene.duration, 2)}`
    : vatos;
}

function formatDuration(totalSeconds: number) {
  return TextUtils.formatDurationRange(totalSeconds);
}

function addDatum(
  buckets: Map<string, ChartDatum>,
  key: string,
  label: string,
  sortValue: number,
  filter?: ChartFilter,
  path?: string
) {
  const existing = buckets.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  buckets.set(key, { key, label, count: 1, sortValue, filter, path });
}

function roundedDurationMinutes(scene: SceneStatsScene) {
  return Math.round(scene.duration / 60);
}

// The best facial in the scene: GOAT, then Really Hot, then a regular one.
function facialStatus(scene: SceneStatsScene, roleTagIDs: RoleTagIDSets) {
  const hasFacial = sceneHasTag(scene, roleTagIDs.facial);
  const hasGoatFacial =
    !!roleTagIDs.goat &&
    scene.scene_markers.some(
      (marker) =>
        markerHasTag(marker, roleTagIDs.facial) &&
        markerHasTag(marker, roleTagIDs.goat)
    );

  if (hasGoatFacial) return "goat";
  if (reallyHotFacialCount(scene, roleTagIDs) > 0) return "rh";
  if (hasFacial) return "regular";
  return "no";
}

type FacialStatus = ReturnType<typeof facialStatus>;

const FACIAL_STATUS_LABELS: Record<FacialStatus, string> = {
  goat: "GOAT",
  rh: "Really Hot",
  regular: "Regular",
  no: "None",
};

const FACIAL_STATUS_RANK: Record<FacialStatus, number> = {
  no: 0,
  regular: 1,
  rh: 2,
  goat: 3,
};

// Nut Stats event quality → the same statuses the facial columns use.
const NUT_QUALITY_STATUS: Record<string, FacialStatus> = {
  REGULAR: "regular",
  REALLY_HOT: "rh",
  GOAT: "goat",
};

const FACIAL_STATUS_COLORS: Record<FacialStatus, string> = {
  goat: STATS_QUALITY_COLORS.goat,
  rh: STATS_QUALITY_COLORS.really_hot,
  regular: STATS_QUALITY_COLORS.regular,
  no: "#464d53",
};

const SCENE_TYPE_LABELS: Record<string, string> = {
  sex: "Sex",
  oral: "Oral",
  solo: "Jerk",
};

function sceneType(scene: SceneStatsScene, roleTagIDs: RoleTagIDSets) {
  return sceneStatsActivityType(
    sceneHasTag(scene, roleTagIDs.sex),
    sceneHasTag(scene, roleTagIDs.oral),
    sceneHasTag(scene, roleTagIDs.solo)
  );
}

function sceneResolutionLabel(scene: SceneStatsScene) {
  return scene.primary_width && scene.primary_height
    ? TextUtils.resolution(scene.primary_width, scene.primary_height)
    : undefined;
}

type UIConfiguration = ReturnType<
  typeof useConfigurationContext
>["configuration"];

function sceneMetallicBucket(
  scene: SceneStatsScene,
  configuration: UIConfiguration
) {
  // CUSTOM: explicit metallic overrides remain valid without a rating
  return metallicRatingChartBucket(
    scene.rating100,
    sceneMetallicRating(scene, configuration?.ui)
  );
}

function sceneMatchesFilter(
  scene: SceneStatsScene,
  filter: ChartFilter,
  roleTagIDs: RoleTagIDSets,
  configuration: UIConfiguration,
  nutsByScene: ReadonlyMap<string, SceneNuts>
) {
  if (
    filter.value === STATS_UNKNOWN_FILTER_VALUE ||
    filter.value.startsWith(`${STATS_UNKNOWN_FILTER_VALUE}:`)
  ) {
    const level = filter.value.split(":")[1];
    return isSceneStatsUnknownValue(
      filter.category,
      {
        ethnicities: scene.performer_ethnicities,
        countries: scene.performer_countries,
        oCount: scene.o_counter,
        performerCount: scene.performer_count,
        ratingBucket: sceneStatsRatingBucket(scene.rating100),
        metallicRatingBucket: sceneMetallicBucket(scene, configuration)?.key,
        releaseYear: releaseYear(scene),
        releaseMonth: releaseMonth(scene),
        releaseDay: releaseDay(scene),
        facialCount: facialCount(scene, roleTagIDs.facial),
        sceneType: sceneType(scene, roleTagIDs),
        resolution: sceneResolutionLabel(scene),
      },
      level === "month" || level === "day" ? level : "year"
    );
  }
  switch (filter.category) {
    case "ethnicity":
      return scene.performer_ethnicities.some(
        (ethnicity) => cleanValue(ethnicity) === filter.value
      );
    case "country":
      return scene.performer_countries.some(
        (country) => cleanValue(country) === filter.value
      );
    case "o_count":
      return String(sceneStatsCount(scene.o_counter)) === filter.value;
    case "performer_count":
      // CUSTOM: the vato-count split groups 4 or more vatos as "4+".
      if (filter.value === VATO_GROUP_FILTER_VALUE)
        return scene.performer_count >= 4;
      return String(sceneStatsCount(scene.performer_count)) === filter.value;
    case "rating":
      return sceneStatsRatingBucket(scene.rating100) === filter.value;
    case "metallic_rating":
      return sceneMetallicBucket(scene, configuration)?.key === filter.value;
    case "release_day":
      return releaseDate(scene)?.slice(0, 10) === filter.value;
    case "facial_status":
      return facialStatus(scene, roleTagIDs) === filter.value;
    case "facial_count":
      return String(facialCount(scene, roleTagIDs.facial)) === filter.value;
    case "nut_count":
      return String(nutsByScene.get(scene.id)?.count ?? 0) === filter.value;
    case "nut_status":
      return (nutsByScene.get(scene.id)?.best ?? "no") === filter.value;
    case "organized":
      return (scene.organized ? "yes" : "no") === filter.value;
    case "scene_type":
      return sceneType(scene, roleTagIDs) === filter.value;
    case "duration":
      return (
        durationBucketForMinutes(roundedDurationMinutes(scene)).key ===
        filter.value
      );
    case "resolution":
      return sceneResolutionLabel(scene) === filter.value;
    default:
      return true;
  }
}

function buildReleaseChart(
  scenes: SceneStatsScene[],
  navigationBase: string,
  selectedYear?: number,
  selectedMonth?: number
) {
  const counts = new Map<number, number>();
  let unknownCount = 0;
  const level: SceneStatsReleaseLevel = !selectedYear
    ? "year"
    : !selectedMonth
    ? "month"
    : "day";

  scenes.forEach((scene) => {
    const year = releaseYear(scene);
    let value: number | undefined;
    if (level === "year") {
      value = year;
    } else if (year !== selectedYear) {
      return;
    } else if (level === "month") {
      value = releaseMonth(scene);
    } else if (releaseMonth(scene) !== selectedMonth) {
      return;
    } else {
      value = releaseDay(scene);
    }
    if (value === undefined) unknownCount += 1;
    else counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  const data = fillSceneStatsReleaseBuckets(
    counts,
    level,
    selectedYear,
    selectedMonth
  ).map<ChartDatum>((bucket) => {
    if (level === "year") {
      return {
        key: bucket.key,
        label: String(bucket.value),
        count: bucket.count,
        sortValue: bucket.value,
        path: `${navigationBase}/${bucket.value}`,
      };
    }
    if (level === "month") {
      return {
        key: bucket.key,
        label: monthName(bucket.value),
        count: bucket.count,
        sortValue: bucket.value,
        path: `${navigationBase}/${selectedYear}/${bucket.value}`,
      };
    }
    const label = dayLabel(selectedYear ?? 0, selectedMonth ?? 0, bucket.value);
    return {
      key: bucket.key,
      label,
      count: bucket.count,
      sortValue: bucket.value,
      filter: { category: "release_day", label, value: bucket.key },
    };
  });

  return { data, unknownCount, level };
}

type FacialColumn = {
  count: number;
  total: number;
  statuses: Record<FacialStatus, number>;
};

// Nut events per scene with the best nut's quality, from Nut Stats.
export type SceneNuts = { count: number; best: FacialStatus };

// CUSTOM: only organized scenes count in the charts; Duration and Resolution
// are known for every scene, so they count all of them.
function buildSceneCharts(
  scenes: SceneStatsScene[],
  roleTagIDs: RoleTagIDSets,
  configuration: UIConfiguration,
  nutsByScene: ReadonlyMap<string, SceneNuts>
) {
  const ethnicityBuckets = new Map<string, ChartDatum>();
  const countryBuckets = new Map<string, ChartDatum>();
  const oCountBuckets = new Map<string, ChartDatum>();
  const ratingBuckets = new Map<string, ChartDatum>();
  const metallicRatingBuckets = new Map<string, ChartDatum>();
  const facialBuckets = new Map<number, FacialColumn>();
  const nutBuckets = new Map<number, FacialColumn>();
  const sceneTypeBuckets = new Map<string, ChartDatum>();
  const durationBuckets = new Map<string, ChartDatum>();
  const resolutionBuckets = new Map<string, ChartDatum>();
  let unknownEthnicityCount = 0;
  let unknownCountryCount = 0;
  let unknownOCount = 0;
  let unknownRatingCount = 0;
  let unknownMetallicRatingCount = 0;
  let unknownSceneTypeCount = 0;
  let unknownResolutionCount = 0;
  let organizedCount = 0;

  scenes.forEach((scene) => {
    const durationBucket = durationBucketForMinutes(
      roundedDurationMinutes(scene)
    );
    addDatum(
      durationBuckets,
      durationBucket.key,
      durationBucket.label,
      durationBucket.sortValue,
      {
        category: "duration",
        label: durationBucket.label,
        value: durationBucket.key,
      }
    );

    const resolutionLabel = sceneResolutionLabel(scene);
    if (!resolutionLabel) {
      unknownResolutionCount += 1;
    } else {
      addDatum(
        resolutionBuckets,
        resolutionLabel,
        resolutionLabel,
        Number.MAX_SAFE_INTEGER,
        {
          category: "resolution",
          label: resolutionLabel,
          value: resolutionLabel,
        }
      );
    }

    if (!scene.organized) return;
    organizedCount += 1;

    const ethnicities = new Set(
      scene.performer_ethnicities
        .map((ethnicity) => cleanValue(ethnicity))
        .filter((value): value is string => !!value)
    );
    if (ethnicities.size === 0) {
      unknownEthnicityCount += 1;
    } else {
      ethnicities.forEach((ethnicity) => {
        addDatum(
          ethnicityBuckets,
          ethnicity,
          ethnicity,
          Number.MAX_SAFE_INTEGER,
          { category: "ethnicity", label: ethnicity, value: ethnicity }
        );
      });
    }

    const countries = new Set(
      scene.performer_countries
        .map((country) => cleanValue(country))
        .filter((value): value is string => !!value)
    );
    if (countries.size === 0) {
      unknownCountryCount += 1;
    } else {
      countries.forEach((country) => {
        const label = statsCountryName(country);
        addDatum(countryBuckets, country, label, Number.MAX_SAFE_INTEGER, {
          category: "country",
          label,
          value: country,
        });
      });
    }

    const oCount = sceneStatsCount(scene.o_counter);
    if (oCount === undefined) {
      unknownOCount += 1;
    } else {
      addDatum(oCountBuckets, String(oCount), String(oCount), oCount, {
        category: "o_count",
        label: String(oCount),
        value: String(oCount),
      });
    }

    const ratingBucket = sceneStatsRatingBucket(scene.rating100);
    if (ratingBucket) {
      addDatum(
        ratingBuckets,
        ratingBucket,
        ratingBucket,
        Number(ratingBucket.split("-")[0]),
        { category: "rating", label: ratingBucket, value: ratingBucket }
      );
    } else {
      unknownRatingCount += 1;
    }

    const metallicRating = sceneMetallicBucket(scene, configuration);
    if (metallicRating) {
      addDatum(
        metallicRatingBuckets,
        metallicRating.key,
        metallicRating.label,
        metallicRating.sortValue,
        {
          category: "metallic_rating",
          label: metallicRating.label,
          value: metallicRating.key,
        }
      );
    } else {
      unknownMetallicRatingCount += 1;
    }

    // CUSTOM: one stacked column per facial count, colored by the best facial.
    const sceneFacials = facialCount(scene, roleTagIDs.facial);
    const column = facialBuckets.get(sceneFacials) ?? {
      count: sceneFacials,
      total: 0,
      statuses: { goat: 0, rh: 0, regular: 0, no: 0 },
    };
    column.total += 1;
    column.statuses[facialStatus(scene, roleTagIDs)] += 1;
    facialBuckets.set(sceneFacials, column);

    // CUSTOM: nuts per scene, colored by the best nut (Nut Stats events).
    const nuts = nutsByScene.get(scene.id);
    const nutCount = nuts?.count ?? 0;
    const nutColumn = nutBuckets.get(nutCount) ?? {
      count: nutCount,
      total: 0,
      statuses: { goat: 0, rh: 0, regular: 0, no: 0 },
    };
    nutColumn.total += 1;
    nutColumn.statuses[nuts?.best ?? "no"] += 1;
    nutBuckets.set(nutCount, nutColumn);

    const type = sceneType(scene, roleTagIDs);
    if (!type) {
      unknownSceneTypeCount += 1;
    } else {
      addDatum(
        sceneTypeBuckets,
        type,
        SCENE_TYPE_LABELS[type],
        type === "sex" ? 1 : type === "oral" ? 2 : 3,
        {
          category: "scene_type",
          label: SCENE_TYPE_LABELS[type],
          value: type,
        }
      );
    }
  });

  const countSort = (a: ChartDatum, b: ChartDatum) =>
    b.count - a.count || a.label.localeCompare(b.label);
  const numericSort = (a: ChartDatum, b: ChartDatum) =>
    a.sortValue - b.sortValue;

  return {
    ethnicity: {
      data: Array.from(ethnicityBuckets.values()).sort(countSort),
      unknownCount: unknownEthnicityCount,
    },
    country: {
      data: Array.from(countryBuckets.values()).sort(countSort),
      unknownCount: unknownCountryCount,
    },
    oCount: {
      data: Array.from(oCountBuckets.values()).sort(numericSort),
      unknownCount: unknownOCount,
    },
    rating: {
      data: Array.from(ratingBuckets.values()).sort(numericSort),
      unknownCount: unknownRatingCount,
    },
    metallicRating: {
      data: Array.from(metallicRatingBuckets.values()).sort(numericSort),
      unknownCount: unknownMetallicRatingCount,
    },
    facials: Array.from(facialBuckets.values()).sort(
      (a, b) => a.count - b.count
    ),
    nuts: Array.from(nutBuckets.values()).sort((a, b) => a.count - b.count),
    organizedCount,
    unorganizedCount: scenes.length - organizedCount,
    sceneType: {
      data: Array.from(sceneTypeBuckets.values()).sort(numericSort),
      unknownCount: unknownSceneTypeCount,
    },
    duration: Array.from(durationBuckets.values()).sort(numericSort),
    resolution: {
      data: Array.from(resolutionBuckets.values()).sort(countSort),
      unknownCount: unknownResolutionCount,
    },
  };
}

const SceneStatsFilterBar: React.FC<{
  filters: ChartFilter[];
  total: string;
  onRemove: (index: number) => void;
  onRemoveYear: () => void;
  onRemoveMonth: () => void;
  hasSelectedMonth: boolean;
  hasSelectedYear: boolean;
  onBack: () => void;
  onClear: () => void;
  selectedMonth: number;
  selectedYear: number;
}> = ({
  filters,
  total,
  onRemove,
  onRemoveYear,
  onRemoveMonth,
  hasSelectedMonth,
  hasSelectedYear,
  onBack,
  onClear,
  selectedMonth,
  selectedYear,
}) => {
  if (filters.length === 0 && !hasSelectedYear) return null;

  return (
    <StatsFilterBar
      label="Active Scene Stats filters"
      total={total}
      onUndo={onBack}
      onClear={onClear}
      filters={[
        ...(hasSelectedYear
          ? [{ label: `Release year: ${selectedYear}`, onRemove: onRemoveYear }]
          : []),
        ...(hasSelectedMonth
          ? [
              {
                label: `Release month: ${monthName(selectedMonth, "long")}`,
                onRemove: onRemoveMonth,
              },
            ]
          : []),
        ...filters.map((filter, index) => ({
          label: `${chartDefinitions[filter.category]}: ${filter.label}`,
          onRemove: () => onRemove(index),
        })),
      ]}
    />
  );
};

export const SceneStatsDashboard: React.FC<ISceneStatsDashboardProps> = ({
  selectedYear: selectedYearParam,
  selectedMonth: selectedMonthParam,
  navigationBase = "/scenestats",
  studioScope,
}) => {
  const { view, updateView, setMetric, setFilters, setShowList } =
    useStatsViewState(sceneViewOptions);
  const {
    studio: selectedStudio,
    includeChildStudios,
    metric,
    filters,
    showList,
  } = view;
  const {
    range: dateRange,
    variable: dateRangeVariable,
    setRange: setDateRange,
  } = useStatsDateRange(); // CUSTOM
  const selectedStudioScope = useMemo<ISceneStatsStudioScope | undefined>(
    () =>
      selectedStudio
        ? {
            id: selectedStudio.id,
            name: selectedStudio.name,
            depth: includeChildStudios ? -1 : 0,
          }
        : undefined,
    [includeChildStudios, selectedStudio]
  );
  const effectiveStudioScope = studioScope ?? selectedStudioScope;
  const pageTitle = studioScope
    ? `${studioScope.name} Scene Stats`
    : "Scene Stats";
  const titleProps = useTitleProps(pageTitle);
  const history = useHistory();
  const location = useLocation(); // CUSTOM
  const [activeSection, setActiveSection] = useState<SceneStatsSection>(() =>
    sceneStatsSectionFromSearch(location.search)
  ); // CUSTOM
  const selectedYear = Number(selectedYearParam);
  const selectedMonth = Number(selectedMonthParam);
  const hasSelectedYear = Number.isInteger(selectedYear) && selectedYear > 0;
  const hasSelectedMonth =
    Number.isInteger(selectedMonth) &&
    selectedMonth >= 1 &&
    selectedMonth <= 12;
  const { configuration } = useConfigurationContext();
  const roleTagIds = useMemo(
    () => configuration?.ui?.roleTagIds ?? {},
    [configuration?.ui?.roleTagIds]
  );
  const roleTagIDList = useMemo(
    () =>
      [
        stringRoleTagId(roleTagIds.sexTagId),
        stringRoleTagId(roleTagIds.oralTagId),
        stringRoleTagId(roleTagIds.soloTagId),
        stringRoleTagId(roleTagIds.facialTagId),
        stringRoleTagId(roleTagIds.reallyHotTagId),
        stringRoleTagId(roleTagIds.goatTagId),
      ].filter((id): id is string => !!id),
    [roleTagIds]
  );

  const sceneQuery = useSceneStatsCompactQuery(
    effectiveStudioScope?.id,
    effectiveStudioScope?.depth,
    dateRangeVariable
  );
  const roleTagsQuery = useQuery<SceneStatsRoleTagsData>(
    SCENE_STATS_ROLE_TAGS,
    {
      skip: roleTagIDList.length === 0,
      variables: { ids: roleTagIDList },
    }
  );
  const { scenes } = sceneQuery;
  const roleTagsByID = useMemo(
    () =>
      new Map(
        (roleTagsQuery.data?.findTags.tags ?? []).map((tag) => [tag.id, tag])
      ),
    [roleTagsQuery.data?.findTags.tags]
  );
  const sexTag = roleTagsByID.get(stringRoleTagId(roleTagIds.sexTagId) ?? "");
  const oralTag = roleTagsByID.get(stringRoleTagId(roleTagIds.oralTagId) ?? "");
  const soloTag = roleTagsByID.get(stringRoleTagId(roleTagIds.soloTagId) ?? "");
  const facialTag = roleTagsByID.get(
    stringRoleTagId(roleTagIds.facialTagId) ?? ""
  );
  const reallyHotTag = roleTagsByID.get(
    stringRoleTagId(roleTagIds.reallyHotTagId) ?? ""
  );
  const goatTag = roleTagsByID.get(stringRoleTagId(roleTagIds.goatTagId) ?? "");
  const roleTagIDs = useMemo(
    () => ({
      sex: tagIDsFor(sexTag),
      oral: tagIDsFor(oralTag),
      solo: tagIDsFor(soloTag),
      facial: tagIDsFor(facialTag),
      reallyHot: tagIDsFor(reallyHotTag),
      goat: tagIDsFor(goatTag),
    }),
    [facialTag, goatTag, oralTag, reallyHotTag, sexTag, soloTag]
  );
  // CUSTOM: Keep the selected stats tab restorable through browser history.
  useEffect(() => {
    setActiveSection(sceneStatsSectionFromSearch(location.search));
  }, [location.search]);
  // CUSTOM: nuts per scene use the Nut Stats events, so both pages agree.
  const nutEventsQuery = useMarkerEventStatsQuery({
    skip: activeSection === "activity-matrix",
    variables: {
      kind: MarkerEventStatsKind.Orgasm,
      studioId: effectiveStudioScope?.id,
      depth: effectiveStudioScope?.depth,
      dateRange: dateRangeVariable,
    },
  });
  const nutsByScene = useMemo(() => {
    const byScene = new Map<string, SceneNuts>();
    (nutEventsQuery.data?.markerEventStats.events ?? []).forEach((event) => {
      const quality = NUT_QUALITY_STATUS[event.quality] ?? "regular";
      const current = byScene.get(event.scene_id) ?? { count: 0, best: "no" };
      current.count += 1;
      if (FACIAL_STATUS_RANK[quality] > FACIAL_STATUS_RANK[current.best])
        current.best = quality;
      byScene.set(event.scene_id, current);
    });
    return byScene;
  }, [nutEventsQuery.data?.markerEventStats.events]);
  // CUSTOM: StashDB Matches tables group by the same buckets as the Overview
  // charts. Best Nut waits for the Nut Stats events instead of showing None.
  const stashDBMatchesPageGroups = useMemo<
    Record<StashDBMatchesPageDimensionCustom, StashDBMatchesGroupsCustom>
  >(() => {
    const statusGroup = (status: FacialStatus) => ({
      key: status,
      label: FACIAL_STATUS_LABELS[status],
      sortValue: FACIAL_STATUS_RANK[status],
    });
    const nutsLoaded = !!nutEventsQuery.data;
    return {
      scene_type: (scene) => {
        const type = sceneType(scene, roleTagIDs);
        return type ? [{ key: type, label: SCENE_TYPE_LABELS[type] }] : [];
      },
      metallic_rating: (scene) => {
        const bucket = sceneMetallicBucket(scene, configuration);
        return bucket ? [bucket] : [];
      },
      best_facial: (scene) => [statusGroup(facialStatus(scene, roleTagIDs))],
      best_nut: (scene) =>
        nutsLoaded
          ? [statusGroup(nutsByScene.get(scene.id)?.best ?? "no")]
          : [],
    };
  }, [configuration, nutEventsQuery.data, nutsByScene, roleTagIDs]);
  const filteredScenes = useMemo(
    () =>
      scenes.filter((scene) => {
        const year = releaseYear(scene);
        const month = releaseMonth(scene);
        if (hasSelectedYear && year !== selectedYear) return false;
        if (hasSelectedMonth && month !== selectedMonth) return false;

        return filters.every((filter) =>
          sceneMatchesFilter(
            scene,
            filter,
            roleTagIDs,
            configuration,
            nutsByScene
          )
        );
      }),
    [
      configuration,
      filters,
      hasSelectedMonth,
      hasSelectedYear,
      nutsByScene,
      roleTagIDs,
      scenes,
      selectedMonth,
      selectedYear,
    ]
  );
  // CUSTOM: every section and aggregate shares the exact chart/release cohort.
  const cohort = useMemo(
    () => ({ scene_ids: filteredScenes.map((scene) => scene.id) }),
    [filteredScenes]
  );
  const totalsQuery = useQuery<SceneStatsTotalsData>(SCENE_STATS_TOTALS, {
    skip:
      activeSection !== "overview" || sceneQuery.loading || !!sceneQuery.error,
    variables: {
      dateRange: dateRangeVariable,
      depth: effectiveStudioScope?.depth,
      studioId: effectiveStudioScope?.id,
      cohort,
    },
  });

  // CUSTOM: summary cards follow the chart filters and release drilldown.
  const averages = useMemo(
    () => sceneStatsAverages(filteredScenes),
    [filteredScenes]
  );
  const vatoCountBuckets = useMemo(
    () =>
      sceneStatsVatoCountBuckets(
        filteredScenes
          .filter((scene) => scene.organized)
          .map((scene) => scene.performer_count)
      ),
    [filteredScenes]
  );
  const rankedScenes = useMemo(
    () =>
      rankStatsItems(
        activeSection === "overview" ? filteredScenes : [],
        (scene) => metricValue(scene, metric, roleTagIDs),
        (scene) => scene.title ?? "",
        // CUSTOM: O Count ties go to the scene that reached it most recently.
        metric === "o_counter"
          ? (scene) => mostRecentOTieBreaker(scene.most_recent_o_date)
          : undefined
      ),
    [activeSection, filteredScenes, metric, roleTagIDs]
  );
  const charts = useMemo(
    () =>
      buildSceneCharts(
        activeSection === "overview" ? filteredScenes : [],
        roleTagIDs,
        configuration,
        nutsByScene
      ),
    [activeSection, configuration, filteredScenes, nutsByScene, roleTagIDs]
  );
  const releaseChart = useMemo(
    () =>
      buildReleaseChart(
        activeSection === "overview"
          ? filteredScenes.filter((scene) => scene.organized)
          : [],
        navigationBase,
        hasSelectedYear ? selectedYear : undefined,
        hasSelectedMonth ? selectedMonth : undefined
      ),
    [
      activeSection,
      filteredScenes,
      hasSelectedMonth,
      hasSelectedYear,
      navigationBase,
      selectedMonth,
      selectedYear,
    ]
  );

  function addFilter(filter: ChartFilter) {
    setFilters((current) => {
      if (
        current.some(
          (existing) =>
            existing.category === filter.category &&
            existing.value === filter.value
        )
      ) {
        return current;
      }
      return [...current, filter];
    });
  }

  function clearReleaseSelection() {
    updateView(
      (current) => ({
        filters: current.filters.filter(
          (filter) => filter.category !== "release_day"
        ),
      }),
      navigationBase
    );
  }

  function navigateRelease(path: string) {
    updateView(
      (current) => ({
        filters: current.filters.filter(
          (filter) => filter.category !== "release_day"
        ),
      }),
      path
    );
  }

  function selectStudio(studio?: Studio) {
    updateView(
      { studio, filters: [] },
      hasSelectedYear ? navigationBase : undefined
    );
  }

  const headerControls = (
    <div className="stats-header-controls">
      <StatsDateRangeFilter range={dateRange} onChange={setDateRange} />
      {!studioScope && (
        <StatsStudioSelector
          includeChildStudios={includeChildStudios}
          onIncludeChildStudiosChange={(include) => {
            updateView({ includeChildStudios: include, filters: [] });
          }}
          onStudioChange={selectStudio}
          studio={selectedStudio}
        />
      )}
    </div>
  );

  if (sceneQuery.error)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage className="scenestats-page" showNavigation={!studioScope}>
          <ErrorMessage error={sceneQuery.error.message} />
        </StatsPage>
      </>
    );

  if (roleTagsQuery.error)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage className="scenestats-page" showNavigation={!studioScope}>
          <ErrorMessage error={roleTagsQuery.error.message} />
        </StatsPage>
      </>
    );

  if (sceneQuery.loading || roleTagsQuery.loading)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage
          className="scenestats-page"
          loading
          loadingMessage="Loading scene stats..."
          showNavigation={!studioScope}
        />
      </>
    );

  const summary: Partial<SceneStatsTotalsData["activity"]> = totalsQuery.loading
    ? {}
    : totalsQuery.data?.activity ?? {};
  const hasChartFilters = filters.length > 0 || hasSelectedYear;
  const releaseSearch = writeStatsView(location.search, sceneViewOptions, {
    ...view,
    filters: filters.filter((filter) => filter.category !== "release_day"),
  });
  const sceneTotal = filteredScenes.length;

  function toBars(data: ChartDatum[]): IStatsBarDatum[] {
    return data.map((datum) => ({
      key: datum.key,
      label: datum.label,
      count: datum.count,
      to: datum.path
        ? { pathname: datum.path, search: releaseSearch }
        : undefined,
      actionLabel: datum.path ? "View release breakdown for" : undefined,
      onSelect: datum.filter
        ? () => addFilter(datum.filter as ChartFilter)
        : undefined,
    }));
  }

  function unknownFilter(category: ChartCategory, count: number) {
    return {
      count,
      onSelect: () =>
        addFilter({
          category,
          label: "Unknown",
          value:
            category === "release_day"
              ? `${STATS_UNKNOWN_FILTER_VALUE}:${releaseChart.level}`
              : STATS_UNKNOWN_FILTER_VALUE,
        }),
    };
  }

  const activityTimes = [
    {
      key: "sex",
      label: `${ACTIVITY_LABELS_CUSTOM.sex} Time`,
      seconds: summary.totalSexTime,
    },
    {
      key: "oral",
      label: `${ACTIVITY_LABELS_CUSTOM.oral} Time`,
      seconds: summary.totalOralTime,
    },
    {
      key: "solo",
      label: `${ACTIVITY_LABELS_CUSTOM.solo} Time`,
      seconds: summary.totalSoloTime,
    },
  ];
  const activityTotal = Math.max(
    0,
    (totalsQuery.data?.activity.totalSeconds ?? 0) -
      (totalsQuery.data?.activity.otherSeconds ?? 0)
  );
  const kpis: IStatsKpi[] = [
    {
      key: "length",
      label: "Avg Scene Length",
      value:
        averages.averageSceneLength === undefined
          ? "—"
          : TextUtils.secondsAsTimeString(averages.averageSceneLength, 2),
      detail: formatStatsTotal(sceneTotal, "scene", "scenes"),
    },
    {
      key: "per-vato",
      label: "Avg Scenes Per Vato",
      value:
        averages.averageScenesPerPerformer === undefined
          ? "—"
          : averages.averageScenesPerPerformer.toLocaleString(
              getAppLocaleCustom(),
              {
                maximumFractionDigits: 1,
              }
            ),
    },
    // CUSTOM: activity-time totals share the first row with the averages.
    ...activityTimes
      .filter(({ seconds }) => typeof seconds === "number" && seconds > 0)
      .map(({ key, label, seconds = 0 }) => ({
        key,
        label,
        value: formatDuration(seconds),
        detail: `${formatStatsBarPercent(
          seconds,
          activityTotal
        )} of activity time`,
      })),
  ];

  const vatoCountBars: IStatsBarDatum[] = [
    { key: "0", label: "No Vatos · 0", count: vatoCountBuckets.zero },
    { key: "1", label: "Solo · 1", count: vatoCountBuckets.one },
    { key: "2", label: "Standard · 2", count: vatoCountBuckets.standard },
    { key: "3", label: "Threesome · 3", count: vatoCountBuckets.threesome },
    {
      key: VATO_GROUP_FILTER_VALUE,
      label: "Group · 4+",
      count: vatoCountBuckets.group,
    },
  ].map((bar) => ({
    ...bar,
    onSelect: () =>
      addFilter({
        category: "performer_count",
        label: bar.key,
        value: bar.key,
      }),
  }));

  // CUSTOM: one column per facial or nut count; slices show the best one.
  function stackedCountColumns(
    columns: FacialColumn[],
    countCategory: "facial_count" | "nut_count",
    statusCategory: "facial_status" | "nut_status"
  ): IStatsBarDatum[] {
    return columns.map((column) => {
      const label = column.count === 0 ? "None" : String(column.count);
      const countFilter: ChartFilter = {
        category: countCategory,
        label,
        value: String(column.count),
      };
      const statuses: FacialStatus[] =
        column.count === 0 ? ["no"] : ["regular", "rh", "goat"];
      return {
        key: String(column.count),
        label,
        count: column.total,
        onSelect: () => addFilter(countFilter),
        segments: statuses.map((status) => ({
          key: status,
          label: FACIAL_STATUS_LABELS[status],
          count: column.statuses[status],
          color: FACIAL_STATUS_COLORS[status],
          onSelect: () => {
            addFilter(countFilter);
            addFilter({
              category: statusCategory,
              label: FACIAL_STATUS_LABELS[status],
              value: status,
            });
          },
        })),
      };
    });
  }

  // Unorganized scenes have no markers yet, so their facials and nuts are
  // unknown rather than zero.
  const unorganizedUnknown = {
    count: charts.unorganizedCount,
    onSelect: () =>
      addFilter({ category: "organized", label: "No", value: "no" }),
  };
  const qualityLegend = [
    ...STATS_QUALITY_LEGEND,
    { key: "no", label: "None", color: FACIAL_STATUS_COLORS.no },
  ];

  const releaseActions = (
    <div className="scenestats-release-chart-actions">
      <div
        className="stats-rank-chips"
        role="group"
        aria-label="Scene release stats navigation"
      >
        {[
          {
            label: "By Year",
            path: navigationBase,
            available: true,
            active: !hasSelectedYear,
          },
          {
            label: "By Month",
            path: `${navigationBase}/${selectedYear}`,
            available: hasSelectedYear,
            active: hasSelectedYear && !hasSelectedMonth,
          },
          {
            label: "By Day",
            path: `${navigationBase}/${selectedYear}/${selectedMonth}`,
            available: hasSelectedYear && hasSelectedMonth,
            active: hasSelectedMonth,
          },
        ].map((destination) =>
          destination.available ? (
            <Link
              key={destination.label}
              className={`stats-chip${destination.active ? " active" : ""}`}
              aria-current={destination.active ? "page" : undefined}
              title={`View scene releases ${destination.label.toLowerCase()}`}
              to={{ pathname: destination.path, search: releaseSearch }}
            >
              {destination.label}
            </Link>
          ) : (
            <button
              key={destination.label}
              className="stats-chip"
              disabled
              type="button"
            >
              {destination.label}
            </button>
          )
        )}
      </div>
      {hasSelectedYear && (
        <span>
          {hasSelectedMonth
            ? `${monthName(selectedMonth, "long")} ${selectedYear}`
            : selectedYear}
        </span>
      )}
    </div>
  );

  return (
    <StatsPage className="scenestats-page" showNavigation={!studioScope}>
      <Helmet {...titleProps} />

      <header className="scenestats-header">
        <div>
          <h1>{pageTitle}</h1>
          <div className="scenestats-total">
            {hasChartFilters
              ? formatStatsDrilldownTotal(
                  sceneTotal,
                  scenes.length,
                  "scene",
                  "scenes"
                )
              : formatStatsTotal(scenes.length, "scene", "scenes")}
          </div>
        </div>
        {headerControls}
      </header>

      {/* CUSTOM: selected filters stay removable in every section. */}
      <SceneStatsFilterBar
        filters={filters}
        total={`${sceneTotal.toLocaleString(
          getAppLocaleCustom()
        )} matching scenes`}
        hasSelectedMonth={hasSelectedMonth}
        hasSelectedYear={hasSelectedYear}
        onRemove={(index) =>
          setFilters((current) => removeStatsFilter(current, index))
        }
        onRemoveYear={clearReleaseSelection}
        onRemoveMonth={() =>
          navigateRelease(`${navigationBase}/${selectedYear}`)
        }
        onBack={() => {
          if (filters.length > 0) setFilters((current) => current.slice(0, -1));
          else if (hasSelectedMonth)
            navigateRelease(`${navigationBase}/${selectedYear}`);
          else clearReleaseSelection();
        }}
        onClear={() => updateView({ filters: [] }, navigationBase)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      <Nav
        activeKey={activeSection}
        className="scenestats-sections"
        // CUSTOM: begin
        onSelect={(key) => {
          const section: SceneStatsSection = sceneStatsSectionFromKey(key);
          setActiveSection(section);
          history.push({
            ...location,
            search: sceneStatsSearchForSection(location.search, section),
          });
        }}
        // CUSTOM: end
        variant="tabs"
      >
        <Nav.Item>
          <Nav.Link eventKey="overview">Overview</Nav.Link>
        </Nav.Item>
        {/* CUSTOM: begin */}
        <Nav.Item>
          <Nav.Link eventKey="activity-matrix">Activity Matrix</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="stashdb-matches">StashDB Matches</Nav.Link>
        </Nav.Item>
        {/* CUSTOM: end */}
      </Nav>

      {activeSection === "overview" && (
        <>
          {totalsQuery.error && (
            <ErrorMessage error={totalsQuery.error.message} />
          )}
          <StatsKpiRow items={kpis} label="Average scene statistics" />

          {scenes.length === 0 ? (
            <Alert variant="secondary">No scenes found.</Alert>
          ) : (
            <>
              {/* CUSTOM: ranked scene cards; the table view replaces the scene list. */}
              <StatsTopCards
                title="Top Scenes"
                variant="scene"
                emptyLabel="No scenes match this ranking."
                rankBy={{
                  options: metricOptions,
                  value: metric,
                  onChange: setMetric,
                }}
                view={showList ? "table" : "cards"}
                onViewChange={(next) => setShowList(next === "table")}
                items={rankedScenes.map((scene) => ({
                  key: scene.id,
                  title: scene.title || `Scene ${scene.id}`,
                  imagePath: `/scene/${scene.id}/screenshot`,
                  rating100: scene.rating100,
                  to: `/scenes/${scene.id}`,
                  meta: sceneCardMeta(scene),
                  value: (
                    <>
                      {formatMetricValue(scene, metric, roleTagIDs)}{" "}
                      {metricOptionValueLabel(metric)}
                    </>
                  ),
                }))}
              />

              <p className="stats-interaction-help">
                Select a bar, segment or Unknown badge to filter this page.
                Release year and month links open the next date breakdown.
                Coverage opens the matching scenes.
              </p>

              {/* CUSTOM: charts grouped by topic; each group fills whole rows. */}
              <StatsChartGroup className="stats-group--panel" title="The Scene">
                <StatsBarChart
                  className="stats-wide"
                  title={
                    hasSelectedYear
                      ? hasSelectedMonth
                        ? "By Release Day"
                        : "By Release Month"
                      : "By Release Year"
                  }
                  data={toBars(releaseChart.data)}
                  unit={SCENE_UNIT}
                  sortable
                  unknown={unknownFilter(
                    "release_day",
                    releaseChart.unknownCount
                  )}
                  actions={releaseActions}
                />
                <StatsBarChart
                  className="stats-wide"
                  title="Duration"
                  data={toBars(charts.duration)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  sortable
                />
                <StatsBarChart
                  className="stats-wide"
                  title="Rating"
                  data={toBars(charts.rating.data)}
                  unit={SCENE_UNIT}
                  sortable
                  unknown={unknownFilter("rating", charts.rating.unknownCount)}
                />
                <StatsBarChart
                  className="stats-small"
                  title="Metallic Rating"
                  data={toBars(charts.metallicRating.data).map((bar) => ({
                    ...bar,
                    color: statsMetallicColor(bar.key),
                  }))}
                  unit={SCENE_UNIT}
                  unknown={unknownFilter(
                    "metallic_rating",
                    charts.metallicRating.unknownCount
                  )}
                />
                <StatsBarChart
                  className="stats-small"
                  title="Resolution"
                  data={toBars(charts.resolution.data)}
                  unit={SCENE_UNIT}
                  totalNote="Counts every scene, organized or not."
                  unknown={unknownFilter(
                    "resolution",
                    charts.resolution.unknownCount
                  )}
                />
                <StatsBarChart
                  className="stats-small"
                  variant="ranked"
                  title="Scene Type"
                  data={toBars(charts.sceneType.data)}
                  unit={SCENE_UNIT}
                  unknown={unknownFilter(
                    "scene_type",
                    charts.sceneType.unknownCount
                  )}
                />
              </StatsChartGroup>

              <StatsChartGroup className="stats-group--panel" title="The Vatos">
                <StatsBarChart
                  className="stats-small"
                  title="Vato Count"
                  data={vatoCountBars}
                  unit={SCENE_UNIT}
                  // Scenes without vatos, as the old By Vato Count chart showed.
                  unknown={unknownFilter(
                    "performer_count",
                    charts.organizedCount -
                      vatoCountBuckets.zero -
                      vatoCountBuckets.one -
                      vatoCountBuckets.standard -
                      vatoCountBuckets.threesome -
                      vatoCountBuckets.group
                  )}
                />
                <StatsBarChart
                  className="stats-small"
                  variant="ranked"
                  title="Vato Ethnicity"
                  data={toBars(charts.ethnicity.data)}
                  unit={SCENE_UNIT}
                  total={charts.organizedCount - charts.ethnicity.unknownCount}
                  totalNote="A scene counts once for each vato ethnicity, so bars can overlap."
                  unknown={unknownFilter(
                    "ethnicity",
                    charts.ethnicity.unknownCount
                  )}
                />
                <StatsBarChart
                  className="stats-small"
                  variant="ranked"
                  title="Vato Country"
                  data={toBars(charts.country.data).map((bar) => ({
                    ...bar,
                    icon: <StatsCountryFlag country={bar.key} />,
                  }))}
                  unit={SCENE_UNIT}
                  total={charts.organizedCount - charts.country.unknownCount}
                  totalNote="A scene counts once for each vato country, so bars can overlap."
                  unknown={unknownFilter(
                    "country",
                    charts.country.unknownCount
                  )}
                />
              </StatsChartGroup>

              <StatsChartGroup
                className="stats-group--panel"
                title="O's, Nuts & Facials"
              >
                <StatsBarChart
                  className="stats-small"
                  title="O Count"
                  data={toBars(charts.oCount.data)}
                  unit={SCENE_UNIT}
                  totalNote="Includes scenes with no O records."
                  sortable
                  unknown={unknownFilter("o_count", charts.oCount.unknownCount)}
                />
                <StatsBarChart
                  className="stats-small"
                  title="Nuts Per Scene"
                  data={stackedCountColumns(
                    charts.nuts,
                    "nut_count",
                    "nut_status"
                  )}
                  unit={SCENE_UNIT}
                  legend={qualityLegend}
                  unknown={unorganizedUnknown}
                />
                <StatsBarChart
                  className="stats-small"
                  title="Facials Per Scene"
                  data={stackedCountColumns(
                    charts.facials,
                    "facial_count",
                    "facial_status"
                  )}
                  unit={SCENE_UNIT}
                  legend={qualityLegend}
                  unknown={unorganizedUnknown}
                />
              </StatsChartGroup>

              {/* CUSTOM: Activity & Ratings follow the charts in their own panel. */}
              <SceneStatsInsights
                cohort={cohort} // CUSTOM
                dateRange={dateRangeVariable}
                depth={effectiveStudioScope?.depth}
                studioId={effectiveStudioScope?.id}
                studioName={effectiveStudioScope?.name}
              />
            </>
          )}
        </>
      )}
      {/* CUSTOM: begin */}
      {activeSection === "activity-matrix" && (
        <SceneStatsActivityMatrix
          cohort={cohort} // CUSTOM
          dateRange={dateRangeVariable}
          depth={effectiveStudioScope?.depth}
          studioId={effectiveStudioScope?.id}
          studioName={effectiveStudioScope?.name}
        />
      )}
      {activeSection === "stashdb-matches" && (
        <SceneStatsStashDBMatches
          pageGroups={stashDBMatchesPageGroups}
          scenes={filteredScenes}
        />
      )}
      {/* CUSTOM: end */}
    </StatsPage>
  );
};

const SceneStats: React.FC<RouteComponentProps<IRouteParams>> = ({ match }) => (
  <SceneStatsDashboard
    selectedMonth={match.params.month}
    selectedYear={match.params.year}
  />
);

export default SceneStats;
