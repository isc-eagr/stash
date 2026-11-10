// CUSTOM: Year in Review. One calendar year of O's, read by O date.
import { StatsDateField } from "src/core/generated-graphql";
import type { StatsDateRangeInput } from "src/core/generated-graphql";
import {
  DEFAULT_STATS_DATE_RANGE,
  writeStatsDateRange,
} from "src/utils/statsDateRange_custom";

export const YEAR_IN_REVIEW_PATH = "/stats/year";

export function yearInReviewPath(year: number) {
  return `${YEAR_IN_REVIEW_PATH}/${year}`;
}

// The year's O's, and every O before it (to tell who is new this year).
export function yearInReviewRanges(year: number): {
  range: StatsDateRangeInput;
  before: StatsDateRangeInput;
} {
  const field = StatsDateField.ODate;
  return {
    range: { from: `${year}-01-01`, to: `${year}-12-31`, field },
    before: { from: null, to: `${year - 1}-12-31`, field },
  };
}

// Years with O's, oldest first, and the one to show: the requested year when
// it has O's, otherwise the latest year that does.
export function yearInReviewYears(
  counts: readonly { year: number; count: number }[],
  requested?: number
) {
  const years = counts
    .filter((item) => item.year > 0 && item.count > 0)
    .map((item) => item.year)
    .sort((a, b) => a - b);
  const year =
    requested !== undefined && years.includes(requested)
      ? requested
      : years[years.length - 1];
  const index = year === undefined ? -1 : years.indexOf(year);

  return {
    years,
    year,
    previous: index > 0 ? years[index - 1] : undefined,
    next: index >= 0 ? years[index + 1] : undefined,
  };
}

export function parseYearInReviewYear(value?: string) {
  return value && /^\d{4}$/.test(value) ? Number(value) : undefined;
}

// Twelve months, zero-filled, from the year's per-day counts.
export function yearInReviewMonths(
  year: number,
  days: readonly { date: string; count: number }[],
  locale: string
) {
  const totals = Array<number>(12).fill(0);
  days.forEach((day) => {
    if (!day.date.startsWith(`${year}-`)) return;
    const month = Number(day.date.slice(5, 7));
    if (month >= 1 && month <= 12) totals[month - 1] += day.count;
  });

  return totals.map((count, index) => ({
    key: String(index + 1).padStart(2, "0"),
    month: index + 1,
    label: new Date(Date.UTC(year, index, 1)).toLocaleString(locale, {
      month: "short",
      timeZone: "UTC",
    }),
    count,
  }));
}

// Ranked items with no O before this year, in their ranked order.
export function yearInReviewNewcomers<T>(
  ranked: readonly T[],
  idsBefore: Iterable<string>,
  id: (item: T) => string
) {
  const known = new Set(idsBefore);
  return ranked.filter((item) => !known.has(id(item)));
}

// "+25% vs 2025"; nothing when the earlier year has no O's to compare with.
export function yearInReviewChange(
  current: number,
  previous: number | undefined,
  previousYear: number
) {
  if (!previous || previous <= 0) return undefined;
  const percent = Math.round(((current - previous) / previous) * 100);
  const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
  return `${sign}${Math.abs(percent)}% vs ${previousYear}`;
}

// Days of the year that have already happened, for "active days of N".
export function yearInReviewElapsedDays(year: number, today = new Date()) {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const now = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );
  return Math.max(0, (Math.min(end, now) - start) / 86_400_000);
}

// O Stats pages opened from the review keep the year as their date range.
export function yearInReviewOStatsPath(path: string, year: number) {
  const { range } = yearInReviewRanges(year);
  return `${path}${writeStatsDateRange("", {
    preset: "custom",
    from: range.from ?? undefined,
    to: range.to ?? undefined,
    field: DEFAULT_STATS_DATE_RANGE.field,
  })}`;
}
