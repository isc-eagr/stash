import {
  StatsPageSkeleton,
  StatsSectionSkeleton,
} from "src/components/Shared/CardGridSkeleton_custom"; // CUSTOM
import {
  formatAppDateCustom,
  getAppLocaleCustom,
} from "src/utils/appLocale_custom"; // CUSTOM
import { cleanStatsValueCustom } from "src/utils/statsValues_custom"; // CUSTOM
import React, { useMemo } from "react";
// CUSTOM: preview, paged history, and drilldowns share the event rows.
import {
  OStatsEventList,
  OStatsLatest,
  OStatsFullTimeline,
} from "./OStatsTimeline_custom";
import {
  OStatsTimelineEventFragmentDoc,
  type OStatsTimelineEventFragment as SceneOEvent,
} from "src/core/generated-graphql";
import {
  O_STATS_TIMELINE_PATH_CUSTOM,
  oStatsTimelinePageCustom,
  oStatsTimelineSearchCustom,
} from "./oStatsTimelinePaging_custom";
import { gql, useQuery, type DocumentNode } from "@apollo/client";
import { Alert, Button, ButtonGroup } from "react-bootstrap";
import { Helmet } from "react-helmet";
import {
  Link,
  RouteComponentProps,
  useLocation,
  useHistory,
} from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { StatsPage } from "src/components/StatsPage_custom";
import {
  StatsBarChart,
  type IStatsBarDatum,
} from "src/components/StatsBarChart_custom"; // CUSTOM
import { StatsDateRangeFilter } from "src/components/StatsDateRangeFilter_custom"; // CUSTOM
import { useConfigurationContext } from "src/hooks/Config";
import { useStatsDateRange } from "src/hooks/useStatsDateRange_custom"; // CUSTOM
import { useTitleProps } from "src/hooks/title";
import { statsCountryName } from "src/utils/statsCountry_custom";
import {
  addStatsDateRangeToPath,
  formatStatsLocalDate,
  writeStatsDateRange,
} from "src/utils/statsDateRange_custom"; // CUSTOM
import { metallicRatingChartBucket } from "src/utils/metallicRatingChart_custom"; // CUSTOM
import {
  addOStatsStudioScopeToPath,
  getOStatsStudioScopeVariables,
  readOStatsStudioScope,
} from "./oStatsStudioScope_custom"; // CUSTOM
import type { IOStatsStudioScope } from "./oStatsStudioScope_custom"; // CUSTOM
import { partitionOStatsMarkerTagCountsCustom } from "./oStatsMarkerTagCharts_custom"; // CUSTOM
import {
  fillOStatsDays,
  fillOStatsMonths,
  oStatsYears,
} from "./oStatsDateSeries_custom"; // CUSTOM
import {
  O_STATS_UNKNOWN_BUCKET,
  oStatsBucketCounts,
  oStatsRatingBucket,
  oStatsSceneIDsInBucket,
  oStatsTierBucket,
  type OStatsSceneCount,
} from "./oStatsSceneBuckets_custom"; // CUSTOM
import { OStatsCalendarHeatmap } from "./OStatsCalendarHeatmap_custom"; // CUSTOM
import { StatsTopCards } from "src/components/StatsTopCards_custom"; // CUSTOM
import {
  StatsChartGroup,
  StatsCountryFlag,
  StatsKpiRow,
} from "src/components/StatsCharts_custom"; // CUSTOM
import { statsMetallicColor } from "src/utils/statsChartColors_custom";
import { formatStatsBarPercent } from "src/utils/statsBarChart_custom"; // CUSTOM

// CUSTOM: begin - amateur instance O's merged into O Stats.
import {
  OStatsEventMomentsDocument,
  type OStatsEventMomentsQuery,
} from "src/core/generated-graphql";
import { OStatsAmateurNotice } from "./OStatsAmateurNotice_custom";
import {
  useAmateurOStatsCustom,
  useBothOStatsQueriesCustom,
  type IAmateurOStats,
} from "./useAmateurOStats_custom";
import {
  amateurRowKeyCustom,
  byCountDescCustom,
  markAmateurCustom,
  mergeEventsByDateCustom,
  mergeSortedCustom,
  mergeTagCountsByNameCustom,
  oStatsRecordsCustom,
  oStatsRecordsEndDayCustom,
  oStatsTagPathCustom,
  readOStatsAmateurOnlyCustom,
  sumCountsByKeyCustom,
  sumCountsWithUnknownCustom,
  withAmateurSourceCustom,
  type AmateurMarked,
} from "./oStatsAmateur_custom";
// CUSTOM: end
import "./OStats.scss";

// CUSTOM: begin - every O Stats query accepts the studio tree and the O-date range.
const O_EVENT_FIELDS = OStatsTimelineEventFragmentDoc;

const SCOPE_VARIABLES =
  "$studioId: ID, $depth: Int, $dateRange: StatsDateRangeInput";
const SCOPE_ARGUMENTS =
  "studio_id: $studioId, depth: $depth, date_range: $dateRange";

function eventsQuery(
  operation: string,
  field: string,
  variables = "",
  argumentsList = ""
) {
  return gql`
    query ${operation}(${variables}${SCOPE_VARIABLES}) {
      events: ${field}(${argumentsList}${SCOPE_ARGUMENTS}) {
        ...OStatsTimelineEvent
      }
    }
    ${O_EVENT_FIELDS}
  `;
}

const EVENT_QUERIES = {
  date: eventsQuery(
    "OStatsEventsByDate",
    "sceneOEventsByDate",
    "$date: String!, ",
    "date: $date, "
  ),
  tag: eventsQuery(
    "OStatsEventsByTag",
    "sceneOEventsByTag",
    "$tagID: ID!, ",
    "tagID: $tagID, "
  ),
  unknownMarkerTag: eventsQuery(
    "OStatsEventsWithoutMarkerTags",
    "sceneOEventsWithoutMarkerTags"
  ),
  ethnicity: eventsQuery(
    "OStatsEventsByEthnicity",
    "sceneOEventsByEthnicity",
    "$ethnicity: String!, ",
    "ethnicity: $ethnicity, "
  ),
  country: eventsQuery(
    "OStatsEventsByCountry",
    "sceneOEventsByCountry",
    "$country: String!, ",
    "country: $country, "
  ),
  unknownStudio: eventsQuery(
    "OStatsEventsWithUnknownStudio",
    "sceneOEventsWithUnknownStudio"
  ),
  age: eventsQuery(
    "OStatsEventsByPerformerAge",
    "sceneOEventsByPerformerAge",
    "$age: Int!, ",
    "age: $age, "
  ),
  unknownAge: eventsQuery(
    "OStatsEventsWithUnknownPerformerAge",
    "sceneOEventsWithUnknownPerformerAge"
  ),
  releaseYear: eventsQuery(
    "OStatsEventsByReleaseYear",
    "sceneOEventsByReleaseYear",
    "$year: Int!, ",
    "year: $year, "
  ),
  unknownReleaseYear: eventsQuery(
    "OStatsEventsWithUnknownReleaseYear",
    "sceneOEventsWithUnknownReleaseYear"
  ),
  unknownDate: eventsQuery(
    "OStatsEventsBeforeTrackingStart",
    "sceneOEventsBeforeTrackingStart"
  ),
  performer: eventsQuery(
    "OStatsEventsByPerformer",
    "sceneOEventsByPerformer",
    "$performerID: ID!, ",
    "performerID: $performerID, "
  ),
  scene: eventsQuery(
    "OStatsEventsByScene",
    "sceneOEventsByScene",
    "$sceneID: ID!, ",
    "sceneID: $sceneID, "
  ),
  scenes: eventsQuery(
    "OStatsEventsByScenes",
    "sceneOEventsByScenes",
    "$sceneIDs: [ID!]!, ",
    "sceneIDs: $sceneIDs, "
  ),
};

