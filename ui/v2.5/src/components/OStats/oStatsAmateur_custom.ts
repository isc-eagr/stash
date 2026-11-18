// CUSTOM: combines the amateur Stash instance's O Stats with this one's.
// Counts keyed by a value (year, age, country...) add up; scenes, vatos and
// studios stay separate rows marked amateur; marker tags join by name.
import { O_STATS_TRACKING_START } from "./oStatsCalendar_custom";

export const O_STATS_SOURCE_PARAM_CUSTOM = "oSource";
// Mirrors sceneODateMostOsExcludedDay in internal/api/resolver_custom.go.
export const O_STATS_MOST_OS_EXCLUDED_DAY_CUSTOM = "2025-09-08";

export type AmateurMarked<T> = T & { amateur?: boolean };

export function markAmateurCustom<T extends object>(
  items: readonly T[]
): AmateurMarked<T>[] {
  return items.map((item) => ({ ...item, amateur: true }));
}

// A row key that cannot collide between instances.
export function amateurRowKeyCustom(id: string, amateur?: boolean) {
  return amateur ? `amateur-${id}` : id;
}

// Merges two lists already sorted by compare; ties keep this instance first.
export function mergeSortedCustom<T>(
  main: readonly T[],
  amateur: readonly T[],
  compare: (a: T, b: T) => number
): T[] {
  const merged: T[] = [];
  let i = 0;
  let j = 0;
  while (i < main.length || j < amateur.length) {
    if (
      j >= amateur.length ||
      (i < main.length && compare(main[i], amateur[j]) <= 0)
    ) {
      merged.push(main[i++]);
    } else {
      merged.push(amateur[j++]);
    }
  }
  return merged;
}

export function byCountDescCustom(a: { count: number }, b: { count: number }) {
  return b.count - a.count;
}

// Adds counts with the same key; keys only the amateur has follow in its order.
export function sumCountsByKeyCustom<T extends { count: number }>(
  main: readonly T[],
  amateur: readonly T[],
  keyOf: (item: T) => string | number
): T[] {
  const merged = new Map<string | number, T>();
  for (const item of [...main, ...amateur]) {
    const key = keyOf(item);
    const current = merged.get(key);
    merged.set(
      key,
      current ? { ...current, count: current.count + item.count } : item
    );
  }
  return Array.from(merged.values());
}

export function sumCountsWithUnknownCustom<T extends { count: number }>(
  main: { counts: readonly T[]; unknown_count: number },
  amateur: { counts: readonly T[]; unknown_count: number },
  keyOf: (item: T) => string | number
) {
  return {
    counts: sumCountsByKeyCustom(main.counts, amateur.counts, keyOf),
    unknown_count: main.unknown_count + amateur.unknown_count,
  };
}

export type OStatsTagCountCustom = {
  tag_id: string;
  tag_name: string;
  count: number;
  // Set when only the amateur instance has the tag; tag_id is its ID.
  amateur?: boolean;
};

