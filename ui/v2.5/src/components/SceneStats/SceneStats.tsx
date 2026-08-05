import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  faHand,
  faUser,
  faUserGroup,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { Alert, Button, ButtonGroup, Form, Nav } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, RouteComponentProps, useHistory } from "react-router-dom";
import { FormattedNumber } from "react-intl";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { StatsPage } from "src/components/StatsPage_custom";
import { StatsStudioSelector } from "src/components/StatsStudioSelector_custom";
import type { Studio } from "src/components/Studios/StudioSelect";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
import TextUtils from "src/utils/text";
import NavUtils from "src/utils/navigation";
import { getRatingCardThresholdsForEntity } from "src/utils/ratingCardStyles_custom";
import { metallicRatingChartBucket } from "src/utils/metallicRatingChart_custom";
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
  facialCountPastYear,
  markerHasTag,
  reallyHotFacialCount,
} from "./sceneStatsFacialCounts_custom";
import { sceneStatsPodiumIncludesScene } from "./sceneStatsPodiumEligibility_custom";
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
  makeSceneStatsMarkerTagURL,
  makeSceneStatsVatoCountURL,
  sceneStatsVatoCountBuckets,
} from "./sceneStatsSummary_custom";
import { SceneStatsInsights } from "./SceneStatsInsights_custom";

import "./SceneStats.scss";

const SCENE_STATS_SCENES = gql`
  query SceneStatsScenes($studioId: ID, $depth: Int) {
    sceneStats(studio_id: $studioId, depth: $depth) {
      count
      scenes {
        id
        title
        date
        effective_date
        rating100
        o_counter
        o_counter_past_year
        is_past_year
        is_release_past_year
        duration
        filesize
        performer_count
        performer_count_past_year
        performer_ethnicities
        performer_countries
        scene_markers: marker_tag_groups {
          tag_ids
        }
        tags: tag_ids
        primary_width
        primary_height
        most_recent_o_date
      }
    }
    sceneOrgasmCount(studio_id: $studioId, depth: $depth)
    sceneFacialCount(studio_id: $studioId, depth: $depth)
    totalOrgasmTime(studio_id: $studioId, depth: $depth)
    totalFacialTime(studio_id: $studioId, depth: $depth)
    totalSexTime(studio_id: $studioId, depth: $depth)
    totalOralTime(studio_id: $studioId, depth: $depth)
  }
`;

const SCENE_STATS_ROLE_TAGS = gql`
  query SceneStatsRoleTags($ids: [ID!]) {
    findTags(ids: $ids) {
      tags {
        id
        name
        children {
          id
        }
      }
    }
  }
`;

type SceneStatsMarker = {
  tag_ids: string[];
};

type SceneStatsScene = {
  id: string;
  title?: string | null;
  date?: string | null;
  effective_date?: string | null;
  rating100?: number | null;
  o_counter?: number | null;
  o_counter_past_year: number;
  is_past_year: boolean;
  is_release_past_year: boolean;
  duration: number;
  filesize: number;
  performer_count: number;
  performer_count_past_year: number;
  performer_ethnicities: string[];
  performer_countries: string[];
  scene_markers: SceneStatsMarker[];
  tags: string[];
  primary_width?: number | null;
  primary_height?: number | null;
  most_recent_o_date?: string | null;
};

type SceneStatsData = {
  sceneStats: {
    count: number;
    scenes: SceneStatsScene[];
  };
  sceneOrgasmCount: number;
  sceneFacialCount: number;
  totalOrgasmTime: number;
  totalFacialTime: number;
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
  children: Array<{ id: string }>;
};

type PodiumMetric =
  | "o_counter"
  | "o_counter_past_year"
  | "rating100"
  | "rating100_past_year"
  | "duration"
  | "filesize"
  | "most_recent_o"
  | "performer_count"
  | "performer_count_past_year"
  | "facial_count"
  | "facial_count_past_year";

