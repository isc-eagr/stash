// Shared date range for the stats pages. It lives in the URL (so refresh,
// back navigation, and links between stats pages keep it) and resolves to the
// StatsDateRangeInput the stats resolvers accept.

export type StatsDateField = "RELEASE" | "ADDED" | "O_DATE";

export type StatsDatePreset =
  | "all"
  | "30d"
  | "90d"
  | "365d"
  | "this_year"
  | "last_year"
  | "custom";

export interface IStatsDateRange {
  preset: StatsDatePreset;
  from?: string;
  to?: string;
  field: StatsDateField;
}

export interface IStatsDateRangeVariable {
  from: string | null;
  to: string | null;
  field: StatsDateField;
}

export const STATS_DATE_RANGE_PARAMS = {
  preset: "statsRange",
  from: "statsFrom",
  to: "statsTo",
  field: "statsDateField",
} as const;

export const STATS_DATE_PRESETS: Array<{
  value: StatsDatePreset;
  label: string;
}> = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom" },
];

export const STATS_DATE_FIELDS: Array<{
  value: StatsDateField;
  label: string;
}> = [
  { value: "RELEASE", label: "Release date" },
  { value: "ADDED", label: "Date added" },
  { value: "O_DATE", label: "O date" },
];

export const DEFAULT_STATS_DATE_RANGE: IStatsDateRange = {
  preset: "all",
  field: "RELEASE",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isStatsIsoDate(value?: string | null): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function formatStatsLocalDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isPreset(value: string | null): value is StatsDatePreset {
  return STATS_DATE_PRESETS.some((preset) => preset.value === value);
}

function isField(value: string | null): value is StatsDateField {
  return STATS_DATE_FIELDS.some((field) => field.value === value);
}

export function readStatsDateRange(search: string): IStatsDateRange {
  const params = new URLSearchParams(search);
  const preset = params.get(STATS_DATE_RANGE_PARAMS.preset);
  const field = params.get(STATS_DATE_RANGE_PARAMS.field);
  const from = params.get(STATS_DATE_RANGE_PARAMS.from);
  const to = params.get(STATS_DATE_RANGE_PARAMS.to);
  const range: IStatsDateRange = {
    preset: isPreset(preset) ? preset : "all",
    field: isField(field) ? field : "RELEASE",
  };
  if (range.preset === "custom") {
    if (isStatsIsoDate(from)) range.from = from;
    if (isStatsIsoDate(to)) range.to = to;
  }
  return range;
}

export function writeStatsDateRange(search: string, range: IStatsDateRange) {
  const params = new URLSearchParams(search);
  Object.values(STATS_DATE_RANGE_PARAMS).forEach((name) => params.delete(name));
  if (range.preset !== "all") {
    params.set(STATS_DATE_RANGE_PARAMS.preset, range.preset);
  }
  if (range.preset === "custom") {
    if (isStatsIsoDate(range.from)) {
      params.set(STATS_DATE_RANGE_PARAMS.from, range.from);
    }
    if (isStatsIsoDate(range.to)) {
      params.set(STATS_DATE_RANGE_PARAMS.to, range.to);
    }
  }
  if (range.field !== DEFAULT_STATS_DATE_RANGE.field) {
    params.set(STATS_DATE_RANGE_PARAMS.field, range.field);
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

// Relative presets resolve against the viewer's local calendar day, matching
// the backend's local O-date grouping.
export function resolveStatsDateRange(
  range: IStatsDateRange,
  today = new Date()
): { from?: string; to?: string } {
  const year = today.getFullYear();
  const daysAgo = (days: number) =>
    formatStatsLocalDate(
      new Date(year, today.getMonth(), today.getDate() - (days - 1))
    );
  const todayValue = formatStatsLocalDate(today);

  switch (range.preset) {
    case "30d":
      return { from: daysAgo(30), to: todayValue };
    case "90d":
      return { from: daysAgo(90), to: todayValue };
    case "365d":
      return { from: daysAgo(365), to: todayValue };
    case "this_year":
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case "last_year":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case "custom": {
      if (range.from && range.to && range.from > range.to) {
        return { from: range.to, to: range.from };
      }
      return { from: range.from, to: range.to };
    }
    default:
      return {};
  }
}

export function statsDateRangeVariable(
  range: IStatsDateRange,
  today = new Date()
): IStatsDateRangeVariable | null {
  const { from, to } = resolveStatsDateRange(range, today);
  if (!from && !to) return null;
  return { from: from ?? null, to: to ?? null, field: range.field };
}

// Carry the date range from the current page into links to other stats pages.
export function addStatsDateRangeToPath(path: string, search: string) {
  const range = readStatsDateRange(search);
  const [pathAndSearch, hash = ""] = path.split("#", 2);
  const [pathname, pathSearch = ""] = pathAndSearch.split("?", 2);
  const nextSearch = writeStatsDateRange(pathSearch, range);
  return `${pathname}${nextSearch}${hash ? `#${hash}` : ""}`;
}
