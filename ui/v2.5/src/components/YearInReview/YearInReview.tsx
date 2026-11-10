// CUSTOM: Year in Review. One calendar year of O's: totals, streaks, top
// vatos, scenes and nuts, first-time vatos, months and the O Calendar.
import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { Alert } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import {
  MarkerEventStatsKind,
  SortDirectionEnum,
  useMarkerEventStatsMarkersQuery,
  useMarkerEventStatsQuery,
} from "src/core/generated-graphql";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { StatsPageSkeleton } from "src/components/Shared/CardGridSkeleton_custom";
import { SceneMarkerCardGrid } from "src/components/Scenes/SceneMarkerCardGrid";
import { StatsBarChart } from "src/components/StatsBarChart_custom";
import { StatsKpiRow, type IStatsKpi } from "src/components/StatsCharts_custom";
import { StatsPage } from "src/components/StatsPage_custom";
import { StatsTopCards } from "src/components/StatsTopCards_custom";
import { OStatsCalendarHeatmap } from "src/components/OStats/OStatsCalendarHeatmap_custom";
import { summarizeOStatsCalendar } from "src/components/OStats/oStatsCalendar_custom";
import {
  markerEventSortMetric,
  rankMarkerEventMarkers,
} from "src/components/MarkerEventStats/markerEventStatsData_custom";
import { useTitleProps } from "src/hooks/title";
import {
  formatAppDateCustom,
  getAppLocaleCustom,
} from "src/utils/appLocale_custom";
import { formatStatsBarPercent } from "src/utils/statsBarChart_custom";
import {
  parseYearInReviewYear,
  yearInReviewChange,
  yearInReviewElapsedDays,
  yearInReviewMonths,
  yearInReviewNewcomers,
  yearInReviewOStatsPath,
  yearInReviewPath,
  yearInReviewRanges,
  yearInReviewYears,
} from "./yearInReview_custom";

import "src/components/OStats/OStats.scss";
import "./YearInReview.scss";

const YEAR_IN_REVIEW_YEARS = gql`
  query YearInReviewYears {
    years: sceneOYearCounts {
      year
      count
    }
  }
`;

const YEAR_IN_REVIEW = gql`
  query YearInReview(
    $year: Int!
    $yearBefore: Int!
    $yearAfter: Int!
    $range: StatsDateRangeInput!
    $before: StatsDateRangeInput!
  ) {
    byScene: sceneOCountsByScene(date_range: $range) {
      scene_id
      title
      screenshot_path
      rating100
      count
    }
    byPerformer: sceneOCountsByPerformer(date_range: $range) {
      performer_id
      performer_name
      image_path
      rating100
      count
    }
    performersBefore: sceneOCountsByPerformer(date_range: $before) {
      performer_id
    }
    byStudio: sceneOCountsByStudio(date_range: $range) {
      counts {
        studio_id
        studio_name
        count
      }
    }
    longestPeriodWithoutO(date_range: $range) {
      days
      start_date
      end_date
    }
    days: sceneOCalendarDayCounts(year: $year) {
      date
      count
    }
    daysBefore: sceneOCalendarDayCounts(year: $yearBefore) {
      date
      count
    }
    daysAfter: sceneOCalendarDayCounts(year: $yearAfter) {
      date
      count
    }
  }
`;

interface IDayCount {
  date: string;
  count: number;
}

interface IYearInReviewData {
  byScene: Array<{
    scene_id: string;
    title?: string | null;
    screenshot_path: string;
    rating100?: number | null;
    count: number;
  }>;
  byPerformer: Array<{
    performer_id: string;
    performer_name: string;
    image_path?: string | null;
    rating100?: number | null;
    count: number;
  }>;
  performersBefore: Array<{ performer_id: string }>;
  byStudio: {
    counts: Array<{ studio_id: string; studio_name: string; count: number }>;
  };
  longestPeriodWithoutO?: {
    days: number;
    start_date: string;
    end_date: string;
  } | null;
  days: IDayCount[];
  daysBefore: IDayCount[];
  daysAfter: IDayCount[];
}

const O_UNIT: [string, string] = ["O", "O's"];
const TOP_NUT_COUNT = 5;
const NO_SELECTION = new Set<string>();

function count(value: number) {
  return value.toLocaleString(getAppLocaleCustom());
}

function units(value: number, [one, many]: [string, string]) {
  return `${count(value)} ${value === 1 ? one : many}`;
}

