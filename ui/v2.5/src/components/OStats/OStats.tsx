import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { Alert, Button, ButtonGroup } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, RouteComponentProps, useHistory } from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
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
      associated_tags {
        id
        name
      }
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

const SCENE_O_EVENTS_BY_TAG = gql`
  query OStatsSceneOEventsByTag($tagID: ID!) {
    sceneOEventsByTag(tagID: $tagID) {
      id
      scene_id
      o_date
      video_timestamp
      associated_tags {
        id
        name
      }
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

const SCENE_O_EVENTS_BY_ETHNICITY = gql`
  query OStatsSceneOEventsByEthnicity($ethnicity: String!) {
    sceneOEventsByEthnicity(ethnicity: $ethnicity) {
      id
      scene_id
      o_date
      video_timestamp
      associated_tags {
        id
        name
      }
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

const MOST_OS_IN_DAY = gql`
  query OStatsMostOsInDay {
    mostOsInDay {
      date
      count
    }
  }
`;

const LONGEST_PERIOD_WITHOUT_O = gql`
  query OStatsLongestPeriodWithoutO {
    longestPeriodWithoutO {
      days
      start_date
      end_date
    }
  }
`;

const SCENE_O_COUNTS_BY_TAG = gql`
  query OStatsSceneOCountsByTag {
    sceneOCountsByTag {
      tag_id
      tag_name
      count
    }
  }
`;

const SCENE_O_COUNTS_BY_ETHNICITY = gql`
  query OStatsSceneOCountsByEthnicity {
    sceneOCountsByEthnicity {
      ethnicity
      count
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
  associated_tags: Array<{
    id: string;
    name: string;
  }>;
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

type SceneODayStat = {
  date: string;
  count: number;
};

type SceneODrySpell = {
  days: number;
  start_date: string;
  end_date: string;
};

type SceneOCountByTag = {
  tag_id: string;
  tag_name: string;
  count: number;
};

type SceneOCountByEthnicity = {
  ethnicity: string;
  count: number;
};

interface IRouteParams {
  tagId?: string;
  ethnicity?: string;
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

const OStatsTimeline: React.FC<{
  date?: string;
  tagId?: string;
  ethnicity?: string;
  emptyLabel: string;
}> = ({ date, tagId, ethnicity, emptyLabel }) => {
  const dateQuery = useQuery<{
    sceneOEventsByDate: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_DATE, {
    variables: { date },
    skip: !date,
  });
  const tagQuery = useQuery<{
    sceneOEventsByTag: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_TAG, {
    variables: { tagID: tagId },
    skip: !tagId,
  });
  const ethnicityQuery = useQuery<{
    sceneOEventsByEthnicity: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_ETHNICITY, {
    variables: { ethnicity },
    skip: !ethnicity,
  });

  const loading =
    dateQuery.loading || tagQuery.loading || ethnicityQuery.loading;
  const error = dateQuery.error ?? tagQuery.error ?? ethnicityQuery.error;

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage error={error} />;

  const events =
    dateQuery.data?.sceneOEventsByDate ??
    tagQuery.data?.sceneOEventsByTag ??
    ethnicityQuery.data?.sceneOEventsByEthnicity ??
    [];

  if (events.length === 0) {
    return <div className="ostats-empty">{emptyLabel}</div>;
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
              {event.associated_tags.length > 0 && (
                <div
                  className="ostats-event-tags"
                  aria-label="Associated marker tags"
                >
                  {event.associated_tags.map((tag) => (
                    <Link
                      className="ostats-event-tag"
                      key={tag.id}
                      to={`/ostats/tag/${tag.id}`}
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

const OStats: React.FC<RouteComponentProps<IRouteParams>> = ({ match }) => {
  const history = useHistory();
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const { oStatsExcludedTagIds } = roleTagIds;
  const selectedTagId = match.params.tagId;
  const selectedEthnicity = match.params.ethnicity
    ? decodeURIComponent(match.params.ethnicity)
    : undefined;
  const selectedYear = asPositiveInt(match.params.year);
  const selectedMonth = asPositiveInt(match.params.month);
  const selectedDay = asPositiveInt(match.params.day);
  const selectedDate = makeDate(selectedYear, selectedMonth, selectedDay);
  const showTimeline = !!selectedDate || !!selectedTagId || !!selectedEthnicity;

  const yearQuery = useQuery<{ sceneOYearCounts: YearCount[] }>(
    SCENE_O_YEAR_COUNTS
  );
  const mostOsInDayQuery = useQuery<{ mostOsInDay: SceneODayStat | null }>(
    MOST_OS_IN_DAY
  );
  const longestPeriodWithoutOQuery = useQuery<{
    longestPeriodWithoutO: SceneODrySpell | null;
  }>(LONGEST_PERIOD_WITHOUT_O);
  const countsByTagQuery = useQuery<{ sceneOCountsByTag: SceneOCountByTag[] }>(
    SCENE_O_COUNTS_BY_TAG,
    {
      skip: !!selectedYear,
    }
  );
  const countsByEthnicityQuery = useQuery<{
    sceneOCountsByEthnicity: SceneOCountByEthnicity[];
  }>(SCENE_O_COUNTS_BY_ETHNICITY, {
    skip: !!selectedYear,
  });
  const monthQuery = useQuery<{ sceneOMonthCounts: MonthCount[] }>(
    SCENE_O_MONTH_COUNTS,
    {
      skip: !!selectedTagId || !selectedYear || showTimeline,
      variables: { year: selectedYear },
    }
  );
  const dayQuery = useQuery<{ sceneODayCounts: DayCount[] }>(
    SCENE_O_DAY_COUNTS,
    {
      skip: !!selectedTagId || !selectedYear || !selectedMonth || showTimeline,
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

  const tagChartData = useMemo<IBarDatum[]>(() => {
    const excludedTagIds = new Set(oStatsExcludedTagIds ?? []);
    return (countsByTagQuery.data?.sceneOCountsByTag ?? [])
      .filter((item) => !excludedTagIds.has(item.tag_id))
      .map((item) => ({
        key: item.tag_id,
        label: item.tag_name,
        count: item.count,
        path: `/ostats/tag/${item.tag_id}`,
      }));
  }, [countsByTagQuery.data?.sceneOCountsByTag, oStatsExcludedTagIds]);

  const ethnicityChartData = useMemo<IBarDatum[]>(
    () =>
      (countsByEthnicityQuery.data?.sceneOCountsByEthnicity ?? []).map(
        (item) => ({
          key: item.ethnicity,
          label: item.ethnicity,
          count: item.count,
          path: `/ostats/ethnicity/${encodeURIComponent(item.ethnicity)}`,
        })
      ),
    [countsByEthnicityQuery.data?.sceneOCountsByEthnicity]
  );

  const selectedTagName = selectedTagId
    ? tagChartData.find((item) => item.key === selectedTagId)?.label
    : undefined;
  const loading =
    yearQuery.loading ||
    mostOsInDayQuery.loading ||
    longestPeriodWithoutOQuery.loading ||
    (!selectedYear && countsByTagQuery.loading) ||
    (!selectedYear && countsByEthnicityQuery.loading) ||
    (!selectedYear ? false : !showTimeline && monthQuery.loading) ||
    (!selectedMonth ? false : !showTimeline && dayQuery.loading);
  const error =
    yearQuery.error ??
    mostOsInDayQuery.error ??
    longestPeriodWithoutOQuery.error ??
    countsByTagQuery.error ??
    countsByEthnicityQuery.error ??
    monthQuery.error ??
    dayQuery.error;

  function renderTitle() {
    if (selectedTagId) return `O's tagged ${selectedTagName ?? selectedTagId}`;
    if (selectedEthnicity) return `O's to ${selectedEthnicity} vatos`;
    if (selectedDate) return `O's on ${selectedDate}`;
    if (selectedYear && selectedMonth) {
      return `${monthName(selectedMonth, "long")} ${selectedYear}`;
    }
    if (selectedYear) return String(selectedYear);
    return "O's";
  }

  function renderModeLabel() {
    if (selectedTagId) return "By Marker Tag";
    if (selectedEthnicity) return "By Ethnicity";
    if (selectedDate) return "Day Summary";
    if (selectedYear && selectedMonth) return "By Day";
    if (selectedYear) return "By Month";
    return "By Year";
  }

  const titleProps = useTitleProps("OStats", renderTitle());

  return (
    <div className="ostats-page">
      <Helmet {...titleProps} />

      <div className="ostats-header">
        <div>
          <h1>{renderTitle()}</h1>
          <p>Reliable tracked O dates from {O_STATS_TRACKING_START} onward.</p>
        </div>
        <ButtonGroup aria-label="O stats navigation">
          <Button
            disabled={!selectedYear && !selectedTagId}
            onClick={() => history.push("/ostats")}
            variant={!selectedYear && !selectedTagId ? "primary" : "secondary"}
          >
            By Year
          </Button>
          <Button
            disabled={!selectedYear || !!selectedTagId}
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

      {(mostOsInDayQuery.data?.mostOsInDay ||
        longestPeriodWithoutOQuery.data?.longestPeriodWithoutO) && (
        <div className="ostats-summary" aria-label="O date records">
          {mostOsInDayQuery.data?.mostOsInDay && (
            <div className="ostats-summary-item">
              <div className="ostats-summary-value">
                {mostOsInDayQuery.data.mostOsInDay.count}
              </div>
              <div className="ostats-summary-label">Most O&apos;s in a day</div>
              <div className="ostats-summary-detail">
                {mostOsInDayQuery.data.mostOsInDay.date}
              </div>
            </div>
          )}
          {longestPeriodWithoutOQuery.data?.longestPeriodWithoutO && (
            <div className="ostats-summary-item">
              <div className="ostats-summary-value">
                {longestPeriodWithoutOQuery.data.longestPeriodWithoutO.days}{" "}
                days
              </div>
              <div className="ostats-summary-label">
                Longest period without an O
              </div>
              <div className="ostats-summary-detail">
                {
                  longestPeriodWithoutOQuery.data.longestPeriodWithoutO
                    .start_date
                }{" "}
                -{" "}
                {longestPeriodWithoutOQuery.data.longestPeriodWithoutO.end_date}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ostats-subheader">
        <span>{renderModeLabel()}</span>
        {(selectedYear || selectedTagId) && (
          <Button
            onClick={() => {
              if (selectedTagId || selectedEthnicity) {
                history.push("/ostats");
              } else if (selectedDate && selectedYear && selectedMonth) {
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
      {!error && !loading && !showTimeline && !selectedYear && (
        <section className="ostats-section">
          <div className="ostats-subheader">
            <span>By Marker Tag</span>
          </div>
          <OStatsChart
            data={tagChartData}
            emptyLabel="No timestamped O marker-tag counts found."
          />
        </section>
      )}
      {!error && !loading && !showTimeline && !selectedYear && (
        <section className="ostats-section">
          <div className="ostats-subheader">
            <span>By Ethnicity</span>
          </div>
          <OStatsChart
            data={ethnicityChartData}
            emptyLabel="No O ethnicity counts found."
          />
        </section>
      )}
      {!error && !loading && showTimeline && (
        <OStatsTimeline
          date={selectedDate}
          tagId={selectedTagId}
          ethnicity={selectedEthnicity}
          emptyLabel={
            selectedTagId
              ? "No reliable O events found for this marker tag."
              : selectedEthnicity
              ? "No reliable O events found for this ethnicity."
              : "No reliable O events on this day."
          }
        />
      )}
      {!selectedDate && selectedYear && selectedMonth && selectedDay && (
        <Alert variant="warning">That date does not exist.</Alert>
      )}
    </div>
  );
};

export default OStats;
