import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import {
  cleanStatsValueCustom as cleanValue,
  statsCountCustom,
} from "src/utils/statsValues_custom"; // CUSTOM
import React, { useMemo, useState } from "react";
import {
  mostRecentOTieBreaker,
  rankStatsItems,
} from "src/utils/statsRanking_custom";
import { Alert } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
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
  StatsDivergingChart,
  StatsKpiRow,
  StatsRankByChips,
} from "src/components/StatsCharts_custom"; // CUSTOM
import {
  STATS_BOTTOM_COLOR,
  STATS_TOP_COLOR,
  statsMetallicColor,
} from "src/utils/statsChartColors_custom";
import { StatsDateRangeFilter } from "src/components/StatsDateRangeFilter_custom"; // CUSTOM
import { useStatsViewState } from "src/hooks/useStatsViewState_custom";
import { useStatsDateRange } from "src/hooks/useStatsDateRange_custom"; // CUSTOM
import { removeStatsFilter } from "src/utils/statsViewState_custom";
import { useTitleProps } from "src/hooks/title";
import { metallicRatingChartBucket } from "src/utils/metallicRatingChart_custom";
import { statsCountryName } from "src/utils/statsCountry_custom";
import { VatoStatsRatingAdvisor } from "./VatoStatsRatingAdvisor_custom";
import {
  getVatoStatsStudioScope,
  getVatoStatsSummary,
  type IVatoStatsStudioScope,
  type IVatoStatsSummary,
} from "./vatoStatsStudioScope_custom";
import { buildVatoAgeChartData } from "./vatoStatsMetrics_custom";

import {
  buildVatoRoleChartData,
  vatoMatchesRole,
} from "./vatoStatsRoles_custom";

import { useVatoStatsCompactQuery } from "./useVatoStatsCompactQuery_custom";
import type { VatoStatsPerformer } from "./vatoStatsCompactData_custom";

import "./VatoStats.scss";

const UNKNOWN_KEY = "__unknown__";

interface IVatoStatsDashboardProps {
  studioScope?: IVatoStatsStudioScope;
}

type ChartCategory =
  | "role_strictness"
  | "role"
  | "ethnicity"
  | "age"
  | "rating"
  | "metallic_rating"
  | "height"
  | "country"
  | "hair"
  | "eye"
  | "circumcised"
  | "penis"
  | "scene_o_count"
  | "scene_count"
  | "sex_top_count"
  | "sex_bottom_count"
  | "oral_top_count"
  | "oral_bottom_count"
  | "facial_given_count"
  | "facial_received_count";

type PodiumMetric =
  | "scene_o_count"
  | "rating100"
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

const metricOptions: Array<{
  key: PodiumMetric;
  label: string;
  valueLabel: string;
}> = [
  { key: "scene_o_count", label: "O Count", valueLabel: "O's" },
  { key: "rating100", label: "Rating", valueLabel: "rating" },
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
  { key: "role_strictness", label: "By Role Strictness" },
  { key: "role", label: "By Role" },
  { key: "ethnicity", label: "Ethnicity" },
  { key: "age", label: "Age at Scene" },
  { key: "rating", label: "Rating" },
  { key: "metallic_rating", label: "Metallic Rating" },
  { key: "height", label: "Height" },
  { key: "country", label: "Country" },
  { key: "hair", label: "Hair Color" },
  { key: "eye", label: "Eye Color" },
  { key: "circumcised", label: "Circumcised" },
  { key: "penis", label: "Verga" },
  // CUSTOM: Graph the count-based podium metrics as drill-down distributions.
  { key: "scene_o_count", label: "O Count" },
  { key: "scene_count", label: "Total Scenes" },
  { key: "sex_top_count", label: "Sex Top Scenes" },
  { key: "sex_bottom_count", label: "Sex Bottom Scenes" },
  { key: "oral_top_count", label: "Oral Top Scenes" },
  { key: "oral_bottom_count", label: "Oral Bottom Scenes" },
  { key: "facial_given_count", label: "Facials Given" },
  { key: "facial_received_count", label: "Facials Received" },
];

