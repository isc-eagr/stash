import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  mostRecentOTieBreaker,
  rankStatsItems,
} from "src/utils/statsRanking_custom";
import {
  faHand,
  faPeopleGroup,
  faUser,
  faUserGroup,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { Alert, Button, ButtonGroup, Form, Nav } from "react-bootstrap";
import { Helmet } from "react-helmet";
import {
  Link,
  RouteComponentProps,
  useHistory,
  useLocation,
} from "react-router-dom";
import { FormattedNumber } from "react-intl";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { StatsPage } from "src/components/StatsPage_custom";
import { StatsStudioSelector } from "src/components/StatsStudioSelector_custom";
import { StatsFilterBar } from "src/components/StatsFilterBar_custom";
import {
  StatsBarChart,
  type IStatsBarDatum,
} from "src/components/StatsBarChart_custom"; // CUSTOM
import { StatsTopCards } from "src/components/StatsTopCards_custom"; // CUSTOM
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
import NavUtils from "src/utils/navigation";
import { metallicRatingChartBucket } from "src/utils/metallicRatingChart_custom";
import { sceneMetallicRating } from "src/utils/sceneMetallicRating_custom"; // CUSTOM
import { statsCountryName } from "src/utils/statsCountry_custom";
import {
  formatStatsDrilldownTotal,
  formatStatsTotal,
} from "src/utils/statsDrilldown_custom";
import { FileSize } from "src/components/Shared/FileSize";
import { Icon } from "src/components/Shared/Icon";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import facialPng from "src/assets/facial.png";
import {
  facialCount,
  markerHasTag,
  reallyHotFacialCount,
} from "./sceneStatsFacialCounts_custom";
import { durationBucketForMinutes } from "./sceneStatsDuration_custom";
import {
  sceneStatsActivityType,
  sceneStatsPositiveCount,
  sceneStatsRatingBucket,
  sceneStatsReleaseDay,
  sceneStatsReleaseMonth,
  sceneStatsReleaseYear,
} from "./sceneStatsChartBuckets_custom";
import {
  makeSceneStatsVatoCountURL,
  sceneStatsVatoCountBuckets,
} from "./sceneStatsSummary_custom";
import { type SceneStatsScene } from "./sceneStatsCompactData_custom"; // CUSTOM
import { useSceneStatsCompactQuery } from "./useSceneStatsCompactQuery_custom"; // CUSTOM
import { SceneStatsInsights } from "./SceneStatsInsights_custom";
import { SceneStatsActivityMatrix } from "./SceneStatsActivityMatrix_custom"; // CUSTOM
import {
  sceneStatsSearchForSection,
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
    totalSexTime(
      studio_id: $studioId
      depth: $depth
      date_range: $dateRange
      cohort: $cohort
    )
    totalOralTime(
      studio_id: $studioId
      depth: $depth
      date_range: $dateRange
      cohort: $cohort
    )
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
  totalSexTime: number;
  totalOralTime: number;
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
  | "really_hot_facial_count"
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
  facial_status: "Has Facial",
  facial_count: "Facial Count",
  really_hot_facial_count: "Really Hot Facial Count",
  scene_type: "Scene Type",
  duration: "Duration",
  resolution: "Resolution",
};

const SCENE_UNIT: [string, string] = ["scene", "scenes"];
const sceneViewOptions = {
  prefix: "scene",
  categories: Object.keys(chartDefinitions) as ChartCategory[],
  metrics: metricOptions.map((option) => option.key),
  defaultMetric: "o_counter" as PodiumMetric,
};
const SCENE_LIST_PAGE_SIZE = 60;

function cleanValue(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "<nil>") return undefined;
  return trimmed;
}

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
  return new Date(Date.UTC(2024, month - 1, 1)).toLocaleString(undefined, {
    month: format,
    timeZone: "UTC",
  });
}

