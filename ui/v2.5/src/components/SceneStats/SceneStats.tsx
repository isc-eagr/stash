import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  faHand,
  faUser,
  faUserGroup,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { Alert, Button, ButtonGroup, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, RouteComponentProps, useHistory } from "react-router-dom";
import { FormattedNumber } from "react-intl";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { StatsPage } from "src/components/StatsPage_custom";
import { useStats } from "src/core/StashService";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
import TextUtils from "src/utils/text";
import NavUtils from "src/utils/navigation";
import { getRatingCardThresholdsForEntity } from "src/utils/ratingCardStyles_custom";
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
  makeSceneStatsMarkerTagURL,
  makeSceneStatsVatoCountURL,
  sceneStatsVatoCountBuckets,
} from "./sceneStatsSummary_custom";

import "./SceneStats.scss";

const SCENE_STATS_SCENES = gql`
  query SceneStatsScenes {
    sceneStats {
      count
      scenes {
        id
        title
        date
        effective_date
        rating100
        o_counter
        duration
        filesize
        performer_count
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

const ORGASM_TOTAL_COUNT = gql`
  query SceneStatsOrgasmCount {
    sceneOrgasmCount
  }
`;

const FACIAL_TOTAL_COUNT = gql`
  query SceneStatsFacialCount {
    sceneFacialCount
  }
`;

const TOTAL_ORGASM_TIME = gql`
  query SceneStatsTotalOrgasmTime {
    totalOrgasmTime
  }