type ChartCategory =
  | "ethnicity"
  | "country"
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
  {
    key: "o_counter_past_year",
    label: "O Count (past year)",
    valueLabel: "O's",
  },
  { key: "rating100", label: "Rating", valueLabel: "rating" },
  {
    key: "rating100_past_year",
    label: "Rating (past year)",
    valueLabel: "rating",
  },
  { key: "duration", label: "Duration", valueLabel: "" },
  { key: "filesize", label: "File Size", valueLabel: "" },
  { key: "most_recent_o", label: "Most Recent O", valueLabel: "" },
  { key: "performer_count", label: "Vato Count", valueLabel: "vatos" },
  {
    key: "performer_count_past_year",
    label: "Vato Count (past year)",
    valueLabel: "vatos",
  },
  { key: "facial_count", label: "Facial Count", valueLabel: "facials" },
  {
    key: "facial_count_past_year",
    label: "Facial Count (past year)",
    valueLabel: "facials",
  },
];

const chartDefinitions: Record<ChartCategory, string> = {
  ethnicity: "Vato Ethnicity",
  country: "Vato Country",
  performer_count: "Vato Count",
  rating: "Rating",
  metallic_rating: "Metallic Rating",
  release_day: "Release Day",
  facial_status: "Has Facial",
  facial_count: "Number of Facial",
  really_hot_facial_count: "Number of Really Hot Facial",
  scene_type: "Scene Type",
  duration: "Length/Duration",
  resolution: "Resolution",
};

const CHART_INITIAL_BAR_COUNT = 48;
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
  if (!roleTag) return undefined;
  return new Set([roleTag.id, ...roleTag.children.map((child) => child.id)]);
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

function sceneDuration(scene: SceneStatsScene) {
  return scene.duration;
}

