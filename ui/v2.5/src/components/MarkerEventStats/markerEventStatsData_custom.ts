import { cleanStatsValueCustom as cleanValue } from "src/utils/statsValues_custom"; // CUSTOM
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
  | "per_scene";

// How a chart draws: columns for ordered values, ranked rows for categories,
// mirror for giver vs receiver (the receiver chart rides along), grid for
// giver → receiver pairs, none for filters with no chart of their own.
export type MarkerEventChartDisplay =
  | "columns"
  | "ranked"
  | "mirror"
  | "grid"
  | "none";

export interface IMarkerEventChartDefinition {
  key: MarkerEventChartCategory;
  label: string;
  display: MarkerEventChartDisplay;
  // The receiver chart drawn on the right of a mirror.
  mirror?: MarkerEventChartCategory;
  // Shown when one event can land in several bars.
  note?: string;
  sortable?: boolean;
  // Columns stacked by Regular, Really Hot and GOAT.
  stacked?: boolean;
  // Topic group the chart sits in; charts are listed in page order.
  group?: string;
  // Row share: three small, two medium (default) or one wide chart per row.
  size?: "small" | "wide";
}

export type MarkerEventQuality = "REGULAR" | "REALLY_HOT" | "GOAT";

export const MARKER_EVENT_QUALITIES: MarkerEventQuality[] = [
  "REGULAR",
  "REALLY_HOT",
  "GOAT",
];

export const MARKER_EVENT_QUALITY_LABELS: Record<MarkerEventQuality, string> = {
  REGULAR: "Regular",
  REALLY_HOT: "Really Hot",
  GOAT: "GOAT",
};

export function markerEventQuality(quality: string): MarkerEventQuality {
  return MARKER_EVENT_QUALITIES.includes(quality as MarkerEventQuality)
    ? (quality as MarkerEventQuality)
    : "REGULAR";
}

function qualityRank(quality: string) {
  return MARKER_EVENT_QUALITIES.indexOf(markerEventQuality(quality));
}

export interface IMarkerEventChartDatum {
  key: string;
  label: string;
  count: number;
  sortValue: number;
  // Events per quality, for stacked columns.
  qualities: Record<MarkerEventQuality, number>;
}

export interface IMarkerEventStatsContext {
  performers: Map<string, IMarkerEventPerformer>;
  typeNames: Map<string, string>;
  // Events in each scene, over every loaded event.
  sceneEventCounts: Map<string, number>;
}

export const MARKER_EVENT_UNKNOWN = "__unknown__";
const PLAIN_TYPE = "__plain__";
const NO_SORT = Number.MAX_SAFE_INTEGER;

const RECEIVER_NOTE =
  "A facial counts once for each receiver, so bars can overlap.";

export const NUT_STATS_CHARTS: IMarkerEventChartDefinition[] = [
  {
    key: "per_scene",
    label: "Nuts Per Scene",
    display: "columns",
    sortable: true,
    stacked: true,
    group: "The Nuts",
    size: "small",
  },
  {
    key: "quality",
    label: "Quality",
    display: "columns",
    group: "The Nuts",
    size: "small",
  },
  {
    key: "o_count",
    label: "By O Count",
    display: "columns",
    sortable: true,
    stacked: true,
    group: "The Nuts",
    size: "small",
  },
  {
    key: "giver_age",
    label: "Age at Scene",
    display: "columns",
    sortable: true,
    stacked: true,
    group: "The Vatos",
    size: "wide",
  },
  {
    key: "giver_ethnicity",
    label: "By Ethnicity",
    display: "ranked",
    group: "The Vatos",
  },
  {
    key: "giver_country",
    label: "By Country",
    display: "ranked",
    group: "The Vatos",
  },
  {
    key: "activity",
    label: "What He Was Doing",
    display: "ranked",
    note: "A nut counts once for each thing he was doing, so bars can overlap.",
    group: "The Action",
  },
  {
    key: "type",
    label: "By Type",
    display: "ranked",
    note: "A nut counts once for each type, so bars can overlap.",
    group: "The Action",
  },
];

