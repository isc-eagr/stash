import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { Alert, Button, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { FormattedMessage, FormattedNumber } from "react-intl";
import { Link } from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { StatsPage } from "src/components/StatsPage_custom";
import { StatsStudioSelector } from "src/components/StatsStudioSelector_custom";
import { StatsFilterBar } from "src/components/StatsFilterBar_custom";
import { useStatsViewState } from "src/hooks/useStatsViewState_custom";
import { removeStatsFilter } from "src/utils/statsViewState_custom";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
import { ListFilterModel } from "src/models/list-filter/filter";
import NavUtils from "src/utils/navigation";
import { metallicRatingChartBucket } from "src/utils/metallicRatingChart_custom";
import { statsCountryName } from "src/utils/statsCountry_custom";
import {
  formatStatsDrilldownTotal,
  formatStatsTotal,
} from "src/utils/statsDrilldown_custom";
import { VatoStatsRatingAdvisor } from "./VatoStatsRatingAdvisor_custom";
import {
  getVatoStatsStudioScope,
  getVatoStatsStudioRoleCounts,
  getVatoStatsStudioSummary,
  getVatoStatsStudioTierRows,
  type IVatoStatsStudioScope,
} from "./vatoStatsStudioScope_custom";

import "./VatoStats.scss";

const UNKNOWN_KEY = "__unknown__";

const VATO_STATS_PERFORMERS = gql`
  query VatoStatsPerformers($studioId: ID, $depth: Int) {
    vatoStatsPerformers(studio_id: $studioId, depth: $depth) {
      id
      name
      image_path
      rating100
      scene_o_count
      scene_o_count_past_year
      is_past_year
      scene_count
      sex_top_count
      sex_bottom_count
      oral_top_count
      oral_bottom_count
      solo_scene_count
      facial_given_count
      facial_received_count
      most_recent_o_date
      career_span_days
      metallic_rating
      ethnicity
      country
      hair_color
      eye_color
      height_cm
      penis_length
      circumcised
      unknown_scene_age_count
      age_counts {
        age_range
        count
      }
    }
    sceneOrgasmCount(studio_id: $studioId, depth: $depth)
  }
`;

const VATO_SUMMARY_STATS = gql`
  query VatoSummaryStats {
    estimatedLiters
    totalPenisMeters
    performersSexGivenCount
    performersSexReceivedCount
    performersOralGivenCount
    performersOralReceivedCount
    performersFacialGivenCount
    performersFacialReceivedCount
    performersSoloOnlyCount
    performersOneSceneCount
  }
`;

const PERFORMER_ETHNICITY_TIER_COUNTS = gql`
  query VatoStatsPerformerEthnicityTierCounts {
    performerEthnicityTierCounts {
      ethnicity
      bronze
      silver
      gold
      royal_sapphire
    }
  }
`;

const VATO_STATS_ROLE_TAGS = gql`
  query VatoStatsRoleTags($ids: [ID!]) {
    findTags(ids: $ids) {
      tags {
        id
        name
      }
    }
  }
`;

const VATO_STRICT_TOP_COUNT = gql`
  query VatoStatsStrictTopCount(
    $filter: FindFilterType
    $performer_filter: PerformerFilterType
  ) {
    findPerformers(filter: $filter, performer_filter: $performer_filter) {
      count
    }
  }
`;

const VATO_LENIENT_TOP_COUNT = gql`
  query VatoStatsLenientTopCount(
    $filter: FindFilterType
    $performer_filter: PerformerFilterType
  ) {
    findPerformers(filter: $filter, performer_filter: $performer_filter) {
      count
    }
  }
`;

const VATO_STRICT_BOTTOM_COUNT = gql`
  query VatoStatsStrictBottomCount(
    $filter: FindFilterType
    $performer_filter: PerformerFilterType
  ) {
    findPerformers(filter: $filter, performer_filter: $performer_filter) {
      count
    }
  }
`;

const VATO_LENIENT_BOTTOM_COUNT = gql`
  query VatoStatsLenientBottomCount(
    $filter: FindFilterType
    $performer_filter: PerformerFilterType
  ) {
    findPerformers(filter: $filter, performer_filter: $performer_filter) {
      count
    }
  }
`;

type VatoStatsAgeCount = {
  age_range: string;
  count: number;
};

interface IVatoStatsDashboardProps {
  studioScope?: IVatoStatsStudioScope;
}

type VatoStatsPerformer = {
  id: string;
  name: string;
  image_path?: string | null;
  rating100?: number | null;
  scene_o_count: number;
  scene_o_count_past_year: number;
  is_past_year: boolean;
  scene_count: number;
  sex_top_count: number;
  sex_bottom_count: number;
  oral_top_count: number;
  oral_bottom_count: number;
  solo_scene_count: number;
  facial_given_count: number;
  facial_received_count: number;
  most_recent_o_date?: string | null;
  career_span_days: number;
  metallic_rating?: string | null;
  ethnicity?: string | null;
  country?: string | null;
  hair_color?: string | null;
  eye_color?: string | null;
  height_cm?: number | null;
  penis_length?: number | null;
  circumcised?: string | null;
  unknown_scene_age_count: number;
  age_counts: VatoStatsAgeCount[];
};

type ChartCategory =
  | "ethnicity"
  | "age"
  | "rating"
  | "metallic_rating"
  | "height"
  | "country"
  | "hair"
  | "eye"
  | "circumcised"
  | "penis";

type PodiumMetric =
  | "scene_o_count"
  | "scene_o_count_past_year"
  | "rating100"
  | "rating100_past_year"
  | "scene_count"
  | "sex_top_count"
  | "sex_bottom_count"
  | "oral_top_count"
  | "oral_bottom_count"
  | "facial_given_count"
  | "facial_received_count"
  | "most_recent_o_date"
  | "career_span_days";

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
};

type ChartDataResult = {
  data: ChartDatum[];
  unknownCount: number;
};

type VatoSummaryStatsData = {
  estimatedLiters: number;
  totalPenisMeters: number;
  performersSexGivenCount: number;
  performersSexReceivedCount: number;
  performersOralGivenCount: number;
  performersOralReceivedCount: number;
  performersFacialGivenCount: number;
  performersFacialReceivedCount: number;
  performersSoloOnlyCount: number;
  performersOneSceneCount: number;
};

type VatoStatsRoleTagsData = {
  findTags: {
    tags: Array<{ id: string; name: string }>;
  };
};

type PerformerEthnicityTierKey =
  | "bronze"
  | "silver"
  | "gold"
  | "royal_sapphire";

type PerformerEthnicityTierRow = {
  ethnicity: string;
  bronze: number;
  silver: number;
  gold: number;
  royal_sapphire: number;
};

type FindPerformersCountData = {
  findPerformers: {
    count: number;
  };
};

