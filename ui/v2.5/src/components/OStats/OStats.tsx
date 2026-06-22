import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { Alert, Button, ButtonGroup } from "react-bootstrap";
import { Link, RouteComponentProps, useHistory } from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import TextUtils from "src/utils/text";

import "./OStats.scss";

const O_STATS_TRACKING_START = "2024-03-08";

const SCENE_O_YEAR_COUNTS = gql`
  query OStatsSceneOYearCounts {
    sceneOYearCounts {
      year
      count
    }
  }
`;

const SCENE_O_MONTH_COUNTS = gql`
  query OStatsSceneOMonthCounts($year: Int!) {
    sceneOMonthCounts(year: $year) {
      year
      month
      count
    }
  }
`;

const SCENE_O_DAY_COUNTS = gql`
  query OStatsSceneODayCounts($year: Int!, $month: Int!) {
    sceneODayCounts(year: $year, month: $month) {
      date
      day
      count
    }
  }
`;

const SCENE_O_EVENTS_BY_DATE = gql`
  query OStatsSceneOEventsByDate($date: String!) {
    sceneOEventsByDate(date: $date) {
      id
      scene_id
      o_date
      video_timestamp
      scene {
        id
        title
        date
        paths {
          screenshot
        }
        studio {
          id
          name
        }
        performers {
          id
          name
        }
      }
    }
  }
`;

type YearCount = {
  year: number;
  count: number;
};

type MonthCount = {
  year: number;
  month: number;
  count: number;
};

type DayCount = {
  date: string;
  day: number;
  count: number;
};

type SceneOEvent = {
  id: string;
  scene_id: string;
  o_date: string;
  video_timestamp?: number | null;
  scene: {
    id: string;
    title?: string | null;
    date?: string | null;
    paths: {
      screenshot?: string | null;
    };
    studio?: {
      id: string;
      name: string;
    } | null;
    performers: Array<{
      id: string;
      name: string;
    }>;
  };
};

interface IRouteParams {
  year?: string;
  month?: string;
  day?: string;
}

interface IBarDatum {
  key: string;
  label: string;
  subLabel?: string;
  count: number;
  path: string;
}

function asPositiveInt(value: string | undefined) {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
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
  return new Date(Date.UTC(2024, month - 1, 1)).toLocaleString(undefined, {
    month: format,
    timeZone: "UTC",
  });
}

function dayLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatODate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const OStatsChart: React.FC<{ data: IBarDatum[]; emptyLabel: string }> = ({
  data,
  emptyLabel,
}) => {
  const history = useHistory();
  const max = Math.max(...data.map((item) => item.count), 1);

  if (data.length === 0) {
    return <div className="ostats-empty">{emptyLabel}</div>;
  }

  return (
    <div className="ostats-chart" role="list">
      {data.map((item) => {
        const height = `${Math.max((item.count / max) * 100, 8)}%`;

        return (
          <button
            className="ostats-bar-cell"
            key={item.key}
            onClick={() => history.push(item.path)}
            type="button"
            role="listitem"
          >
            <span className="ostats-bar-value">{item.count}</span>
            <span className="ostats-bar" style={{ height }} />
            <span className="ostats-bar-label">{item.label}</span>
            {item.subLabel && (
              <span className="ostats-bar-sublabel">{item.subLabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

const OStatsTimestampImage: React.FC<{
  event: SceneOEvent;
}> = ({ event }) => {
  const hasTimestamp =
    event.video_timestamp !== null && event.video_timestamp !== undefined;
  const imagePath = hasTimestamp
    ? `/scene/${event.scene.id}/o/${event.id}/screenshot`
    : event.scene.paths.screenshot;

  if (imagePath) {
    return (
      <img
        alt={event.scene.title ?? ""}
        className="ostats-event-thumb"
        loading="lazy"
        src={imagePath}
      />
    );
  }

  return <div className="ostats-event-thumb ostats-event-thumb-empty" />;
};

const OStatsTimeline: React.FC<{ date: string }> = ({ date }) => {
  const { data, error, loading } = useQuery<{
    sceneOEventsByDate: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_DATE, {
    variables: { date },
  });

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage error={error} />;

  const events = data?.sceneOEventsByDate ?? [];

  if (events.length === 0) {
    return (
      <div className="ostats-empty">No reliable O events on this day.</div>
    );
  }

  return (
    <ol className="ostats-timeline">
      {events.map((event) => {
        const scenePath =
          event.video_timestamp !== null && event.video_timestamp !== undefined
            ? `/scenes/${event.scene.id}?t=${Math.floor(event.video_timestamp)}`
            : `/scenes/${event.scene.id}`;

        return (
          <li className="ostats-event" key={event.id}>
            <OStatsTimestampImage event={event} />
            <div className="ostats-event-body">
              <div className="ostats-event-time">
                {formatODate(event.o_date)}
              </div>
              <Link className="ostats-event-title" to={scenePath}>
                {event.scene.title || `Scene ${event.scene.id}`}
              </Link>
              <div className="ostats-event-meta">
                {event.video_timestamp !== null &&
                  event.video_timestamp !== undefined && (
                    <span>
                      {TextUtils.secondsToTimestamp(event.video_timestamp)}
                    </span>
                  )}
                {event.scene.studio && <span>{event.scene.studio.name}</span>}
                {event.scene.performers.length > 0 && (
                  <span>
                    {event.scene.performers
                      .map((performer) => performer.name)
                      .join(", ")}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

const OStats: React.FC<RouteComponentProps<IRouteParams>> = ({ match }) => {
  const history = useHistory();
  const selectedYear = asPositiveInt(match.params.year);
  const selectedMonth = asPositiveInt(match.params.month);
  const selectedDay = asPositiveInt(match.params.day);
  const selectedDate = makeDate(selectedYear, selectedMonth, selectedDay);
  const showTimeline = !!selectedDate;

  const yearQuery = useQuery<{ sceneOYearCounts: YearCount[] }>(
    SCENE_O_YEAR_COUNTS
  );
  const monthQuery = useQuery<{ sceneOMonthCounts: MonthCount[] }>(
    SCENE_O_MONTH_COUNTS,
    {
      skip: !selectedYear || showTimeline,
      variables: { year: selectedYear },
    }
  );
  const dayQuery = useQuery<{ sceneODayCounts: DayCount[] }>(
    SCENE_O_DAY_COUNTS,
    {
      skip: !selectedYear || !selectedMonth || showTimeline,
      variables: { year: selectedYear, month: selectedMonth },
    }
  );

  const chartData = useMemo<IBarDatum[]>(() => {
    if (!selectedYear) {
      return (yearQuery.data?.sceneOYearCounts ?? []).map((item) => ({
        key: String(item.year),
        label: String(item.year),
        count: item.count,
        path: `/ostats/${item.year}`,
      }));
    }

    if (!selectedMonth) {
      return (monthQuery.data?.sceneOMonthCounts ?? []).map((item) => ({
        key: `${item.year}-${item.month}`,
        label: monthName(item.month),
        subLabel: String(item.year),
        count: item.count,
        path: `/ostats/${item.year}/${item.month}`,
      }));
    }

    return (dayQuery.data?.sceneODayCounts ?? []).map((item) => ({
      key: item.date,
      label: dayLabel(item.date),
      count: item.count,
      path: `/ostats/${selectedYear}/${selectedMonth}/${item.day}`,
    }));
  }, [
    dayQuery.data?.sceneODayCounts,
    monthQuery.data?.sceneOMonthCounts,
    selectedMonth,
    selectedYear,
    yearQuery.data?.sceneOYearCounts,
  ]);

  const loading =
    yearQuery.loading ||
    (!selectedYear ? false : !showTimeline && monthQuery.loading) ||
    (!selectedMonth ? false : !showTimeline && dayQuery.loading);
  const error = yearQuery.error ?? monthQuery.error ?? dayQuery.error;

  function renderTitle() {
    if (selectedDate) return `O's on ${selectedDate}`;
    if (selectedYear && selectedMonth) {
      return `${monthName(selectedMonth, "long")} ${selectedYear}`;
    }
    if (selectedYear) return String(selectedYear);
    return "O's";
  }

  function renderModeLabel() {
    if (selectedDate) return "Day Summary";
    if (selectedYear && selectedMonth) return "By Day";
    if (selectedYear) return "By Month";
    return "By Year";
  }

  return (
    <div className="ostats-page">
      <div className="ostats-header">
        <div>
          <h1>{renderTitle()}</h1>
          <p>Reliable tracked O dates from {O_STATS_TRACKING_START} onward.</p>
        </div>
        <ButtonGroup aria-label="O stats navigation">
          <Button
            disabled={!selectedYear}
            onClick={() => history.push("/ostats")}
            variant={!selectedYear ? "primary" : "secondary"}
          >
            By Year
          </Button>
          <Button
            disabled={!selectedYear}
            onClick={() =>
              selectedYear && history.push(`/ostats/${selectedYear}`)
            }
            variant={selectedYear && !selectedMonth ? "primary" : "secondary"}
          >
            By Month
          </Button>
          <Button
            disabled={!selectedYear || !selectedMonth}
            onClick={() =>
              selectedYear &&
              selectedMonth &&
              history.push(`/ostats/${selectedYear}/${selectedMonth}`)
            }
            variant={
              selectedYear && selectedMonth && !selectedDate
                ? "primary"
                : "secondary"
            }
          >
            By Day
          </Button>
        </ButtonGroup>
      </div>

      <div className="ostats-subheader">
        <span>{renderModeLabel()}</span>
        {selectedYear && (
          <Button
            onClick={() => {
              if (selectedDate && selectedYear && selectedMonth) {
                history.push(`/ostats/${selectedYear}/${selectedMonth}`);
              } else if (selectedMonth && selectedYear) {
                history.push(`/ostats/${selectedYear}`);
              } else {
                history.push("/ostats");
              }
            }}
            className="ostats-back-button"
            size="sm"
            variant="secondary"
          >
            Back
          </Button>
        )}
      </div>

      {error && <ErrorMessage error={error} />}
      {!error && loading && <LoadingIndicator />}
      {!error && !loading && !showTimeline && (
        <OStatsChart
          data={chartData}
          emptyLabel="No reliable O events in this range."
        />
      )}
      {!error && !loading && showTimeline && (
        <OStatsTimeline date={selectedDate} />
      )}
      {!selectedDate && selectedYear && selectedMonth && selectedDay && (
        <Alert variant="warning">That date does not exist.</Alert>
      )}
    </div>
  );
};

export default OStats;