// The studio drilldown names its own studio, so the scope uses scope_studio_id.
const EVENTS_BY_STUDIO = gql`
  query OStatsEventsByStudio(
    $studioID: ID!
    $studioId: ID
    $depth: Int
    $dateRange: StatsDateRangeInput
  ) {
    events: sceneOEventsByStudio(
      studioID: $studioID
      scope_studio_id: $studioId
      depth: $depth
      date_range: $dateRange
    ) {
      ...OStatsTimelineEvent
    }
  }
  ${O_EVENT_FIELDS}
`;

const ENTITY_NAMES = gql`
  query OStatsEntityNames(
    $performerId: ID!
    $sceneId: ID!
    $studioId: ID!
    $tagId: ID!
    $withPerformer: Boolean!
    $withScene: Boolean!
    $withStudio: Boolean!
    $withTag: Boolean!
  ) {
    findPerformer(id: $performerId) @include(if: $withPerformer) {
      id
      name
    }
    findScene(id: $sceneId) @include(if: $withScene) {
      id
      title
    }
    findStudio(id: $studioId) @include(if: $withStudio) {
      id
      name
    }
    findTag(id: $tagId) @include(if: $withTag) {
      id
      name
    }
  }
`;

// CUSTOM: the other instance's tag with the same name, for tag drilldowns.
const TAG_BY_NAME = gql`
  query OStatsTagByName($name: String!) {
    findTags(
      tag_filter: { name: { value: $name, modifier: EQUALS } }
      filter: { per_page: 1 }
    ) {
      tags {
        id
      }
    }
  }
`;

// One request for every overview aggregate. Records and the By Studio chart
// are global-only, so embedded Studio O Stats leaves them out.
const O_STATS_OVERVIEW = gql`
  query OStatsOverview(
    $studioId: ID
    $depth: Int
    $dateRange: StatsDateRangeInput
    $includeGlobal: Boolean!
  ) {
    calendarYears: sceneOYearCounts(studio_id: $studioId, depth: $depth) {
      year
    }
    years: sceneOYearCounts(${SCOPE_ARGUMENTS}) {
      year
      count
    }
    mostOsInDay(${SCOPE_ARGUMENTS}) @include(if: $includeGlobal) {
      date
      count
    }
    longestPeriodWithoutO(${SCOPE_ARGUMENTS}) @include(if: $includeGlobal) {
      days
      start_date
      end_date
    }
    byTag: sceneOCountsByTag(${SCOPE_ARGUMENTS}) {
      tag_id
      tag_name
      count
    }
    withoutMarkerTags: sceneOCountWithoutMarkerTags(${SCOPE_ARGUMENTS})
    byEthnicity: sceneOCountsByEthnicity(${SCOPE_ARGUMENTS}) {
      ethnicity
      count
    }
    byCountry: sceneOCountsByCountry(${SCOPE_ARGUMENTS}) {
      country
      count
    }
    byStudio: sceneOCountsByStudio(${SCOPE_ARGUMENTS})
      @include(if: $includeGlobal) {
      counts {
        studio_id
        studio_name
        count
      }
      unknown_count
    }
    byAge: sceneOCountsByPerformerAge(${SCOPE_ARGUMENTS}) {
      counts {
        age
        count
      }
      unknown_count
    }
    byReleaseYear: sceneOCountsByReleaseYear(${SCOPE_ARGUMENTS}) {
      counts {
        year
        count
      }
      unknown_count
    }
    unreliableDateCount: sceneOUnreliableDateCount(${SCOPE_ARGUMENTS})
    byPerformer: sceneOCountsByPerformer(${SCOPE_ARGUMENTS}) {
      performer_id
      performer_name
      image_path
      rating100
      count
    }
  }
`;

const O_STATS_SCENE_COUNTS = gql`
  query OStatsSceneCounts(${SCOPE_VARIABLES}) {
    sceneOCountsByScene(${SCOPE_ARGUMENTS}) {
      scene_id
      title
      screenshot_path
      rating100
      tag_ids
      has_royal_sapphire_bonus
      count
    }
  }
`;

const SCENE_O_MONTH_COUNTS = gql`
  query OStatsSceneOMonthCounts(
    $year: Int!
    $studioId: ID
    $depth: Int
    $dateRange: StatsDateRangeInput
  ) {
    sceneOMonthCounts(year: $year, ${SCOPE_ARGUMENTS}) {
      month
      count
    }
  }
`;

const SCENE_O_DAY_COUNTS = gql`
  query OStatsSceneODayCounts(
    $year: Int!
    $month: Int!
    $studioId: ID
    $depth: Int
    $dateRange: StatsDateRangeInput
  ) {
    sceneODayCounts(year: $year, month: $month, ${SCOPE_ARGUMENTS}) {
      day
      count
    }
  }
`;
// CUSTOM: end

type CountsWithUnknown<T> = {
  counts: T[];
  unknown_count: number;
};

type OStatsOverviewData = {
  calendarYears: Array<{ year: number }>;
  years: Array<{ year: number; count: number }>;
  mostOsInDay?: { date: string; count: number } | null;
  longestPeriodWithoutO?: {
    days: number;
    start_date: string;
    end_date: string;
  } | null;
  byTag: Array<{ tag_id: string; tag_name: string; count: number }>;
  withoutMarkerTags: number;
  byEthnicity: Array<{ ethnicity: string; count: number }>;
  byCountry: Array<{ country: string; count: number }>;
  byStudio?: CountsWithUnknown<{
    studio_id: string;
    studio_name: string;
    count: number;
    amateur?: boolean; // CUSTOM
  }>;
  byAge: CountsWithUnknown<{ age: number; count: number }>;
  byReleaseYear: CountsWithUnknown<{ year: number; count: number }>;
  unreliableDateCount: number;
  byPerformer: Array<{
    performer_id: string;
    performer_name: string;
    image_path?: string | null;
    rating100?: number | null;
    count: number;
    amateur?: boolean; // CUSTOM
  }>;
  // CUSTOM: amateur tag counts, split later by the amateur's own role tags.
  amateurByTag?: Array<{ tag_id: string; tag_name: string; count: number }>;
};

type EntityNamesData = {
  findPerformer?: { id: string; name: string } | null;
  findScene?: { id: string; title?: string | null } | null;
  findStudio?: { id: string; name: string } | null;
  findTag?: { id: string; name: string } | null;
};

interface IRouteParams {
  tagId?: string;
  ethnicity?: string;
  country?: string;
  studioId?: string;
  performerAge?: string;
  releaseYear?: string;
  ratingBucket?: string;
  tier?: string;
  unknownCategory?: string;
  performerId?: string;
  sceneId?: string;
  year?: string;
  month?: string;
  day?: string;
}

