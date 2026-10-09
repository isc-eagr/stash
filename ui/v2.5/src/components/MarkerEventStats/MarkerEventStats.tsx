import { gql, useQuery } from "@apollo/client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Nav } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, useHistory, useLocation } from "react-router-dom";
import {
  MarkerEventStatsKind,
  SortDirectionEnum,
  useMarkerEventStatsMarkersQuery,
  useMarkerEventStatsQuery,
} from "src/core/generated-graphql";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { SceneMarkerCardGrid } from "src/components/Scenes/SceneMarkerCardGrid";
import { StatsPage } from "src/components/StatsPage_custom";
import { StatsStudioSelector } from "src/components/StatsStudioSelector_custom";
import { StatsFilterBar } from "src/components/StatsFilterBar_custom";
import { StatsBarChart } from "src/components/StatsBarChart_custom";
import { StatsTopCards } from "src/components/StatsTopCards_custom";
import { StatsDateRangeFilter } from "src/components/StatsDateRangeFilter_custom";
import { makeSceneStatsMarkerTagURL } from "src/components/SceneStats/sceneStatsSummary_custom";
import {
  getVatoStatsStudioScope,
  type IVatoStatsStudioScope,
} from "src/components/VatoStats/vatoStatsStudioScope_custom";
import { useConfigurationContext } from "src/hooks/Config";
import { useStatsViewState } from "src/hooks/useStatsViewState_custom";
import { useStatsDateRange } from "src/hooks/useStatsDateRange_custom";
import { useTitleProps } from "src/hooks/title";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { formatStatsBarPercent } from "src/utils/statsBarChart_custom";
import {
  removeStatsFilter,
  type StatsViewFilter,
  type StatsViewOptions,
} from "src/utils/statsViewState_custom";
import {
  buildMarkerEventChart,
  buildMarkerEventStatsContext,
  FACIAL_STATS_CHARTS,
  MARKER_EVENT_SORTS,
  MARKER_EVENT_UNKNOWN,
  markerEventMatchesFilter,
  markerEventScenes,
  markerEventSortMetric,
  markerEventStatsSummary,
  NUT_STATS_CHARTS,
  rankMarkerEventMarkers,
  rankMarkerEventVatos,
  type IMarkerEventChartDefinition,
  type IMarkerEventStatsContext,
  type IMarkerEvent,
  type MarkerEventChartCategory,
  type MarkerEventSort,
} from "./markerEventStatsData_custom";

import "./MarkerEventStats.scss";

// CUSTOM: Nut Stats and Facial Stats share one dashboard over marker events.

const MARKER_EVENT_ROOT_TAG = gql`
  query MarkerEventStatsRootTag($ids: [ID!]) {
    findTags(ids: $ids) {
      tags {
        id
        name
      }
    }
  }
`;

interface IMarkerEventStatsPage {
  kind: MarkerEventStatsKind;
  title: string;
  unit: [string, string];
  countLabel: string;
  timeLabel: string;
  topTab: string;
  tagKey: "orgasmTagId" | "facialTagId";
  tagLabel: string;
  charts: IMarkerEventChartDefinition[];
  view: StatsViewOptions<MarkerEventChartCategory, MarkerEventSort>;
}

function pageView(
  prefix: string,
  charts: IMarkerEventChartDefinition[]
): StatsViewOptions<MarkerEventChartCategory, MarkerEventSort> {
  return {
    prefix,
    categories: charts.map((chart) => chart.key),
    metrics: MARKER_EVENT_SORTS.map((sort) => sort.key),
    defaultMetric: "o_count",
  };
}

const NUT_STATS_PAGE: IMarkerEventStatsPage = {
  kind: MarkerEventStatsKind.Orgasm,
  title: "Nut Stats",
  unit: ["nut", "nuts"],
  countLabel: "Total Nuts",
  timeLabel: "Total Nut Time",
  topTab: "Top Nutters",
  tagKey: "orgasmTagId",
  tagLabel: "Orgasm",
  charts: NUT_STATS_CHARTS,
  view: pageView("nut", NUT_STATS_CHARTS),
};