// The year's nuts you came to most, as marker cards.
const YearInReviewTopNuts: React.FC<{ year: number }> = ({ year }) => {
  const { range } = yearInReviewRanges(year);
  const { data } = useMarkerEventStatsQuery({
    variables: { kind: MarkerEventStatsKind.Orgasm, dateRange: range },
  });
  const ranked = useMemo(
    () =>
      rankMarkerEventMarkers(
        (data?.markerEventStats.events ?? []).filter(
          (event) => event.o_count > 0
        ),
        "o_count"
      ).slice(0, TOP_NUT_COUNT),
    [data?.markerEventStats.events]
  );
  const ids = useMemo(() => ranked.map((event) => event.marker_id), [ranked]);
  const { data: markerData } = useMarkerEventStatsMarkersQuery({
    skip: ids.length === 0,
    variables: { ids },
  });
  const markers = useMemo(() => {
    const byID = new Map(
      (markerData?.findSceneMarkers.scene_markers ?? []).map((marker) => [
        marker.id,
        marker,
      ])
    );
    return ids.flatMap((id) => byID.get(id) ?? []);
  }, [ids, markerData?.findSceneMarkers.scene_markers]);
  const events = new Map(ranked.map((event) => [event.marker_id, event]));

  if (markers.length === 0) return null;

  return (
    <section className="stats-top year-review-nuts">
      <div className="stats-top-heading">
        <div className="stats-top-title">
          <h2>Top Nuts of {year}</h2>
          <span className="stats-top-note">
            Nuts with the most of the year&apos;s O&apos;s landing on them.
          </span>
        </div>
      </div>
      <SceneMarkerCardGrid
        activeSortDirection={SortDirectionEnum.Desc}
        markers={markers}
        onSelectChange={() => {}}
        selectedIds={NO_SELECTION}
        sortMetricFor={(marker) => {
          const event = events.get(marker.id);
          return event ? markerEventSortMetric(event, "o_count") : undefined;
        }}
        zoomIndex={1}
      />
    </section>
  );
};