// CUSTOM: page order by topic; each group fills whole rows of three small,
// two medium or one wide chart. "scene_count" draws the combined Scenes Per
// Vato chart (All, Sex, Oral), always wide.
const chartGroups: Array<{ title: string; categories: ChartCategory[] }> = [
  {
    title: "The Vatos",
    categories: [
      "age",
      "ethnicity",
      "country",
      "height",
      "penis",
      "hair",
      "eye",
      "circumcised",
    ],
  },
  {
    title: "Roles & Scenes",
    categories: ["scene_count", "role_strictness", "role"],
  },
  {
    title: "O's & Facials",
    categories: [
      "scene_o_count",
      "facial_given_count",
      "facial_received_count",
    ],
  },
];
const wideChartCategories: ChartCategory[] = ["age", "rating"];
const smallChartCategories: ChartCategory[] = [
  "hair",
  "eye",
  "circumcised",
  "scene_o_count",
  "facial_given_count",
  "facial_received_count",
];

function chartSizeClass(category: ChartCategory) {
  if (wideChartCategories.includes(category)) return "stats-wide";
  if (smallChartCategories.includes(category)) return "stats-small";
}

// Scene-count ranges for Scenes Per Vato; filters use "range:min-max".
const SCENE_COUNT_RANGES = [
  { key: "0-0", label: "0", min: 0, max: 0 },
  { key: "1-1", label: "1", min: 1, max: 1 },
  { key: "2-2", label: "2", min: 2, max: 2 },
  { key: "3-5", label: "3–5", min: 3, max: 5 },
  { key: "6-10", label: "6–10", min: 6, max: 10 },
  { key: "11-20", label: "11–20", min: 11, max: 20 },
  { key: "21-", label: "21+", min: 21, max: Number.MAX_SAFE_INTEGER },
];
const RANGE_FILTER_PREFIX = "range:";

function inSceneCountRange(value: number, rangeKey: string) {
  const range = SCENE_COUNT_RANGES.find((item) => item.key === rangeKey);
  return !!range && value >= range.min && value <= range.max;
}

// Unordered categories as ranked rows; role charts draw as two-sided bars.
const breakdownCategories: ChartCategory[] = [
  "ethnicity",
  "country",
  "hair",
  "eye",
  "circumcised",
  "role_strictness",
  "role",
];

function chartLabel(category: ChartCategory) {
  return (
    chartDefinitions.find((definition) => definition.key === category)?.label ??
    category
  );
}

function vatoChartBars(
  category: ChartCategory,
  data: ChartDatum[],
  onSelect: (filter: ChartFilter) => void
): IStatsBarDatum[] {
  return data.map((datum) => ({
    key: datum.key,
    label: datum.label,
    count: datum.count,
    color:
      category === "metallic_rating"
        ? statsMetallicColor(datum.key)
        : undefined,
    onSelect: () =>
      onSelect({ category, label: datum.label, value: datum.key }),
  }));
}

function vatoChartUnknown(
  category: ChartCategory,
  count: number,
  onSelect: (filter: ChartFilter) => void
) {
  return {
    count,
    onSelect: () =>
      onSelect({ category, label: "Unknown", value: UNKNOWN_KEY }),
  };
}

// Two-sided rows: bottoms on the left (green), tops on the right (blue).
const roleRows: Record<
  "role_strictness" | "role",
  { rows: Array<[string, string, string]>; extras: string[] }