// Tags are matched by name, ignoring case, since IDs differ per instance.
export function mergeTagCountsByNameCustom(
  main: readonly { tag_id: string; tag_name: string; count: number }[],
  amateur: readonly { tag_id: string; tag_name: string; count: number }[]
): OStatsTagCountCustom[] {
  const merged = new Map<string, OStatsTagCountCustom>();
  for (const tag of main) merged.set(tag.tag_name.toLowerCase(), { ...tag });
  for (const tag of amateur) {
    const key = tag.tag_name.toLowerCase();
    const current = merged.get(key);
    if (current && !current.amateur) {
      current.count += tag.count;
    } else if (!current) {
      merged.set(key, { ...tag, amateur: true });
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => b.count - a.count || a.tag_name.localeCompare(b.tag_name)
  );
}

// The O Stats path for a tag row; the drilldown finds the other instance's
// tag with the same name.
export function oStatsTagPathCustom(tag: OStatsTagCountCustom) {
  return withAmateurSourceCustom(`/ostats/tag/${tag.tag_id}`, tag.amateur);
}

function withSearchParamCustom(path: string, name: string, value: string) {
  const [pathAndSearch, hash = ""] = path.split("#", 2);
  const [pathname, search = ""] = pathAndSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set(name, value);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

// Marks an O Stats path as an amateur scene, vato, studio, or tag drilldown.
export function withAmateurSourceCustom(path: string, amateur?: boolean) {
  return amateur
    ? withSearchParamCustom(path, O_STATS_SOURCE_PARAM_CUSTOM, "amateur")
    : path;
}

// True when the drilldown's scene, vato, studio, or tag ID is the amateur's.
export function readOStatsAmateurOnlyCustom(search: string) {
  return (
    new URLSearchParams(search).get(O_STATS_SOURCE_PARAM_CUSTOM) === "amateur"
  );
}

// Newest first, as every O timeline is ordered.
export function mergeEventsByDateCustom<T extends { o_date: string }>(
  main: readonly T[],
  amateur: readonly T[]
): T[] {
  return mergeSortedCustom(
    main,
    amateur,
    (a, b) => Date.parse(b.o_date) - Date.parse(a.o_date)
  );
}

export type OStatsMomentCustom = { at: string; day: string };

// Which slice of each instance's timeline fills one page of the merged
// timeline. Both lists are newest first; equal times put this instance first.
export function splitMergedTimelinePageCustom(
  main: readonly OStatsMomentCustom[],
  amateur: readonly OStatsMomentCustom[],
  offset: number,
  size: number
) {
  let i = 0;
  let j = 0;
  const order: Array<"main" | "amateur"> = [];
  const take = () => {
    const fromMain =
      j >= amateur.length || (i < main.length && main[i].at >= amateur[j].at);
    if (fromMain) i++;
    else j++;
    return fromMain ? "main" : "amateur";
  };
  while (i + j < offset && i + j < main.length + amateur.length) take();
  const start = { main: i, amateur: j };
  while (order.length < size && i + j < main.length + amateur.length) {
    order.push(take());
  }
  return {
    main: { offset: start.main, count: i - start.main },
    amateur: { offset: start.amateur, count: j - start.amateur },
    order,
  };
}

// Lays out a merged page from each instance's slice in the split order.
export function zipMergedTimelinePageCustom<T>(
  order: ReadonlyArray<"main" | "amateur">,
  main: readonly T[],
  amateur: readonly T[]
): T[] {
  let i = 0;
  let j = 0;
  return order.flatMap((source) => {
    const item = source === "main" ? main[i++] : amateur[j++];
    return item === undefined ? [] : [item];
  });
}

// The last day a dry spell can run to: today, or the range end if earlier.
export function oStatsRecordsEndDayCustom(
  to: string | null | undefined,
  today: string
) {
  return to && to < today ? to : today;
}

function dayNumber(day: string) {
  return Date.parse(`${day}T00:00:00Z`) / 86_400_000;
}

function dayString(value: number) {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

// Most O's in a day and the longest dry spell over local O days (one entry
// per O), matching MostOsInDay and LongestPeriodWithoutO on the server.
export function oStatsRecordsCustom(days: readonly string[], endDay: string) {
  const tracked = days.filter((day) => day >= O_STATS_TRACKING_START);
  const perDay = new Map<string, number>();
  for (const day of tracked) perDay.set(day, (perDay.get(day) ?? 0) + 1);

  let mostOsInDay: { date: string; count: number } | undefined;
  for (const [date, count] of perDay) {
    if (date === O_STATS_MOST_OS_EXCLUDED_DAY_CUSTOM) continue;
    if (
      !mostOsInDay ||
      count > mostOsInDay.count ||
      (count === mostOsInDay.count && date < mostOsInDay.date)
    ) {
      mostOsInDay = { date, count };
    }
  }

  const distinct = Array.from(perDay.keys()).sort().map(dayNumber);
  if (distinct.length === 0) return { mostOsInDay };

  let best = -1;
  let start = distinct[0];
  let end = distinct[0];
  for (let index = 1; index < distinct.length; index++) {
    const gap = distinct[index] - distinct[index - 1] - 1;
    if (gap > best) {
      best = gap;
      start = distinct[index - 1] + 1;
      end = distinct[index] - 1;
    }
  }
  const last = distinct[distinct.length - 1];
  const finalDay = dayNumber(endDay);
  const current = finalDay - last;
  if (current > best) {
    best = current;
    start = current === 0 ? finalDay : last + 1;
    end = finalDay;
  }
  if (best < 0) {
    best = 0;
    start = last;
    end = last;
  }
  return {
    mostOsInDay,
    longestPeriodWithoutO: {
      days: best,
      start_date: dayString(start),
      end_date: dayString(end),
    },
  };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// A link into the amateur app. A localhost URL follows the host this page was
// opened on, so the link also works from another device on the network.
export function amateurAppUrlCustom(
  instanceUrl: string,
  path: string,
  currentHost: string
) {
  try {
    const url = new URL(instanceUrl.trim());
    if (LOCAL_HOSTS.has(url.hostname) && !LOCAL_HOSTS.has(currentHost)) {
      url.hostname = currentHost;
    }
    return `${url.origin}${url.pathname.replace(/\/$/, "")}${path}`;
  } catch {
    return path;
  }
}
