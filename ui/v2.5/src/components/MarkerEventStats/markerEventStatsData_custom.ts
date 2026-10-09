// CUSTOM: chart data for Nut Stats and Facial Stats. Every total, ranking,
// and chart is built from the loaded events, so chart filters apply to all.
import { statsCountryName } from "src/utils/statsCountry_custom";
import { rankStatsItems } from "src/utils/statsRanking_custom";
import type { ISortMetricBadgeCustom } from "src/components/Shared/SortMetricBadge_custom";

export interface IMarkerEventVato {
  performer_id: string;
  age?: number | null;
}

export interface IMarkerEvent {
  marker_id: string;
  scene_id: string;
  scene_title?: string | null;
  scene_rating100?: number | null;
  scene_date?: string | null;
  duration: number;
  giver?: IMarkerEventVato | null;
  receivers: IMarkerEventVato[];
  o_count: number;
  latest_o_date?: string | null;
  type_tag_ids: string[];
  quality: string;
  activities: string[];
}

export interface IMarkerEventPerformer {
  id: string;
  name: string;
  image_path?: string | null;
  rating100?: number | null;
  ethnicity?: string | null;
  country?: string | null;
}

export type MarkerEventChartCategory =
  | "giver_ethnicity"
  | "giver_age"
  | "giver_country"
  | "receiver_ethnicity"
  | "receiver_age"
  | "receiver_country"
  | "pair_ethnicity"
  | "o_count"
  | "activity"
  | "type"
  | "quality"
  | "group";

export interface IMarkerEventChartDefinition {
  key: MarkerEventChartCategory;
  label: string;
  // Shown when one event can land in several bars.
  note?: string;
  sortable?: boolean;
  // Low-cardinality charts share a row.
  compact?: boolean;
}

export interface IMarkerEventChartDatum {
  key: string;
  label: string;
  count: number;
  sortValue: number;
}

export interface IMarkerEventStatsContext {
  performers: Map<string, IMarkerEventPerformer>;
  typeNames: Map<string, string>;
  // Distinct givers each receiver got in a scene, over every loaded event.
  groupSizes: Map<string, number>;
}

export const MARKER_EVENT_UNKNOWN = "__unknown__";
const PLAIN_TYPE = "__plain__";
const NO_SORT = Number.MAX_SAFE_INTEGER;

const RECEIVER_NOTE =
  "A facial counts once for each receiver, so bars can overlap.";

export const NUT_STATS_CHARTS: IMarkerEventChartDefinition[] = [
  { key: "giver_ethnicity", label: "By Ethnicity" },
  { key: "giver_age", label: "Age at Scene", sortable: true },
  { key: "giver_country", label: "By Country" },
  {
    key: "activity",
    label: "What He Was Doing",
    note: "A nut counts once for each thing he was doing, so bars can overlap.",
    compact: true,
  },
  {
    key: "type",
    label: "By Type",
    note: "A nut counts once for each type, so bars can overlap.",
    compact: true,
  },
  { key: "quality", label: "Really Hot", compact: true },
  { key: "o_count", label: "By O Count", sortable: true, compact: true },
];

export const FACIAL_STATS_CHARTS: IMarkerEventChartDefinition[] = [
  {
    key: "pair_ethnicity",
    label: "Giver → Receiver Ethnicity",
    note: RECEIVER_NOTE,
  },
  { key: "giver_ethnicity", label: "Giver Ethnicity" },
  {
    key: "receiver_ethnicity",
    label: "Receiver Ethnicity",
    note: RECEIVER_NOTE,
  },
  { key: "giver_age", label: "Giver Age at Scene", sortable: true },
  {
    key: "receiver_age",
    label: "Receiver Age at Scene",
    note: RECEIVER_NOTE,
    sortable: true,
  },
  { key: "giver_country", label: "Giver Country" },
  { key: "receiver_country", label: "Receiver Country", note: RECEIVER_NOTE },
  { key: "quality", label: "Really Hot", compact: true },
  {
    key: "type",
    label: "By Type",
    note: "A facial counts once for each type, so bars can overlap.",
    compact: true,
  },
  { key: "group", label: "Group Facials", sortable: true, compact: true },
  { key: "o_count", label: "By O Count", sortable: true, compact: true },
];