const metricOptions: Array<{
  key: PodiumMetric;
  label: string;
  valueLabel: string;
}> = [
  { key: "scene_o_count", label: "O Counts", valueLabel: "O's" },
  {
    key: "scene_o_count_past_year",
    label: "O Count (past year)",
    valueLabel: "O's",
  },
  { key: "rating100", label: "Rating", valueLabel: "rating" },
  {
    key: "rating100_past_year",
    label: "Rating (past year)",
    valueLabel: "rating",
  },
  { key: "scene_count", label: "Total Scenes", valueLabel: "scenes" },
  { key: "sex_top_count", label: "Sex Top Scenes", valueLabel: "top scenes" },
  {
    key: "sex_bottom_count",
    label: "Sex Bottom Scenes",
    valueLabel: "bottom scenes",
  },
  { key: "oral_top_count", label: "Oral Top Scenes", valueLabel: "top scenes" },
  {
    key: "oral_bottom_count",
    label: "Oral Bottom Scenes",
    valueLabel: "bottom scenes",
  },
  {
    key: "facial_given_count",
    label: "Facials Given",
    valueLabel: "facials",
  },
  {
    key: "facial_received_count",
    label: "Facials Received",
    valueLabel: "facials",
  },
  { key: "most_recent_o_date", label: "Most Recent O", valueLabel: "" },
  {
    key: "career_span_days",
    label: "Longest Career Span",
    valueLabel: "span",
  },
];

const chartDefinitions: Array<{ key: ChartCategory; label: string }> = [
  { key: "ethnicity", label: "Ethnicity" },
  { key: "age", label: "Scene Age" },
  { key: "rating", label: "Rating" },
  { key: "metallic_rating", label: "Metallic Rating" },
  { key: "height", label: "Height" },
  { key: "country", label: "Country" },
  { key: "hair", label: "Hair Color" },
  { key: "eye", label: "Eye Color" },
  { key: "circumcised", label: "Circumcised" },
  { key: "penis", label: "Verga" },
];

// CUSTOM: These categories have a small, stable set of values and benefit from
// sharing a row instead of reserving the full chart width.
const compactChartCategories: ChartCategory[] = [
  "metallic_rating",
  "circumcised",
];

const vatoViewOptions = {
  prefix: "vato",
  categories: chartDefinitions.map((definition) => definition.key),
  metrics: metricOptions.map((option) => option.key),
  defaultMetric: "scene_o_count" as PodiumMetric,
};

const countryDemonyms: Record<string, string> = {
  "United States": "American",
  "United Kingdom": "British",
  Canada: "Canadian",
  Germany: "German",
  France: "French",
  Russia: "Russian",
  Ukraine: "Ukrainian",
  Japan: "Japanese",
  Brazil: "Brazilian",
  Italy: "Italian",
  Spain: "Spanish",
  Australia: "Australian",
  "Czech Republic": "Czech",
  Poland: "Polish",
  Netherlands: "Dutch",
  Sweden: "Swedish",
  Hungary: "Hungarian",
  Romania: "Romanian",
  Slovakia: "Slovak",
  Argentina: "Argentine",
  Colombia: "Colombian",
  Mexico: "Mexican",
  Venezuela: "Venezuelan",
  Thailand: "Thai",
  Philippines: "Filipino",
  "South Korea": "Korean",
  China: "Chinese",
  India: "Indian",
  Turkey: "Turkish",
  Greece: "Greek",
  Portugal: "Portuguese",
  Belgium: "Belgian",
  Austria: "Austrian",
  Switzerland: "Swiss",
  Norway: "Norwegian",
  Denmark: "Danish",
  Finland: "Finnish",
  Fiji: "Fijian",
  Latvia: "Latvian",
  Lithuania: "Lithuanian",
  Estonia: "Estonian",
  Slovenia: "Slovenian",
  Croatia: "Croatian",
  Serbia: "Serbian",
  Bulgaria: "Bulgarian",
  Ireland: "Irish",
  "South Africa": "South African",
  "New Zealand": "New Zealander",
  Israel: "Israeli",
  "Puerto Rico": "Puerto Rican",
  Kazakhstan: "Kazakh",
  Vietnam: "Vietnamese",
  Belarus: "Belarusian",
  Cuba: "Cuban",
  Moldova: "Moldovan",
  Taiwan: "Taiwanese",
  "Dominican Republic": "Dominican",
  Chile: "Chilean",
  Peru: "Peruvian",
  "El Salvador": "Salvadoran",
  Uruguay: "Uruguayan",
  Georgia: "Georgian",
  Ecuador: "Ecuadorian",
  Panama: "Panamanian",
  Mongolia: "Mongolian",
  Syria: "Syrian",
  Morocco: "Moroccan",
  Albania: "Albanian",
  Iceland: "Icelandic",
  Lebanon: "Lebanese",
  Kenya: "Kenyan",
  Kyrgyzstan: "Kyrgyz",
  "Lao People's Democratic Republic": "Lao",
  Indonesia: "Indonesian",
  Singapore: "Singaporean",
  Bolivia: "Bolivian",
  "Virgin Islands": "Virgin Islander",
  Luxembourg: "Luxembourgish",
  Sudan: "Sudanese",
  Pakistan: "Pakistani",
  "Korea, Republic of": "Korean",
  Belize: "Belizean",
  Haiti: "Haitian",
  "Hong Kong": "Hong Konger",
  Micronesia: "Micronesian",
  Tajikistan: "Tajik",
  Armenia: "Armenian",
  Malta: "Maltese",
  "Iran (Islamic Republic of)": "Iranian",
  Rwanda: "Rwandan",
  Togo: "Togolese",
  Guatemala: "Guatemalan",
  Paraguay: "Paraguayan",
  Maldives: "Maldivian",
  Cyprus: "Cypriot",
  Jamaica: "Jamaican",
  "Bosnia and Herzegovina": "Bosnian",
  Yugoslavia: "Yugoslav",
  Bangladesh: "Bangladeshi",
  "Central African Republic": "Central African",
  Guam: "Guamanian",
  Uzbekistan: "Uzbek",
  Iraq: "Iraqi",
  "Saudi Arabia": "Saudi",
  "Costa Rica": "Costa Rican",
  Honduras: "Honduran",
  Mauritius: "Mauritian",
  "Slovakia (Slovak Republic)": "Slovak",
  Afghanistan: "Afghan",
  Algeria: "Algerian",
};