`;

const TOTAL_FACIAL_TIME = gql`
  query SceneStatsTotalFacialTime {
    totalFacialTime
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
  duration: number;
  filesize: number;
  performer_count: number;
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
  | "rating100"
  | "duration"
  | "filesize"
  | "most_recent_o"
  | "performer_count";

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

type MetallicRatingTier = "bronze" | "silver" | "gold" | "royal_sapphire";

interface IRouteParams {
  year?: string;
  month?: string;
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

const metallicRatingTiers: Array<{
  key: MetallicRatingTier;
  label: string;
  sortValue: number;
}> = [
  { key: "bronze", label: "Bronze", sortValue: 1 },
  { key: "silver", label: "Silver", sortValue: 2 },
  { key: "gold", label: "Gold", sortValue: 3 },
  { key: "royal_sapphire", label: "Royal Sapphire", sortValue: 4 },
];

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
  const date = releaseDate(scene);
  if (!date || !/^\d{4}/.test(date)) return undefined;
  return Number(date.slice(0, 4));
}

function releaseMonth(scene: SceneStatsScene) {
  const date = releaseDate(scene);
  if (!date || !/^\d{4}-\d{2}/.test(date)) return undefined;
  return Number(date.slice(5, 7));
}

function releaseDay(scene: SceneStatsScene) {
  const date = releaseDate(scene);
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return undefined;
  return Number(date.slice(8, 10));
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

function metricValue(scene: SceneStatsScene, metric: PodiumMetric) {
  switch (metric) {
    case "o_counter":
      return scene.o_counter ?? 0;
    case "rating100":
      return scene.rating100 ?? 0;
    case "duration":
      return sceneDuration(scene);
    case "filesize":
      return sceneFileSize(scene);
    case "most_recent_o":
      return mostRecentOTime(scene);
    case "performer_count":
      return scene.performer_count;
    default:
      return 0;
  }
}

function formatMetricValue(scene: SceneStatsScene, metric: PodiumMetric) {
  const value = metricValue(scene, metric);
  if (metric === "duration") return TextUtils.secondsAsTimeString(value, 3);
  if (metric === "filesize") return <FileSize size={value} />;
  if (metric === "rating100") return `${value}/100`;
  if (metric === "most_recent_o") return mostRecentOLabel(scene);
  return value.toLocaleString();
}

function metricOptionLabel(metric: PodiumMetric) {
  return metricOptions.find((option) => option.key === metric)?.label ?? metric;
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

function bucketRating(value?: number | null) {
  if (value === null || value === undefined) return undefined;
  const rating = Math.max(0, Math.round(value));
  const start = Math.floor(rating / 5) * 5;
  const end = start + 4;
  return `${start}-${end}`;
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
  if (sceneHasTag(scene, roleTagIDs.sex)) return "sex";
  if (sceneHasTag(scene, roleTagIDs.oral)) return "oral";
  if (sceneHasTag(scene, roleTagIDs.solo)) return "solo";
  return "other";
}

function sceneResolutionLabel(scene: SceneStatsScene) {
  return scene.primary_width && scene.primary_height
    ? TextUtils.resolution(scene.primary_width, scene.primary_height)
    : undefined;
}

function sceneHasTagID(scene: SceneStatsScene, tagId?: string | null) {
  return !!tagId && scene.tags.includes(tagId);
}

function metallicRatingSort(value?: string) {
  return (
    metallicRatingTiers.find((tier) => tier.key === value)?.sortValue ??
    Number.MAX_SAFE_INTEGER
  );
}

function metallicRatingLabel(value?: string) {
  return metallicRatingTiers.find((tier) => tier.key === value)?.label;
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
      return String(scene.performer_count) === filter.value;
    case "rating":
      return bucketRating(scene.rating100) === filter.value;
    case "metallic_rating":
      return sceneMetallicRating(scene, configuration) === filter.value;
    case "release_day":
      return releaseDate(scene)?.slice(0, 10) === filter.value;
    case "facial_status":
      return facialStatus(scene, roleTagIDs) === filter.value;
    case "facial_count":
      return String(facialCount(scene, roleTagIDs.facial)) === filter.value;
    case "really_hot_facial_count":
      return String(reallyHotFacialCount(scene, roleTagIDs)) === filter.value;
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
  selectedMonth?: number
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

    const performerCount = scene.performer_count;
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

    const ratingBucket = bucketRating(scene.rating100);
    if (ratingBucket) {
      addDatum(
        ratingBuckets,
        ratingBucket,
        ratingBucket,
        Number(ratingBucket.split("-")[0]),
        { category: "rating", label: ratingBucket, value: ratingBucket }
      );
    }

    const metallicRating = sceneMetallicRating(scene, configuration);
    const metallicLabel = metallicRatingLabel(metallicRating);
    if (metallicRating && metallicLabel) {
      addDatum(
        metallicRatingBuckets,
        metallicRating,
        metallicLabel,
        metallicRatingSort(metallicRating),
        {
          category: "metallic_rating",
          label: metallicLabel,
          value: metallicRating,
        }
      );
    }

    const year = releaseYear(scene);
    if (year && !selectedYear) {
      addDatum(
        releaseBuckets,
        String(year),
        String(year),
        year,
        undefined,
        `/scenestats/${year}`
      );
    } else if (year && year === selectedYear) {
      const month = releaseMonth(scene);
      if (month && !selectedMonth) {
        addDatum(
          releaseBuckets,
          `${year}-${month}`,
          monthName(month),
          month,
          undefined,
          `/scenestats/${year}/${month}`
        );
      } else if (month && month === selectedMonth) {
        const day = releaseDay(scene);
        if (day) {
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

    const sceneFacialCount = facialCount(scene, roleTagIDs.facial);
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

    const sceneReallyHotFacialCount = reallyHotFacialCount(scene, roleTagIDs);
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

    const typeLabels: Record<string, string> = {
      sex: "Sex",
      oral: "Oral",
      solo: "Jerk",
      other: "Other",
    };
    const type = sceneType(scene, roleTagIDs);
    addDatum(
      sceneTypeBuckets,
      type,
      typeLabels[type],
      type === "sex" ? 1 : type === "oral" ? 2 : type === "solo" ? 3 : 4,
      {
        category: "scene_type",
        label: typeLabels[type],
        value: type,
      }
    );

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
    performerCount: Array.from(performerCountBuckets.values()).sort(
      numericSort
    ),
    rating: Array.from(ratingBuckets.values()).sort(numericSort),
    metallicRating: Array.from(metallicRatingBuckets.values()).sort(
      numericSort
    ),
    release: Array.from(releaseBuckets.values()).sort(numericSort),
    facialStatus: Array.from(facialStatusBuckets.values()).sort(numericSort),
    facialCount: Array.from(facialCountBuckets.values()).sort(numericSort),
    reallyHotFacialCount: Array.from(reallyHotFacialCountBuckets.values()).sort(
      numericSort
    ),
    sceneType: Array.from(sceneTypeBuckets.values()).sort(numericSort),
    duration: Array.from(durationBuckets.values()).sort(numericSort),
    resolution: {
      data: Array.from(resolutionBuckets.values()).sort(countSort),
      unknownCount: unknownResolutionCount,
    },
  };
}

const SceneStatsPodium: React.FC<{
  scenes: SceneStatsScene[];
  metric: PodiumMetric;
}> = ({ scenes, metric }) => {
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
                  {formatMetricValue(scene, metric)} {metricOption?.valueLabel}
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
  scenes: SceneStatsScene[];
}> = ({ metric, scenes }) => {
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
            {formatMetricValue(scene, metric)}
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

const SceneStats: React.FC<RouteComponentProps<IRouteParams>> = ({ match }) => {
  const titleProps = useTitleProps("SceneStats");
  const history = useHistory();
  const [metric, setMetric] = useState<PodiumMetric>("o_counter");
  const [filters, setFilters] = useState<ChartFilter[]>([]);
  const [showSceneList, setShowSceneList] = useState(false);
  const selectedYear = Number(match.params.year);
  const selectedMonth = Number(match.params.month);
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

  const {
    data: statsData,
    error: statsError,
    loading: statsLoading,
  } = useStats();
  const sceneQuery = useQuery<SceneStatsData>(SCENE_STATS_SCENES);
  const roleTagsQuery = useQuery<SceneStatsRoleTagsData>(
    SCENE_STATS_ROLE_TAGS,
    {
      skip: roleTagIDList.length === 0,
      variables: { ids: roleTagIDList },
    }
  );
  const { data: orgasmCountData } = useQuery<{ sceneOrgasmCount: number }>(
    ORGASM_TOTAL_COUNT
  );
  const { data: facialCountData } = useQuery<{ sceneFacialCount: number }>(
    FACIAL_TOTAL_COUNT
  );
  const { data: orgasmTimeData } = useQuery<{ totalOrgasmTime: number }>(
    TOTAL_ORGASM_TIME
  );
  const { data: facialTimeData } = useQuery<{ totalFacialTime: number }>(
    TOTAL_FACIAL_TIME
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
      [...filteredScenes].sort(
        (a, b) =>
          metricValue(b, metric) - metricValue(a, metric) ||
          (a.title ?? "").localeCompare(b.title ?? "", undefined, {
            sensitivity: "base",
          })
      ),
    [filteredScenes, metric]
  );
  const charts = useMemo(
    () =>
      buildSceneCharts(
        filteredScenes,
        roleTagIDs,
        configuration,
        hasSelectedYear ? selectedYear : undefined,
        hasSelectedMonth ? selectedMonth : undefined
      ),
    [
      configuration,
      filteredScenes,
      hasSelectedMonth,
      hasSelectedYear,
      roleTagIDs,
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
    if (hasSelectedYear) history.push("/scenestats");
  }

  if (statsError)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage className="scenestats-page">
          <span>{statsError.message}</span>
        </StatsPage>
      </>
    );

  if (sceneQuery.error)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage className="scenestats-page">
          <ErrorMessage error={sceneQuery.error.message} />
        </StatsPage>
      </>
    );

  if (roleTagsQuery.error)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage className="scenestats-page">
          <ErrorMessage error={roleTagsQuery.error.message} />
        </StatsPage>
      </>
    );

  if (statsLoading || sceneQuery.loading || roleTagsQuery.loading || !statsData)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage
          className="scenestats-page"
          loading
          loadingMessage="Loading scene stats..."
        />
      </>
    );

  return (
    <StatsPage className="scenestats-page">
      <Helmet {...titleProps} />

      <header className="scenestats-header">
        <div>
          <h1>SceneStats</h1>
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
      </header>

      {(sexTag || oralTag || soloTag || facialTag) && (
        <section
          className="scenestats-summary-grid scenestats-category-grid"
          aria-label="Scene category metrics"
        >
          {sexTag && (
            <Button
              className="scenestats-summary-card scenestats-category-card stats-category-button sex-stats-button"
              href={NavUtils.makeScenesWithMarkerTagUrl(sexTag.id, sexTag.name)}
              disabled={statsData.stats.sex_scene_count === 0}
              title="Sex Scene"
            >
              <img src={gaySvg} alt="Sex" className="stats-category-icon" />
              <span>
                <FormattedNumber value={statsData.stats.sex_scene_count} />
              </span>
            </Button>
          )}
          {oralTag && (
            <Button
              className="scenestats-summary-card scenestats-category-card stats-category-button oral-stats-button"
              href={NavUtils.makeScenesWithExclusiveMarkerTagUrl(
                oralTag.id,
                oralTag.name,
                sexTag ? [{ id: sexTag.id, label: sexTag.name }] : [],
                -1
              )}
              disabled={statsData.stats.oral_scene_count === 0}
              title="Oral Scene"
            >
              <img src={mouthSvg} alt="Oral" className="stats-category-icon" />
              <span>
                <FormattedNumber value={statsData.stats.oral_scene_count} />
              </span>
            </Button>
          )}
          {soloTag && (
            <Button
              className="scenestats-summary-card scenestats-category-card stats-category-button solo-stats-button"
              href={NavUtils.makeScenesWithExclusiveMarkerTagUrl(
                soloTag.id,
                soloTag.name,
                [
                  ...(sexTag ? [{ id: sexTag.id, label: sexTag.name }] : []),
                  ...(oralTag ? [{ id: oralTag.id, label: oralTag.name }] : []),
                ],
                -1
              )}
              disabled={statsData.stats.solo_scene_count === 0}
              title="Solo Scene"
            >
              <Icon icon={faHand} className="stats-category-icon-fa" />
              <span>
                <FormattedNumber value={statsData.stats.solo_scene_count} />
              </span>
            </Button>
          )}
          {facialTag && (
            <Button
              className="scenestats-summary-card scenestats-category-card stats-category-button facial-stats-button"
              href={NavUtils.makeScenesWithMarkerTagUrl(
                facialTag.id,
                facialTag.name,
                -1
              )}
              disabled={statsData.stats.facial_scene_count === 0}
              title="Facial Scene"
            >
              <img
                src={facialPng}
                alt="Facial"
                className="stats-category-icon"
              />
              <span>
                <FormattedNumber
                  value={statsData.stats.facial_scene_count ?? 0}
                />
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
          to={makeSceneStatsVatoCountURL("one")}
        >
          <Icon icon={faUser} className="stats-category-icon-fa" />
          <span>{vatoCountBuckets.one.toLocaleString()}</span>
        </Link>
        <Link
          aria-label="Scenes with 2 or 3 vatos"
          className="scenestats-summary-card scenestats-category-card linked"
          title="Scenes with 2 or 3 vatos (standard)"
          to={makeSceneStatsVatoCountURL("standard")}
        >
          <Icon icon={faUserGroup} className="stats-category-icon-fa" />
          <span>{vatoCountBuckets.standard.toLocaleString()}</span>
        </Link>
        <Link
          aria-label="Scenes with 4 or more vatos"
          className="scenestats-summary-card scenestats-category-card linked"
          title="Scenes with 4 or more vatos (group scenes)"
          to={makeSceneStatsVatoCountURL("group")}
        >
          <Icon icon={faUsers} className="stats-category-icon-fa" />
          <span>{vatoCountBuckets.group.toLocaleString()}</span>
        </Link>
      </section>

      {(typeof orgasmCountData?.sceneOrgasmCount === "number" ||
        typeof facialCountData?.sceneFacialCount === "number" ||
        typeof orgasmTimeData?.totalOrgasmTime === "number" ||
        typeof facialTimeData?.totalFacialTime === "number") && (
        <section className="scenestats-summary-grid" aria-label="Scene metrics">
          {typeof orgasmCountData?.sceneOrgasmCount === "number" && (
            <Link
              className="scenestats-summary-card linked"
              title="Each matching marker counts once per assigned top vato (minimum 1), while the linked search counts marker rows. The search also includes 2nd-camera markers that this total excludes, so the numbers can differ."
              to={makeSceneStatsMarkerTagURL(orgasmTag)}
            >
              <div className="scenestats-summary-value">
                {orgasmCountData.sceneOrgasmCount.toLocaleString()}
              </div>
              <div className="scenestats-summary-label">Total orgasms</div>
            </Link>
          )}
          {typeof orgasmTimeData?.totalOrgasmTime === "number" &&
            orgasmTimeData.totalOrgasmTime > 0 && (
              <div className="scenestats-summary-card">
                <div className="scenestats-summary-value">
                  {formatDuration(orgasmTimeData.totalOrgasmTime)}
                </div>
                <div className="scenestats-summary-label">
                  Total orgasm time
                </div>
              </div>
            )}
          {typeof facialCountData?.sceneFacialCount === "number" && (
            <Link
              className="scenestats-summary-card linked"
              title="Each matching marker counts once per assigned top vato (minimum 1), while the linked search counts marker rows. The search also includes 2nd-camera markers that this total excludes, so the numbers can differ."
              to={makeSceneStatsMarkerTagURL(facialTag)}
            >
              <div className="scenestats-summary-value">
                {facialCountData.sceneFacialCount.toLocaleString()}
              </div>
              <div className="scenestats-summary-label">Total facials</div>
            </Link>
          )}
          {typeof facialTimeData?.totalFacialTime === "number" &&
            facialTimeData.totalFacialTime > 0 && (
              <div className="scenestats-summary-card">
                <div className="scenestats-summary-value">
                  {formatDuration(facialTimeData.totalFacialTime)}
                </div>
                <div className="scenestats-summary-label">
                  Total facial time
                </div>
              </div>
            )}
        </section>
      )}

      {scenes.length === 0 ? (
        <Alert variant="secondary">No scenes found.</Alert>
      ) : (
        <>
          <SceneStatsPodium scenes={rankedScenes} metric={metric} />

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
            <SceneStatsSceneList metric={metric} scenes={rankedScenes} />
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
              data={charts.performerCount}
              label="By Vato Count"
              onSelect={addFilter}
            />
            <SceneStatsChart
              data={charts.rating}
              label="By Rating"
              onSelect={addFilter}
            />
            <SceneStatsChart
              data={charts.metallicRating}
              label="By Metallic Rating"
              onSelect={addFilter}
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
                      onClick={() => history.push("/scenestats")}
                      variant={!hasSelectedYear ? "primary" : "secondary"}
                    >
                      By Year
                    </Button>
                    <Button
                      disabled={!hasSelectedYear}
                      onClick={() =>
                        history.push(`/scenestats/${selectedYear}`)
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
                          `/scenestats/${selectedYear}/${selectedMonth}`
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
                        ? `${monthName(selectedMonth, "long")} ${selectedYear}`
                        : selectedYear}
                    </span>
                  )}
                </div>
              }
              data={charts.release}
              label={
                hasSelectedYear
                  ? hasSelectedMonth
                    ? "By Release Day"
                    : "By Release Month"
                  : "By Release Year"
              }
              onSelect={addFilter}
            />
            <SceneStatsChart
              data={charts.facialStatus}
              label="Has Facial"
              onSelect={addFilter}
            />
            <SceneStatsChart
              data={charts.facialCount}
              label="By Number of Facial"
              onSelect={addFilter}
            />
            <SceneStatsChart
              data={charts.reallyHotFacialCount}
              label="By Number of Really Hot Facial"
              onSelect={addFilter}
            />
            <SceneStatsChart
              data={charts.sceneType}
              label="Scene Type"
              onSelect={addFilter}
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
    </StatsPage>
  );
};

export default SceneStats;
