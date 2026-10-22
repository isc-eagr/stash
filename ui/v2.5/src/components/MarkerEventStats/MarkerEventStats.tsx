import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import { gql, useQuery } from "@apollo/client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Nav } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useHistory, useLocation } from "react-router-dom";
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
import {
  StatsBarChart,
  StatsChartLegend,
  type IStatsBarDatum,
} from "src/components/StatsBarChart_custom";
import {
  StatsChartGroup,
  StatsCountryFlag,
  StatsDivergingChart,
  StatsKpiRow,
  StatsPairGrid,
  StatsRankByChips,
  type IStatsKpi,
} from "src/components/StatsCharts_custom";
import {
  STATS_BOTTOM_COLOR,
  STATS_QUALITY_COLORS,
  STATS_QUALITY_LEGEND,
  STATS_TOP_COLOR,
} from "src/utils/statsChartColors_custom";
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
  MARKER_EVENT_QUALITIES,
  MARKER_EVENT_QUALITY_LABELS,
  MARKER_EVENT_SORTS,
  MARKER_EVENT_UNKNOWN,
  markerEventMatchesFilter,
  markerEventQuality,
  markerEventScenes,
  markerEventSortMetric,
  markerEventStatsSummary,
  NUT_STATS_CHARTS,
  rankMarkerEventMarkers,
  rankMarkerEventVatos,
  type IMarkerEventChartDatum,
  type IMarkerEventChartDefinition,
  type IMarkerEventStatsContext,
  type IMarkerEvent,
  type MarkerEventChartCategory,
  type MarkerEventQuality,
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
  tagLabel: "Nut",
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

const SCENE_UNIT: [string, string] = ["scene", "scenes"];
const MARKER_CARD_PAGE_SIZE = 12;
const NO_SELECTION = new Set<string>();
const TOP_SECTION = "top";

function unitCount(count: number, unit: [string, string]) {
  return `${count.toLocaleString(getAppLocaleCustom())} ${
    count === 1 ? unit[0] : unit[1]
  }`;
}

function searchWithSection(search: string, section?: string) {
  const params = new URLSearchParams(search);
  if (section) params.set("section", section);
  else params.delete("section");
  const value = params.toString();
  return value ? `?${value}` : "";
}

// What He Was Doing in role colors: bottoms green, tops blue.
const ACTIVITY_ROLE_COLORS: Record<string, string | undefined> = {
  GETTING_FUCKED: STATS_BOTTOM_COLOR,
  SUCKING: STATS_BOTTOM_COLOR,
  FUCKING: STATS_TOP_COLOR,
  GETTING_SUCKED: STATS_TOP_COLOR,
};

const QUALITY_COLORS: Record<MarkerEventQuality, string> = {
  REGULAR: STATS_QUALITY_COLORS.regular,
  REALLY_HOT: STATS_QUALITY_COLORS.really_hot,
  GOAT: STATS_QUALITY_COLORS.goat,
};

// Mirror rows: ages in order, everything else by combined count.
function mirrorRowKeys(
  left: IMarkerEventChartDatum[],
  right: IMarkerEventChartDatum[],
  numeric: boolean
) {
  const rows = new Map<
    string,
    { label: string; sort: number; count: number }
  >();
  [...left, ...right].forEach((datum) => {
    const row = rows.get(datum.key) ?? {
      label: datum.label,
      sort: datum.sortValue,
      count: 0,
    };
    row.count += datum.count;
    rows.set(datum.key, row);
  });
  return Array.from(rows, ([key, row]) => ({ key, ...row })).sort((a, b) =>
    numeric
      ? a.sort - b.sort
      : b.count - a.count || a.label.localeCompare(b.label)
  );
}