const countryCodeDemonyms: Record<string, string> = {
  US: "American",
  GB: "British",
  CA: "Canadian",
  DE: "German",
  FR: "French",
  RU: "Russian",
  UA: "Ukrainian",
  JP: "Japanese",
  BR: "Brazilian",
  IT: "Italian",
  ES: "Spanish",
  AU: "Australian",
  CZ: "Czech",
  PL: "Polish",
  NL: "Dutch",
  SE: "Swedish",
  HU: "Hungarian",
  RO: "Romanian",
  SK: "Slovak",
  AR: "Argentine",
  CO: "Colombian",
  MX: "Mexican",
  VE: "Venezuelan",
  TH: "Thai",
  PH: "Filipino",
  KR: "Korean",
  CN: "Chinese",
  IN: "Indian",
  TR: "Turkish",
  GR: "Greek",
  PT: "Portuguese",
  BE: "Belgian",
  AT: "Austrian",
  CH: "Swiss",
  NO: "Norwegian",
  DK: "Danish",
  FI: "Finnish",
  FJ: "Fijian",
  LV: "Latvian",
  LT: "Lithuanian",
  EE: "Estonian",
  SI: "Slovenian",
  HR: "Croatian",
  RS: "Serbian",
  BG: "Bulgarian",
  IE: "Irish",
  ZA: "South African",
  NZ: "New Zealander",
  IL: "Israeli",
  PR: "Puerto Rican",
  KZ: "Kazakh",
  VN: "Vietnamese",
  BY: "Belarusian",
  CU: "Cuban",
  MD: "Moldovan",
  TW: "Taiwanese",
  DO: "Dominican",
  CL: "Chilean",
  PE: "Peruvian",
  SV: "Salvadoran",
  UY: "Uruguayan",
  GE: "Georgian",
  EC: "Ecuadorian",
  PA: "Panamanian",
  MN: "Mongolian",
  SY: "Syrian",
  MA: "Moroccan",
  AL: "Albanian",
  IS: "Icelandic",
  LB: "Lebanese",
  KE: "Kenyan",
  KG: "Kyrgyz",
  LA: "Lao",
  ID: "Indonesian",
  SG: "Singaporean",
  BO: "Bolivian",
  VI: "Virgin Islander",
  LU: "Luxembourgish",
  SD: "Sudanese",
  PK: "Pakistani",
  BZ: "Belizean",
  HT: "Haitian",
  HK: "Hong Konger",
  FM: "Micronesian",
  TJ: "Tajik",
  AM: "Armenian",
  MT: "Maltese",
  IR: "Iranian",
  RW: "Rwandan",
  TG: "Togolese",
  GT: "Guatemalan",
  PY: "Paraguayan",
  MV: "Maldivian",
  CY: "Cypriot",
  JM: "Jamaican",
  BA: "Bosnian",
  YU: "Yugoslav",
  BD: "Bangladeshi",
  CF: "Central African",
  GU: "Guamanian",
  UZ: "Uzbek",
  IQ: "Iraqi",
  SA: "Saudi",
  CR: "Costa Rican",
  HN: "Honduran",
  MU: "Mauritian",
  AF: "Afghan",
  DZ: "Algerian",
};

function cleanValue(value?: string | null) {
  const trimmed = value?.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "<nil>" ||
    trimmed.toLowerCase() === "null"
  ) {
    return undefined;
  }
  return trimmed;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((word) =>
      word.length === 0
        ? word
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
    )
    .join(" ");
}

function countryDemonym(value: string) {
  const trimmed = value.trim();
  const countryName = statsCountryName(trimmed);
  if (countryName !== trimmed) return countryName;

  const exactDemonym = countryDemonyms[trimmed];
  if (exactDemonym) return exactDemonym;

  const codeDemonym = countryCodeDemonyms[trimmed.toUpperCase()];
  if (codeDemonym) return codeDemonym;

  const matchedCountry = Object.keys(countryDemonyms).find(
    (country) => country.toLowerCase() === trimmed.toLowerCase()
  );
  return matchedCountry ? countryDemonyms[matchedCountry] : titleCase(trimmed);
}

function circumcisedLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("uncut")) return "Uncut";
  if (normalized.includes("cut") || normalized.includes("circumcised"))
    return "Cut";
  return titleCase(value);
}

function podiumMetricLabel(metric: PodiumMetric) {
  switch (metric) {
    case "scene_o_count":
      return "O-Count";
    case "scene_o_count_past_year":
      return "O-Count (past year)";
    case "rating100":
      return "Rating";
    case "rating100_past_year":
      return "Rating (past year)";
    case "scene_count":
      return "Total Scenes";
    case "sex_top_count":
      return "Sex Top Scenes";
    case "sex_bottom_count":
      return "Sex Bottom Scenes";
    case "oral_top_count":
      return "Oral Top Scenes";
    case "oral_bottom_count":
      return "Oral Bottom Scenes";
    case "facial_given_count":
      return "Facials Given";
    case "facial_received_count":
      return "Facials Received";
    case "most_recent_o_date":
      return "Most Recent O";
    case "career_span_days":
      return "Longest Career Span";
    default:
      return metricOptionLabel(metric);
  }
}

function vatoStatsDescriptor(filters: ChartFilter[], metric: PodiumMetric) {
  const filterOrder: ChartCategory[] = [
    "circumcised",
    "ethnicity",
    "country",
    "hair",
    "eye",
    "metallic_rating",
    "height",
    "penis",
    "age",
    "rating",
  ];
  const orderedFilters = [...filters].sort(
    (a, b) => filterOrder.indexOf(a.category) - filterOrder.indexOf(b.category)
  );
  const adjectives: string[] = [];
  const qualifiers: string[] = [];

  orderedFilters.forEach((filter) => {
    const label = filter.label === "Unknown" ? "Unknown" : filter.label;

    switch (filter.category) {
      case "circumcised":
        adjectives.push(circumcisedLabel(label));
        break;
      case "ethnicity":
        adjectives.push(titleCase(label));
        break;
      case "country":
        adjectives.push(countryDemonym(filter.value));
        break;
      case "hair":
        adjectives.push(`${label.toLowerCase()}-haired`);
        break;
      case "eye":
        adjectives.push(`${label.toLowerCase()}-eyed`);
        break;
      case "metallic_rating":
        adjectives.push(titleCase(label));
        break;
      case "height":
        qualifiers.push(`height-${label}`);
        break;
      case "penis":
        adjectives.push(label.replace(/\s+/g, ""));
        break;
      case "age":
        break;
      case "rating":
        qualifiers.push(`rated-${label}`);
        break;
      default:
        break;
    }
  });

  const adjectiveText = adjectives.length > 0 ? `${adjectives.join(" ")} ` : "";
  const qualifierText = qualifiers.length > 0 ? ` ${qualifiers.join(" ")}` : "";
  return `Best ${adjectiveText}pitos${qualifierText} (By ${podiumMetricLabel(
    metric
  )})`;
}