function dayLabel(year: number, month: number, day: number) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toLocaleString(undefined, {
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
  return new Date(timestamp).toLocaleDateString();
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
  return value.toLocaleString();
}

function metricOptionValueLabel(metric: PodiumMetric) {
  return metricOptions.find((option) => option.key === metric)?.valueLabel;
}

function metricOptionLabel(metric: PodiumMetric) {
  return metricOptions.find((option) => option.key === metric)?.label ?? metric;
}

function formatDuration(totalSeconds: number) {
  return TextUtils.formatDurationRange(totalSeconds);
}

function sceneStatsScopedListURL(
  url: string,
  studioScope?: ISceneStatsStudioScope
) {
  if (!studioScope) return url;
  return NavUtils.withStudioScope(
    url,
    studioScope.id,
    studioScope.name,
    studioScope.depth
  );
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

function facialStatus(scene: SceneStatsScene, roleTagIDs: RoleTagIDSets) {
  const hasFacial = sceneHasTag(scene, roleTagIDs.facial);
  const hasReallyHotFacial = reallyHotFacialCount(scene, roleTagIDs) > 0;

  if (hasReallyHotFacial) return "rh";
  if (hasFacial) return "regular";
  return "no";
}

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
  configuration: UIConfiguration
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
        reallyHotFacialCount: reallyHotFacialCount(scene, roleTagIDs),
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
      return String(sceneStatsPositiveCount(scene.o_counter)) === filter.value;
    case "performer_count":
      return (
        String(sceneStatsPositiveCount(scene.performer_count)) === filter.value
      );
    case "rating":
      return sceneStatsRatingBucket(scene.rating100) === filter.value;
    case "metallic_rating":
      return sceneMetallicBucket(scene, configuration)?.key === filter.value;
    case "release_day":
      return releaseDate(scene)?.slice(0, 10) === filter.value;
    case "facial_status":
      return facialStatus(scene, roleTagIDs) === filter.value;
    case "facial_count":
      return (
        String(
          sceneStatsPositiveCount(facialCount(scene, roleTagIDs.facial))
        ) === filter.value
      );
    case "really_hot_facial_count":
      return (
        String(
          sceneStatsPositiveCount(reallyHotFacialCount(scene, roleTagIDs))
        ) === filter.value
      );
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

function buildSceneCharts(
  scenes: SceneStatsScene[],
  roleTagIDs: RoleTagIDSets,
  configuration: UIConfiguration
) {
  const ethnicityBuckets = new Map<string, ChartDatum>();
  const countryBuckets = new Map<string, ChartDatum>();
  const oCountBuckets = new Map<string, ChartDatum>();
  const performerCountBuckets = new Map<string, ChartDatum>();
  const ratingBuckets = new Map<string, ChartDatum>();
  const metallicRatingBuckets = new Map<string, ChartDatum>();
  const facialStatusBuckets = new Map<string, ChartDatum>();
  const facialCountBuckets = new Map<string, ChartDatum>();
  const reallyHotFacialCountBuckets = new Map<string, ChartDatum>();
  const sceneTypeBuckets = new Map<string, ChartDatum>();
  const durationBuckets = new Map<string, ChartDatum>();
  const resolutionBuckets = new Map<string, ChartDatum>();
  let unknownEthnicityCount = 0;
  let unknownCountryCount = 0;
  let unknownOCount = 0;
  let unknownPerformerCount = 0;
  let unknownRatingCount = 0;
  let unknownMetallicRatingCount = 0;
  let unknownFacialCount = 0;
  let unknownReallyHotFacialCount = 0;
  let unknownSceneTypeCount = 0;
  let unknownResolutionCount = 0;

  const statusLabels: Record<string, string> = {
    rh: "Really hot",
    regular: "Regular",
    no: "None",
  };
  const typeLabels: Record<string, string> = {
    sex: "Sex",
    oral: "Oral",
    solo: "Jerk",
  };

  scenes.forEach((scene) => {
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

    const oCount = sceneStatsPositiveCount(scene.o_counter);
    if (oCount === undefined) {
      unknownOCount += 1;
    } else {
      addDatum(oCountBuckets, String(oCount), String(oCount), oCount, {
        category: "o_count",
        label: String(oCount),
        value: String(oCount),
      });
    }

    const performerCount = sceneStatsPositiveCount(scene.performer_count);
    if (performerCount === undefined) {
      unknownPerformerCount += 1;
    } else {
      addDatum(
        performerCountBuckets,
        String(performerCount),
        String(performerCount),
        performerCount,
        {
          category: "performer_count",
          label: String(performerCount),
          value: String(performerCount),
        }
      );
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

    const status = facialStatus(scene, roleTagIDs);
    addDatum(
      facialStatusBuckets,
      status,
      statusLabels[status],
      status === "rh" ? 1 : status === "regular" ? 2 : 3,
      {
        category: "facial_status",
        label: statusLabels[status],
        value: status,
      }
    );

    const sceneFacialCount = sceneStatsPositiveCount(
      facialCount(scene, roleTagIDs.facial)
    );
    if (sceneFacialCount === undefined) {
      unknownFacialCount += 1;
    } else {
      addDatum(
        facialCountBuckets,
        String(sceneFacialCount),
        String(sceneFacialCount),
        sceneFacialCount,
        {
          category: "facial_count",
          label: String(sceneFacialCount),
          value: String(sceneFacialCount),
        }
      );
    }

    const sceneReallyHotFacialCount = sceneStatsPositiveCount(
      reallyHotFacialCount(scene, roleTagIDs)
    );
    if (sceneReallyHotFacialCount === undefined) {
      unknownReallyHotFacialCount += 1;
    } else {
      addDatum(
        reallyHotFacialCountBuckets,
        String(sceneReallyHotFacialCount),
        String(sceneReallyHotFacialCount),
        sceneReallyHotFacialCount,
        {
          category: "really_hot_facial_count",
          label: String(sceneReallyHotFacialCount),
          value: String(sceneReallyHotFacialCount),
        }
      );
    }

    const type = sceneType(scene, roleTagIDs);
    if (!type) {
      unknownSceneTypeCount += 1;
    } else {
      addDatum(
        sceneTypeBuckets,
        type,
        typeLabels[type],
        type === "sex" ? 1 : type === "oral" ? 2 : 3,
        {
          category: "scene_type",
          label: typeLabels[type],
          value: type,
        }
      );
    }

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
    performerCount: {
      data: Array.from(performerCountBuckets.values()).sort(numericSort),
      unknownCount: unknownPerformerCount,
    },
    rating: {
      data: Array.from(ratingBuckets.values()).sort(numericSort),
      unknownCount: unknownRatingCount,
    },
    metallicRating: {
      data: Array.from(metallicRatingBuckets.values()).sort(numericSort),
      unknownCount: unknownMetallicRatingCount,
    },
    facialStatus: Array.from(facialStatusBuckets.values()).sort(numericSort),
    facialCount: {
      data: Array.from(facialCountBuckets.values()).sort(numericSort),
      unknownCount: unknownFacialCount,
    },
    reallyHotFacialCount: {
      data: Array.from(reallyHotFacialCountBuckets.values()).sort(numericSort),
      unknownCount: unknownReallyHotFacialCount,
    },
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

const SceneStatsSceneList: React.FC<{
  metric: PodiumMetric;
  roleTagIDs: RoleTagIDSets;
  scenes: SceneStatsScene[];
}> = ({ metric, roleTagIDs, scenes }) => {
  const [visibleCount, setVisibleCount] = useState(SCENE_LIST_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(SCENE_LIST_PAGE_SIZE);
  }, [metric, scenes]);

  const visibleScenes = scenes.slice(0, visibleCount);
  const hiddenCount = Math.max(scenes.length - visibleScenes.length, 0);

  return (
    <section className="scenestats-scene-list" aria-label="Filtered scenes">
      <div className="scenestats-scene-list-heading">
        Sorted by {metricOptionLabel(metric)} - Showing{" "}
        {visibleScenes.length.toLocaleString()} /{" "}
        {scenes.length.toLocaleString()}
      </div>
      {visibleScenes.map((scene) => (
        <Link
          className="scenestats-scene-list-item"
          key={scene.id}
          to={`/scenes/${scene.id}`}
        >
          <img
            alt=""
            className="scenestats-scene-list-image"
            loading="lazy"
            src={`/scene/${scene.id}/screenshot`}
          />
          <span className="scenestats-scene-list-name">
            {scene.title || `Scene ${scene.id}`}
          </span>
          <span className="scenestats-scene-list-meta">
            {formatMetricValue(scene, metric, roleTagIDs)}
          </span>
        </Link>
      ))}
      {hiddenCount > 0 && (
        <div className="scenestats-scene-list-more">
          <Button
            onClick={() =>
              setVisibleCount((current) => current + SCENE_LIST_PAGE_SIZE)
            }
            size="sm"
            variant="secondary"
          >
            Show more
          </Button>
        </div>
      )}
    </section>
  );
};

export const SceneStatsDashboard: React.FC<ISceneStatsDashboardProps> = ({
  selectedYear: selectedYearParam,
  selectedMonth: selectedMonthParam,
  navigationBase = "/scenestats",
  studioScope,
}) => {
  const {
    view,
    updateView,
    setMetric,
    setFilters,
    setShowList: setShowSceneList,
  } = useStatsViewState(sceneViewOptions);
  const {
    studio: selectedStudio,
    includeChildStudios,
    metric,
    filters,
    showList: showSceneList,
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
  const roleTagIDs = useMemo(
    () => ({
      sex: tagIDsFor(sexTag),
      oral: tagIDsFor(oralTag),
      solo: tagIDsFor(soloTag),
      facial: tagIDsFor(facialTag),
      reallyHot: tagIDsFor(reallyHotTag),
    }),
    [facialTag, oralTag, reallyHotTag, sexTag, soloTag]
  );

  // CUSTOM: Keep the selected stats tab restorable through browser history.
  useEffect(() => {
    setActiveSection(sceneStatsSectionFromSearch(location.search));
  }, [location.search]);
  const filteredScenes = useMemo(
    () =>
      scenes.filter((scene) => {
        const year = releaseYear(scene);
        const month = releaseMonth(scene);
        if (hasSelectedYear && year !== selectedYear) return false;
        if (hasSelectedMonth && month !== selectedMonth) return false;

        return filters.every((filter) =>
          sceneMatchesFilter(scene, filter, roleTagIDs, configuration)
        );
      }),
    [
      configuration,
      filters,
      hasSelectedMonth,
      hasSelectedYear,
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
        filteredScenes.map((scene) => scene.performer_count)
      ),
    [filteredScenes]
  );
  const categoryCounts = useMemo(
    () =>
      filteredScenes.reduce(
        (counts, scene) => {
          const type = sceneType(scene, roleTagIDs);
          if (type) counts[type] += 1;
          if (sceneHasTag(scene, roleTagIDs.facial)) counts.facial += 1;
          return counts;
        },
        { sex: 0, oral: 0, solo: 0, facial: 0 }
      ),
    [roleTagIDs, filteredScenes]
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
        configuration
      ),
    [activeSection, configuration, filteredScenes, roleTagIDs]
  );
  const releaseChart = useMemo(
    () =>
      buildReleaseChart(
        activeSection === "overview" ? filteredScenes : [],
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

  const summary: Partial<SceneStatsTotalsData> = totalsQuery.loading
    ? {}
    : totalsQuery.data ?? {};
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
        total={`${sceneTotal.toLocaleString()} matching scenes`}
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
          const section: SceneStatsSection =
            key === "insights" || key === "activity-matrix" ? key : "overview";
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
        <Nav.Item>
          <Nav.Link eventKey="insights">Activity &amp; Ratings</Nav.Link>
        </Nav.Item>
        {/* CUSTOM: begin */}
        <Nav.Item>
          <Nav.Link eventKey="activity-matrix">Activity Matrix</Nav.Link>
        </Nav.Item>
        {/* CUSTOM: end */}
      </Nav>

      {activeSection === "overview" && (
        <>
          {totalsQuery.error && (
            <ErrorMessage error={totalsQuery.error.message} />
          )}
          {!effectiveStudioScope && !hasChartFilters && (
            <p className="stats-interaction-help">
              Library totals below. Linked cards open matching scenes or markers
              →
            </p>
          )}
          <section
            className="scenestats-summary-grid"
            aria-label="Average scene statistics"
          >
            <div className="scenestats-summary-card">
              <div className="scenestats-summary-value">
                {averages.averageSceneLength === undefined
                  ? "—"
                  : TextUtils.secondsAsTimeString(
                      averages.averageSceneLength,
                      2
                    )}
              </div>
              <div className="scenestats-summary-label">
                Average Scene Length
              </div>
            </div>
            <div className="scenestats-summary-card">
              <div className="scenestats-summary-value">
                {averages.averageScenesPerPerformer === undefined
                  ? "—"
                  : averages.averageScenesPerPerformer.toLocaleString(
                      undefined,
                      { maximumFractionDigits: 1 }
                    )}
              </div>
              <div className="scenestats-summary-label">
                Average Scenes Per Vato
              </div>
            </div>
          </section>
          {(sexTag || oralTag || soloTag || facialTag) && (
            <section
              className="scenestats-summary-grid scenestats-category-grid"
              aria-label="Scene category metrics"
            >
              {/* CUSTOM: router links keep the SPA cache; every family includes sub-tags. */}
              {sexTag && (
                <Link
                  className="scenestats-summary-card scenestats-category-card stats-category-button sex-stats-button"
                  to={sceneStatsScopedListURL(
                    NavUtils.makeScenesWithMarkerTagUrl(
                      sexTag.id,
                      sexTag.name,
                      -1
                    ),
                    effectiveStudioScope
                  )}
                  aria-disabled={categoryCounts.sex === 0}
                  title="Sex Scenes"
                >
                  <img src={gaySvg} alt="Sex" className="stats-category-icon" />
                  <span>
                    <FormattedNumber value={categoryCounts.sex} />
                  </span>
                </Link>
              )}
              {oralTag && (
                <Link
                  className="scenestats-summary-card scenestats-category-card stats-category-button oral-stats-button"
                  to={sceneStatsScopedListURL(
                    NavUtils.makeScenesWithExclusiveMarkerTagUrl(
                      oralTag.id,
                      oralTag.name,
                      sexTag ? [{ id: sexTag.id, label: sexTag.name }] : [],
                      -1
                    ),
                    effectiveStudioScope
                  )}
                  aria-disabled={categoryCounts.oral === 0}
                  title="Oral Scenes"
                >
                  <img
                    src={mouthSvg}
                    alt="Oral"
                    className="stats-category-icon"
                  />
                  <span>
                    <FormattedNumber value={categoryCounts.oral} />
                  </span>
                </Link>
              )}
              {soloTag && (
                <Link
                  className="scenestats-summary-card scenestats-category-card stats-category-button solo-stats-button"
                  to={sceneStatsScopedListURL(
                    NavUtils.makeScenesWithExclusiveMarkerTagUrl(
                      soloTag.id,
                      soloTag.name,
                      [
                        ...(sexTag
                          ? [{ id: sexTag.id, label: sexTag.name }]
                          : []),
                        ...(oralTag
                          ? [{ id: oralTag.id, label: oralTag.name }]
                          : []),
                      ],
                      -1
                    ),
                    effectiveStudioScope
                  )}
                  aria-disabled={categoryCounts.solo === 0}
                  title="Solo Scenes"
                >
                  <Icon icon={faHand} className="stats-category-icon-fa" />
                  <span>
                    <FormattedNumber value={categoryCounts.solo} />
                  </span>
                </Link>
              )}
              {facialTag && (
                <Link
                  className="scenestats-summary-card scenestats-category-card stats-category-button facial-stats-button"
                  to={sceneStatsScopedListURL(
                    NavUtils.makeScenesWithMarkerTagUrl(
                      facialTag.id,
                      facialTag.name,
                      -1
                    ),
                    effectiveStudioScope
                  )}
                  aria-disabled={categoryCounts.facial === 0}
                  title="Facial Scenes"
                >
                  <img
                    src={facialPng}
                    alt="Facial"
                    className="stats-category-icon"
                  />
                  <span>
                    <FormattedNumber value={categoryCounts.facial} />
                  </span>
                </Link>
              )}
            </section>
          )}

          <section
            className="scenestats-summary-grid scenestats-vato-count-grid"
            aria-label="Scenes by vato count"
          >
            <Link
              aria-label="Scenes with 1 vato"
              className="scenestats-summary-card scenestats-category-card linked"
              title="Scenes with 1 vato"
              to={sceneStatsScopedListURL(
                makeSceneStatsVatoCountURL("one"),
                effectiveStudioScope
              )}
            >
              <Icon icon={faUser} className="stats-category-icon-fa" />
              <span>{vatoCountBuckets.one.toLocaleString()}</span>
            </Link>
            <Link
              aria-label="Scenes with 2 vatos"
              className="scenestats-summary-card scenestats-category-card linked"
              title="Scenes with 2 vatos (standard)"
              to={sceneStatsScopedListURL(
                makeSceneStatsVatoCountURL("standard"),
                effectiveStudioScope
              )}
            >
              <Icon icon={faUserGroup} className="stats-category-icon-fa" />
              <span>{vatoCountBuckets.standard.toLocaleString()}</span>
            </Link>
            <Link
              aria-label="Scenes with 3 vatos"
              className="scenestats-summary-card scenestats-category-card linked"
              title="Scenes with 3 vatos (threesome)"
              to={sceneStatsScopedListURL(
                makeSceneStatsVatoCountURL("threesome"),
                effectiveStudioScope
              )}
            >
              <Icon icon={faUsers} className="stats-category-icon-fa" />
              <span>{vatoCountBuckets.threesome.toLocaleString()}</span>
            </Link>
            <Link
              aria-label="Scenes with 4 or more vatos"
              className="scenestats-summary-card scenestats-category-card linked"
              title="Scenes with 4 or more vatos (group scenes)"
              to={sceneStatsScopedListURL(
                makeSceneStatsVatoCountURL("group"),
                effectiveStudioScope
              )}
            >
              <Icon icon={faPeopleGroup} className="stats-category-icon-fa" />
              <span>{vatoCountBuckets.group.toLocaleString()}</span>
            </Link>
          </section>

          {(typeof summary.totalSexTime === "number" ||
            typeof summary.totalOralTime === "number") && (
            <>
              <section
                className="scenestats-summary-grid"
                aria-label="Scene metrics"
              >
                {typeof summary.totalSexTime === "number" &&
                  summary.totalSexTime > 0 && (
                    <div className="scenestats-summary-card">
                      <div className="scenestats-summary-value">
                        {formatDuration(summary.totalSexTime)}
                      </div>
                      <div className="scenestats-summary-label">
                        Total Fucking Time
                      </div>
                    </div>
                  )}
                {typeof summary.totalOralTime === "number" &&
                  summary.totalOralTime > 0 && (
                    <div className="scenestats-summary-card">
                      <div className="scenestats-summary-value">
                        {formatDuration(summary.totalOralTime)}
                      </div>
                      <div className="scenestats-summary-label">
                        Total Sucking Pito Time
                      </div>
                    </div>
                  )}
              </section>
            </>
          )}

          {scenes.length === 0 ? (
            <Alert variant="secondary">No scenes found.</Alert>
          ) : (
            <>
              {/* CUSTOM: ranked scene cards replace the three-slot podium. */}
              <StatsTopCards
                title="Top Scenes"
                variant="scene"
                emptyLabel="No scenes match this ranking."
                items={rankedScenes.map((scene) => ({
                  key: scene.id,
                  title: scene.title || `Scene ${scene.id}`,
                  imagePath: `/scene/${scene.id}/screenshot`,
                  rating100: scene.rating100,
                  to: `/scenes/${scene.id}`,
                  value: (
                    <>
                      {formatMetricValue(scene, metric, roleTagIDs)}{" "}
                      {metricOptionValueLabel(metric)}
                    </>
                  ),
                }))}
                actions={
                  <Form.Group
                    className="scenestats-metric-control"
                    controlId="sceneMetric"
                  >
                    <Form.Label>Rank by</Form.Label>
                    <Form.Control
                      as="select"
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                        setMetric(event.target.value as PodiumMetric)
                      }
                      value={metric}
                    >
                      {metricOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Control>
                  </Form.Group>
                }
              />

              <div className="scenestats-list-toggle">
                <Button
                  onClick={() => setShowSceneList((current) => !current)}
                  size="sm"
                  variant="secondary"
                >
                  {showSceneList ? "Hide scenes list" : "Show scenes list"}
                </Button>
              </div>
              {showSceneList && (
                <SceneStatsSceneList
                  metric={metric}
                  roleTagIDs={roleTagIDs}
                  scenes={rankedScenes}
                />
              )}

              <p className="stats-interaction-help">
                Select a bar or Unknown badge to filter this overview. Release
                year and month links open the next date breakdown.
              </p>
              <div className="stats-chart-grid">
                <StatsBarChart
                  title="By Vato Ethnicity"
                  data={toBars(charts.ethnicity.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  totalNote="A scene counts once for each vato ethnicity, so bars can overlap."
                  unknown={unknownFilter(
                    "ethnicity",
                    charts.ethnicity.unknownCount
                  )}
                />
                <StatsBarChart
                  title="By Vato Country"
                  data={toBars(charts.country.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  totalNote="A scene counts once for each vato country, so bars can overlap."
                  unknown={unknownFilter(
                    "country",
                    charts.country.unknownCount
                  )}
                />
                <StatsBarChart
                  title="By O Count"
                  data={toBars(charts.oCount.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  sortable
                  unknown={unknownFilter("o_count", charts.oCount.unknownCount)}
                />
                <StatsBarChart
                  title="By Vato Count"
                  data={toBars(charts.performerCount.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  sortable
                  unknown={unknownFilter(
                    "performer_count",
                    charts.performerCount.unknownCount
                  )}
                />
                <StatsBarChart
                  title="By Rating"
                  data={toBars(charts.rating.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  sortable
                  unknown={unknownFilter("rating", charts.rating.unknownCount)}
                />
                <StatsBarChart
                  title={
                    hasSelectedYear
                      ? hasSelectedMonth
                        ? "By Release Day"
                        : "By Release Month"
                      : "By Release Year"
                  }
                  data={toBars(releaseChart.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  sortable
                  unknown={unknownFilter(
                    "release_day",
                    releaseChart.unknownCount
                  )}
                  actions={
                    <div className="scenestats-release-chart-actions">
                      <ButtonGroup
                        aria-label="Scene release stats navigation"
                        size="sm"
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
                              className={`btn btn-sm btn-${
                                destination.active ? "primary" : "secondary"
                              }`}
                              aria-current={
                                destination.active ? "page" : undefined
                              }
                              title={`View scene releases ${destination.label.toLowerCase()}`}
                              to={{
                                pathname: destination.path,
                                search: releaseSearch,
                              }}
                            >
                              {destination.label}
                            </Link>
                          ) : (
                            <Button
                              key={destination.label}
                              disabled
                              size="sm"
                              variant="secondary"
                            >
                              {destination.label}
                            </Button>
                          )
                        )}
                      </ButtonGroup>
                      {hasSelectedYear && (
                        <span>
                          {hasSelectedMonth
                            ? `${monthName(
                                selectedMonth,
                                "long"
                              )} ${selectedYear}`
                            : selectedYear}
                        </span>
                      )}
                    </div>
                  }
                />
                <StatsBarChart
                  title="By Duration"
                  data={toBars(charts.duration)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  sortable
                />
              </div>
              {/* CUSTOM: Keep facial charts together because they describe the same activity. */}
              <div className="stats-chart-grid stats-chart-grid--thirds">
                <StatsBarChart
                  title="Has Facial"
                  data={toBars(charts.facialStatus)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                />
                <StatsBarChart
                  title="By Facial Count"
                  data={toBars(charts.facialCount.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  unknown={unknownFilter(
                    "facial_count",
                    charts.facialCount.unknownCount
                  )}
                />
                <StatsBarChart
                  title="By Really Hot Facial Count"
                  data={toBars(charts.reallyHotFacialCount.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  unknown={unknownFilter(
                    "really_hot_facial_count",
                    charts.reallyHotFacialCount.unknownCount
                  )}
                />
              </div>
              {/* CUSTOM: Keep fixed, low-cardinality charts in a space-efficient grid. */}
              <div className="stats-chart-grid stats-chart-grid--compact">
                <StatsBarChart
                  title="By Metallic Rating"
                  data={toBars(charts.metallicRating.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  unknown={unknownFilter(
                    "metallic_rating",
                    charts.metallicRating.unknownCount
                  )}
                />
                <StatsBarChart
                  title="Scene Type"
                  data={toBars(charts.sceneType.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  unknown={unknownFilter(
                    "scene_type",
                    charts.sceneType.unknownCount
                  )}
                />
                <StatsBarChart
                  title="By Resolution"
                  data={toBars(charts.resolution.data)}
                  unit={SCENE_UNIT}
                  total={sceneTotal}
                  unknown={unknownFilter(
                    "resolution",
                    charts.resolution.unknownCount
                  )}
                />
              </div>
            </>
          )}
        </>
      )}
      {activeSection === "insights" && (
        <SceneStatsInsights
          cohort={cohort} // CUSTOM
          dateRange={dateRangeVariable}
          depth={effectiveStudioScope?.depth}
          studioId={effectiveStudioScope?.id}
          studioName={effectiveStudioScope?.name}
        />
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