// Ranked marker cards; only the visible page is fetched as full markers.
function chartSizeClass(chart: IMarkerEventChartDefinition) {
  return chart.size && `stats-${chart.size}`;
}

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
        <StatsRankByChips
          label="Sort by"
          options={MARKER_EVENT_SORTS}
          value={sort}
          onChange={onSortChange}
        />
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
          <button
            className="stats-chip"
            onClick={() =>
              setVisibleCount((current) => current + MARKER_CARD_PAGE_SIZE)
            }
            type="button"
          >
            Show{" "}
            {Math.min(
              MARKER_CARD_PAGE_SIZE,
              ranked.length - visibleCount
            ).toLocaleString(getAppLocaleCustom())}{" "}
            more
          </button>
          <span className="stats-top-count">
            {visibleCount.toLocaleString(getAppLocaleCustom())} of{" "}
            {ranked.length.toLocaleString(getAppLocaleCustom())}
          </span>
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
  const cards: IStatsKpi[] = [
    {
      key: "count",
      label: page.countLabel,
      value: summary.count.toLocaleString(getAppLocaleCustom()),
      title: markerRule,
      to: markersURL,
      action: markersURL ? "View markers" : undefined,
    },
    {
      key: "time",
      label: page.timeLabel,
      value: TextUtils.formatDurationRange(summary.seconds),
      title: "Markers without an end count as 20 seconds.",
    },
  ];
  if (page.kind === MarkerEventStatsKind.Orgasm) {
    cards.push({
      key: "liters",
      label: "Estimated Liters",
      value: `${summary.liters.toLocaleString(getAppLocaleCustom(), {
        maximumFractionDigits: 2,
      })} L`,
      title: "Total Nuts × 3 mL",
    });
  }

  const unknownFor = (chart: (typeof charts)[number]) => ({
    count: chart.unknownCount,
    onSelect: () =>
      addFilter({
        category: chart.key,
        label: "Unknown",
        value: MARKER_EVENT_UNKNOWN,
      }),
  });

  const chartBars = (chart: (typeof charts)[number]): IStatsBarDatum[] =>
    chart.data.map((datum) => {
      const filter = {
        category: chart.key,
        label: datum.label,
        value: datum.key,
      };
      return {
        key: datum.key,
        label: datum.label,
        count: datum.count,
        onSelect: () => addFilter(filter),
        segments: chart.stacked
          ? MARKER_EVENT_QUALITIES.map((quality) => ({
              key: quality,
              label: MARKER_EVENT_QUALITY_LABELS[quality],
              count: datum.qualities[quality],
              color: QUALITY_COLORS[quality],
              onSelect: () => {
                addFilter(filter);
                addFilter({
                  category: "quality",
                  label: MARKER_EVENT_QUALITY_LABELS[quality],
                  value: quality,
                });
              },
            }))
          : undefined,
      };
    });

  function renderChart(chart: (typeof charts)[number]) {
    const unit = chart.key === "per_scene" ? SCENE_UNIT : page.unit;
    if (chart.display === "none") return null;
    if (chart.display === "grid") {
      const cells = new Map(chart.data.map((datum) => [datum.key, datum]));
      const giverKeys = new Map<string, string>();
      const receiverKeys = new Map<string, string>();
      chart.data.forEach((datum) => {
        const [giver, receiver] = datum.key.split("|");
        const [giverLabel, receiverLabel] = datum.label.split(" → ");
        giverKeys.set(giver, giverLabel);
        receiverKeys.set(receiver, receiverLabel);
      });
      const axis = (keys: Map<string, string>, index: 0 | 1) =>
        Array.from(keys, ([key, label]) => ({
          key,
          label,
          count: chart.data
            .filter((datum) => datum.key.split("|")[index] === key)
            .reduce((total, datum) => total + datum.count, 0),
        })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      return (
        <StatsPairGrid
          className="stats-wide"
          key={chart.key}
          title={chart.label}
          rowTitle="Giver"
          columnTitle="Receiver"
          rows={axis(giverKeys, 0)}
          columns={axis(receiverKeys, 1)}
          cell={(giver, receiver) => {
            const datum = cells.get(`${giver}|${receiver}`);
            return datum
              ? {
                  count: datum.count,
                  onSelect: () =>
                    addFilter({
                      category: chart.key,
                      label: datum.label,
                      value: datum.key,
                    }),
                }
              : undefined;
          }}
          unit={unit}
          total={chart.total}
          totalNote={chart.note}
          unknown={unknownFor(chart)}
        />
      );
    }
    if (chart.display === "mirror") {
      const receiver = charts.find((item) => item.key === chart.mirror);
      const giverBars = new Map(chartBars(chart).map((bar) => [bar.key, bar]));
      const receiverBars = new Map(
        (receiver ? chartBars(receiver) : []).map((bar) => [bar.key, bar])
      );
      const numeric = chart.key === "giver_age";
      return (
        <StatsDivergingChart
          className={chartSizeClass(chart)}
          key={chart.key}
          title={chart.label}
          // Receivers are bottoms (left, green); givers are tops (right, blue).
          leftLabel="Receivers"
          rightLabel="Givers"
          leftColor={STATS_BOTTOM_COLOR}
          rightColor={STATS_TOP_COLOR}
          rows={mirrorRowKeys(chart.data, receiver?.data ?? [], numeric).map(
            (row) => ({
              key: row.key,
              label: row.label,
              icon:
                chart.key === "giver_country" ? (
                  <StatsCountryFlag country={row.key} />
                ) : undefined,
              left: receiverBars.get(row.key),
              right: giverBars.get(row.key),
            })
          )}
          extras={[receiver, chart].flatMap((item, index) =>
            item && item.unknownCount > 0
              ? [
                  {
                    key: `unknown-${item.key}`,
                    label: `${index === 0 ? "Receiver" : "Giver"} Unknown`,
                    ...unknownFor(item),
                  },
                ]
              : []
          )}
          initialRowCount={numeric ? 80 : undefined}
          unit={page.unit}
          totalNote={chart.note}
        />
      );
    }
    return (
      <StatsBarChart
        className={chartSizeClass(chart)}
        key={chart.key}
        variant={chart.display}
        title={chart.label}
        unit={unit}
        total={chart.total}
        totalNote={chart.note}
        sortable={chart.sortable}
        data={chartBars(chart).map((bar) =>
          chart.key === "giver_country"
            ? { ...bar, icon: <StatsCountryFlag country={bar.key} /> }
            : chart.key === "activity"
            ? { ...bar, color: ACTIVITY_ROLE_COLORS[bar.key] }
            : chart.key === "quality"
            ? { ...bar, color: QUALITY_COLORS[markerEventQuality(bar.key)] }
            : bar
        )}
        unknown={unknownFor(chart)}
      />
    );
  }

  // CUSTOM: charts grouped by topic, in definition order.
  const chartPanels = Array.from(
    new Set(charts.flatMap((chart) => chart.group ?? []))
  ).map((title) => ({
    title,
    charts: charts.filter((chart) => chart.group === title),
  }));

  const overview = (
    <>
      <StatsKpiRow items={cards} label="Summary" />
      <MarkerEventCards
        title={page.unit[1].charAt(0).toUpperCase() + page.unit[1].slice(1)}
        events={filteredEvents}
        sort={sort}
        onSortChange={setMetric}
      />
      {/* CUSTOM: the giver → receiver matrix sits right under the cards. */}
      {charts
        .filter((chart) => chart.display === "grid")
        .map((chart) => (
          <div className="marker-event-stats-matrix" key={chart.key}>
            {renderChart(chart)}
          </div>
        ))}
      <p className="stats-interaction-help">
        Select a bar or Unknown badge to filter the totals, {page.unit[1]},
        rankings, and charts on this page.
      </p>
      <div className="marker-event-stats-legend">
        <span>Column colors</span>
        <StatsChartLegend items={STATS_QUALITY_LEGEND} />
      </div>
      {chartPanels.map((panel) => (
        <StatsChartGroup
          className="stats-group--panel"
          key={panel.title}
          title={panel.title}
        >
          {panel.charts.map(renderChart)}
        </StatsChartGroup>
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