function sceneFileSize(scene: SceneStatsScene) {
  return scene.filesize;
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
    case "o_counter_past_year":
      return scene.o_counter_past_year;
    case "rating100":
    case "rating100_past_year":
      return scene.rating100 ?? 0;
    case "duration":
      return sceneDuration(scene);
    case "filesize":
      return sceneFileSize(scene);
    case "most_recent_o":
      return mostRecentOTime(scene);
    case "performer_count":
      return scene.performer_count;
    case "performer_count_past_year":
      return scene.performer_count_past_year;
    case "facial_count":
      return facialCount(scene, roleTagIDs.facial);
    case "facial_count_past_year":
      return facialCountPastYear(scene, roleTagIDs.facial);
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
  if (metric === "rating100" || metric === "rating100_past_year")
    return `${value}/100`;
  if (metric === "most_recent_o") return mostRecentOLabel(scene);
  return value.toLocaleString();
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
  return Math.round(sceneDuration(scene) / 60);
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

function sceneHasTagID(scene: SceneStatsScene, tagId?: string | null) {
  return !!tagId && scene.tags.includes(tagId);
}

function sceneMetallicRating(
  scene: SceneStatsScene,
  configuration: ReturnType<typeof useConfigurationContext>["configuration"]
) {
  const uiConfig = configuration?.ui;
  const overrideTagIds = uiConfig?.ratingCardOverrideTagIds;
  const goatTagId = uiConfig?.roleTagIds?.goatTagId;

  if (
    sceneHasTagID(scene, overrideTagIds?.royalSapphireTagId) ||
    sceneHasTagID(scene, goatTagId)
  ) {
    return "royal_sapphire";
  }
  if (sceneHasTagID(scene, overrideTagIds?.goldTagId)) return "gold";
  if (sceneHasTagID(scene, overrideTagIds?.silverTagId)) return "silver";
  if (sceneHasTagID(scene, overrideTagIds?.bronzeTagId)) return "bronze";

  const rating = scene.rating100;
  if (rating === undefined || rating === null) return undefined;

  const thresholds = getRatingCardThresholdsForEntity(
    uiConfig?.ratingCardThresholds,
    "scene"
  );
  if (rating >= thresholds.royalSapphire) return "royal_sapphire";
  if (rating >= thresholds.gold) return "gold";
  if (rating >= thresholds.silver) return "silver";
  if (rating >= thresholds.bronze) return "bronze";
  return undefined;
}

function sceneMatchesFilter(
  scene: SceneStatsScene,
  filter: ChartFilter,
  roleTagIDs: RoleTagIDSets,
  configuration: ReturnType<typeof useConfigurationContext>["configuration"]
) {
  switch (filter.category) {
    case "ethnicity":
      return scene.performer_ethnicities.some(
        (ethnicity) => cleanValue(ethnicity) === filter.value
      );
    case "country":
      return scene.performer_countries.some(
        (country) => cleanValue(country) === filter.value
      );
    case "performer_count":
      return (
        String(sceneStatsPositiveCount(scene.performer_count)) === filter.value
      );
    case "rating":
      return sceneStatsRatingBucket(scene.rating100) === filter.value;
    case "metallic_rating": {
      const metallicRating = sceneMetallicRating(scene, configuration);
      return (
        metallicRatingChartBucket(scene.rating100, metallicRating, true)
          ?.key === filter.value
      );
    }
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

function buildSceneCharts(
  scenes: SceneStatsScene[],
  roleTagIDs: RoleTagIDSets,
  configuration: ReturnType<typeof useConfigurationContext>["configuration"],
  selectedYear?: number,
  selectedMonth?: number,
  navigationBase = "/scenestats"
) {
  const ethnicityBuckets = new Map<string, ChartDatum>();
  const countryBuckets = new Map<string, ChartDatum>();
  const performerCountBuckets = new Map<string, ChartDatum>();
  const ratingBuckets = new Map<string, ChartDatum>();
  const metallicRatingBuckets = new Map<string, ChartDatum>();
  const releaseBuckets = new Map<string, ChartDatum>();
  const facialStatusBuckets = new Map<string, ChartDatum>();
  const facialCountBuckets = new Map<string, ChartDatum>();
  const reallyHotFacialCountBuckets = new Map<string, ChartDatum>();
  const sceneTypeBuckets = new Map<string, ChartDatum>();
  const durationBuckets = new Map<string, ChartDatum>();
  const resolutionBuckets = new Map<string, ChartDatum>();
  let unknownEthnicityCount = 0;
  let unknownCountryCount = 0;
  let unknownPerformerCount = 0;
  let unknownRatingCount = 0;
  let unknownMetallicRatingCount = 0;
  let unknownReleaseCount = 0;
  let unknownFacialCount = 0;
  let unknownReallyHotFacialCount = 0;
  let unknownSceneTypeCount = 0;
  let unknownResolutionCount = 0;

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

    const metallicRating = metallicRatingChartBucket(
      scene.rating100,
      sceneMetallicRating(scene, configuration),
      true
    );
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

    const year = releaseYear(scene);
    if (!selectedYear) {
      if (year === undefined) {
        unknownReleaseCount += 1;
      } else {
        addDatum(
          releaseBuckets,
          String(year),
          String(year),
          year,
          undefined,
          `${navigationBase}/${year}`
        );
      }
    } else if (year === selectedYear) {
      const month = releaseMonth(scene);
      if (!selectedMonth) {
        if (month === undefined) {
          unknownReleaseCount += 1;
        } else {
          addDatum(
            releaseBuckets,
            `${year}-${month}`,
            monthName(month),
            month,
            undefined,
            `${navigationBase}/${year}/${month}`
          );
        }
      } else if (month === selectedMonth) {
        const day = releaseDay(scene);
        if (day === undefined) {
          unknownReleaseCount += 1;
        } else {
          const date = `${year}-${String(month).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;
          const label = dayLabel(year, month, day);
          addDatum(releaseBuckets, date, label, day, {
            category: "release_day",
            label,
            value: date,
          });
        }
      }
    }

    const statusLabels: Record<string, string> = {
      rh: "Yes RHOrgasm",
      regular: "Yes regular",
      no: "No",
    };
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

    const typeLabels: Record<string, string> = {
      sex: "Sex",
      oral: "Oral",
      solo: "Jerk",
    };
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
    release: {
      data: Array.from(releaseBuckets.values()).sort(numericSort),
      unknownCount: unknownReleaseCount,
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

const SceneStatsPodium: React.FC<{
  roleTagIDs: RoleTagIDSets;
  scenes: SceneStatsScene[];
  metric: PodiumMetric;
}> = ({ roleTagIDs, scenes, metric }) => {
  const metricOption = metricOptions.find((option) => option.key === metric);
  const topScenes = scenes.slice(0, 3);
  const ranks = [1, 2, 3] as const;

  return (
    <div className="scenestats-podium" aria-label="Top scenes">
      {ranks.map((rank, index) => {
        const scene = topScenes[index];
        const rankClass =
          rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";

        return (
          <div
            className={`scenestats-podium-card ${rankClass}`}
            key={scene?.id ?? `empty-${rank}`}
          >
            {scene ? (
              <>
                <div className="scenestats-podium-rank">{rank}</div>
                <img
                  alt={scene.title ?? ""}
                  className="scenestats-podium-image"
                  loading="lazy"
                  src={`/scene/${scene.id}/screenshot`}
                />
                <Link
                  className="scenestats-podium-name"
                  to={`/scenes/${scene.id}`}
                >
                  {scene.title || `Scene ${scene.id}`}
                </Link>
                <div className="scenestats-podium-value">
                  {formatMetricValue(scene, metric, roleTagIDs)}{" "}
                  {metricOption?.valueLabel}
                </div>
              </>
            ) : (
              <div className="scenestats-podium-empty">No scene</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SceneStatsChart: React.FC<{
  actions?: React.ReactNode;
  data: ChartDatum[];
  label: string;
  onSelect: (filter: ChartFilter) => void;
  unknownCount?: number;
}> = ({ actions, data, label, onSelect, unknownCount = 0 }) => {
  const history = useHistory();
  const [showAllBars, setShowAllBars] = useState(false);
  const visibleData = showAllBars
    ? data
    : data.slice(0, CHART_INITIAL_BAR_COUNT);
  const max = Math.max(...data.map((datum) => datum.count), 1);
  const hiddenCount = Math.max(data.length - visibleData.length, 0);

  useEffect(() => {
    setShowAllBars(false);
  }, [data, label]);

  return (
    <section className="scenestats-chart-panel">
      <div className="scenestats-chart-heading">
        <h2>{label}</h2>
        <div className="scenestats-chart-actions">
          {actions}
          {unknownCount > 0 && (
            <span className="scenestats-unknown-count">
              Unknown: {unknownCount.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="scenestats-empty">No data</div>
      ) : (
        <div className="scenestats-bars" role="list">
          {visibleData.map((datum) => (
            <button
              className="scenestats-bar-cell"
              disabled={!datum.filter && !datum.path}
              key={datum.key}
              onClick={() => {
                if (datum.path) history.push(datum.path);
                if (datum.filter) onSelect(datum.filter);
              }}
              type="button"
              role="listitem"
            >
              <span className="scenestats-bar-count">
                {datum.count.toLocaleString()}
              </span>
              <span className="scenestats-bar-track">
                <span
                  className="scenestats-bar-fill"
                  style={{
                    height: `${Math.max((datum.count / max) * 100, 6)}%`,
                  }}
                />
              </span>
              <span className="scenestats-bar-label" title={datum.label}>
                {datum.label}
              </span>
            </button>
          ))}
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="scenestats-chart-more">
          <Button
            onClick={() => setShowAllBars(true)}
            size="sm"
            variant="secondary"
          >
            Show all {data.length.toLocaleString()}
          </Button>
        </div>
      )}
    </section>
  );
};

const SceneStatsFilterBar: React.FC<{
  filters: ChartFilter[];
  hasSelectedMonth: boolean;
  hasSelectedYear: boolean;
  onBack: () => void;
  onClear: () => void;
  selectedMonth: number;
  selectedYear: number;
}> = ({
  filters,
  hasSelectedMonth,
  hasSelectedYear,
  onBack,
  onClear,
  selectedMonth,
  selectedYear,
}) => {
  if (filters.length === 0 && !hasSelectedYear) return null;

  return (
    <div
      className="scenestats-filter-bar"
      aria-label="Active SceneStats filters"
    >
      <Button onClick={onBack} size="sm" variant="secondary">
        Back
      </Button>
      <Button onClick={onClear} size="sm" variant="secondary">
        Clear
      </Button>
      <div className="scenestats-filter-list">
        {hasSelectedYear && (
          <span className="scenestats-filter-chip">
            Release:{" "}
            {hasSelectedMonth
              ? `${monthName(selectedMonth, "long")} ${selectedYear}`
              : selectedYear}
          </span>
        )}
        {filters.map((filter, index) => (
          <span
            className="scenestats-filter-chip"
            key={`${filter.category}-${filter.value}-${index}`}
          >
            {chartDefinitions[filter.category]}: {filter.label}
          </span>
        ))}
      </div>
    </div>
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
  const [selectedStudio, setSelectedStudio] = useState<Studio>();
  const [includeChildStudios, setIncludeChildStudios] = useState(true);
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
    ? `${studioScope.name} SceneStats`
    : "SceneStats";
  const titleProps = useTitleProps(pageTitle);
  const history = useHistory();
  const [metric, setMetric] = useState<PodiumMetric>("o_counter");
  const [filters, setFilters] = useState<ChartFilter[]>([]);
  const [showSceneList, setShowSceneList] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "insights">(
    "overview"
  );
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
        stringRoleTagId(roleTagIds.orgasmTagId),
        stringRoleTagId(roleTagIds.reallyHotTagId),
      ].filter((id): id is string => !!id),
    [roleTagIds]
  );

  const sceneQuery = useQuery<SceneStatsData>(SCENE_STATS_SCENES, {
    variables: {
      depth: effectiveStudioScope?.depth,
      studioId: effectiveStudioScope?.id,
    },
  });
  const roleTagsQuery = useQuery<SceneStatsRoleTagsData>(
    SCENE_STATS_ROLE_TAGS,
    {
      skip: roleTagIDList.length === 0,
      variables: { ids: roleTagIDList },
    }
  );
  const scenes = useMemo(
    () => sceneQuery.data?.sceneStats.scenes ?? [],
    [sceneQuery.data?.sceneStats.scenes]
  );
  const vatoCountBuckets = useMemo(
    () =>
      sceneStatsVatoCountBuckets(scenes.map((scene) => scene.performer_count)),
    [scenes]
  );
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
  const orgasmTag = roleTagsByID.get(
    stringRoleTagId(roleTagIds.orgasmTagId) ?? ""
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
  const categoryCounts = useMemo(
    () =>
      scenes.reduce(
        (counts, scene) => {
          const type = sceneType(scene, roleTagIDs);
          if (type) counts[type] += 1;
          if (sceneHasTag(scene, roleTagIDs.facial)) counts.facial += 1;
          return counts;
        },
        { sex: 0, oral: 0, solo: 0, facial: 0 }
      ),
    [roleTagIDs, scenes]
  );
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
  const rankedScenes = useMemo(
    () =>
      filteredScenes
        .filter((scene) => sceneStatsPodiumIncludesScene(scene, metric))
        .sort(
          (a, b) =>
            metricValue(b, metric, roleTagIDs) -
              metricValue(a, metric, roleTagIDs) ||
            (a.title ?? "").localeCompare(b.title ?? "", undefined, {
              sensitivity: "base",
            })
        ),
    [filteredScenes, metric, roleTagIDs]
  );
  const charts = useMemo(
    () =>
      buildSceneCharts(
        filteredScenes,
        roleTagIDs,
        configuration,
        hasSelectedYear ? selectedYear : undefined,
        hasSelectedMonth ? selectedMonth : undefined,
        navigationBase
      ),
    [
      configuration,
      filteredScenes,
      hasSelectedMonth,
      hasSelectedYear,
      roleTagIDs,
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
    if (hasSelectedYear) history.push(navigationBase);
  }

  function selectStudio(studio?: Studio) {
    setSelectedStudio(studio);
    setFilters([]);
    if (hasSelectedYear) history.push(navigationBase);
  }

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

  if (sceneQuery.loading || roleTagsQuery.loading || !sceneQuery.data)
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

  const summary = sceneQuery.data;

  return (
    <StatsPage className="scenestats-page" showNavigation={!studioScope}>
      <Helmet {...titleProps} />

      <header className="scenestats-header">
        <div>
          <h1>{pageTitle}</h1>
          <div className="scenestats-total">
            {filters.length > 0 || hasSelectedYear
              ? formatStatsDrilldownTotal(
                  filteredScenes.length,
                  scenes.length,
                  "scene",
                  "scenes"
                )
              : formatStatsTotal(scenes.length, "scene", "scenes")}
          </div>
        </div>
        {!studioScope && (
          <StatsStudioSelector
            includeChildStudios={includeChildStudios}
            onIncludeChildStudiosChange={(include) => {
              setIncludeChildStudios(include);
              setFilters([]);
            }}
            onStudioChange={selectStudio}
            studio={selectedStudio}
          />
        )}
      </header>

      <Nav
        activeKey={activeSection}
        className="scenestats-sections"
        onSelect={(key) =>
          setActiveSection(key === "insights" ? "insights" : "overview")
        }
        variant="tabs"
      >
        <Nav.Item>
          <Nav.Link eventKey="overview">Overview</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="insights">Activity &amp; Ratings</Nav.Link>
        </Nav.Item>
      </Nav>

      {activeSection === "overview" && (
        <>
          {(sexTag || oralTag || soloTag || facialTag) && (
            <section
              className="scenestats-summary-grid scenestats-category-grid"
              aria-label="Scene category metrics"
            >
              {sexTag && (
                <Button
                  className="scenestats-summary-card scenestats-category-card stats-category-button sex-stats-button"
                  href={sceneStatsScopedListURL(
                    NavUtils.makeScenesWithMarkerTagUrl(sexTag.id, sexTag.name),
                    effectiveStudioScope
                  )}
                  disabled={categoryCounts.sex === 0}
                  title="Sex Scene"
                >
                  <img src={gaySvg} alt="Sex" className="stats-category-icon" />
                  <span>
                    <FormattedNumber value={categoryCounts.sex} />
                  </span>
                </Button>
              )}
              {oralTag && (
                <Button
                  className="scenestats-summary-card scenestats-category-card stats-category-button oral-stats-button"
                  href={sceneStatsScopedListURL(
                    NavUtils.makeScenesWithExclusiveMarkerTagUrl(
                      oralTag.id,
                      oralTag.name,
                      sexTag ? [{ id: sexTag.id, label: sexTag.name }] : [],
                      -1
                    ),
                    effectiveStudioScope
                  )}
                  disabled={categoryCounts.oral === 0}
                  title="Oral Scene"
                >
                  <img
                    src={mouthSvg}
                    alt="Oral"
                    className="stats-category-icon"
                  />
                  <span>
                    <FormattedNumber value={categoryCounts.oral} />
                  </span>
                </Button>
              )}
              {soloTag && (
                <Button
                  className="scenestats-summary-card scenestats-category-card stats-category-button solo-stats-button"
                  href={sceneStatsScopedListURL(
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
                  disabled={categoryCounts.solo === 0}
                  title="Solo Scene"
                >
                  <Icon icon={faHand} className="stats-category-icon-fa" />
                  <span>
                    <FormattedNumber value={categoryCounts.solo} />
                  </span>
                </Button>
              )}
              {facialTag && (
                <Button
                  className="scenestats-summary-card scenestats-category-card stats-category-button facial-stats-button"
                  href={sceneStatsScopedListURL(
                    NavUtils.makeScenesWithMarkerTagUrl(
                      facialTag.id,
                      facialTag.name,
                      -1
                    ),
                    effectiveStudioScope
                  )}
                  disabled={categoryCounts.facial === 0}
                  title="Facial Scene"
                >
                  <img
                    src={facialPng}
                    alt="Facial"
                    className="stats-category-icon"
                  />
                  <span>
                    <FormattedNumber value={categoryCounts.facial} />
                  </span>
                </Button>
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
              aria-label="Scenes with 2 or 3 vatos"
              className="scenestats-summary-card scenestats-category-card linked"
              title="Scenes with 2 or 3 vatos (standard)"
              to={sceneStatsScopedListURL(
                makeSceneStatsVatoCountURL("standard"),
                effectiveStudioScope
              )}
            >
              <Icon icon={faUserGroup} className="stats-category-icon-fa" />
              <span>{vatoCountBuckets.standard.toLocaleString()}</span>
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
              <Icon icon={faUsers} className="stats-category-icon-fa" />
              <span>{vatoCountBuckets.group.toLocaleString()}</span>
            </Link>
          </section>

          {(typeof summary.sceneOrgasmCount === "number" ||
            typeof summary.sceneFacialCount === "number" ||
            typeof summary.totalOrgasmTime === "number" ||
            typeof summary.totalFacialTime === "number" ||
            typeof summary.totalSexTime === "number" ||
            typeof summary.totalOralTime === "number") && (
            <section
              className="scenestats-summary-grid"
              aria-label="Scene metrics"
            >
              {typeof summary.sceneOrgasmCount === "number" && (
                <Link
                  className="scenestats-summary-card linked"
                  title="Each matching marker counts once per assigned top vato (minimum 1), while the linked search counts marker rows. The search also includes 2nd-camera markers that this total excludes, so the numbers can differ."
                  to={sceneStatsScopedListURL(
                    makeSceneStatsMarkerTagURL(orgasmTag),
                    effectiveStudioScope
                  )}
                >
                  <div className="scenestats-summary-value">
                    {summary.sceneOrgasmCount.toLocaleString()}
                  </div>
                  <div className="scenestats-summary-label">Total orgasms</div>
                </Link>
              )}
              {typeof summary.totalOrgasmTime === "number" &&
                summary.totalOrgasmTime > 0 && (
                  <div className="scenestats-summary-card">
                    <div className="scenestats-summary-value">
                      {formatDuration(summary.totalOrgasmTime)}
                    </div>
                    <div className="scenestats-summary-label">
                      Total orgasm time
                    </div>
                  </div>
                )}
              {typeof summary.sceneFacialCount === "number" && (
                <Link
                  className="scenestats-summary-card linked"
                  title="Each matching marker counts once per assigned top vato (minimum 1), while the linked search counts marker rows. The search also includes 2nd-camera markers that this total excludes, so the numbers can differ."
                  to={sceneStatsScopedListURL(
                    makeSceneStatsMarkerTagURL(facialTag),
                    effectiveStudioScope
                  )}
                >
                  <div className="scenestats-summary-value">
                    {summary.sceneFacialCount.toLocaleString()}
                  </div>
                  <div className="scenestats-summary-label">Total facials</div>
                </Link>
              )}
              {typeof summary.totalFacialTime === "number" &&
                summary.totalFacialTime > 0 && (
                  <div className="scenestats-summary-card">
                    <div className="scenestats-summary-value">
                      {formatDuration(summary.totalFacialTime)}
                    </div>
                    <div className="scenestats-summary-label">
                      Total facial time
                    </div>
                  </div>
                )}
              {typeof summary.totalSexTime === "number" &&
                summary.totalSexTime > 0 && (
                  <div className="scenestats-summary-card">
                    <div className="scenestats-summary-value">
                      {formatDuration(summary.totalSexTime)}
                    </div>
                    <div className="scenestats-summary-label">
                      Total Fucking time
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
                      Total Sucking Pito time
                    </div>
                  </div>
                )}
            </section>
          )}

          {scenes.length === 0 ? (
            <Alert variant="secondary">No scenes found.</Alert>
          ) : (
            <>
              <div className="scenestats-podium-toolbar">
                <h2>Top Scenes</h2>
                <Form.Group
                  className="scenestats-metric-control"
                  controlId="sceneMetric"
                >
                  <Form.Label>Podium metric</Form.Label>
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
              </div>
              <SceneStatsPodium
                scenes={rankedScenes}
                metric={metric}
                roleTagIDs={roleTagIDs}
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

              <div className="scenestats-chart-grid">
                <SceneStatsChart
                  data={charts.ethnicity.data}
                  label="By Vato Ethnicity"
                  onSelect={addFilter}
                  unknownCount={charts.ethnicity.unknownCount}
                />
                <SceneStatsChart
                  data={charts.country.data}
                  label="By Vato Country"
                  onSelect={addFilter}
                  unknownCount={charts.country.unknownCount}
                />
                <SceneStatsChart
                  data={charts.performerCount.data}
                  label="By Vato Count"
                  onSelect={addFilter}
                  unknownCount={charts.performerCount.unknownCount}
                />
                <SceneStatsChart
                  data={charts.rating.data}
                  label="By Rating"
                  onSelect={addFilter}
                  unknownCount={charts.rating.unknownCount}
                />
                <SceneStatsChart
                  data={charts.metallicRating.data}
                  label="By Metallic Rating"
                  onSelect={addFilter}
                  unknownCount={charts.metallicRating.unknownCount}
                />
                <SceneStatsChart
                  actions={
                    <div className="scenestats-release-chart-actions">
                      <ButtonGroup
                        aria-label="Scene release stats navigation"
                        size="sm"
                      >
                        <Button
                          disabled={!hasSelectedYear}
                          onClick={() => history.push(navigationBase)}
                          variant={!hasSelectedYear ? "primary" : "secondary"}
                        >
                          By Year
                        </Button>
                        <Button
                          disabled={!hasSelectedYear}
                          onClick={() =>
                            history.push(`${navigationBase}/${selectedYear}`)
                          }
                          variant={
                            hasSelectedYear && !hasSelectedMonth
                              ? "primary"
                              : "secondary"
                          }
                        >
                          By Month
                        </Button>
                        <Button
                          disabled={!hasSelectedYear || !hasSelectedMonth}
                          onClick={() =>
                            history.push(
                              `${navigationBase}/${selectedYear}/${selectedMonth}`
                            )
                          }
                          variant={hasSelectedMonth ? "primary" : "secondary"}
                        >
                          By Day
                        </Button>
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
                  data={charts.release.data}
                  label={
                    hasSelectedYear
                      ? hasSelectedMonth
                        ? "By Release Day"
                        : "By Release Month"
                      : "By Release Year"
                  }
                  onSelect={addFilter}
                  unknownCount={charts.release.unknownCount}
                />
                <SceneStatsChart
                  data={charts.facialStatus}
                  label="Has Facial"
                  onSelect={addFilter}
                />
                <SceneStatsChart
                  data={charts.facialCount.data}
                  label="By Number of Facial"
                  onSelect={addFilter}
                  unknownCount={charts.facialCount.unknownCount}
                />
                <SceneStatsChart
                  data={charts.reallyHotFacialCount.data}
                  label="By Number of Really Hot Facial"
                  onSelect={addFilter}
                  unknownCount={charts.reallyHotFacialCount.unknownCount}
                />
                <SceneStatsChart
                  data={charts.sceneType.data}
                  label="Scene Type"
                  onSelect={addFilter}
                  unknownCount={charts.sceneType.unknownCount}
                />
                <SceneStatsChart
                  data={charts.duration}
                  label="By Length/Duration"
                  onSelect={addFilter}
                />
                <SceneStatsChart
                  data={charts.resolution.data}
                  label="By Resolution"
                  onSelect={addFilter}
                  unknownCount={charts.resolution.unknownCount}
                />
              </div>
            </>
          )}
          <SceneStatsFilterBar
            filters={filters}
            hasSelectedMonth={hasSelectedMonth}
            hasSelectedYear={hasSelectedYear}
            onBack={() => {
              if (filters.length > 0) {
                setFilters((current) => current.slice(0, -1));
              } else {
                clearReleaseSelection();
              }
            }}
            onClear={() => {
              setFilters([]);
              clearReleaseSelection();
            }}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </>
      )}
      {activeSection === "insights" && (
        <SceneStatsInsights
          depth={effectiveStudioScope?.depth}
          studioId={effectiveStudioScope?.id}
          studioName={effectiveStudioScope?.name}
        />
      )}
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