// The giver → receiver grid sits under the cards, outside the groups.
export const FACIAL_STATS_CHARTS: IMarkerEventChartDefinition[] = [
  {
    key: "pair_ethnicity",
    label: "Giver → Receiver Ethnicity",
    display: "grid",
    note: RECEIVER_NOTE,
  },
  {
    key: "per_scene",
    label: "Facials Per Scene",
    display: "columns",
    sortable: true,
    stacked: true,
    group: "The Facials",
  },
  {
    key: "o_count",
    label: "By O Count",
    display: "columns",
    sortable: true,
    stacked: true,
    group: "The Facials",
  },
  {
    key: "quality",
    label: "Quality",
    display: "columns",
    group: "The Facials",
  },
  {
    key: "type",
    label: "By Type",
    display: "ranked",
    note: "A facial counts once for each type, so bars can overlap.",
    group: "The Facials",
  },
  {
    key: "giver_age",
    label: "Age at Scene",
    display: "mirror",
    mirror: "receiver_age",
    note: RECEIVER_NOTE,
    group: "The Vatos",
    size: "wide",
  },
  {
    key: "receiver_age",
    label: "Receiver Age at Scene",
    display: "none",
  },
  {
    key: "giver_ethnicity",
    label: "Ethnicity",
    display: "mirror",
    mirror: "receiver_ethnicity",
    note: RECEIVER_NOTE,
    group: "The Vatos",
  },
  {
    key: "receiver_ethnicity",
    label: "Receiver Ethnicity",
    display: "none",
  },
  {
    key: "giver_country",
    label: "Country",
    display: "mirror",
    mirror: "receiver_country",
    note: RECEIVER_NOTE,
    group: "The Vatos",
  },
  {
    key: "receiver_country",
    label: "Receiver Country",
    display: "none",
  },
];

const ACTIVITY_LABELS: Record<string, string> = {
  GETTING_FUCKED: "Getting fucked",
  FUCKING: "Fucking",
  GETTING_SUCKED: "Getting sucked",
  SUCKING: "Sucking",
  SOLO: "Solo",
};

export function buildMarkerEventStatsContext(
  events: readonly IMarkerEvent[],
  performers: readonly IMarkerEventPerformer[],
  types: readonly { id: string; name: string }[]
): IMarkerEventStatsContext {
  const sceneEventCounts = new Map<string, number>();
  events.forEach((event) =>
    sceneEventCounts.set(
      event.scene_id,
      (sceneEventCounts.get(event.scene_id) ?? 0) + 1
    )
  );
  return {
    performers: new Map(
      performers.map((performer) => [performer.id, performer])
    ),
    typeNames: new Map(types.map((type) => [type.id, type.name])),
    sceneEventCounts,
  };
}

type CategoryValue = { key: string; label: string; sortValue: number };

// Every count gets its own column; nothing folds into a "3+" or "4+" bar.
function countValue(count: number): CategoryValue {
  return { key: String(count), label: String(count), sortValue: count };
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
      return { values: [countValue(event.o_count)], unknown: false };
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
            label:
              MARKER_EVENT_QUALITY_LABELS[markerEventQuality(event.quality)],
            sortValue: qualityRank(event.quality),
          },
        ],
        unknown: false,
      };
    case "per_scene":
      return {
        values: [countValue(context.sceneEventCounts.get(event.scene_id) ?? 1)],
        unknown: false,
      };
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

// Nuts/Facials Per Scene count scenes; every other chart counts events. Shares
// are of the events with a known value, so Unknown never dilutes them.
export function buildMarkerEventChart(
  events: readonly IMarkerEvent[],
  category: MarkerEventChartCategory,
  context: IMarkerEventStatsContext
) {
  const buckets = new Map<string, IMarkerEventChartDatum>();
  let unknownCount = 0;
  let total = 0;
  const add = (value: CategoryValue, quality: string) => {
    const datum = buckets.get(value.key) ?? {
      ...value,
      count: 0,
      qualities: { REGULAR: 0, REALLY_HOT: 0, GOAT: 0 },
    };
    datum.count += 1;
    datum.qualities[markerEventQuality(quality)] += 1;
    buckets.set(value.key, datum);
  };

  if (category === "per_scene") {
    // A scene counts once, with its best facial.
    const best = new Map<string, IMarkerEvent>();
    events.forEach((event) => {
      const current = best.get(event.scene_id);
      if (!current || qualityRank(event.quality) > qualityRank(current.quality))
        best.set(event.scene_id, event);
    });
    best.forEach((event) => {
      const { values } = markerEventCategoryValues(event, category, context);
      values.forEach((value) => add(value, event.quality));
    });
    total = best.size;
  } else {
    events.forEach((event) => {
      const { values, unknown } = markerEventCategoryValues(
        event,
        category,
        context
      );
      if (unknown) unknownCount += 1;
      if (values.length > 0) total += 1;
      new Map(values.map((value) => [value.key, value])).forEach((value) =>
        add(value, event.quality)
      );
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
  | "scene_rating"
  | "duration";

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
];

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
    case "scene_rating":
      return event.scene_rating100 ?? -1;
    case "duration":
      return event.duration;
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
    scene_rating: event.scene_rating100 ?? null,
    duration: event.duration,
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