type TimelineConfig = {
  query: DocumentNode;
  variables: Record<string, unknown>;
  emptyLabel: string;
  skip?: boolean;
  sceneId?: string; // CUSTOM: shared identity only for scene-specific timelines
  // CUSTOM: which instances the drilldown reads, and amateur IDs when they differ.
  source?: "both" | "main" | "amateur";
  amateurVariables?: Record<string, unknown>;
  amateurSkip?: boolean;
};

const O_UNIT: [string, string] = ["O", "O's"];
const UNKNOWN_CATEGORIES = [
  "date",
  "marker-tag",
  "studio",
  "performer-age",
  "release-year",
];

function asPositiveInt(value: string | undefined) {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function oCountLabel(count: number) {
  return `${count.toLocaleString(getAppLocaleCustom())} ${
    count === 1 ? "O" : "O's"
  }`;
}

function isUnknownLabel(value: string) {
  return cleanStatsValueCustom(value) === undefined;
}

function makeDate(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined
) {
  if (!year || !month || !day) return undefined;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function monthName(month: number, format: "short" | "long" = "short") {
  return new Date(Date.UTC(2024, month - 1, 1)).toLocaleString(
    getAppLocaleCustom(),
    {
      month: format,
      timeZone: "UTC",
    }
  );
}

function dayLabel(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toLocaleString(
    getAppLocaleCustom(),
    {
      weekday: "short",
      day: "numeric",
      timeZone: "UTC",
    }
  );
}

function tierLabel(tier: string) {
  return (
    metallicRatingChartBucket(
      undefined,
      tier === O_STATS_UNKNOWN_BUCKET ? undefined : tier
    )?.label ?? "Unknown"
  );
}

// CUSTOM: begin - merges with the amateur instance. Value-keyed counts add up;
// scenes, vatos and studios stay separate rows; records use O moments.
function unknownLabelKey(value: string) {
  return isUnknownLabel(value) ? "" : value;
}

function mergeOStatsOverviewCustom(
  main: OStatsOverviewData,
  amateur: OStatsOverviewData
): OStatsOverviewData {
  const byAge = sumCountsWithUnknownCustom(
    main.byAge,
    amateur.byAge,
    (item) => item.age
  );
  return {
    ...main,
    calendarYears: Array.from(
      new Set(
        [...main.calendarYears, ...amateur.calendarYears].map(
          (item) => item.year
        )
      )
    )
      .sort((a, b) => a - b)
      .map((year) => ({ year })),
    years: sumCountsByKeyCustom(main.years, amateur.years, (item) => item.year),
    amateurByTag: amateur.byTag,
    withoutMarkerTags: main.withoutMarkerTags + amateur.withoutMarkerTags,
    byEthnicity: sumCountsByKeyCustom(
      main.byEthnicity,
      amateur.byEthnicity,
      (item) => unknownLabelKey(item.ethnicity)
    ).sort(byCountDescCustom),
    byCountry: sumCountsByKeyCustom(main.byCountry, amateur.byCountry, (item) =>
      unknownLabelKey(item.country)
    ),
    byStudio:
      main.byStudio && amateur.byStudio
        ? {
            counts: mergeSortedCustom(
              main.byStudio.counts,
              markAmateurCustom(amateur.byStudio.counts),
              byCountDescCustom
            ),
            unknown_count:
              main.byStudio.unknown_count + amateur.byStudio.unknown_count,
          }
        : main.byStudio,
    byAge: { ...byAge, counts: byAge.counts.sort((a, b) => a.age - b.age) },
    byReleaseYear: sumCountsWithUnknownCustom(
      main.byReleaseYear,
      amateur.byReleaseYear,
      (item) => item.year
    ),
    unreliableDateCount: main.unreliableDateCount + amateur.unreliableDateCount,
    byPerformer: mergeSortedCustom(
      main.byPerformer,
      markAmateurCustom(amateur.byPerformer),
      byCountDescCustom
    ),
  };
}

type OStatsSceneCountsData = {
  sceneOCountsByScene: AmateurMarked<OStatsSceneCount>[];
};

function mergeOStatsSceneCountsCustom(
  main: OStatsSceneCountsData,
  amateur: OStatsSceneCountsData
): OStatsSceneCountsData {
  return {
    sceneOCountsByScene: mergeSortedCustom(
      main.sceneOCountsByScene,
      markAmateurCustom(amateur.sceneOCountsByScene),
      byCountDescCustom
    ),
  };
}

type OStatsMonthCountsData = {
  sceneOMonthCounts: Array<{ month: number; count: number }>;
};
type OStatsDayCountsData = {
  sceneODayCounts: Array<{ day: number; count: number }>;
};

function mergeOStatsMonthCountsCustom(
  main: OStatsMonthCountsData,
  amateur: OStatsMonthCountsData
): OStatsMonthCountsData {
  return {
    sceneOMonthCounts: sumCountsByKeyCustom(
      main.sceneOMonthCounts,
      amateur.sceneOMonthCounts,
      (item) => item.month
    ),
  };
}

function mergeOStatsDayCountsCustom(
  main: OStatsDayCountsData,
  amateur: OStatsDayCountsData
): OStatsDayCountsData {
  return {
    sceneODayCounts: sumCountsByKeyCustom(
      main.sceneODayCounts,
      amateur.sceneODayCounts,
      (item) => item.day
    ),
  };
}

function mergeOStatsMomentsCustom(
  main: OStatsEventMomentsQuery,
  amateur: OStatsEventMomentsQuery
): OStatsEventMomentsQuery {
  return { moments: [...main.moments, ...amateur.moments] };
}

type OStatsEventsData = { events: AmateurMarked<SceneOEvent>[] };

function mergeOStatsEventsCustom(
  main: OStatsEventsData,
  amateur: OStatsEventsData
): OStatsEventsData {
  return {
    events: mergeEventsByDateCustom(
      main.events,
      markAmateurCustom(amateur.events)
    ),
  };
}
// CUSTOM: end

// CUSTOM: one timeline renders every drilldown; links keep the studio scope
// and date range.
const OStatsTimeline: React.FC<{
  config: TimelineConfig;
  linkToEntity: boolean;
  withScope: (path: string) => string;
  amateur: IAmateurOStats; // CUSTOM
}> = ({ config, linkToEntity, withScope, amateur }) => {
  // CUSTOM: begin - value drilldowns read both instances, entity drilldowns one.
  const source = config.source ?? "both";
  const mainSkip = !!config.skip || source === "amateur";
  const amateurSkip = !!config.amateurSkip || source === "main";
  const { data, error, loading, amateurFailed } =
    useBothOStatsQueriesCustom<OStatsEventsData>(
      amateur,
      config.query,
      { variables: config.variables, skip: mainSkip },
      {
        variables: config.amateurVariables ?? config.variables,
        skip: amateurSkip,
      },
      mergeOStatsEventsCustom
    );
  // Without this instance's side, the data is the amateur's alone.
  const events = useMemo(
    () =>
      !data ? [] : mainSkip ? markAmateurCustom(data.events) : data.events,
    [data, mainSkip]
  );
  // CUSTOM: end
  if (loading) return <StatsSectionSkeleton />;
  if (error) return <ErrorMessage error={error.message} />;
  return (
    <>
      {/* CUSTOM */}
      {amateurFailed && !amateur.problem && (
        <OStatsAmateurNotice amateur={amateur} failed />
      )}
      <OStatsEventList
        events={events}
        amateur={amateur} // CUSTOM
        sceneId={config.sceneId}
        emptyLabel={config.emptyLabel}
        linkToEntity={linkToEntity}
        withScope={withScope}
      />
    </>
  );
};

// CUSTOM: accepts an optional studio tree for embedded and URL-backed scopes.
const OStatsContent: React.FC<{
  params: IRouteParams;
  studioScope?: IOStatsStudioScope;
  embedded?: boolean;
  allTimeline?: boolean;
}> = ({ params, studioScope, embedded = false, allTimeline = false }) => {
  const location = useLocation();
  const history = useHistory();
  const {
    range: dateRange,
    variable: dateRangeVariable,
    setRange: setDateRange,
  } = useStatsDateRange(); // CUSTOM
  const scopeVariables = {
    ...getOStatsStudioScopeVariables(studioScope),
    dateRange: dateRangeVariable,
  };
  const withScope = (path: string) =>
    addStatsDateRangeToPath(
      addOStatsStudioScopeToPath(path, studioScope),
      location.search
    );
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const { oStatsExcludedTagIds, oralTagId, sexTagId, soloTagId } = roleTagIds;
  // CUSTOM: begin - the amateur instance joins global O Stats only.
  const amateur = useAmateurOStatsCustom(!studioScope && !embedded);
  const amateurOnly = readOStatsAmateurOnlyCustom(location.search);
  // CUSTOM: end

  const selectedTagId = params.tagId;
  const selectedPerformerId = params.performerId;
  const selectedSceneId = params.sceneId;
  const selectedStudioId = params.studioId;
  const selectedEthnicity = params.ethnicity
    ? decodeURIComponent(params.ethnicity)
    : undefined;
  const selectedCountry = params.country
    ? decodeURIComponent(params.country)
    : undefined;
  const selectedPerformerAge = asPositiveInt(params.performerAge);
  const selectedReleaseYear = asPositiveInt(params.releaseYear);
  const selectedRatingBucket = params.ratingBucket;
  const selectedTier = params.tier;
  const selectedUnknownCategory = UNKNOWN_CATEGORIES.includes(
    params.unknownCategory ?? ""
  )
    ? params.unknownCategory
    : undefined;
  const selectedYear = asPositiveInt(params.year);
  const selectedMonth = asPositiveInt(params.month);
  const selectedDay = asPositiveInt(params.day);
  const selectedDate = makeDate(selectedYear, selectedMonth, selectedDay);
  const isEntityDrilldown =
    !!selectedTagId ||
    !!selectedEthnicity ||
    !!selectedCountry ||
    !!selectedStudioId ||
    !!selectedPerformerAge ||
    !!selectedReleaseYear ||
    !!selectedRatingBucket ||
    !!selectedTier ||
    !!selectedUnknownCategory ||
    !!selectedPerformerId ||
    !!selectedSceneId;
  const showTimeline = allTimeline || !!selectedDate || isEntityDrilldown;
  const isDetailPage = allTimeline || !!selectedYear || isEntityDrilldown;
  const showDateNavigation = !allTimeline && !isEntityDrilldown;
  const needsSceneCounts =
    !isDetailPage || !!selectedRatingBucket || !!selectedTier;

  const namesQuery = useQuery<EntityNamesData>(ENTITY_NAMES, {
    client: amateurOnly ? amateur.client : undefined, // CUSTOM
    variables: {
      performerId: selectedPerformerId ?? "0",
      sceneId: selectedSceneId ?? "0",
      studioId: selectedStudioId ?? "0",
      tagId: selectedTagId ?? "0",
      withPerformer: !!selectedPerformerId,
      withScene: !!selectedSceneId,
      withStudio: !!selectedStudioId,
      withTag: !!selectedTagId,
    },
    skip:
      (amateurOnly && !amateur.active) || // CUSTOM
      (!selectedPerformerId &&
        !selectedSceneId &&
        !selectedStudioId &&
        !selectedTagId),
  });
  // CUSTOM: begin - a tag drilldown reads both instances' tags with its name.
  const tagName = namesQuery.data?.findTag?.name;
  const otherTagQuery = useQuery<{ findTags: { tags: Array<{ id: string }> } }>(
    TAG_BY_NAME,
    {
      client: amateurOnly ? undefined : amateur.client,
      variables: { name: tagName ?? "" },
      skip: !amateur.active || !selectedTagId || !tagName,
    }
  );
  const otherTagId = otherTagQuery.data?.findTags.tags[0]?.id;
  const mainTagId = amateurOnly ? otherTagId : selectedTagId;
  const amateurTagId = amateurOnly ? selectedTagId : otherTagId;
  const tagLookupPending =
    !!selectedTagId &&
    amateur.active &&
    (namesQuery.loading || otherTagQuery.loading);
  // CUSTOM: end
  // CUSTOM: begin - every aggregate also reads the amateur instance when on.
  const overviewOptions = {
    variables: { ...scopeVariables, includeGlobal: !embedded },
    skip: isDetailPage,
  };
  const overviewQuery = useBothOStatsQueriesCustom<OStatsOverviewData>(
    amateur,
    O_STATS_OVERVIEW,
    overviewOptions,
    overviewOptions,
    mergeOStatsOverviewCustom
  );
  const sceneCountsOptions = {
    variables: scopeVariables,
    skip: !needsSceneCounts,
  };
  const sceneCountsQuery = useBothOStatsQueriesCustom<OStatsSceneCountsData>(
    amateur,
    O_STATS_SCENE_COUNTS,
    sceneCountsOptions,
    sceneCountsOptions,
    mergeOStatsSceneCountsCustom
  );
  const monthOptions = {
    skip: !selectedYear || !!selectedMonth || showTimeline,
    variables: { year: selectedYear, ...scopeVariables },
  };
  const monthQuery = useBothOStatsQueriesCustom<OStatsMonthCountsData>(
    amateur,
    SCENE_O_MONTH_COUNTS,
    monthOptions,
    monthOptions,
    mergeOStatsMonthCountsCustom
  );
  const dayOptions = {
    skip: !selectedYear || !selectedMonth || showTimeline,
    variables: { year: selectedYear, month: selectedMonth, ...scopeVariables },
  };
  const dayQuery = useBothOStatsQueriesCustom<OStatsDayCountsData>(
    amateur,
    SCENE_O_DAY_COUNTS,
    dayOptions,
    dayOptions,
    mergeOStatsDayCountsCustom
  );
  // Records over both instances come from every dated O's local day.
  const momentsOptions = {
    variables: scopeVariables,
    skip: !amateur.active || isDetailPage,
  };
  const momentsQuery = useBothOStatsQueriesCustom<OStatsEventMomentsQuery>(
    amateur,
    OStatsEventMomentsDocument,
    momentsOptions,
    momentsOptions,
    mergeOStatsMomentsCustom
  );
  const amateurFailed =
    overviewQuery.amateurFailed ||
    sceneCountsQuery.amateurFailed ||
    monthQuery.amateurFailed ||
    dayQuery.amateurFailed ||
    momentsQuery.amateurFailed;
  // CUSTOM: end

  const overview = overviewQuery.data;
  // CUSTOM: begin - records across both instances when the amateur answered.
  const dateRangeTo = dateRangeVariable?.to;
  const records = useMemo(() => {
    if (!amateur.active || !momentsQuery.data || momentsQuery.amateurFailed) {
      return {
        mostOsInDay: overview?.mostOsInDay,
        longestPeriodWithoutO: overview?.longestPeriodWithoutO,
      };
    }
    return oStatsRecordsCustom(
      momentsQuery.data.moments.map((moment) => moment.day),
      oStatsRecordsEndDayCustom(dateRangeTo, formatStatsLocalDate(new Date()))
    );
  }, [
    amateur.active,
    dateRangeTo,
    momentsQuery.amateurFailed,
    momentsQuery.data,
    overview?.longestPeriodWithoutO,
    overview?.mostOsInDay,
  ]);
  // CUSTOM: end
  // CUSTOM: studio pages embed O Stats without the By Studio chart.
  const studioCounts = embedded ? undefined : overview?.byStudio;
  const sceneCounts = useMemo(
    () => sceneCountsQuery.data?.sceneOCountsByScene ?? [],
    [sceneCountsQuery.data?.sceneOCountsByScene]
  );
  const uiConfig = configuration?.ui;
  const ratingOf = oStatsRatingBucket;
  // CUSTOM: amateur scenes use the amateur's own metallic tier settings.
  const tierOf = (scene: AmateurMarked<OStatsSceneCount>) =>
    oStatsTierBucket(scene, scene.amateur ? amateur.ui : uiConfig);
  const totalOs = sceneCounts.reduce((sum, scene) => sum + scene.count, 0);

  // Date chart: populated years, with zero-filled months and days.
  // biome-ignore lint/correctness/useExhaustiveDependencies: CUSTOM: re-runs when location.search, studioScope change; intentionally omits withScope
  const dateChartData = useMemo<IStatsBarDatum[]>(() => {
    if (!selectedYear) {
      return oStatsYears(overview?.years ?? []).map((point) => ({
        key: String(point.value),
        label: String(point.value),
        count: point.count,
        to: withScope(`/ostats/${point.value}`),
        actionLabel: "View monthly breakdown for",
      }));
    }
    if (!selectedMonth) {
      return fillOStatsMonths(monthQuery.data?.sceneOMonthCounts ?? []).map(
        (point) => ({
          key: `${selectedYear}-${point.value}`,
          label: monthName(point.value),
          subLabel: String(selectedYear),
          count: point.count,
          to: withScope(`/ostats/${selectedYear}/${point.value}`),
          actionLabel: "View daily breakdown for",
        })
      );
    }
    return fillOStatsDays(
      selectedYear,
      selectedMonth,
      dayQuery.data?.sceneODayCounts ?? []
    ).map((point) => ({
      key: `${selectedYear}-${selectedMonth}-${point.value}`,
      label: dayLabel(selectedYear, selectedMonth, point.value),
      count: point.count,
      to: withScope(`/ostats/${selectedYear}/${selectedMonth}/${point.value}`),
      actionLabel: "View O events on",
    }));
    // withScope only changes with the location and scope captured below.
  }, [
    dayQuery.data?.sceneODayCounts,
    location.search,
    monthQuery.data?.sceneOMonthCounts,
    overview?.years,
    selectedMonth,
    selectedYear,
    studioScope,
  ]);

  // CUSTOM: each instance splits its tags by its own role tags, then the
  // lists join by tag name.
  const { activityTypeCounts, markerTagCounts } = useMemo(() => {
    const main = partitionOStatsMarkerTagCountsCustom(
      overview?.byTag ?? [],
      { oralTagId, sexTagId, soloTagId },
      oStatsExcludedTagIds
    );
    const amateurRoles = amateur.ui?.roleTagIds ?? {};
    const other = partitionOStatsMarkerTagCountsCustom(
      overview?.amateurByTag ?? [],
      {
        oralTagId: amateurRoles.oralTagId,
        sexTagId: amateurRoles.sexTagId,
        soloTagId: amateurRoles.soloTagId,
      },
      amateurRoles.oStatsExcludedTagIds
    );
    return {
      activityTypeCounts: mergeTagCountsByNameCustom(
        main.activityTypeCounts,
        other.activityTypeCounts
      ),
      markerTagCounts: mergeTagCountsByNameCustom(
        main.markerTagCounts,
        other.markerTagCounts
      ),
    };
  }, [
    amateur.ui,
    overview?.amateurByTag,
    overview?.byTag,
    oStatsExcludedTagIds,
    oralTagId,
    sexTagId,
    soloTagId,
  ]);

  function eventBars<T>(
    items: readonly T[],
    toDatum: (item: T) => {
      key: string;
      label: string;
      count: number;
      path: string;
    },
    actionLabel = "View O events for"
  ): IStatsBarDatum[] {
    return items.map((item) => {
      const datum = toDatum(item);
      return {
        key: datum.key,
        label: datum.label,
        count: datum.count,
        to: withScope(datum.path),
        actionLabel,
      };
    });
  }

  const ratingCounts = oStatsBucketCounts(sceneCounts, ratingOf, (key) => ({
    label: key,
    sortValue: Number(key.split("-")[0]),
  }));
  const tierCounts = oStatsBucketCounts(sceneCounts, tierOf, (key) => {
    const bucket = metallicRatingChartBucket(undefined, key);
    return { label: bucket?.label ?? key, sortValue: bucket?.sortValue ?? 99 };
  });

  // Rating/tier drilldowns resolve their scene set from the per-scene counts.
  // CUSTOM: each instance resolves its own scene IDs.
  const bucketSceneIDsFor = (amateurScenes: boolean) => {
    const scenes = sceneCounts.filter(
      (scene) => !!scene.amateur === amateurScenes
    );
    return selectedRatingBucket
      ? oStatsSceneIDsInBucket(scenes, ratingOf, selectedRatingBucket)
      : selectedTier
        ? oStatsSceneIDsInBucket(scenes, tierOf, selectedTier)
        : [];
  };
  const bucketSceneIDs = bucketSceneIDsFor(false);
  const amateurBucketSceneIDs = bucketSceneIDsFor(true);

  function timelineConfig(): TimelineConfig | undefined {
    if (selectedDate) {
      return {
        query: EVENT_QUERIES.date,
        variables: { date: selectedDate, ...scopeVariables },
        emptyLabel: "No reliable O events on this day.",
      };
    }
    if (selectedTagId) {
      return {
        query: EVENT_QUERIES.tag,
        variables: { tagID: mainTagId, ...scopeVariables },
        emptyLabel: "No O events found for this marker tag.",
        // CUSTOM: each instance reads its own tag with this name.
        skip: !mainTagId,
        amateurVariables: { tagID: amateurTagId, ...scopeVariables },
        amateurSkip: !amateurTagId,
      };
    }
    if (selectedEthnicity) {
      return {
        query: EVENT_QUERIES.ethnicity,
        variables: { ethnicity: selectedEthnicity, ...scopeVariables },
        emptyLabel: "No O events found for this ethnicity.",
      };
    }
    if (selectedCountry) {
      return {
        query: EVENT_QUERIES.country,
        variables: { country: selectedCountry, ...scopeVariables },
        emptyLabel: "No O events found for this country.",
      };
    }
    if (selectedStudioId) {
      return {
        query: EVENTS_BY_STUDIO,
        variables: { studioID: selectedStudioId, ...scopeVariables },
        emptyLabel: "No O events found for this studio.",
        source: amateurOnly ? "amateur" : "main", // CUSTOM
      };
    }
    if (selectedPerformerAge) {
      // CUSTOM: begin - consistent entity vocabulary.
      return {
        query: EVENT_QUERIES.age,
        variables: { age: selectedPerformerAge, ...scopeVariables },
        emptyLabel: "No O events found for this vato age.",
      };
      // CUSTOM: end
    }
    if (selectedReleaseYear) {
      return {
        query: EVENT_QUERIES.releaseYear,
        variables: { year: selectedReleaseYear, ...scopeVariables },
        emptyLabel: "No O events found for this scene release year.",
      };
    }
    if (selectedRatingBucket || selectedTier) {
      return {
        query: EVENT_QUERIES.scenes,
        variables: { sceneIDs: bucketSceneIDs, ...scopeVariables },
        emptyLabel: selectedTier
          ? "No O events found for this metallic tier."
          : "No O events found for this scene rating.",
        skip: bucketSceneIDs.length === 0,
        // CUSTOM
        amateurVariables: {
          sceneIDs: amateurBucketSceneIDs,
          ...scopeVariables,
        },
        amateurSkip: amateurBucketSceneIDs.length === 0,
      };
    }
    const unknownQueries: Record<string, DocumentNode> = {
      date: EVENT_QUERIES.unknownDate,
      "marker-tag": EVENT_QUERIES.unknownMarkerTag,
      studio: EVENT_QUERIES.unknownStudio,
      "performer-age": EVENT_QUERIES.unknownAge,
      "release-year": EVENT_QUERIES.unknownReleaseYear,
    };
    if (selectedUnknownCategory) {
      return {
        query: unknownQueries[selectedUnknownCategory],
        variables: scopeVariables,
        emptyLabel: "No O events found for this unknown-value group.",
      };
    }
    if (selectedSceneId) {
      return {
        query: EVENT_QUERIES.scene,
        sceneId: selectedSceneId, // CUSTOM
        variables: { sceneID: selectedSceneId, ...scopeVariables },
        emptyLabel: "No O events found for this scene.",
        source: amateurOnly ? "amateur" : "main", // CUSTOM
      };
    }
    if (selectedPerformerId) {
      return {
        query: EVENT_QUERIES.performer,
        variables: { performerID: selectedPerformerId, ...scopeVariables },
        emptyLabel: "No O events found for this vato.",
        source: amateurOnly ? "amateur" : "main", // CUSTOM
      };
    }
    return undefined;
  }

  const loading =
    (!isDetailPage && overviewQuery.loading) ||
    (!isDetailPage && momentsQuery.loading) || // CUSTOM
    tagLookupPending || // CUSTOM
    (needsSceneCounts && sceneCountsQuery.loading) ||
    (!!selectedYear && !showTimeline && monthQuery.loading) ||
    (!!selectedYear && !!selectedMonth && !showTimeline && dayQuery.loading);
  const error =
    overviewQuery.error ??
    sceneCountsQuery.error ??
    monthQuery.error ??
    dayQuery.error;
  const names = namesQuery.data;

  function renderTitle() {
    if (allTimeline) return "O Timeline";
    if (selectedTagId)
      return `O's tagged ${names?.findTag?.name ?? "Loading tag..."}`;
    if (selectedPerformerId) {
      return `O's to ${
        names?.findPerformer?.name ?? `Vato ${selectedPerformerId}`
      }`;
    }
    if (selectedSceneId) {
      return `O's from ${
        names?.findScene?.title || `Scene ${selectedSceneId}`
      }`;
    }
    if (selectedEthnicity) return `O's to ${selectedEthnicity} vatos`;
    if (selectedCountry)
      return `O's to ${statsCountryName(selectedCountry)} vatos`;
    if (selectedStudioId) {
      return `O's from ${
        names?.findStudio?.name ?? `Studio ${selectedStudioId}`
      }`;
    }
    if (selectedPerformerAge) return `O's to ${selectedPerformerAge}-year-olds`;
    if (selectedReleaseYear)
      return `O's in scenes released in ${selectedReleaseYear}`;
    if (selectedRatingBucket) {
      return selectedRatingBucket === O_STATS_UNKNOWN_BUCKET
        ? "O's in unrated scenes"
        : `O's in scenes rated ${selectedRatingBucket}`;
    }
    if (selectedTier) {
      return selectedTier === O_STATS_UNKNOWN_BUCKET
        ? "O's in scenes without a metallic tier"
        : `O's in ${tierLabel(selectedTier)} scenes`;
    }
    if (selectedUnknownCategory === "date") return "O's with an unknown date";
    if (selectedUnknownCategory === "marker-tag") {
      return "O's with an unknown marker tag";
    }
    if (selectedUnknownCategory === "studio") {
      return "O's from scenes with an unknown studio";
    }
    if (selectedUnknownCategory === "performer-age") {
      // CUSTOM: begin - consistent entity vocabulary.
      return "O's with an unknown vato age";
      // CUSTOM: end
    }
    if (selectedUnknownCategory === "release-year") {
      return "O's with an unknown scene release year";
    }
    if (selectedDate) return `O's on ${selectedDate}`;
    if (selectedYear && selectedMonth) {
      return `${monthName(selectedMonth, "long")} ${selectedYear}`;
    }
    if (selectedYear) return String(selectedYear);
    return studioScope ? `${studioScope.name} O Stats` : "O Stats";
  }

  function renderModeLabel() {
    if (allTimeline) return "All O's";
    if (selectedTagId || selectedUnknownCategory === "marker-tag") {
      return "By Marker Tag";
    }
    if (selectedPerformerId) return "By Vato";
    if (selectedSceneId) return "By Scene";
    if (selectedEthnicity) return "By Ethnicity";
    if (selectedCountry) return "By Country";
    if (selectedStudioId || selectedUnknownCategory === "studio") {
      return "By Studio";
    }
    if (selectedPerformerAge || selectedUnknownCategory === "performer-age") {
      // CUSTOM: begin - consistent entity vocabulary.
      return "By Vato Age";
      // CUSTOM: end
    }
    if (selectedReleaseYear || selectedUnknownCategory === "release-year") {
      return "By Scene Release Year";
    }
    if (selectedRatingBucket) return "By Scene Rating";
    if (selectedTier) return "By Metallic Tier";
    if (selectedUnknownCategory === "date") return "By Year";
    if (selectedDate) return "Day Summary";
    if (selectedYear && selectedMonth) return "By Day";
    if (selectedYear) return "By Month";
    return "By Year";
  }

  const pageTitle = renderTitle();
  // Avoid "O Stats | O Stats" on the overview.
  const titleProps = useTitleProps(
    ...(pageTitle === "O Stats" ? [pageTitle] : [pageTitle, "O Stats"])
  );
  const timeline = showTimeline ? timelineConfig() : undefined;
  const showOverview = !error && !loading && !isDetailPage;
  const dateNavigation = showDateNavigation && (
    <ButtonGroup aria-label="O date stats navigation" size="sm">
      {[
        { label: "By Year", path: "/ostats", active: !isDetailPage },
        {
          label: "By Month",
          path: selectedYear ? `/ostats/${selectedYear}` : undefined,
          active: !!selectedYear && !selectedMonth,
        },
        {
          label: "By Day",
          path:
            selectedYear && selectedMonth
              ? `/ostats/${selectedYear}/${selectedMonth}`
              : undefined,
          active: !!selectedYear && !!selectedMonth && !selectedDate,
        },
      ].map((item) =>
        item.path ? (
          <Link
            key={item.label}
            to={withScope(item.path)}
            className={`btn btn-sm btn-${
              item.active ? "primary" : "secondary"
            }`}
            aria-current={item.active ? "page" : undefined}
          >
            {item.label}
          </Link>
        ) : (
          <Button key={item.label} disabled size="sm" variant="secondary">
            {item.label}
          </Button>
        )
      )}
    </ButtonGroup>
  );
  const backButton = isDetailPage && (
    <Button
      as={Link}
      to={withScope(
        selectedDate && selectedYear && selectedMonth
          ? `/ostats/${selectedYear}/${selectedMonth}`
          : !showTimeline && selectedMonth && selectedYear
            ? `/ostats/${selectedYear}`
            : "/ostats"
      )}
      className="ostats-back-button"
      size="sm"
      variant="secondary"
    >
      {selectedDate && selectedYear && selectedMonth
        ? `View days in ${monthName(selectedMonth)} ${selectedYear}`
        : !showTimeline && selectedMonth && selectedYear
          ? `View months in ${selectedYear}`
          : "View all O stats"}
    </Button>
  );

  // CUSTOM: begin - consistent entity vocabulary.
  return (
    <StatsPage className="ostats-page" showNavigation={!embedded}>
      <Helmet {...titleProps} />

      <header className="ostats-header">
        <div>
          <h1>{pageTitle}</h1>
        </div>
        <div className="stats-header-controls">
          <StatsDateRangeFilter
            range={dateRange}
            onChange={(range) => {
              if (allTimeline) {
                history.push({
                  ...location,
                  search: writeStatsDateRange(
                    oStatsTimelineSearchCustom(location.search, 1),
                    range
                  ),
                });
              } else setDateRange(range);
            }}
            showField={false}
          />
        </div>
      </header>

      {/* CUSTOM */}
      <OStatsAmateurNotice amateur={amateur} failed={amateurFailed} />

      {showOverview && (
        <StatsKpiRow
          label="O totals and records"
          items={[
            {
              key: "total",
              label: "Total O's",
              value: totalOs.toLocaleString(getAppLocaleCustom()),
              detail: `${sceneCounts.length.toLocaleString(
                getAppLocaleCustom()
              )} ${sceneCounts.length === 1 ? "scene" : "scenes"}`,
            },
            ...(records.mostOsInDay
              ? [
                  {
                    key: "day",
                    label: "Most O's in a day",
                    value: records.mostOsInDay.count.toLocaleString(
                      getAppLocaleCustom()
                    ),
                    detail: formatAppDateCustom(records.mostOsInDay.date),
                  },
                ]
              : []),
            ...(records.longestPeriodWithoutO
              ? [
                  {
                    key: "dry",
                    label: "Longest period without an O",
                    value: `${records.longestPeriodWithoutO.days} days`,
                    detail: `${formatAppDateCustom(records.longestPeriodWithoutO.start_date)} – ${formatAppDateCustom(records.longestPeriodWithoutO.end_date)}`,
                  },
                ]
              : []),
          ]}
        />
      )}

      {/* CUSTOM: Latest appears below totals and above ranked cards. */}
      {!isDetailPage && (
        <OStatsLatest
          studioId={studioScope?.id}
          depth={studioScope?.depth}
          dateRange={dateRangeVariable}
          withScope={withScope}
          amateur={amateur} // CUSTOM
        />
      )}

      {error && <ErrorMessage error={error.message} />}
      {!error && loading && <StatsPageSkeleton message="Loading O stats..." />}

      {!error && !loading && showTimeline && (
        <section className="ostats-chart-panel ostats-timeline-panel">
          <div className="ostats-subheader">
            <h2>{renderModeLabel()}</h2>
            <div className="ostats-subheader-actions">
              {dateNavigation}
              {backButton}
            </div>
          </div>
          {allTimeline && (
            <OStatsFullTimeline
              page={oStatsTimelinePageCustom(location.search)}
              studioId={studioScope?.id}
              depth={studioScope?.depth}
              dateRange={dateRangeVariable}
              withScope={withScope}
              amateur={amateur} // CUSTOM
            />
          )}
          {timeline && (
            <OStatsTimeline
              config={timeline}
              linkToEntity={!!selectedSceneId || !!selectedPerformerId}
              withScope={withScope}
              amateur={amateur} // CUSTOM
            />
          )}
        </section>
      )}

      {/* CUSTOM: ranked scene and vato cards lead the overview. */}
      {showOverview && overview && (
        <>
          <StatsTopCards
            title="Top Scenes"
            variant="scene"
            emptyLabel="No O's in this range."
            items={sceneCounts.map((scene) => ({
              key: amateurRowKeyCustom(scene.scene_id, scene.amateur), // CUSTOM
              title: scene.title || `Scene ${scene.scene_id}`,
              imagePath: scene.screenshot_path,
              rating100: scene.rating100,
              value: oCountLabel(scene.count),
              detail: formatStatsBarPercent(scene.count, totalOs),
              meta: scene.amateur ? "Amateur" : undefined, // CUSTOM
              to: withScope(
                withAmateurSourceCustom(
                  `/ostats/scene/${scene.scene_id}`,
                  scene.amateur
                )
              ),
            }))}
          />
          <StatsTopCards
            title="Top Vatos"
            variant="vato"
            note="An O counts for every vato in its scene."
            emptyLabel="No O's in this range."
            items={overview.byPerformer.map((performer) => ({
              // CUSTOM: amateur vatos stay separate cards.
              key: amateurRowKeyCustom(
                performer.performer_id,
                performer.amateur
              ),
              title: performer.performer_name,
              imagePath: performer.image_path,
              rating100: performer.rating100,
              value: oCountLabel(performer.count),
              detail: formatStatsBarPercent(performer.count, totalOs),
              meta: performer.amateur ? "Amateur" : undefined,
              to: withScope(
                withAmateurSourceCustom(
                  `/ostats/vato/${performer.performer_id}`,
                  performer.amateur
                )
              ),
            }))}
          />
        </>
      )}

      {!error && !loading && !showTimeline && (
        <StatsBarChart
          title={renderModeLabel()}
          data={dateChartData}
          unit={O_UNIT}
          sortable
          emptyLabel="No reliable O events in this range."
          unknown={
            !isDetailPage
              ? {
                  count: overview?.unreliableDateCount ?? 0,
                  to: withScope("/ostats/unknown/date"),
                }
              : undefined
          }
          actions={
            <>
              {dateNavigation}
              {backButton}
            </>
          }
        />
      )}
      {!selectedDate && selectedYear && selectedMonth && selectedDay && (
        <Alert variant="warning">That date does not exist.</Alert>
      )}

      {showOverview && overview && (
        <>
          <OStatsCalendarHeatmap
            studioScope={studioScope}
            years={overview.calendarYears.map((item) => item.year)}
            amateur={amateur} // CUSTOM
          />
          {/* CUSTOM: charts grouped by topic; each group fills whole rows. */}
          <StatsChartGroup className="stats-group--panel" title="The Scene">
            <StatsBarChart
              className="stats-wide"
              title="By Scene Release Year"
              data={eventBars(
                oStatsYears(overview.byReleaseYear.counts),
                (item) => ({
                  key: String(item.value),
                  label: String(item.value),
                  count: item.count,
                  path: `/ostats/release-year/${item.value}`,
                })
              )}
              unit={O_UNIT}
              total={totalOs}
              sortable
              emptyLabel="No O scene release-year counts found."
              unknown={{
                count: overview.byReleaseYear.unknown_count,
                to: withScope("/ostats/unknown/release-year"),
              }}
            />
            <StatsBarChart
              className="stats-wide"
              title="By Scene Rating"
              data={eventBars(ratingCounts.data, (bucket) => ({
                ...bucket,
                path: `/ostats/rating/${bucket.key}`,
              }))}
              unit={O_UNIT}
              total={totalOs}
              sortable
              unknown={{
                count: ratingCounts.unknownCount,
                to: withScope(`/ostats/rating/${O_STATS_UNKNOWN_BUCKET}`),
              }}
            />
            <StatsBarChart
              className={studioCounts ? undefined : "stats-wide"}
              title="By Metallic Tier"
              data={eventBars(tierCounts.data, (bucket) => ({
                ...bucket,
                path: `/ostats/tier/${bucket.key}`,
              })).map((bar) => ({
                ...bar,
                color: statsMetallicColor(bar.key),
              }))}
              unit={O_UNIT}
              total={totalOs}
              unknown={{
                count: tierCounts.unknownCount,
                to: withScope(`/ostats/tier/${O_STATS_UNKNOWN_BUCKET}`),
              }}
            />
            {studioCounts && (
              <StatsBarChart
                variant="ranked"
                title="By Studio"
                data={eventBars(studioCounts.counts, (item) => ({
                  // CUSTOM: amateur studios stay separate bars.
                  key: amateurRowKeyCustom(item.studio_id, item.amateur),
                  label: item.amateur
                    ? `${item.studio_name} (Amateur)`
                    : item.studio_name,
                  count: item.count,
                  path: withAmateurSourceCustom(
                    `/ostats/studio/${item.studio_id}`,
                    item.amateur
                  ),
                }))}
                unit={O_UNIT}
                total={totalOs}
                emptyLabel="No O studio counts found."
                unknown={{
                  count: studioCounts.unknown_count,
                  to: withScope("/ostats/unknown/studio"),
                }}
              />
            )}
          </StatsChartGroup>
          <StatsChartGroup className="stats-group--panel" title="The Vatos">
            <StatsBarChart
              className="stats-wide"
              title="By Vato Age"
              data={eventBars(overview.byAge.counts, (item) => ({
                key: String(item.age),
                label: String(item.age),
                count: item.count,
                path: `/ostats/age/${item.age}`,
              }))}
              unit={O_UNIT}
              total={totalOs}
              totalNote="An O counts once for each vato age in its scene, so bars can overlap."
              sortable
              emptyLabel="No O performer-age counts found."
              unknown={{
                count: overview.byAge.unknown_count,
                to: withScope("/ostats/unknown/performer-age"),
              }}
            />
            <StatsBarChart
              variant="ranked"
              title="By Ethnicity"
              data={eventBars(
                overview.byEthnicity.filter(
                  (item) => !isUnknownLabel(item.ethnicity)
                ),
                (item) => ({
                  key: item.ethnicity,
                  label: item.ethnicity,
                  count: item.count,
                  path: `/ostats/ethnicity/${encodeURIComponent(
                    item.ethnicity
                  )}`,
                })
              )}
              unit={O_UNIT}
              total={totalOs}
              totalNote="An O counts once for each vato ethnicity in its scene, so bars can overlap."
              emptyLabel="No O ethnicity counts found."
              unknown={{
                count:
                  overview.byEthnicity.find((item) =>
                    isUnknownLabel(item.ethnicity)
                  )?.count ?? 0,
                to: withScope("/ostats/ethnicity/Unknown"),
              }}
            />
            <StatsBarChart
              variant="ranked"
              title="By Country"
              data={eventBars(
                overview.byCountry
                  .filter((item) => !isUnknownLabel(item.country))
                  .map((item) => ({
                    ...item,
                    label: statsCountryName(item.country),
                  }))
                  .sort(
                    (a, b) =>
                      b.count - a.count || a.label.localeCompare(b.label)
                  ),
                (item) => ({
                  key: item.country,
                  label: item.label,
                  count: item.count,
                  path: `/ostats/country/${encodeURIComponent(item.country)}`,
                })
              ).map((bar) => ({
                ...bar,
                icon: <StatsCountryFlag country={bar.key} />,
              }))}
              unit={O_UNIT}
              total={totalOs}
              totalNote="An O counts once for each vato country in its scene, so bars can overlap."
              emptyLabel="No O country counts found."
              unknown={{
                count:
                  overview.byCountry.find((item) =>
                    isUnknownLabel(item.country)
                  )?.count ?? 0,
                to: withScope("/ostats/country/Unknown"),
              }}
            />
          </StatsChartGroup>
          <StatsChartGroup className="stats-group--panel" title="The Action">
            <StatsBarChart
              variant="ranked"
              title="By Activity Type"
              data={eventBars(activityTypeCounts, (item) => ({
                key: amateurRowKeyCustom(item.tag_id, item.amateur), // CUSTOM
                label: item.tag_name,
                count: item.count,
                path: oStatsTagPathCustom(item), // CUSTOM
              }))}
              unit={O_UNIT}
              emptyLabel="No activity-type counts found."
            />
            <StatsBarChart
              variant="ranked"
              title="By Marker Tag"
              data={eventBars(markerTagCounts, (item) => ({
                key: amateurRowKeyCustom(item.tag_id, item.amateur), // CUSTOM
                label: item.tag_name,
                count: item.count,
                path: oStatsTagPathCustom(item), // CUSTOM
              }))}
              unit={O_UNIT}
              totalNote="An O counts once for each marker tag covering it, so bars can overlap."
              emptyLabel="No timestamped O marker-tag counts found."
              unknown={{
                count: overview.withoutMarkerTags,
                to: withScope("/ostats/unknown/marker-tag"),
              }}
            />
          </StatsChartGroup>
        </>
      )}
    </StatsPage>
  );
  // CUSTOM: end
};

const OStats: React.FC<RouteComponentProps<IRouteParams>> = ({
  match,
  location,
}) => (
  <OStatsContent
    params={match.params}
    allTimeline={match.path === O_STATS_TIMELINE_PATH_CUSTOM}
    studioScope={readOStatsStudioScope(location.search)}
  />
);

// CUSTOM: reusable dashboard entry for Studio O Stats tabs.
export const OStatsDashboard: React.FC<{
  studioScope: IOStatsStudioScope;
}> = ({ studioScope }) => (
  <OStatsContent params={{}} studioScope={studioScope} embedded />
);

export default OStats;