> = {
  role_strictness: {
    rows: [
      ["pure", "Pure", "pure_bottoms|pure_tops"],
      ["lenient", "Lenient", "lenient_bottoms|lenient_tops"],
    ],
    extras: ["solo_only"],
  },
  role: {
    rows: [
      ["sex", "Sex", "sex_bottom_count|sex_top_count"],
      ["oral", "Oral", "oral_bottom_count|oral_top_count"],
      ["facial", "Facial", "facial_received_count|facial_given_count"],
    ],
    extras: ["solo_scene_count"],
  },
};

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
  return `Best ${adjectiveText}pitos${qualifierText} (By ${metricOptionLabel(
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
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value <= 0
  )
    return undefined;
  return String(Math.round(value));
}

function nonNegativeNumericValueLabel(value?: number | null) {
  const count = statsCountCustom(value);
  return count === undefined ? undefined : String(Math.round(count));
}

function numericSortFromLabel(label: string) {
  const first = Number(label.split("-")[0]);
  return Number.isFinite(first) ? first : Number.MAX_SAFE_INTEGER;
}

// CUSTOM: A zero scene count means a vato has no matching scenes, not missing data.

function chartSortValue(
  performer: VatoStatsPerformer,
  category: ChartCategory,
  value?: string
) {
  switch (category) {
    case "height":
    case "rating":
    case "scene_o_count":
    case "scene_count":
    case "sex_top_count":
    case "sex_bottom_count":
    case "oral_top_count":
    case "oral_bottom_count":
    case "facial_given_count":
    case "facial_received_count":
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
    case "scene_count":
      return nonNegativeNumericValueLabel(performer.scene_count);
    case "scene_o_count":
    case "sex_top_count":
    case "sex_bottom_count":
    case "oral_top_count":
    case "oral_bottom_count":
    case "facial_given_count":
    case "facial_received_count":
      return nonNegativeNumericValueLabel(performer[category]);
    default:
      return undefined;
  }
}

function performerMatchesFilter(
  performer: VatoStatsPerformer,
  filter: ChartFilter
) {
  if (filter.category === "role" || filter.category === "role_strictness") {
    return vatoMatchesRole(performer, filter.category, filter.value);
  }
  // CUSTOM: Scenes Per Vato filters by a scene-count range.
  if (filter.value.startsWith(RANGE_FILTER_PREFIX)) {
    const value = metricValue(performer, filter.category as PodiumMetric);
    return inSceneCountRange(
      value,
      filter.value.slice(RANGE_FILTER_PREFIX.length)
    );
  }
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

  const value = performer[metric];
  return typeof value === "number" ? value : 0;
}

function formatCareerSpan(days: number) {
  if (days < 365) return `${days.toLocaleString(getAppLocaleCustom())} days`;

  const years = days / 365.25;
  return `${years.toLocaleString(getAppLocaleCustom(), {
    maximumFractionDigits: 1,
  })} years`;
}

function formatMetricValue(
  performer: VatoStatsPerformer,
  metric: PodiumMetric
) {
  if (metric === "most_recent_o_date") {
    // Stored as a UTC timestamp so ties can break on time; show the local day.
    const timestamp = mostRecentOTieBreaker(performer.most_recent_o_date);
    return timestamp > 0
      ? new Date(timestamp).toLocaleDateString(getAppLocaleCustom())
      : "Unknown";
  }
  if (metric === "career_span_days") {
    return formatCareerSpan(performer.career_span_days);
  }

  const value = metricValue(performer, metric);
  if (metric === "rating100") return `${value}/100`;
  return value.toLocaleString(getAppLocaleCustom());
}

function metricOptionLabel(metric: PodiumMetric) {
  return metricOptions.find((option) => option.key === metric)?.label ?? metric;
}

function formatDecimal(value?: number, suffix = "") {
  if (typeof value !== "number") return undefined;
  return `${value.toLocaleString(getAppLocaleCustom(), {
    maximumFractionDigits: 2,
  })}${suffix}`;
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
  if (category === "role" || category === "role_strictness") {
    return buildVatoRoleChartData(performers, category);
  }
  if (category === "age") return buildVatoAgeChartData(performers);
  const buckets = new Map<string, ChartDatum>();
  let unknownCount = 0;

  performers.forEach((performer) => {
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

const VATO_UNIT: [string, string] = ["vato", "vatos"];

// Categories where one vato can land in several bars.
const overlappingChartNotes: Partial<Record<ChartCategory, string>> = {
  role: "A vato counts once for each role he has done, so bars can overlap.",
  age: "A vato counts once for each age he did a scene at, so bars can overlap.",
};

// Numeric distributions whose natural order is not by count.
const sortableChartCategories: ChartCategory[] = [
  "age",
  "rating",
  "height",
  "penis",
  "scene_o_count",
  "scene_count",
  "sex_top_count",
  "sex_bottom_count",
  "oral_top_count",
  "oral_bottom_count",
  "facial_given_count",
  "facial_received_count",
];

const VatoStatsChart: React.FC<{
  category: ChartCategory;
  data: ChartDatum[];
  label: string;
  total: number;
  unknownCount: number;
  onSelect: (filter: ChartFilter) => void;
}> = ({ category, data, label, total, unknownCount, onSelect }) => {
  // Role counts use the app's role colors: givers are tops, receivers bottoms.
  const roleColor =
    category === "facial_given_count"
      ? STATS_TOP_COLOR
      : category === "facial_received_count"
      ? STATS_BOTTOM_COLOR
      : undefined;
  const bars = vatoChartBars(category, data, onSelect).map((bar) =>
    category === "country"
      ? { ...bar, icon: <StatsCountryFlag country={bar.key} /> }
      : roleColor
      ? { ...bar, color: roleColor }
      : bar
  );
  const unknown = vatoChartUnknown(category, unknownCount, onSelect);

  if (category === "role" || category === "role_strictness") {
    const byKey = new Map(bars.map((bar) => [bar.key, bar]));
    const layout = roleRows[category];
    return (
      <StatsDivergingChart
        className={chartSizeClass(category)}
        title={label}
        leftLabel="Bottoms"
        rightLabel="Tops"
        leftColor={STATS_BOTTOM_COLOR}
        rightColor={STATS_TOP_COLOR}
        rows={layout.rows.map(([key, rowLabel, sides]) => {
          const [left, right] = sides.split("|");
          return {
            key,
            label: rowLabel,
            left: byKey.get(left),
            right: byKey.get(right),
          };
        })}
        extras={layout.extras.flatMap((key) => byKey.get(key) ?? [])}
        unit={VATO_UNIT}
        total={total}
        totalNote={overlappingChartNotes[category]}
        unknown={unknown}
      />
    );
  }

  return (
    <StatsBarChart
      className={chartSizeClass(category)}
      variant={breakdownCategories.includes(category) ? "ranked" : "columns"}
      title={label}
      data={bars}
      unit={VATO_UNIT}
      total={total}
      totalNote={overlappingChartNotes[category]}
      sortable={sortableChartCategories.includes(category)}
      unknown={unknown}
    />
  );
};

type ScenesPerVatoMode = "all" | "sex" | "oral";

const SCENES_PER_VATO_MODES: Array<{ key: ScenesPerVatoMode; label: string }> =
  [
    { key: "all", label: "All" },
    { key: "sex", label: "Sex" },
    { key: "oral", label: "Oral" },
  ];

// CUSTOM: Total Scenes and the Sex/Oral Top/Bottom counts in one chart. All
// shows columns; Sex and Oral compare bottoms (left) and tops (right) per
// scene-count range.
const VatoScenesPerVatoChart: React.FC<{
  performers: VatoStatsPerformer[];
  onSelect: (filter: ChartFilter) => void;
}> = ({ performers, onSelect }) => {
  const [mode, setMode] = useState<ScenesPerVatoMode>("all");
  const chips = (
    <StatsRankByChips
      label="Scenes"
      options={SCENES_PER_VATO_MODES}
      value={mode}
      onChange={setMode}
    />
  );
  const bar = (
    category: PodiumMetric & ChartCategory,
    range: (typeof SCENE_COUNT_RANGES)[number]
  ): IStatsBarDatum => ({
    key: `${category}-${range.key}`,
    label: `${range.label} ${chartLabel(category)}`,
    count: performers.filter((performer) =>
      inSceneCountRange(metricValue(performer, category), range.key)
    ).length,
    onSelect: () =>
      onSelect({
        category,
        label: range.label,
        value: `${RANGE_FILTER_PREFIX}${range.key}`,
      }),
  });

  if (mode === "all") {
    return (
      <StatsBarChart
        className="stats-wide"
        title="Scenes Per Vato"
        data={SCENE_COUNT_RANGES.map((range) => ({
          ...bar("scene_count", range),
          label: range.label,
        }))}
        unit={VATO_UNIT}
        actions={chips}
      />
    );
  }

  const [bottom, top] =
    mode === "sex"
      ? (["sex_bottom_count", "sex_top_count"] as const)
      : (["oral_bottom_count", "oral_top_count"] as const);
  return (
    <StatsDivergingChart
      className="stats-wide"
      title="Scenes Per Vato"
      leftLabel="Bottom scenes"
      rightLabel="Top scenes"
      leftColor={STATS_BOTTOM_COLOR}
      rightColor={STATS_TOP_COLOR}
      rows={SCENE_COUNT_RANGES.filter((range) => range.min > 0).map(
        (range) => ({
          key: range.key,
          label: range.label,
          left: bar(bottom, range),
          right: bar(top, range),
        })
      )}
      unit={VATO_UNIT}
      totalNote="A vato counts once on each side he has scenes on."
      actions={chips}
    />
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

// CUSTOM: nut totals moved to Nut Stats.
const VatoStatsSummary: React.FC<{
  summary: IVatoStatsSummary;
  totalVatos: number;
}> = ({ summary, totalVatos }) => (
  <StatsKpiRow
    label="Vato summary stats"
    items={[
      {
        key: "vatos",
        label: "Total Vatos",
        value: totalVatos.toLocaleString(getAppLocaleCustom()),
      },
      {
        key: "pito",
        label: "Meters of Pito",
        value: formatDecimal(summary.totalPenisMeters, " m") ?? "—",
        title: `${summary.measuredCount.toLocaleString(
          getAppLocaleCustom()
        )} measured; ${summary.assumedCount.toLocaleString(
          getAppLocaleCustom()
        )} estimated at 17 cm.`,
      },
    ]}
  />
);

export const VatoStatsDashboard: React.FC<IVatoStatsDashboardProps> = ({
  studioScope: fixedStudioScope,
}) => {
  const { view, updateView, setMetric, setFilters, setShowList } =
    useStatsViewState(vatoViewOptions);
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
  const selectedStudioScope = useMemo<IVatoStatsStudioScope | undefined>(
    () =>
      selectedStudio
        ? getVatoStatsStudioScope(selectedStudio, includeChildStudios)
        : undefined,
    [includeChildStudios, selectedStudio]
  );
  const studioScope = fixedStudioScope ?? selectedStudioScope;
  const pageTitle = fixedStudioScope
    ? `${fixedStudioScope.name} Vato Stats`
    : "Vato Stats";
  const titleProps = useTitleProps(pageTitle);
  const { data, error, loading } = useVatoStatsCompactQuery(
    studioScope?.id,
    studioScope?.depth,
    dateRangeVariable
  );
  const performers = useMemo(
    () => data?.vatoStatsPerformers ?? [],
    [data?.vatoStatsPerformers]
  );
  const filteredPerformers = useMemo(
    () =>
      performers.filter((performer) =>
        filters.every((filter) => performerMatchesFilter(performer, filter))
      ),
    [filters, performers]
  );
  // CUSTOM: selected vatos also constrain rating criteria.
  const cohort = useMemo(
    () => ({ performer_ids: filteredPerformers.map((p) => p.id) }),
    [filteredPerformers]
  );
  const summary = useMemo(
    () => getVatoStatsSummary(filteredPerformers),
    [filteredPerformers]
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
      rankStatsItems(
        filteredPerformers,
        (performer) => metricValue(performer, metric),
        (performer) => performer.name,
        // CUSTOM: O Count ties go to the vato who reached it most recently.
        metric === "scene_o_count"
          ? (performer) => mostRecentOTieBreaker(performer.most_recent_o_date)
          : undefined
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

  const headerControls = (
    <div className="stats-header-controls">
      <StatsDateRangeFilter range={dateRange} onChange={setDateRange} />
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
    </div>
  );

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

  const hasScope = !!studioScope || !!dateRangeVariable;

  const renderChart = (category: ChartCategory) =>
    category === "scene_count" ? (
      <VatoScenesPerVatoChart
        key={category}
        onSelect={addFilter}
        performers={filteredPerformers}
      />
    ) : (
      <VatoStatsChart
        category={category}
        data={chartData[category].data}
        key={category}
        label={chartLabel(category)}
        onSelect={addFilter}
        total={filteredPerformers.length}
        unknownCount={chartData[category].unknownCount}
      />
    );

  return (
    <StatsPage className="vatostats-page" showNavigation={!fixedStudioScope}>
      <Helmet {...titleProps} />

      <header className="vatostats-header">
        <h1>{pageTitle}</h1>
        {headerControls}
      </header>

      <VatoStatsFilterBar
        filters={filters}
        total={`${filteredPerformers.length.toLocaleString(
          getAppLocaleCustom()
        )} matching vatos`}
        onRemove={(index) =>
          setFilters((current) => removeStatsFilter(current, index))
        }
        onBack={() => setFilters((current) => current.slice(0, -1))}
        onClear={() => setFilters([])}
      />

      {performers.length === 0 ? (
        <Alert variant="secondary">No vatos found.</Alert>
      ) : (
        <>
          <p className="stats-interaction-help">
            {filters.length > 0
              ? "Matching vato"
              : hasScope
              ? "Scoped"
              : "Library"}{" "}
            totals at a glance.
          </p>
          <VatoStatsSummary
            summary={summary}
            totalVatos={filteredPerformers.length}
          />
          {/* CUSTOM: ranked vato cards; the table view replaces the vato list. */}
          <StatsTopCards
            title={podiumDescriptor}
            variant="vato"
            emptyLabel="No vatos match this ranking."
            rankBy={{
              options: metricOptions,
              value: metric,
              onChange: setMetric,
            }}
            view={showList ? "table" : "cards"}
            onViewChange={(next) => setShowList(next === "table")}
            items={filteredList.map((performer) => ({
              key: performer.id,
              title: performer.name,
              imagePath: performer.image_path,
              rating100: performer.rating100,
              to: `/performers/${performer.id}`,
              meta: `${performer.scene_count.toLocaleString(
                getAppLocaleCustom()
              )} ${performer.scene_count === 1 ? "scene" : "scenes"}`,
              value: `${formatMetricValue(performer, metric)} ${
                metricOptions.find((option) => option.key === metric)
                  ?.valueLabel ?? ""
              }`.trim(),
            }))}
          />
          <p className="stats-interaction-help">
            Select a bar or Unknown badge to filter the totals, criteria,
            charts, and rankings on this page.
          </p>
          {chartGroups.map((group) => (
            <StatsChartGroup
              className="stats-group--panel"
              key={group.title}
              title={group.title}
            >
              {group.categories.map(renderChart)}
            </StatsChartGroup>
          ))}
          {/* CUSTOM: rating charts sit beside the rating criteria. */}
          <StatsChartGroup className="stats-group--panel" title="Ratings">
            {renderChart("rating")}
            {renderChart("metallic_rating")}
            <div>
              <VatoStatsRatingAdvisor
                cohort={cohort}
                dateRange={dateRangeVariable}
                studioScope={studioScope}
              />
            </div>
          </StatsChartGroup>
        </>
      )}
    </StatsPage>
  );
};

const VatoStats: React.FC = () => <VatoStatsDashboard />;

export default VatoStats;