const YearInReviewContent: React.FC<{
  year: number;
  years: number[];
  yearCounts: ReadonlyMap<number, number>;
}> = ({ year, years, yearCounts }) => {
  const { data, error, loading } = useQuery<IYearInReviewData>(
    YEAR_IN_REVIEW,
    {
      variables: {
        year,
        yearBefore: year - 1,
        yearAfter: year + 1,
        ...yearInReviewRanges(year),
      },
    }
  );
  const calendar = useMemo(
    () =>
      summarizeOStatsCalendar(
        year,
        new Map(
          [
            ...(data?.daysBefore ?? []),
            ...(data?.days ?? []),
            ...(data?.daysAfter ?? []),
          ].map((day) => [day.date, day.count])
        )
      ),
    [data, year]
  );
  const months = useMemo(
    () => yearInReviewMonths(year, data?.days ?? [], getAppLocaleCustom()),
    [data?.days, year]
  );

  if (error) return <ErrorMessage error={error.message} />;
  if (loading || !data) {
    return (
      <div className="stats-page-loading">
        <StatsPageSkeleton message="Loading the year..." />
      </div>
    );
  }

  const total = data.byScene.reduce((sum, scene) => sum + scene.count, 0);
  const change = yearInReviewChange(total, yearCounts.get(year - 1), year - 1);
  const topStudio = data.byStudio.counts[0];
  const dry = data.longestPeriodWithoutO;
  const newVatos = yearInReviewNewcomers(
    data.byPerformer,
    data.performersBefore.map((performer) => performer.performer_id),
    (performer) => performer.performer_id
  );
  const oStats = (path: string) => yearInReviewOStatsPath(path, year);
  const vatoCard = (performer: IYearInReviewData["byPerformer"][number]) => ({
    key: performer.performer_id,
    title: performer.performer_name,
    imagePath: performer.image_path,
    rating100: performer.rating100,
    value: units(performer.count, O_UNIT),
    detail: formatStatsBarPercent(performer.count, total),
    to: oStats(`/ostats/vato/${performer.performer_id}`),
  });

  const kpis: IStatsKpi[] = [
    {
      key: "total",
      label: "Total O's",
      value: count(total),
      detail: change,
      to: `/ostats/${year}`,
      action: "View in O Stats",
    },
    {
      key: "active",
      label: "Active days",
      value: count(calendar.activeDays),
      detail: `of ${count(yearInReviewElapsedDays(year))}`,
    },
    {
      key: "streak",
      label: "Longest streak",
      value: units(calendar.longestStreak, ["day", "days"]),
      title: "Counted whole when it runs over New Year",
    },
    ...(calendar.bestDay
      ? [
          {
            key: "best",
            label: "Best day",
            value: units(calendar.bestDay.count, O_UNIT),
            detail: formatAppDateCustom(calendar.bestDay.date),
          },
        ]
      : []),
    ...(dry
      ? [
          {
            key: "dry",
            label: "Longest period without an O",
            value: units(dry.days, ["day", "days"]),
            detail: `${formatAppDateCustom(dry.start_date)} – ${formatAppDateCustom(dry.end_date)}`,
          },
        ]
      : []),
    {
      key: "scenes",
      label: "Scenes",
      value: count(data.byScene.length),
      detail: `${units(data.byPerformer.length, ["vato", "vatos"])}`,
    },
    ...(topStudio
      ? [
          {
            key: "studio",
            label: "Top studio",
            value: topStudio.studio_name,
            detail: units(topStudio.count, O_UNIT),
            to: oStats(`/ostats/studio/${topStudio.studio_id}`),
          },
        ]
      : []),
  ];

  return (
    <>
      <StatsKpiRow items={kpis} label={`${year} key numbers`} />
      <StatsTopCards
        title={`Top Vatos of ${year}`}
        variant="vato"
        note="An O counts for every vato in its scene."
        emptyLabel={`No O's in ${year}.`}
        items={data.byPerformer.map(vatoCard)}
      />
      <StatsTopCards
        title={`Top Scenes of ${year}`}
        variant="scene"
        emptyLabel={`No O's in ${year}.`}
        items={data.byScene.map((scene) => ({
          key: scene.scene_id,
          title: scene.title || `Scene ${scene.scene_id}`,
          imagePath: scene.screenshot_path,
          rating100: scene.rating100,
          value: units(scene.count, O_UNIT),
          detail: formatStatsBarPercent(scene.count, total),
          to: oStats(`/ostats/scene/${scene.scene_id}`),
        }))}
      />
      {newVatos.length > 0 && (
        <StatsTopCards
          title="New Favorites"
          variant="vato"
          note={`Vatos whose first dated O came in ${year}.`}
          emptyLabel=""
          items={newVatos.map(vatoCard)}
        />
      )}
      <YearInReviewTopNuts year={year} />
      <div className="year-review-months">
        <StatsBarChart
          title="O's by Month"
          unit={O_UNIT}
          variant="columns"
          data={months.map((month) => ({
            key: month.key,
            label: month.label,
            count: month.count,
            to:
              month.count > 0 ? `/ostats/${year}/${month.month}` : undefined,
          }))}
        />
      </div>
      <OStatsCalendarHeatmap fixedYear={year} years={years} />
    </>
  );
};

const YearInReview: React.FC = () => {
  const params = useParams<{ year?: string }>();
  const { data, error, loading } = useQuery<{
    years: Array<{ year: number; count: number }>;
  }>(YEAR_IN_REVIEW_YEARS);
  const { years, year, previous, next } = useMemo(
    () =>
      yearInReviewYears(data?.years ?? [], parseYearInReviewYear(params.year)),
    [data?.years, params.year]
  );
  const yearCounts = useMemo(
    () => new Map((data?.years ?? []).map((item) => [item.year, item.count])),
    [data?.years]
  );
  const title = year ? `${year} in Review` : "Year in Review";
  const titleProps = useTitleProps(title);

  if (loading) {
    return (
      <>
        <Helmet {...titleProps} />
        <StatsPage loading loadingMessage="Loading the year..." />
      </>
    );
  }

  return (
    <StatsPage className="year-review-page">
      <Helmet {...titleProps} />
      <header className="year-review-header">
        <h1>{title}</h1>
        {year !== undefined && (
          <nav className="year-review-years" aria-label="Year">
            {previous !== undefined && (
              <Link className="stats-chip" to={yearInReviewPath(previous)}>
                ← {previous}
              </Link>
            )}
            {next !== undefined && (
              <Link className="stats-chip" to={yearInReviewPath(next)}>
                {next} →
              </Link>
            )}
          </nav>
        )}
      </header>
      {error && <ErrorMessage error={error.message} />}
      {!error && year === undefined && (
        <Alert variant="secondary">No dated O&apos;s yet.</Alert>
      )}
      {!error && year !== undefined && (
        <YearInReviewContent
          key={year}
          year={year}
          years={years}
          yearCounts={yearCounts}
        />
      )}
    </StatsPage>
  );
};

export default YearInReview;