const ACTIVITY_LABELS: Record<string, string> = {
  GETTING_FUCKED: "Getting fucked",
  FUCKING: "Fucking",
  GETTING_SUCKED: "Getting sucked",
  SUCKING: "Sucking",
  SOLO: "Solo",
};

const QUALITY_LABELS: Record<string, string> = {
  REGULAR: "Regular",
  REALLY_HOT: "Really Hot",
  GOAT: "GOAT",
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

function groupKey(sceneID: string, receiverID: string) {
  return `${sceneID}:${receiverID}`;
}

export function buildMarkerEventStatsContext(
  events: readonly IMarkerEvent[],
  performers: readonly IMarkerEventPerformer[],
  types: readonly { id: string; name: string }[]
): IMarkerEventStatsContext {
  const givers = new Map<string, Set<string>>();
  events.forEach((event) => {
    const giver = event.giver?.performer_id ?? `marker:${event.marker_id}`;
    event.receivers.forEach((receiver) => {
      const key = groupKey(event.scene_id, receiver.performer_id);
      const current = givers.get(key) ?? new Set<string>();
      current.add(giver);
      givers.set(key, current);
    });
  });
  return {
    performers: new Map(
      performers.map((performer) => [performer.id, performer])
    ),
    typeNames: new Map(types.map((type) => [type.id, type.name])),
    groupSizes: new Map(
      Array.from(givers, ([key, giverIDs]) => [key, giverIDs.size])
    ),
  };
}

type CategoryValue = { key: string; label: string; sortValue: number };

function cappedCountValue(count: number, singular?: string, plural?: string) {
  const capped = Math.min(count, 3);
  const key = count >= 3 ? "3+" : String(count);
  const suffix =
    singular && plural ? ` ${count === 1 ? singular : plural}` : "";
  return { key, label: `${key}${suffix}`, sortValue: capped };
}

function vatoValue(
  vato: IMarkerEventVato,
  category: "ethnicity" | "country" | "age",
  context: IMarkerEventStatsContext
): CategoryValue | undefined {
  if (category === "age") {
    return typeof vato.age === "number"
      ? { key: String(vato.age), label: String(vato.age), sortValue: vato.age }
      : undefined;
  }
  const performer = context.performers.get(vato.performer_id);
  const value = cleanValue(performer?.[category]);
  if (!value) return undefined;
  return {
    key: value,
    label: category === "country" ? statsCountryName(value) : value,
    sortValue: NO_SORT,
  };
}

function receiverValues(
  event: IMarkerEvent,
  valueOf: (receiver: IMarkerEventVato) => CategoryValue | undefined
) {
  const values = event.receivers.map(valueOf);
  return {
    values: values.filter((value): value is CategoryValue => !!value),
    unknown: values.length === 0 || values.some((value) => !value),
  };
}

// The bars an event lands in; unknown marks the Unknown badge.
export function markerEventCategoryValues(
  event: IMarkerEvent,
  category: MarkerEventChartCategory,
  context: IMarkerEventStatsContext
): { values: CategoryValue[]; unknown: boolean } {
  switch (category) {
    case "giver_ethnicity":
    case "giver_country":
    case "giver_age": {
      const field = category.replace("giver_", "") as
        | "ethnicity"
        | "country"
        | "age";
      const value = event.giver
        ? vatoValue(event.giver, field, context)
        : undefined;
      return { values: value ? [value] : [], unknown: !value };
    }
    case "receiver_ethnicity":
    case "receiver_country":
    case "receiver_age": {
      const field = category.replace("receiver_", "") as
        | "ethnicity"
        | "country"
        | "age";
      return receiverValues(event, (receiver) =>
        vatoValue(receiver, field, context)
      );
    }
    case "pair_ethnicity": {
      const giver = event.giver
        ? vatoValue(event.giver, "ethnicity", context)
        : undefined;
      return receiverValues(event, (receiver) => {
        const value = vatoValue(receiver, "ethnicity", context);
        return giver && value
          ? {
              key: `${giver.key}|${value.key}`,
              label: `${giver.label} → ${value.label}`,
              sortValue: NO_SORT,
            }
          : undefined;
      });
    }
    case "o_count":
      return { values: [cappedCountValue(event.o_count)], unknown: false };
    case "activity": {
      const values = event.activities.map((activity) => ({
        key: activity,
        label: ACTIVITY_LABELS[activity] ?? activity,
        sortValue: Object.keys(ACTIVITY_LABELS).indexOf(activity),
      }));
      return { values, unknown: values.length === 0 };
    }
    case "type":
      return {
        values:
          event.type_tag_ids.length === 0
            ? [{ key: PLAIN_TYPE, label: "Plain", sortValue: NO_SORT }]
            : event.type_tag_ids.map((id) => ({
                key: id,
                label: context.typeNames.get(id) ?? `Tag ${id}`,
                sortValue: NO_SORT,
              })),
        unknown: false,
      };
    case "quality":
      return {
        values: [
          {
            key: event.quality,
            label: QUALITY_LABELS[event.quality] ?? event.quality,
            sortValue: Object.keys(QUALITY_LABELS).indexOf(event.quality),
          },
        ],
        unknown: false,
      };
    case "group":
      return receiverValues(event, (receiver) => {
        const size = context.groupSizes.get(
          groupKey(event.scene_id, receiver.performer_id)
        );
        return size ? cappedCountValue(size, "giver", "givers") : undefined;
      });
  }
}

export function markerEventMatchesFilter(
  event: IMarkerEvent,
  filter: { category: MarkerEventChartCategory; value: string },
  context: IMarkerEventStatsContext
) {
  const { values, unknown } = markerEventCategoryValues(
    event,
    filter.category,
    context
  );
  return filter.value === MARKER_EVENT_UNKNOWN
    ? unknown
    : values.some((value) => value.key === filter.value);
}

function sortChartData(data: IMarkerEventChartDatum[]) {
  return data.sort((a, b) =>
    a.sortValue !== NO_SORT || b.sortValue !== NO_SORT
      ? a.sortValue - b.sortValue
      : b.count - a.count || a.label.localeCompare(b.label)
  );
}

// Group Facials counts receivers in a scene; every other chart counts events.
export function buildMarkerEventChart(
  events: readonly IMarkerEvent[],
  category: MarkerEventChartCategory,
  context: IMarkerEventStatsContext
) {
  const buckets = new Map<string, IMarkerEventChartDatum>();
  let unknownCount = 0;
  let total = events.length;

  if (category === "group") {
    const counted = new Set<string>();
    events.forEach((event) =>
      event.receivers.forEach((receiver) => {
        const key = groupKey(event.scene_id, receiver.performer_id);
        const size = context.groupSizes.get(key);
        if (!size || counted.has(key)) return;
        counted.add(key);
        const value = cappedCountValue(size, "giver", "givers");
        const datum = buckets.get(value.key) ?? { ...value, count: 0 };
        datum.count += 1;
        buckets.set(value.key, datum);
      })
    );
    total = counted.size;
  } else {
    events.forEach((event) => {
      const { values, unknown } = markerEventCategoryValues(
        event,
        category,
        context
      );
      if (unknown) unknownCount += 1;
      new Map(values.map((value) => [value.key, value])).forEach((value) => {
        const datum = buckets.get(value.key) ?? { ...value, count: 0 };
        datum.count += 1;
        buckets.set(value.key, datum);
      });
    });
  }

  return {
    data: sortChartData(Array.from(buckets.values())),
    unknownCount,
    total,
  };
}

export function markerEventStatsSummary(events: readonly IMarkerEvent[]) {
  return {
    count: events.length,
    seconds: events.reduce((total, event) => total + event.duration, 0),
    // Same estimate the Vato Stats card used: 3 mL per nut.
    liters: (events.length * 3) / 1000,
  };
}

export type MarkerEventSort =
  | "o_count"
  | "latest_o"
  | "hotness"
  | "scene_rating"
  | "duration"
  | "release_date";

export const MARKER_EVENT_SORTS: Array<
  Omit<ISortMetricBadgeCustom, "value"> & {
    key: MarkerEventSort;
    label: string;
  }
> = [
  { key: "o_count", label: "O Count", messageID: "o_count", format: "count" },
  {
    key: "latest_o",
    label: "Latest O",
    messageID: "last_o_at",
    format: "datetime",
  },
  { key: "hotness", label: "Hotness", messageID: "hotness", format: "text" },
  {
    key: "scene_rating",
    label: "Scene Rating",
    messageID: "rating",
    format: "rating",
  },
  {
    key: "duration",
    label: "Length",
    messageID: "duration",
    format: "duration",
  },
  {
    key: "release_date",
    label: "Release Date",
    messageID: "date",
    format: "date",
  },
];

const QUALITY_RANK: Record<string, number> = {
  REGULAR: 0,
  REALLY_HOT: 1,
  GOAT: 2,
};

function timestamp(value?: string | null) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function markerEventSortValue(event: IMarkerEvent, sort: MarkerEventSort) {
  switch (sort) {
    case "o_count":
      return event.o_count;
    case "latest_o":
      return timestamp(event.latest_o_date);
    case "hotness":
      return QUALITY_RANK[event.quality] ?? 0;
    case "scene_rating":
      return event.scene_rating100 ?? -1;
    case "duration":
      return event.duration;
    case "release_date":
      return timestamp(event.scene_date);
  }
}

// One entry per marker, highest first. Ties go to more O's, then the most
// recent O, so equal O counts favor what got you off lately.
export function rankMarkerEventMarkers(
  events: readonly IMarkerEvent[],
  sort: MarkerEventSort
) {
  return Array.from(
    new Map(events.map((event) => [event.marker_id, event])).values()
  )
    .map((event) => ({
      event,
      value: markerEventSortValue(event, sort),
      latest: timestamp(event.latest_o_date),
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        b.event.o_count - a.event.o_count ||
        b.latest - a.latest ||
        Number(b.event.marker_id) - Number(a.event.marker_id)
    )
    .map(({ event }) => event);
}

// The ranked value shown on each marker card.
export function markerEventSortMetric(
  event: IMarkerEvent,
  sort: MarkerEventSort
): ISortMetricBadgeCustom {
  const definition =
    MARKER_EVENT_SORTS.find((option) => option.key === sort) ??
    MARKER_EVENT_SORTS[0];
  const values: Record<MarkerEventSort, ISortMetricBadgeCustom["value"]> = {
    o_count: event.o_count,
    latest_o: event.latest_o_date ?? null,
    hotness: QUALITY_LABELS[event.quality] ?? event.quality,
    scene_rating: event.scene_rating100 ?? null,
    duration: event.duration,
    release_date: event.scene_date ?? null,
  };
  return {
    messageID: definition.messageID,
    format: definition.format,
    value: values[definition.key],
  };
}

// Givers count their events; receivers count the events they received.
export function rankMarkerEventVatos(
  events: readonly IMarkerEvent[],
  role: "giver" | "receiver",
  context: IMarkerEventStatsContext
) {
  const counts = new Map<string, number>();
  events.forEach((event) => {
    const ids =
      role === "giver"
        ? event.giver
          ? [event.giver.performer_id]
          : []
        : event.receivers.map((receiver) => receiver.performer_id);
    new Set(ids).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  });
  return rankStatsItems(
    Array.from(counts, ([id, count]) => ({
      performer: context.performers.get(id) ?? { id, name: `Vato ${id}` },
      count,
    })),
    (item) => item.count,
    (item) => item.performer.name
  );
}

export function markerEventScenes(events: readonly IMarkerEvent[]) {
  return Array.from(
    new Map(
      events.map((event) => [
        event.scene_id,
        { id: event.scene_id, title: event.scene_title },
      ])
    ).values()
  );
}