function bucketByFives(value?: number | null) {
  if (!value || value <= 0) return undefined;
  const rounded = Math.round(value);
  const start = Math.floor((rounded - 1) / 5) * 5 + 1;
  return `${start}-${start + 4}`;
}

function bucketRating(value?: number | null) {
  if (value === null || value === undefined) return undefined;
  const rating = Math.max(0, Math.round(value));
  const start = Math.floor(rating / 5) * 5;
  const end = start + 4;
  return `${start}-${end}`;
}

function numericValueLabel(value?: number | null) {
  if (value === null || value === undefined || value <= 0) return undefined;
  return String(Math.round(value));
}

function numericSortFromLabel(label: string) {
  const first = Number(label.split("-")[0]);
  return Number.isFinite(first) ? first : Number.MAX_SAFE_INTEGER;
}

function chartSortValue(
  performer: VatoStatsPerformer,
  category: ChartCategory,
  value?: string
) {
  switch (category) {
    case "height":
    case "rating":
      return numericSortFromLabel(value ?? "");
    case "metallic_rating":
      return (
        metallicRatingChartBucket(
          performer.rating100,
          performer.metallic_rating
        )?.sortValue ?? Number.MAX_SAFE_INTEGER
      );
    case "penis": {
      const numericValue = Number(value);
      return Number.isFinite(numericValue)
        ? numericValue
        : Number.MAX_SAFE_INTEGER;
    }
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

function categoryValue(performer: VatoStatsPerformer, category: ChartCategory) {
  switch (category) {
    case "ethnicity":
      return cleanValue(performer.ethnicity);
    case "rating":
      return bucketRating(performer.rating100);
    case "metallic_rating":
      return metallicRatingChartBucket(
        performer.rating100,
        performer.metallic_rating
      )?.key;
    case "height":
      return bucketByFives(performer.height_cm);
    case "country":
      return cleanValue(performer.country);
    case "hair":
      return cleanValue(performer.hair_color);
    case "eye":
      return cleanValue(performer.eye_color);
    case "circumcised":
      return cleanValue(performer.circumcised);
    case "penis":
      return numericValueLabel(performer.penis_length);
    default:
      return undefined;
  }
}

function performerMatchesFilter(
  performer: VatoStatsPerformer,
  filter: ChartFilter
) {
  if (filter.category === "age") {
    if (filter.value === UNKNOWN_KEY)
      return performer.unknown_scene_age_count > 0;
    return performer.age_counts.some(
      (ageCount) => ageCount.age_range === filter.value && ageCount.count > 0
    );
  }

  return (
    (categoryValue(performer, filter.category) ?? UNKNOWN_KEY) === filter.value
  );
}

function metricValue(performer: VatoStatsPerformer, metric: PodiumMetric) {
  if (metric === "most_recent_o_date") {
    const timestamp = Date.parse(performer.most_recent_o_date ?? "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (metric === "rating100_past_year") {
    return performer.rating100 ?? 0;
  }

  const value = performer[metric];
  return typeof value === "number" ? value : 0;
}

function metricIncludesPerformer(
  performer: VatoStatsPerformer,
  metric: PodiumMetric
) {
  return metric !== "rating100_past_year" || performer.is_past_year;
}

function formatCareerSpan(days: number) {
  if (days < 365) return `${days.toLocaleString()} days`;

  const years = days / 365.25;
  return `${years.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} years`;
}

function formatMetricValue(
  performer: VatoStatsPerformer,
  metric: PodiumMetric
) {
  if (metric === "most_recent_o_date") {
    return cleanValue(performer.most_recent_o_date) ?? "Unknown";
  }
  if (metric === "career_span_days") {
    return formatCareerSpan(performer.career_span_days);
  }

  const value = metricValue(performer, metric);
  if (metric === "rating100" || metric === "rating100_past_year")
    return `${value}/100`;
  return value.toLocaleString();
}

function metricOptionLabel(metric: PodiumMetric) {
  return metricOptions.find((option) => option.key === metric)?.label ?? metric;
}

function formatDecimal(value?: number, suffix = "") {
  if (typeof value !== "number") return undefined;
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function randomSortID() {
  return Math.floor(Math.random() * 100000000);
}

function performerMarkerRoleURL(
  tag: { id: string; name: string } | undefined,
  role: "any" | "top" | "bottom",
  depth = 0
) {
  if (!tag) return undefined;
  const criterionData = {
    type: "performer_markers",
    modifier: "INCLUDES_ALL",
    group: {
      tag_ids: [{ id: tag.id, label: tag.name }],
      depth,
      performer_ids: [],
      performer_ethnicities: [],
      performer_countries: [],
      performer_rating: null,
      performer_role: role,
      partner_ids: [],
      partner_ethnicities: [],
      partner_countries: [],
      partner_rating: null,
      partner_role: "any",
    },
  };
  return `/performers?c=${encodeURIComponent(
    JSON.stringify(criterionData)
  )}&sortby=random_${randomSortID()}`;
}

function partnersFilterURL(value: Record<string, unknown>) {
  const criterion = {
    type: "partners",
    value: JSON.stringify(value),
  };
  return `/performers?c=${encodeURIComponent(
    JSON.stringify(criterion)
  )}&sortby=random_${randomSortID()}`;
}

function performerSceneCountURL(sceneCount: number) {
  const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
  const criterion = filter.makeCriterion("scene_count");
  if (criterion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (criterion as any).modifier = GQL.CriterionModifier.Equals;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (criterion as any).value = sceneCount;
    filter.criteria.push(criterion);
  }
  return `/performers?${filter.makeQueryParameters()}&sortby=random_${randomSortID()}`;
}

function soloOnlyPerformersURL(
  soloTag: { id: string; name: string } | undefined,
  oralTag: { id: string; name: string } | undefined,
  sexTag: { id: string; name: string } | undefined
) {
  if (!soloTag) return undefined;
  const criteria = [
    {
      type: "performer_markers",
      modifier: "INCLUDES_ALL",
      group: {
        tag_ids: [{ id: soloTag.id, label: soloTag.name }],
        depth: -1,
        performer_ids: [],
        performer_ethnicities: [],
        performer_countries: [],
        performer_rating: null,
        performer_role: "any",
        partner_ids: [],
        partner_ethnicities: [],
        partner_countries: [],
        partner_rating: null,
        partner_role: "any",
      },
    },
  ];

  const excludeTags = [];
  if (oralTag) excludeTags.push({ id: oralTag.id, label: oralTag.name });
  if (sexTag) excludeTags.push({ id: sexTag.id, label: sexTag.name });

  if (excludeTags.length > 0) {
    criteria.push({
      type: "performer_markers_exclude",
      modifier: "INCLUDES_ALL",
      group: {
        tag_ids: excludeTags,
        depth: -1,
        performer_ids: [],
        performer_ethnicities: [],
        performer_countries: [],
        performer_rating: null,
        performer_role: "any",
        partner_ids: [],
        partner_ethnicities: [],
        partner_countries: [],
        partner_rating: null,
        partner_role: "any",
      },
    });
  }

  return `/performers?${criteria
    .map((criterion) => `c=${encodeURIComponent(JSON.stringify(criterion))}`)
    .join("&")}&sortby=random_${randomSortID()}`;
}

function addDatum(
  buckets: Map<string, ChartDatum>,
  key: string,
  label: string,
  count: number,
  sortValue: number
) {
  const existing = buckets.get(key);
  if (existing) {
    existing.count += count;
    return;
  }
  buckets.set(key, { key, label, count, sortValue });
}

function buildChartData(
  performers: VatoStatsPerformer[],
  category: ChartCategory
) {
  const buckets = new Map<string, ChartDatum>();
  let unknownCount = 0;

  performers.forEach((performer) => {
    if (category === "age") {
      performer.age_counts.forEach((ageCount) => {
        addDatum(
          buckets,
          ageCount.age_range,
          ageCount.age_range,
          ageCount.count,
          numericSortFromLabel(ageCount.age_range)
        );
      });
      if (performer.unknown_scene_age_count > 0) {
        unknownCount += performer.unknown_scene_age_count;
      }
      return;
    }

    const value = categoryValue(performer, category);
    if (!value) {
      unknownCount += 1;
      return;
    }

    const key = value ?? UNKNOWN_KEY;
    let label = value ?? "Unknown";
    if (category === "penis" && value) label = `${value} cm`;
    if (category === "country") label = statsCountryName(value);
    if (category === "metallic_rating") {
      label =
        metallicRatingChartBucket(
          performer.rating100,
          performer.metallic_rating
        )?.label ?? label;
    }
    addDatum(
      buckets,
      key,
      label,
      1,
      chartSortValue(performer, category, value)
    );
  });

  const data = Array.from(buckets.values())
    .filter((datum) => datum.count > 0)
    .sort((a, b) => {
      if (
        a.sortValue !== Number.MAX_SAFE_INTEGER ||
        b.sortValue !== Number.MAX_SAFE_INTEGER
      ) {
        return a.sortValue - b.sortValue;
      }
      return b.count - a.count || a.label.localeCompare(b.label);
    });

  return { data, unknownCount };
}

const VatoStatsPodium: React.FC<{
  performers: VatoStatsPerformer[];
  metric: PodiumMetric;
}> = ({ performers, metric }) => {
  const metricOption = metricOptions.find((option) => option.key === metric);
  const topPerformers = performers
    .filter((performer) => metricIncludesPerformer(performer, metric))
    .sort((a, b) => {
      const valueDiff = metricValue(b, metric) - metricValue(a, metric);
      return valueDiff || a.name.localeCompare(b.name);
    })
    .slice(0, 3);
  const podiumSlots: Array<VatoStatsPerformer | undefined> = [
    topPerformers[0],
    topPerformers[1],
    topPerformers[2],
  ];
  const ranks = [1, 2, 3] as const;

  return (
    <div className="vatostats-podium" aria-label="Top vatos">
      {podiumSlots.map((performer, index) => {
        const rank = ranks[index];
        const rankClass =
          rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";

        return (
          <div
            className={`vatostats-podium-card ${rankClass}`}
            key={performer?.id ?? `empty-${rank}`}
          >
            {performer ? (
              <>
                <div className="vatostats-podium-rank">{rank}</div>
                {performer.image_path ? (
                  <img
                    alt={performer.name}
                    className="vatostats-podium-image"
                    loading="lazy"
                    src={performer.image_path}
                  />
                ) : (
                  <div className="vatostats-podium-image empty" />
                )}
                <Link
                  className="vatostats-podium-name"
                  to={`/performers/${performer.id}`}
                >
                  {performer.name}
                </Link>
                <div className="vatostats-podium-value">
                  {formatMetricValue(performer, metric)}{" "}
                  {metricOption?.valueLabel}
                </div>
              </>
            ) : (
              <div className="vatostats-podium-empty">No vato</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const VatoStatsChart: React.FC<{
  category: ChartCategory;
  data: ChartDatum[];
  label: string;
  unknownCount: number;
  onSelect: (filter: ChartFilter) => void;
}> = ({ category, data, label, unknownCount, onSelect }) => {
  const max = Math.max(...data.map((datum) => datum.count), 1);

  return (
    <section className="vatostats-chart-panel">
      <div className="vatostats-chart-heading">
        <h2>{label}</h2>
        {unknownCount > 0 && (
          <button
            className="vatostats-unknown-count"
            aria-label={`Filter by ${label}: Unknown`}
            title={`Filter by ${label}: Unknown`}
            onClick={() =>
              onSelect({ category, label: "Unknown", value: UNKNOWN_KEY })
            }
            type="button"
          >
            Unknown: {unknownCount.toLocaleString()}
          </button>
        )}
      </div>
      {data.length === 0 ? (
        <div className="vatostats-empty">
          {unknownCount > 0 ? "Only Unknown data" : "No data"}
        </div>
      ) : (
        <div className="vatostats-bars">
          {data.map((datum) => (
            <button
              className="vatostats-bar-cell"
              key={datum.key}
              onClick={() =>
                onSelect({ category, label: datum.label, value: datum.key })
              }
              type="button"
              aria-label={`Filter by ${label}: ${
                datum.label
              } (${datum.count.toLocaleString()} vatos)`}
              title={`Filter by ${label}: ${datum.label}`}
            >
              <span className="vatostats-bar-count">
                {datum.count.toLocaleString()}
              </span>
              <span className="vatostats-bar-track">
                <span
                  className="vatostats-bar-fill"
                  style={{
                    height: `${Math.max((datum.count / max) * 100, 6)}%`,
                  }}
                />
              </span>
              <span className="vatostats-bar-label" title={datum.label}>
                {datum.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

const VatoStatsFilterBar: React.FC<{
  filters: ChartFilter[];
  total: string;
  onRemove: (index: number) => void;
  onBack: () => void;
  onClear: () => void;
}> = ({ filters, total, onRemove, onBack, onClear }) => {
  if (filters.length === 0) return null;

  return (
    <StatsFilterBar
      label="Active Vato Stats filters"
      total={total}
      onUndo={onBack}
      onClear={onClear}
      filters={filters.map((filter, index) => ({
        label: `${
          chartDefinitions.find(
            (definition) => definition.key === filter.category
          )?.label ?? filter.category
        }: ${filter.label}`,
        onRemove: () => onRemove(index),
      }))}
    />
  );
};

const VatoStatsSummary: React.FC<{
  summary?: VatoSummaryStatsData;
  strictTop?: number;
  lenientTop?: number;
  strictBottom?: number;
  lenientBottom?: number;
  sexTag?: { id: string; name: string };
  oralTag?: { id: string; name: string };
  soloTag?: { id: string; name: string };
  facialTag?: { id: string; name: string };
  studioScope?: IVatoStatsStudioScope;
}> = ({
  summary,
  strictTop,
  lenientTop,
  strictBottom,
  lenientBottom,
  sexTag,
  oralTag,
  soloTag,
  facialTag,
  studioScope,
}) => {
  const cards = [
    {
      label: "Meters Of Pito",
      value: formatDecimal(summary?.totalPenisMeters, " m"),
    },
    {
      label: "Estimated Liters",
      value: formatDecimal(summary?.estimatedLiters, " L"),
    },
    {
      label: "Tops",
      value: summary?.performersSexGivenCount?.toLocaleString(),
      path: performerMarkerRoleURL(sexTag, "top", -1),
    },
    {
      label: "Bottoms",
      value: summary?.performersSexReceivedCount?.toLocaleString(),
      path: performerMarkerRoleURL(sexTag, "bottom", -1),
    },
    {
      label: "Strict Tops",
      value: strictTop?.toLocaleString(),
      path: partnersFilterURL({
        sex_topped: { modifier: "GREATER_THAN", value: 0 },
        sex_bottomed: { modifier: "EQUALS", value: 0 },
        oral_bottomed: { modifier: "EQUALS", value: 0 },
        facial_bottomed: { modifier: "EQUALS", value: 0 },
      }),
    },
    {
      label: "Lenient Tops",
      value: lenientTop?.toLocaleString(),
      path: partnersFilterURL({
        sex_topped: { modifier: "GREATER_THAN", value: 0 },
        sex_bottomed: { modifier: "EQUALS", value: 0 },
        any_non_sex_bottomed: { modifier: "GREATER_THAN", value: 0 },
      }),
    },
    {
      label: "Strict Bottoms",
      value: strictBottom?.toLocaleString(),
      path: partnersFilterURL({
        sex_bottomed: { modifier: "GREATER_THAN", value: 0 },
        sex_topped: { modifier: "EQUALS", value: 0 },
        oral_topped: { modifier: "EQUALS", value: 0 },
        facial_topped: { modifier: "EQUALS", value: 0 },
      }),
    },
    {
      label: "Lenient Bottoms",
      value: lenientBottom?.toLocaleString(),
      path: partnersFilterURL({
        sex_bottomed: { modifier: "GREATER_THAN", value: 0 },
        sex_topped: { modifier: "EQUALS", value: 0 },
        any_non_sex_topped: { modifier: "GREATER_THAN", value: 0 },
      }),
    },
    {
      label: "Oral Tops",
      value: summary?.performersOralGivenCount?.toLocaleString(),
      path: performerMarkerRoleURL(oralTag, "top", -1),
    },
    {
      label: "Oral Bottoms",
      value: summary?.performersOralReceivedCount?.toLocaleString(),
      path: performerMarkerRoleURL(oralTag, "bottom", -1),
    },
    {
      label: "Facial Tops",
      value: summary?.performersFacialGivenCount?.toLocaleString(),
      path: performerMarkerRoleURL(facialTag, "top", -1),
    },
    {
      label: "Facial Bottoms",
      value: summary?.performersFacialReceivedCount?.toLocaleString(),
      path: performerMarkerRoleURL(facialTag, "bottom", -1),
    },
    {
      label: "Solo Only Vatos",
      value: summary?.performersSoloOnlyCount?.toLocaleString(),
      path: soloOnlyPerformersURL(soloTag, oralTag, sexTag),
    },
    {
      label: "One Scene Vatos",
      value: summary?.performersOneSceneCount?.toLocaleString(),
      path: performerSceneCountURL(1),
    },
  ]
    .map((card) => ({
      ...card,
      path:
        card.path && studioScope
          ? NavUtils.withStudioScope(
              card.path,
              studioScope.id,
              studioScope.name,
              studioScope.depth
            )
          : card.path,
    }))
    .filter((card) => card.value !== undefined);

  if (cards.length === 0) return null;

  return (
    <section className="vatostats-summary-grid" aria-label="Vato summary stats">
      {cards.map((card) =>
        card.path ? (
          <Link
            className="vatostats-summary-card linked"
            key={card.label}
            to={card.path}
            title={`View matching vatos: ${card.label}`}
          >
            <div className="vatostats-summary-value">{card.value}</div>
            <div className="vatostats-summary-label">
              {card.label} <span aria-hidden="true">→</span>
            </div>
          </Link>
        ) : (
          <div className="vatostats-summary-card" key={card.label}>
            <div className="vatostats-summary-value">{card.value}</div>
            <div className="vatostats-summary-label">{card.label}</div>
          </div>
        )
      )}
    </section>
  );
};

const performerRatingTiers = [
  {
    key: "bronze",
    label: "Bronze",
  },
  {
    key: "silver",
    label: "Silver",
  },
  {
    key: "gold",
    label: "Gold",
  },
  {
    key: "royal_sapphire",
    label: "Sapphire",
  },
] as const;

const VatoStatsTierTable: React.FC<{
  rows: PerformerEthnicityTierRow[];
  studioScope?: IVatoStatsStudioScope;
}> = ({ rows, studioScope }) => {
  if (rows.length === 0) return null;

  const scopedPath = (path: string) =>
    studioScope
      ? NavUtils.withStudioScope(
          path,
          studioScope.id,
          studioScope.name,
          studioScope.depth
        )
      : path;

  const totals = performerRatingTiers.reduce(
    (acc, tier) => ({
      ...acc,
      [tier.key]: rows.reduce((sum, row) => sum + row[tier.key], 0),
    }),
    {} as Record<PerformerEthnicityTierKey, number>
  );
  const grandTotal = performerRatingTiers.reduce(
    (sum, tier) => sum + totals[tier.key],
    0
  );

  return (
    <section className="vatostats-tier-table" aria-label="Tier vatos">
      <h2>
        <FormattedMessage
          id="stats.tier_performers_by_ethnicity"
          defaultMessage="Tier vatos by ethnicity"
        />
      </h2>
      <div className="table-responsive">
        <table className="table table-sm table-striped mb-0">
          <thead>
            <tr>
              <th>
                <FormattedMessage id="ethnicity" defaultMessage="Ethnicity" />
              </th>
              {performerRatingTiers.map((tier) => (
                <th key={tier.key} className="text-right">
                  {tier.label}
                </th>
              ))}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowTotal =
                row.bronze + row.silver + row.gold + row.royal_sapphire;

              return (
                <tr key={`tiers-${row.ethnicity}`}>
                  <td>
                    <Link
                      to={scopedPath(
                        NavUtils.makePerformersEthnicityUrl(row.ethnicity)
                      )}
                    >
                      {row.ethnicity}
                    </Link>
                  </td>
                  {performerRatingTiers.map((tier) => {
                    const count = row[tier.key];
                    return (
                      <td key={tier.key} className="text-right">
                        {count > 0 ? (
                          <Link
                            to={scopedPath(
                              NavUtils.makePerformersEthnicityMetallicRatingUrl(
                                row.ethnicity,
                                tier.key
                              )
                            )}
                          >
                            <FormattedNumber value={count} />
                          </Link>
                        ) : (
                          <FormattedNumber value={count} />
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right">
                    <Link
                      to={scopedPath(
                        NavUtils.makePerformersEthnicityAnyMetallicRatingUrl(
                          row.ethnicity
                        )
                      )}
                    >
                      <FormattedNumber value={rowTotal} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              {performerRatingTiers.map((tier) => {
                const total = totals[tier.key];
                return (
                  <th key={tier.key} className="text-right">
                    {total > 0 ? (
                      <Link
                        to={scopedPath(
                          NavUtils.makePerformersMetallicRatingUrl(tier.key)
                        )}
                      >
                        <FormattedNumber value={total} />
                      </Link>
                    ) : (
                      <FormattedNumber value={total} />
                    )}
                  </th>
                );
              })}
              <th className="text-right">
                <FormattedNumber value={grandTotal} />
              </th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};

export const VatoStatsDashboard: React.FC<IVatoStatsDashboardProps> = ({
  studioScope: fixedStudioScope,
}) => {
  const {
    view,
    updateView,
    setMetric,
    setFilters,
    setShowList: setShowPerformerList,
  } = useStatsViewState(vatoViewOptions);
  const {
    studio: selectedStudio,
    includeChildStudios,
    metric,
    filters,
    showList: showPerformerList,
  } = view;
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const selectedStudioScope = useMemo<IVatoStatsStudioScope | undefined>(
    () =>
      selectedStudio
        ? getVatoStatsStudioScope(selectedStudio, includeChildStudios)
        : undefined,
    [includeChildStudios, selectedStudio]
  );
  const studioScope = fixedStudioScope ?? selectedStudioScope;
  const pageTitle = fixedStudioScope
    ? `${fixedStudioScope.name} VatoStats`
    : "VatoStats";
  const titleProps = useTitleProps(pageTitle);
  const { data, error, loading } = useQuery<{
    vatoStatsPerformers: VatoStatsPerformer[];
    sceneOrgasmCount: number;
  }>(VATO_STATS_PERFORMERS, {
    variables: {
      depth: studioScope?.depth,
      studioId: studioScope?.id,
    },
  });
  const deferAuxiliaryQueries = loading || !!error;
  const deferGlobalAuxiliaryQueries = deferAuxiliaryQueries || !!studioScope;
  const { data: summaryData } = useQuery<VatoSummaryStatsData>(
    VATO_SUMMARY_STATS,
    { skip: deferGlobalAuxiliaryQueries }
  );
  const { data: tierData } = useQuery<{
    performerEthnicityTierCounts: PerformerEthnicityTierRow[];
  }>(PERFORMER_ETHNICITY_TIER_COUNTS, {
    skip: deferGlobalAuxiliaryQueries,
  });
  const strictTopQuery = useQuery<FindPerformersCountData>(
    VATO_STRICT_TOP_COUNT,
    {
      skip: deferGlobalAuxiliaryQueries,
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          partners: {
            sex_topped: { value: 0, modifier: "GREATER_THAN" },
            sex_bottomed: { value: 0, modifier: "EQUALS" },
            oral_bottomed: { value: 0, modifier: "EQUALS" },
            facial_bottomed: { value: 0, modifier: "EQUALS" },
          },
        },
      },
    }
  );
  const lenientTopQuery = useQuery<FindPerformersCountData>(
    VATO_LENIENT_TOP_COUNT,
    {
      skip: deferGlobalAuxiliaryQueries,
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          partners: {
            sex_topped: { value: 0, modifier: "GREATER_THAN" },
            sex_bottomed: { value: 0, modifier: "EQUALS" },
            any_non_sex_bottomed: { value: 0, modifier: "GREATER_THAN" },
          },
        },
      },
    }
  );
  const strictBottomQuery = useQuery<FindPerformersCountData>(
    VATO_STRICT_BOTTOM_COUNT,
    {
      skip: deferGlobalAuxiliaryQueries,
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          partners: {
            sex_bottomed: { value: 0, modifier: "GREATER_THAN" },
            sex_topped: { value: 0, modifier: "EQUALS" },
            oral_topped: { value: 0, modifier: "EQUALS" },
            facial_topped: { value: 0, modifier: "EQUALS" },
          },
        },
      },
    }
  );
  const lenientBottomQuery = useQuery<FindPerformersCountData>(
    VATO_LENIENT_BOTTOM_COUNT,
    {
      skip: deferGlobalAuxiliaryQueries,
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          partners: {
            sex_bottomed: { value: 0, modifier: "GREATER_THAN" },
            sex_topped: { value: 0, modifier: "EQUALS" },
            any_non_sex_topped: { value: 0, modifier: "GREATER_THAN" },
          },
        },
      },
    }
  );
  const roleTagIDList = useMemo(
    () =>
      [
        roleTagIds.sexTagId,
        roleTagIds.oralTagId,
        roleTagIds.soloTagId,
        roleTagIds.facialTagId,
      ].filter((id): id is string => !!id),
    [
      roleTagIds.facialTagId,
      roleTagIds.oralTagId,
      roleTagIds.sexTagId,
      roleTagIds.soloTagId,
    ]
  );
  const { data: tagsData } = useQuery<VatoStatsRoleTagsData>(
    VATO_STATS_ROLE_TAGS,
    {
      skip: deferAuxiliaryQueries || roleTagIDList.length === 0,
      variables: { ids: roleTagIDList },
    }
  );
  const roleTags = tagsData?.findTags.tags ?? [];
  const sexTag = roleTags.find((tag) => tag.id === roleTagIds.sexTagId);
  const oralTag = roleTags.find((tag) => tag.id === roleTagIds.oralTagId);
  const soloTag = roleTags.find((tag) => tag.id === roleTagIds.soloTagId);
  const facialTag = roleTags.find((tag) => tag.id === roleTagIds.facialTagId);

  const performers = useMemo(
    () => data?.vatoStatsPerformers ?? [],
    [data?.vatoStatsPerformers]
  );
  const studioSummary = useMemo(
    () =>
      studioScope
        ? getVatoStatsStudioSummary(performers, data?.sceneOrgasmCount ?? 0)
        : undefined,
    [data?.sceneOrgasmCount, performers, studioScope]
  );
  const studioRoleCounts = useMemo(
    () => (studioScope ? getVatoStatsStudioRoleCounts(performers) : undefined),
    [performers, studioScope]
  );
  const studioTierRows = useMemo(
    () => (studioScope ? getVatoStatsStudioTierRows(performers) : undefined),
    [performers, studioScope]
  );
  const filteredPerformers = useMemo(
    () =>
      performers.filter((performer) =>
        filters.every((filter) => performerMatchesFilter(performer, filter))
      ),
    [filters, performers]
  );
  const chartData = useMemo(
    () =>
      Object.fromEntries(
        chartDefinitions.map((definition) => [
          definition.key,
          buildChartData(filteredPerformers, definition.key),
        ])
      ) as Record<ChartCategory, ChartDataResult>,
    [filteredPerformers]
  );
  const filteredList = useMemo(
    () =>
      filteredPerformers
        .filter((performer) => metricIncludesPerformer(performer, metric))
        .sort(
          (a, b) =>
            metricValue(b, metric) - metricValue(a, metric) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        ),
    [filteredPerformers, metric]
  );
  const podiumDescriptor = useMemo(
    () => vatoStatsDescriptor(filters, metric),
    [filters, metric]
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

  if (loading)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage
          className="vatostats-page"
          loading
          loadingMessage="Loading vato stats..."
          showNavigation={!fixedStudioScope}
        />
      </>
    );
  if (error)
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage
          className="vatostats-page"
          showNavigation={!fixedStudioScope}
        >
          <ErrorMessage error={error.message} />
        </StatsPage>
      </>
    );

  return (
    <StatsPage className="vatostats-page" showNavigation={!fixedStudioScope}>
      <Helmet {...titleProps} />

      <header className="vatostats-header">
        <div>
          <h1>{pageTitle}</h1>
          <div className="vatostats-total">
            {filters.length > 0
              ? formatStatsDrilldownTotal(
                  filteredPerformers.length,
                  performers.length,
                  "vato",
                  "vatos"
                )
              : formatStatsTotal(performers.length, "vato", "vatos")}
          </div>
        </div>
        {!fixedStudioScope && (
          <StatsStudioSelector
            includeChildStudios={includeChildStudios}
            onIncludeChildStudiosChange={(include) => {
              updateView({ includeChildStudios: include, filters: [] });
            }}
            onStudioChange={(studio) => {
              updateView({ studio, filters: [] });
            }}
            studio={selectedStudio}
          />
        )}
      </header>

      <VatoStatsFilterBar
        filters={filters}
        total={`${filteredPerformers.length.toLocaleString()} matching vatos`}
        onRemove={(index) =>
          setFilters((current) => removeStatsFilter(current, index))
        }
        onBack={() => setFilters((current) => current.slice(0, -1))}
        onClear={() => setFilters([])}
      />

      {performers.length === 0 ? (
        <Alert variant="secondary">No vatos with scenes found.</Alert>
      ) : (
        <>
          <p className="stats-interaction-help">
            {studioScope ? "Studio" : "Library"} totals below. Linked totals
            open matching records →
          </p>
          <VatoStatsSummary
            facialTag={facialTag}
            lenientBottom={
              studioRoleCounts?.lenientBottom ??
              lenientBottomQuery.data?.findPerformers.count
            }
            lenientTop={
              studioRoleCounts?.lenientTop ??
              lenientTopQuery.data?.findPerformers.count
            }
            oralTag={oralTag}
            sexTag={sexTag}
            soloTag={soloTag}
            strictBottom={
              studioRoleCounts?.strictBottom ??
              strictBottomQuery.data?.findPerformers.count
            }
            strictTop={
              studioRoleCounts?.strictTop ??
              strictTopQuery.data?.findPerformers.count
            }
            studioScope={studioScope}
            summary={studioSummary ?? summaryData}
          />
          <div className="vatostats-podium-toolbar">
            <div className="vatostats-podium-descriptor">
              {podiumDescriptor}
            </div>
            <Form.Group
              className="vatostats-metric-control"
              controlId="vatoMetric"
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
          <VatoStatsPodium performers={filteredPerformers} metric={metric} />
          <div className="vatostats-list-toggle">
            <Button
              onClick={() => setShowPerformerList((current) => !current)}
              size="sm"
              variant="secondary"
            >
              {showPerformerList ? "Hide vato list" : "Show vato list"}
            </Button>
          </div>
          {showPerformerList && (
            <section
              className="vatostats-performer-list"
              aria-label="Filtered vatos"
            >
              <div className="vatostats-performer-list-heading">
                Sorted by {metricOptionLabel(metric)}
              </div>
              {filteredList.map((performer) => (
                <Link
                  className="vatostats-performer-list-item"
                  key={performer.id}
                  to={`/performers/${performer.id}`}
                >
                  {performer.image_path ? (
                    <img
                      alt=""
                      className="vatostats-performer-list-image"
                      loading="lazy"
                      src={performer.image_path}
                    />
                  ) : (
                    <span className="vatostats-performer-list-image empty" />
                  )}
                  <span className="vatostats-performer-list-name">
                    {performer.name}
                  </span>
                  <span className="vatostats-performer-list-meta">
                    {formatMetricValue(performer, metric)}
                  </span>
                </Link>
              ))}
            </section>
          )}
          <VatoStatsTierTable
            rows={
              studioTierRows ?? tierData?.performerEthnicityTierCounts ?? []
            }
            studioScope={studioScope}
          />
          <VatoStatsRatingAdvisor studioScope={studioScope} />
          <p className="stats-interaction-help">
            Select a bar or Unknown badge to filter the charts and rankings on
            this page.
          </p>
          <div className="vatostats-chart-grid">
            {chartDefinitions
              .filter(
                (definition) => !compactChartCategories.includes(definition.key)
              )
              .map((definition) => (
                <VatoStatsChart
                  category={definition.key}
                  data={chartData[definition.key].data}
                  key={definition.key}
                  label={definition.label}
                  onSelect={addFilter}
                  unknownCount={chartData[definition.key].unknownCount}
                />
              ))}
          </div>
          {/* CUSTOM: Keep fixed, low-cardinality charts in a space-efficient grid. */}
          <div className="vatostats-chart-grid vatostats-chart-grid--compact">
            {chartDefinitions
              .filter((definition) =>
                compactChartCategories.includes(definition.key)
              )
              .map((definition) => (
                <VatoStatsChart
                  category={definition.key}
                  data={chartData[definition.key].data}
                  key={definition.key}
                  label={definition.label}
                  onSelect={addFilter}
                  unknownCount={chartData[definition.key].unknownCount}
                />
              ))}
          </div>
        </>
      )}
    </StatsPage>
  );
};

const VatoStats: React.FC = () => <VatoStatsDashboard />;

export default VatoStats;