const FACIAL_STATS_PAGE: IMarkerEventStatsPage = {
  kind: MarkerEventStatsKind.Facial,
  title: "Facial Stats",
  unit: ["facial", "facials"],
  countLabel: "Total Facials",
  timeLabel: "Total Facial Time",
  topTab: "Top Vatos",
  tagKey: "facialTagId",
  tagLabel: "Facial",
  charts: FACIAL_STATS_CHARTS,
  view: pageView("facial", FACIAL_STATS_CHARTS),
};

const RECEIVER_UNIT: [string, string] = ["receiver", "receivers"];
const MARKER_CARD_PAGE_SIZE = 12;
const NO_SELECTION = new Set<string>();
const TOP_SECTION = "top";

interface ISummaryCard {
  label: string;
  value: string;
  title?: string;
  to?: string;
  action?: string;
}

function unitCount(count: number, unit: [string, string]) {
  return `${count.toLocaleString()} ${count === 1 ? unit[0] : unit[1]}`;
}

function searchWithSection(search: string, section?: string) {
  const params = new URLSearchParams(search);
  if (section) params.set("section", section);
  else params.delete("section");
  const value = params.toString();
  return value ? `?${value}` : "";
}

const SummaryCards: React.FC<{ cards: ISummaryCard[] }> = ({ cards }) => (
  <section className="marker-event-stats-summary" aria-label="Summary">
    {cards.map((card) => {
      const content = (
        <>
          <div className="marker-event-stats-summary-value">{card.value}</div>
          <div className="marker-event-stats-summary-label">{card.label}</div>
          {card.action && <small>{card.action}</small>}
        </>
      );
      return card.to ? (
        <Link
          className="marker-event-stats-summary-card linked"
          key={card.label}
          title={card.title}
          to={card.to}
        >
          {content}
        </Link>
      ) : (
        <div
          className="marker-event-stats-summary-card"
          key={card.label}
          title={card.title}
        >
          {content}
        </div>
      );
    })}
  </section>
);

