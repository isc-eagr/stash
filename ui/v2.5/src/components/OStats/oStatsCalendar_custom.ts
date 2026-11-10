// Reliable O dates start here; earlier calendar days are shown as untracked.
export const O_STATS_TRACKING_START = "2024-03-08";

export type OStatsCalendarDay = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  tracked: boolean;
};

export type OStatsCalendarWeek = Array<OStatsCalendarDay | null>;

export type OStatsCalendarSummary = {
  total: number;
  activeDays: number;
  bestDay?: { date: string; count: number };
  longestStreak: number;
};

function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

// Four intensity levels scaled to the busiest day of the year; 0 means none.
export function oStatsCalendarLevel(
  count: number,
  max: number
): OStatsCalendarDay["level"] {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as
    | 1
    | 2
    | 3
    | 4;
}

// Jan 1 to Dec 31 as Monday-first week columns; cells outside the year are
// null so the first and last columns line up with their weekdays.
export function buildOStatsCalendar(
  year: number,
  counts: ReadonlyMap<string, number>
) {
  const max = Math.max(0, ...Array.from(counts.values()));
  const first = new Date(Date.UTC(year, 0, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const daysInYear =
    (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;

  const cells: Array<OStatsCalendarDay | null> = Array(leading).fill(null);
  const monthStarts: Array<{ month: number; week: number }> = [];
  for (let index = 0; index < daysInYear; index++) {
    const date = isoDate(year, 0, index + 1);
    const day = Number(date.slice(8, 10));
    if (day === 1) {
      monthStarts.push({
        month: Number(date.slice(5, 7)),
        week: Math.floor((leading + index) / 7),
      });
    }
    const count = counts.get(date) ?? 0;
    cells.push({
      date,
      count,
      level: oStatsCalendarLevel(count, max),
      tracked: date >= O_STATS_TRACKING_START,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: OStatsCalendarWeek[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return { weeks, monthStarts, max };
}

export function summarizeOStatsCalendar(
  year: number,
  counts: ReadonlyMap<string, number>
): OStatsCalendarSummary {
  let total = 0;
  let activeDays = 0;
  let bestDay: OStatsCalendarSummary["bestDay"];
  let longestStreak = 0;
  let streak = 0;
  const daysInYear =
    (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;

  for (let index = 0; index < daysInYear; index++) {
    const date = isoDate(year, 0, index + 1);
    const count = counts.get(date) ?? 0;
    total += count;
    if (count > 0) {
      activeDays += 1;
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
      if (!bestDay || count > bestDay.count) bestDay = { date, count };
    } else {
      streak = 0;
    }
  }
  return { total, activeDays, bestDay, longestStreak };
}