// Ranked marker cards; only the visible page is fetched as full markers.
const MarkerEventCards: React.FC<{
  title: string;
  events: IMarkerEvent[];
  sort: MarkerEventSort;
  onSortChange: (sort: MarkerEventSort) => void;
}> = ({ title, events, sort, onSortChange }) => {
  const ranked = useMemo(
    () => rankMarkerEventMarkers(events, sort),
    [events, sort]
  );
  const [visibleCount, setVisibleCount] = useState(MARKER_CARD_PAGE_SIZE);
  const rankingKey = ranked.map((event) => event.marker_id).join(",");

  useEffect(() => {
    setVisibleCount(MARKER_CARD_PAGE_SIZE);
  }, [rankingKey]);

  const visible = useMemo(
    () => ranked.slice(0, visibleCount),
    [ranked, visibleCount]
  );
  const ids = useMemo(() => visible.map((event) => event.marker_id), [visible]);
  const { data, previousData, error } = useMarkerEventStatsMarkersQuery({
    skip: ids.length === 0,
    variables: { ids },
  });
  const loaded = (data ?? previousData)?.findSceneMarkers.scene_markers;
  const markers = useMemo(() => {
    const byID = new Map((loaded ?? []).map((marker) => [marker.id, marker]));
    return ids.flatMap((id) => byID.get(id) ?? []);
  }, [ids, loaded]);
  const eventsByID = new Map(visible.map((event) => [event.marker_id, event]));

  return (
    <section className="stats-top marker-event-stats-markers">
      <div className="stats-top-heading">
        <div className="stats-top-title">
          <h2>{title}</h2>
          <span className="stats-top-note">
            {unitCount(ranked.length, ["marker", "markers"])}
          </span>
        </div>
        <Form.Group
          className="marker-event-stats-sort"
          controlId={`${title}-sort`}
        >
          <Form.Label>Sort by</Form.Label>
          <Form.Control
            as="select"
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              onSortChange(event.target.value as MarkerEventSort)
            }
            value={sort}
          >
            {MARKER_EVENT_SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
      </div>
      {error && <ErrorMessage error={error.message} />}
      {ranked.length === 0 ? (
        <div className="stats-top-empty">No markers match these filters.</div>
      ) : markers.length === 0 ? (
        <LoadingIndicator inline small message="" />
      ) : (
        <SceneMarkerCardGrid
          activeSortDirection={SortDirectionEnum.Desc}
          markers={markers}
          onSelectChange={() => {}}
          selectedIds={NO_SELECTION}
          sortMetricFor={(marker) => {
            const event = eventsByID.get(marker.id);
            return event ? markerEventSortMetric(event, sort) : undefined;
          }}
          zoomIndex={1}
        />
      )}
      {ranked.length > visibleCount && (
        <div className="stats-top-more">
          <Button
            onClick={() =>
              setVisibleCount((current) => current + MARKER_CARD_PAGE_SIZE)
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

const TopVatos: React.FC<{
  title: string;
  events: IMarkerEvent[];
  role: "giver" | "receiver";
  context: IMarkerEventStatsContext;
  unit: [string, string];
}> = ({ title, events, role, context, unit }) => {
  const ranked = useMemo(
    () => rankMarkerEventVatos(events, role, context),
    [context, events, role]
  );
  return (
    <StatsTopCards
      title={title}
      variant="vato"
      emptyLabel="No vatos match these filters."
      items={ranked.map(({ performer, count }) => ({
        key: performer.id,
        title: performer.name,
        imagePath: performer.image_path,
        rating100: performer.rating100,
        to: `/performers/${performer.id}`,
        value: unitCount(count, unit),
        detail: formatStatsBarPercent(count, events.length),
      }))}
    />
  );
};

const MarkerEventStatsDashboard: React.FC<{
  page: IMarkerEventStatsPage;
  studioScope?: IVatoStatsStudioScope;
}> = ({ page, studioScope: fixedStudioScope }) => {
  const history = useHistory();
  const location = useLocation();
  const { view, updateView, setFilters, setMetric } = useStatsViewState(
    page.view
  );
  const {
    studio: selectedStudio,
    includeChildStudios,
    filters,
    metric: sort,
  } = view;
  const showTop =
    new URLSearchParams(location.search).get("section") === TOP_SECTION;
  const {
    range: dateRange,
    variable: dateRangeVariable,
    setRange: setDateRange,
  } = useStatsDateRange();
  const selectedStudioScope = useMemo(
    () =>
      selectedStudio
        ? getVatoStatsStudioScope(selectedStudio, includeChildStudios)
        : undefined,
    [includeChildStudios, selectedStudio]
  );
  const studioScope = fixedStudioScope ?? selectedStudioScope;
  const pageTitle = fixedStudioScope
    ? `${fixedStudioScope.name} ${page.title}`
    : page.title;
  const titleProps = useTitleProps(pageTitle);
  const { configuration } = useConfigurationContext();
  const rootTagID = configuration?.ui?.roleTagIds?.[page.tagKey] || undefined;

  const { data, error, loading } = useMarkerEventStatsQuery({
    variables: {
      kind: page.kind,
      studioId: studioScope?.id,
      depth: studioScope?.depth,
      dateRange: dateRangeVariable,
    },
  });
  const rootTagQuery = useQuery<{
    findTags: { tags: { id: string; name: string }[] };
  }>(MARKER_EVENT_ROOT_TAG, {
    skip: !rootTagID,
    variables: { ids: [rootTagID] },
  });
  const rootTag = rootTagQuery.data?.findTags.tags[0];

  const result = data?.markerEventStats;
  const events = useMemo(() => result?.events ?? [], [result?.events]);
  const context = useMemo(
    () =>
      buildMarkerEventStatsContext(
        events,
        result?.performers ?? [],
        result?.types ?? []
      ),
    [events, result?.performers, result?.types]
  );
  const filteredEvents = useMemo(
    () =>
      events.filter((event) =>
        filters.every((filter) =>
          markerEventMatchesFilter(event, filter, context)
        )
      ),
    [context, events, filters]
  );
  const summary = useMemo(
    () => markerEventStatsSummary(filteredEvents),
    [filteredEvents]
  );
  const charts = useMemo(
    () =>
      page.charts.map((chart) => ({
        ...chart,
        ...buildMarkerEventChart(filteredEvents, chart.key, context),
      })),
    [context, filteredEvents, page.charts]
  );

  function addFilter(filter: StatsViewFilter<MarkerEventChartCategory>) {
    setFilters((current) =>
      current.some(
        (existing) =>
          existing.category === filter.category &&
          existing.value === filter.value
      )
        ? current
        : [...current, filter]
    );
  }

  const chartLabel = (category: MarkerEventChartCategory) =>
    page.charts.find((chart) => chart.key === category)?.label ?? category;

  const headerControls = (
    <div className="stats-header-controls">
      <StatsDateRangeFilter range={dateRange} onChange={setDateRange} />
      {!fixedStudioScope && (
        <StatsStudioSelector
          includeChildStudios={includeChildStudios}
          onIncludeChildStudiosChange={(include) =>
            updateView({ includeChildStudios: include, filters: [] })
          }
          onStudioChange={(studio) => updateView({ studio, filters: [] })}
          studio={selectedStudio}
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage
          className="marker-event-stats-page"
          loading
          loadingMessage={`Loading ${page.title.toLowerCase()}...`}
          showNavigation={!fixedStudioScope}
        />
      </>
    );
  }
  if (error) {
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage
          className="marker-event-stats-page"
          showNavigation={!fixedStudioScope}
        >
          <ErrorMessage error={error.message} />
        </StatsPage>
      </>
    );
  }

  // Filters and date ranges narrow the marker list to the matching scenes.
  const markersURL = (() => {
    const url = makeSceneStatsMarkerTagURL(
      rootTag,
      filters.length > 0 || dateRangeVariable
        ? markerEventScenes(filteredEvents)
        : undefined
    );
    if (url === "#") return undefined;
    return studioScope
      ? NavUtils.withStudioScope(
          url,
          studioScope.id,
          studioScope.name,
          studioScope.depth
        )
      : url;
  })();
  const markerRule = `A marker with two tops counts as two ${page.unit[1]}; one without tops counts as one. The list counts markers and can include second-camera repeats, which this total skips.`;
  const cards: ISummaryCard[] = [
    {
      label: page.countLabel,
      value: summary.count.toLocaleString(),
      title: markerRule,
      to: markersURL,
      action: markersURL ? "View markers" : undefined,
    },
    {
      label: page.timeLabel,
      value: TextUtils.formatDurationRange(summary.seconds),
      title: "Markers without an end count as 20 seconds.",
    },
  ];
  if (page.kind === MarkerEventStatsKind.Orgasm) {
    cards.push({
      label: "Estimated Liters",
      value: `${summary.liters.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} L`,
      title: "Total Nuts × 3 mL",
    });
  }

  const overview = (
    <>
      <SummaryCards cards={cards} />
      <MarkerEventCards
        title={page.unit[1].charAt(0).toUpperCase() + page.unit[1].slice(1)}
        events={filteredEvents}
        sort={sort}
        onSortChange={setMetric}
      />
      <p className="stats-interaction-help">
        Select a bar or Unknown badge to filter the totals, {page.unit[1]},
        rankings, and charts on this page.
      </p>
      {[false, true].map((compact) => (
        <div
          className={
            compact
              ? "stats-chart-grid stats-chart-grid--compact"
              : "stats-chart-grid"
          }
          key={String(compact)}
        >
          {charts
            .filter((chart) => !!chart.compact === compact)
            .map((chart) => (
              <StatsBarChart
                key={chart.key}
                title={chart.label}
                unit={chart.key === "group" ? RECEIVER_UNIT : page.unit}
                total={chart.total}
                totalNote={chart.note}
                sortable={chart.sortable}
                data={chart.data.map((datum) => ({
                  key: datum.key,
                  label: datum.label,
                  count: datum.count,
                  onSelect: () =>
                    addFilter({
                      category: chart.key,
                      label: datum.label,
                      value: datum.key,
                    }),
                }))}
                unknown={{
                  count: chart.unknownCount,
                  onSelect: () =>
                    addFilter({
                      category: chart.key,
                      label: "Unknown",
                      value: MARKER_EVENT_UNKNOWN,
                    }),
                }}
              />
            ))}
        </div>
      ))}
    </>
  );

  const topVatos =
    page.kind === MarkerEventStatsKind.Orgasm ? (
      <TopVatos
        title="Top Nutters"
        events={filteredEvents}
        role="giver"
        context={context}
        unit={page.unit}
      />
    ) : (
      <>
        <TopVatos
          title="Top Givers"
          events={filteredEvents}
          role="giver"
          context={context}
          unit={page.unit}
        />
        <TopVatos
          title="Top Receivers"
          events={filteredEvents}
          role="receiver"
          context={context}
          unit={page.unit}
        />
      </>
    );

  return (
    <StatsPage
      className="marker-event-stats-page"
      showNavigation={!fixedStudioScope}
    >
      <Helmet {...titleProps} />

      <header className="marker-event-stats-header">
        <h1>{pageTitle}</h1>
        {headerControls}
      </header>

      <StatsFilterBar
        label={`Active ${page.title} filters`}
        total={`${unitCount(filteredEvents.length, page.unit)} match`}
        onUndo={() => setFilters((current) => current.slice(0, -1))}
        onClear={() => setFilters([])}
        filters={filters.map((filter, index) => ({
          label: `${chartLabel(filter.category)}: ${filter.label}`,
          onRemove: () =>
            setFilters((current) => removeStatsFilter(current, index)),
        }))}
      />

      <Nav
        activeKey={showTop ? TOP_SECTION : "overview"}
        className="marker-event-stats-sections"
        onSelect={(key) =>
          history.push({
            ...location,
            search: searchWithSection(
              location.search,
              key === TOP_SECTION ? TOP_SECTION : undefined
            ),
          })
        }
        variant="tabs"
      >
        <Nav.Item>
          <Nav.Link eventKey="overview">Overview</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey={TOP_SECTION}>{page.topTab}</Nav.Link>
        </Nav.Item>
      </Nav>

      {events.length === 0 ? (
        <Alert variant="secondary">
          {rootTagID
            ? `No ${page.unit[1]} found.`
            : `Set the ${page.tagLabel} tag in Settings > Custom to see ${page.unit[1]}.`}
        </Alert>
      ) : showTop ? (
        topVatos
      ) : (
        overview
      )}
    </StatsPage>
  );
};

export const NutStatsDashboard: React.FC<{
  studioScope?: IVatoStatsStudioScope;
}> = ({ studioScope }) => (
  <MarkerEventStatsDashboard page={NUT_STATS_PAGE} studioScope={studioScope} />
);

export const FacialStatsDashboard: React.FC<{
  studioScope?: IVatoStatsStudioScope;
}> = ({ studioScope }) => (
  <MarkerEventStatsDashboard
    page={FACIAL_STATS_PAGE}
    studioScope={studioScope}
  />
);

export const NutStats: React.FC = () => <NutStatsDashboard />;

export const FacialStats: React.FC = () => <FacialStatsDashboard />;
