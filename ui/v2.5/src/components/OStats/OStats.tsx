import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { Alert, Button, ButtonGroup } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { Link, RouteComponentProps, useHistory } from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { StatsPage } from "src/components/StatsPage_custom";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
import { statsCountryName } from "src/utils/statsCountry_custom";
import { formatStatsTotal } from "src/utils/statsDrilldown_custom";
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

const SCENE_O_EVENTS_WITHOUT_MARKER_TAGS = gql`
  query OStatsSceneOEventsWithoutMarkerTags {
    sceneOEventsWithoutMarkerTags {
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

const SCENE_O_EVENTS_BY_COUNTRY = gql`
  query OStatsSceneOEventsByCountry($country: String!) {
    sceneOEventsByCountry(country: $country) {
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

const SCENE_O_EVENTS_BY_STUDIO = gql`
  query OStatsSceneOEventsByStudio($studioID: ID!) {
    sceneOEventsByStudio(studioID: $studioID) {
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

const SCENE_O_EVENTS_WITH_UNKNOWN_STUDIO = gql`
  query OStatsSceneOEventsWithUnknownStudio {
    sceneOEventsWithUnknownStudio {
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

const SCENE_O_EVENTS_BY_PERFORMER_AGE = gql`
  query OStatsSceneOEventsByPerformerAge($age: Int!) {
    sceneOEventsByPerformerAge(age: $age) {
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

const SCENE_O_EVENTS_WITH_UNKNOWN_PERFORMER_AGE = gql`
  query OStatsSceneOEventsWithUnknownPerformerAge {
    sceneOEventsWithUnknownPerformerAge {
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

const SCENE_O_EVENTS_BY_RELEASE_YEAR = gql`
  query OStatsSceneOEventsByReleaseYear($year: Int!) {
    sceneOEventsByReleaseYear(year: $year) {
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

const SCENE_O_EVENTS_WITH_UNKNOWN_RELEASE_YEAR = gql`
  query OStatsSceneOEventsWithUnknownReleaseYear {
    sceneOEventsWithUnknownReleaseYear {
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

const SCENE_O_EVENTS_BEFORE_TRACKING_START = gql`
  query OStatsSceneOEventsBeforeTrackingStart {
    sceneOEventsBeforeTrackingStart {
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

const SCENE_O_EVENTS_BY_PERFORMER = gql`
  query OStatsSceneOEventsByPerformer($performerID: ID!) {
    sceneOEventsByPerformer(performerID: $performerID) {
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

const PERFORMER_NAME = gql`
  query OStatsPerformerName($id: ID!) {
    findPerformer(id: $id) {
      id
      name
    }
  }
`;

const STUDIO_NAME = gql`
  query OStatsStudioName($id: ID!) {
    findStudio(id: $id) {
      id
      name
    }
  }
`;

const TAG_NAME = gql`
  query OStatsTagName($id: ID!) {
    findTag(id: $id) {
      id
      name
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

const SCENE_O_COUNT_WITHOUT_MARKER_TAGS = gql`
  query OStatsSceneOCountWithoutMarkerTags {
    sceneOCountWithoutMarkerTags
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

const SCENE_O_COUNTS_BY_COUNTRY = gql`
  query OStatsSceneOCountsByCountry {
    sceneOCountsByCountry {
      country
      count
    }
  }
`;

const SCENE_O_COUNTS_BY_STUDIO = gql`
  query OStatsSceneOCountsByStudio {
    sceneOCountsByStudio {
      counts {
        studio_id
        studio_name
        count
      }
      unknown_count
    }
  }
`;

const SCENE_O_COUNTS_BY_PERFORMER_AGE = gql`
  query OStatsSceneOCountsByPerformerAge {
    sceneOCountsByPerformerAge {
      counts {
        age
        count
      }
      unknown_count
    }
  }
`;

const SCENE_O_COUNTS_BY_RELEASE_YEAR = gql`
  query OStatsSceneOCountsByReleaseYear {
    sceneOCountsByReleaseYear {
      counts {
        year
        count
      }
      unknown_count
    }
  }
`;

const SCENE_O_UNRELIABLE_DATE_COUNT = gql`
  query OStatsSceneOUnreliableDateCount {
    sceneOUnreliableDateCount
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

type SceneOCountByCountry = {
  country: string;
  count: number;
};

type SceneOCountByStudio = {
  studio_id: string;
  studio_name: string;
  count: number;
};

type SceneOCountsByStudio = {
  counts: SceneOCountByStudio[];
  unknown_count: number;
};

type SceneOCountByPerformerAge = {
  age: number;
  count: number;
};

type SceneOCountsByPerformerAge = {
  counts: SceneOCountByPerformerAge[];
  unknown_count: number;
};

type SceneOCountByReleaseYear = {
  year: number;
  count: number;
};

type SceneOCountsByReleaseYear = {
  counts: SceneOCountByReleaseYear[];
  unknown_count: number;
};

interface IRouteParams {
  tagId?: string;
  ethnicity?: string;
  country?: string;
  studioId?: string;
  performerAge?: string;
  releaseYear?: string;
  unknownCategory?: string;
  performerId?: string;
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

function isUnknownLabel(value: string) {
  return value.trim().toLowerCase() === "unknown";
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

const OStatsChart: React.FC<{
  data: IBarDatum[];
  emptyLabel: string;
  scrollable?: boolean;
}> = ({ data, emptyLabel, scrollable = false }) => {
  const history = useHistory();
  const max = Math.max(...data.map((item) => item.count), 1);

  if (data.length === 0) {
    return <div className="ostats-empty">{emptyLabel}</div>;
  }

  return (
    <div
      className={`ostats-chart${scrollable ? " ostats-chart-scrollable" : ""}`}
      role="list"
    >
      {data.map((item) => {
        const height = `${Math.max((item.count / max) * 100, 6)}%`;

        return (
          <button
            className="ostats-bar-cell"
            key={item.key}
            onClick={() => history.push(item.path)}
            type="button"
            role="listitem"
          >
            <span className="ostats-bar-value">
              {item.count.toLocaleString()}
            </span>
            <span className="ostats-bar-track">
              <span className="ostats-bar" style={{ height }} />
            </span>
            <span className="ostats-bar-label" title={item.label}>
              {item.label}
            </span>
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
  country?: string;
  studioId?: string;
  performerAge?: number;
  releaseYear?: number;
  unknownCategory?: string;
  performerId?: string;
  emptyLabel: string;
}> = ({
  date,
  tagId,
  ethnicity,
  country,
  studioId,
  performerAge,
  releaseYear,
  unknownCategory,
  performerId,
  emptyLabel,
}) => {
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
  const unknownMarkerTagQuery = useQuery<{
    sceneOEventsWithoutMarkerTags: SceneOEvent[];
  }>(SCENE_O_EVENTS_WITHOUT_MARKER_TAGS, {
    skip: unknownCategory !== "marker-tag",
  });
  const ethnicityQuery = useQuery<{
    sceneOEventsByEthnicity: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_ETHNICITY, {
    variables: { ethnicity },
    skip: !ethnicity,
  });
  const countryQuery = useQuery<{
    sceneOEventsByCountry: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_COUNTRY, {
    variables: { country },
    skip: !country,
  });
  const studioQuery = useQuery<{
    sceneOEventsByStudio: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_STUDIO, {
    variables: { studioID: studioId },
    skip: !studioId,
  });
  const unknownStudioQuery = useQuery<{
    sceneOEventsWithUnknownStudio: SceneOEvent[];
  }>(SCENE_O_EVENTS_WITH_UNKNOWN_STUDIO, {
    skip: unknownCategory !== "studio",
  });
  const performerAgeQuery = useQuery<{
    sceneOEventsByPerformerAge: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_PERFORMER_AGE, {
    variables: { age: performerAge },
    skip: !performerAge,
  });
  const unknownPerformerAgeQuery = useQuery<{
    sceneOEventsWithUnknownPerformerAge: SceneOEvent[];
  }>(SCENE_O_EVENTS_WITH_UNKNOWN_PERFORMER_AGE, {
    skip: unknownCategory !== "performer-age",
  });
  const releaseYearQuery = useQuery<{
    sceneOEventsByReleaseYear: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_RELEASE_YEAR, {
    variables: { year: releaseYear },
    skip: !releaseYear,
  });
  const unknownReleaseYearQuery = useQuery<{
    sceneOEventsWithUnknownReleaseYear: SceneOEvent[];
  }>(SCENE_O_EVENTS_WITH_UNKNOWN_RELEASE_YEAR, {
    skip: unknownCategory !== "release-year",
  });
  const unknownDateQuery = useQuery<{
    sceneOEventsBeforeTrackingStart: SceneOEvent[];
  }>(SCENE_O_EVENTS_BEFORE_TRACKING_START, {
    skip: unknownCategory !== "date",
  });
  const performerQuery = useQuery<{
    sceneOEventsByPerformer: SceneOEvent[];
  }>(SCENE_O_EVENTS_BY_PERFORMER, {
    variables: { performerID: performerId },
    skip: !performerId,
  });

  const loading = date
    ? dateQuery.loading
    : tagId
    ? tagQuery.loading
    : unknownCategory === "marker-tag"
    ? unknownMarkerTagQuery.loading
    : ethnicity
    ? ethnicityQuery.loading
    : country
    ? countryQuery.loading
    : studioId
    ? studioQuery.loading
    : unknownCategory === "studio"
    ? unknownStudioQuery.loading
    : performerAge
    ? performerAgeQuery.loading
    : releaseYear
    ? releaseYearQuery.loading
    : unknownCategory === "performer-age"
    ? unknownPerformerAgeQuery.loading
    : unknownCategory === "release-year"
    ? unknownReleaseYearQuery.loading
    : unknownCategory === "date"
    ? unknownDateQuery.loading
    : performerQuery.loading;
  const error = date
    ? dateQuery.error
    : tagId
    ? tagQuery.error
    : unknownCategory === "marker-tag"
    ? unknownMarkerTagQuery.error
    : ethnicity
    ? ethnicityQuery.error
    : country
    ? countryQuery.error
    : studioId
    ? studioQuery.error
    : unknownCategory === "studio"
    ? unknownStudioQuery.error
    : performerAge
    ? performerAgeQuery.error
    : releaseYear
    ? releaseYearQuery.error
    : unknownCategory === "performer-age"
    ? unknownPerformerAgeQuery.error
    : unknownCategory === "release-year"
    ? unknownReleaseYearQuery.error
    : unknownCategory === "date"
    ? unknownDateQuery.error
    : performerQuery.error;

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage error={error.message} />;

  const events = date
    ? dateQuery.data?.sceneOEventsByDate ?? []
    : tagId
    ? tagQuery.data?.sceneOEventsByTag ?? []
    : unknownCategory === "marker-tag"
    ? unknownMarkerTagQuery.data?.sceneOEventsWithoutMarkerTags ?? []
    : ethnicity
    ? ethnicityQuery.data?.sceneOEventsByEthnicity ?? []
    : country
    ? countryQuery.data?.sceneOEventsByCountry ?? []
    : studioId
    ? studioQuery.data?.sceneOEventsByStudio ?? []
    : unknownCategory === "studio"
    ? unknownStudioQuery.data?.sceneOEventsWithUnknownStudio ?? []
    : performerAge
    ? performerAgeQuery.data?.sceneOEventsByPerformerAge ?? []
    : releaseYear
    ? releaseYearQuery.data?.sceneOEventsByReleaseYear ?? []
    : unknownCategory === "performer-age"
    ? unknownPerformerAgeQuery.data?.sceneOEventsWithUnknownPerformerAge ?? []
    : unknownCategory === "release-year"
    ? unknownReleaseYearQuery.data?.sceneOEventsWithUnknownReleaseYear ?? []
    : unknownCategory === "date"
    ? unknownDateQuery.data?.sceneOEventsBeforeTrackingStart ?? []
    : performerQuery.data?.sceneOEventsByPerformer ?? [];

  return (
    <>
      <div className="ostats-drilldown-total">
        {formatStatsTotal(events.length, "O event", "O events")}
      </div>
      {events.length === 0 ? (
        <div className="ostats-empty">{emptyLabel}</div>
      ) : (
        <ol className="ostats-timeline">
          {events.map((event) => {
            const scenePath =
              event.video_timestamp !== null &&
              event.video_timestamp !== undefined
                ? `/scenes/${event.scene.id}?t=${Math.floor(
                    event.video_timestamp
                  )}`
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
                    {event.scene.studio && (
                      <span>{event.scene.studio.name}</span>
                    )}
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
      )}
    </>
  );
};

const OStats: React.FC<RouteComponentProps<IRouteParams>> = ({ match }) => {
  const history = useHistory();
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const { oStatsExcludedTagIds } = roleTagIds;
  const selectedTagId = match.params.tagId;
  const selectedPerformerId = match.params.performerId;
  const selectedStudioId = match.params.studioId;
  const selectedEthnicity = match.params.ethnicity
    ? decodeURIComponent(match.params.ethnicity)
    : undefined;
  const selectedCountry = match.params.country
    ? decodeURIComponent(match.params.country)
    : undefined;
  const selectedPerformerAge = asPositiveInt(match.params.performerAge);
  const selectedReleaseYear = asPositiveInt(match.params.releaseYear);
  const selectedUnknownCategory = [
    "date",
    "marker-tag",
    "studio",
    "performer-age",
    "release-year",
  ].includes(match.params.unknownCategory ?? "")
    ? match.params.unknownCategory
    : undefined;
  const selectedYear = asPositiveInt(match.params.year);
  const selectedMonth = asPositiveInt(match.params.month);
  const selectedDay = asPositiveInt(match.params.day);
  const selectedDate = makeDate(selectedYear, selectedMonth, selectedDay);
  const showTimeline =
    !!selectedDate ||
    !!selectedTagId ||
    !!selectedEthnicity ||
    !!selectedCountry ||
    !!selectedStudioId ||
    !!selectedPerformerAge ||
    !!selectedReleaseYear ||
    !!selectedUnknownCategory ||
    !!selectedPerformerId;
  const isDetailPage =
    !!selectedYear ||
    !!selectedTagId ||
    !!selectedEthnicity ||
    !!selectedCountry ||
    !!selectedStudioId ||
    !!selectedPerformerAge ||
    !!selectedReleaseYear ||
    !!selectedUnknownCategory ||
    !!selectedPerformerId;
  const showDateNavigation =
    !selectedTagId &&
    !selectedPerformerId &&
    !selectedEthnicity &&
    !selectedCountry &&
    !selectedStudioId &&
    !selectedPerformerAge &&
    !selectedReleaseYear &&
    !selectedUnknownCategory;
  const performerQuery = useQuery<{
    findPerformer: { id: string; name: string } | null;
  }>(PERFORMER_NAME, {
    variables: { id: selectedPerformerId },
    skip: !selectedPerformerId,
  });
  const studioQuery = useQuery<{
    findStudio: { id: string; name: string } | null;
  }>(STUDIO_NAME, {
    variables: { id: selectedStudioId },
    skip: !selectedStudioId,
  });
  const tagNameQuery = useQuery<{
    findTag: { id: string; name: string } | null;
  }>(TAG_NAME, {
    variables: { id: selectedTagId },
    skip: !selectedTagId,
  });

  const yearQuery = useQuery<{ sceneOYearCounts: YearCount[] }>(
    SCENE_O_YEAR_COUNTS,
    { skip: isDetailPage }
  );
  const mostOsInDayQuery = useQuery<{ mostOsInDay: SceneODayStat | null }>(
    MOST_OS_IN_DAY,
    { skip: isDetailPage }
  );
  const longestPeriodWithoutOQuery = useQuery<{
    longestPeriodWithoutO: SceneODrySpell | null;
  }>(LONGEST_PERIOD_WITHOUT_O, { skip: isDetailPage });
  const countsByTagQuery = useQuery<{ sceneOCountsByTag: SceneOCountByTag[] }>(
    SCENE_O_COUNTS_BY_TAG,
    {
      skip: isDetailPage,
    }
  );
  const unknownMarkerTagCountQuery = useQuery<{
    sceneOCountWithoutMarkerTags: number;
  }>(SCENE_O_COUNT_WITHOUT_MARKER_TAGS, {
    skip: isDetailPage,
  });
  const countsByEthnicityQuery = useQuery<{
    sceneOCountsByEthnicity: SceneOCountByEthnicity[];
  }>(SCENE_O_COUNTS_BY_ETHNICITY, {
    skip: isDetailPage,
  });
  const countsByCountryQuery = useQuery<{
    sceneOCountsByCountry: SceneOCountByCountry[];
  }>(SCENE_O_COUNTS_BY_COUNTRY, {
    skip: isDetailPage,
  });
  const countsByStudioQuery = useQuery<{
    sceneOCountsByStudio: SceneOCountsByStudio;
  }>(SCENE_O_COUNTS_BY_STUDIO, {
    skip: isDetailPage,
  });
  const countsByPerformerAgeQuery = useQuery<{
    sceneOCountsByPerformerAge: SceneOCountsByPerformerAge;
  }>(SCENE_O_COUNTS_BY_PERFORMER_AGE, {
    skip: isDetailPage,
  });
  const countsByReleaseYearQuery = useQuery<{
    sceneOCountsByReleaseYear: SceneOCountsByReleaseYear;
  }>(SCENE_O_COUNTS_BY_RELEASE_YEAR, {
    skip: isDetailPage,
  });
  const unreliableDateCountQuery = useQuery<{
    sceneOUnreliableDateCount: number;
  }>(SCENE_O_UNRELIABLE_DATE_COUNT, {
    skip: isDetailPage,
  });
  const monthQuery = useQuery<{ sceneOMonthCounts: MonthCount[] }>(
    SCENE_O_MONTH_COUNTS,
    {
      skip: !selectedYear || !!selectedMonth || showTimeline,
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
      (countsByEthnicityQuery.data?.sceneOCountsByEthnicity ?? [])
        .filter((item) => !isUnknownLabel(item.ethnicity))
        .map((item) => ({
          key: item.ethnicity,
          label: item.ethnicity,
          count: item.count,
          path: `/ostats/ethnicity/${encodeURIComponent(item.ethnicity)}`,
        })),
    [countsByEthnicityQuery.data?.sceneOCountsByEthnicity]
  );

  const ethnicityUnknownCount = useMemo(
    () =>
      (countsByEthnicityQuery.data?.sceneOCountsByEthnicity ?? []).find(
        (item) => isUnknownLabel(item.ethnicity)
      )?.count ?? 0,
    [countsByEthnicityQuery.data?.sceneOCountsByEthnicity]
  );

  const countryChartData = useMemo<IBarDatum[]>(
    () =>
      (countsByCountryQuery.data?.sceneOCountsByCountry ?? [])
        .filter((item) => !isUnknownLabel(item.country))
        .map((item) => ({
          key: item.country,
          label: statsCountryName(item.country),
          count: item.count,
          path: `/ostats/country/${encodeURIComponent(item.country)}`,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [countsByCountryQuery.data?.sceneOCountsByCountry]
  );

  const countryUnknownCount = useMemo(
    () =>
      (countsByCountryQuery.data?.sceneOCountsByCountry ?? []).find((item) =>
        isUnknownLabel(item.country)
      )?.count ?? 0,
    [countsByCountryQuery.data?.sceneOCountsByCountry]
  );

  const studioChartData = useMemo<IBarDatum[]>(
    () =>
      (countsByStudioQuery.data?.sceneOCountsByStudio.counts ?? []).map(
        (item) => ({
          key: item.studio_id,
          label: item.studio_name,
          count: item.count,
          path: `/ostats/studio/${item.studio_id}`,
        })
      ),
    [countsByStudioQuery.data?.sceneOCountsByStudio.counts]
  );

  const performerAgeChartData = useMemo<IBarDatum[]>(
    () =>
      (countsByPerformerAgeQuery.data?.sceneOCountsByPerformerAge.counts ?? [])
        .map((item) => ({
          key: String(item.age),
          label: String(item.age),
          count: item.count,
          path: `/ostats/age/${item.age}`,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [countsByPerformerAgeQuery.data?.sceneOCountsByPerformerAge.counts]
  );

  const releaseYearChartData = useMemo<IBarDatum[]>(
    () =>
      (countsByReleaseYearQuery.data?.sceneOCountsByReleaseYear.counts ?? [])
        .map((item) => ({
          key: String(item.year),
          label: String(item.year),
          count: item.count,
          path: `/ostats/release-year/${item.year}`,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [countsByReleaseYearQuery.data?.sceneOCountsByReleaseYear.counts]
  );

  const selectedTagName = selectedTagId
    ? tagNameQuery.data?.findTag?.name ??
      tagChartData.find((item) => item.key === selectedTagId)?.label
    : undefined;
  const chartDrilldownTotal = chartData.reduce(
    (total, item) => total + item.count,
    0
  );
  const loading =
    (!isDetailPage &&
      (yearQuery.loading ||
        mostOsInDayQuery.loading ||
        longestPeriodWithoutOQuery.loading ||
        countsByTagQuery.loading ||
        unknownMarkerTagCountQuery.loading ||
        countsByEthnicityQuery.loading ||
        countsByCountryQuery.loading ||
        countsByStudioQuery.loading ||
        countsByPerformerAgeQuery.loading ||
        countsByReleaseYearQuery.loading ||
        unreliableDateCountQuery.loading)) ||
    (!!selectedYear && !showTimeline && monthQuery.loading) ||
    (!!selectedYear && !!selectedMonth && !showTimeline && dayQuery.loading);
  const error =
    yearQuery.error ??
    mostOsInDayQuery.error ??
    longestPeriodWithoutOQuery.error ??
    countsByTagQuery.error ??
    unknownMarkerTagCountQuery.error ??
    countsByEthnicityQuery.error ??
    countsByCountryQuery.error ??
    countsByStudioQuery.error ??
    countsByPerformerAgeQuery.error ??
    countsByReleaseYearQuery.error ??
    unreliableDateCountQuery.error ??
    monthQuery.error ??
    dayQuery.error;

  function renderTitle() {
    if (selectedTagId)
      return `O's tagged ${selectedTagName ?? "Loading tag..."}`;
    if (selectedPerformerId) {
      return `O's to ${
        performerQuery.data?.findPerformer?.name ??
        `Vato ${selectedPerformerId}`
      }`;
    }
    if (selectedEthnicity) return `O's to ${selectedEthnicity} vatos`;
    if (selectedCountry)
      return `O's to ${statsCountryName(selectedCountry)} vatos`;
    if (selectedStudioId) {
      return `O's from ${
        studioQuery.data?.findStudio?.name ?? `Studio ${selectedStudioId}`
      }`;
    }
    if (selectedPerformerAge) return `O's to ${selectedPerformerAge}-year-olds`;
    if (selectedReleaseYear)
      return `O's in scenes released in ${selectedReleaseYear}`;
    if (selectedUnknownCategory === "date") return "O's with an unknown date";
    if (selectedUnknownCategory === "marker-tag") {
      return "O's with an unknown marker tag";
    }
    if (selectedUnknownCategory === "studio") {
      return "O's from scenes with an unknown studio";
    }
    if (selectedUnknownCategory === "performer-age") {
      return "O's with an unknown performer age";
    }
    if (selectedUnknownCategory === "release-year") {
      return "O's with an unknown scene release year";
    }
    if (selectedDate) return `O's on ${selectedDate}`;
    if (selectedYear && selectedMonth) {
      return `${monthName(selectedMonth, "long")} ${selectedYear}`;
    }
    if (selectedYear) return String(selectedYear);
    return "OStats";
  }

  function renderModeLabel() {
    if (selectedTagId) return "By Marker Tag";
    if (selectedUnknownCategory === "marker-tag") return "By Marker Tag";
    if (selectedPerformerId) return "By Vato";
    if (selectedEthnicity) return "By Ethnicity";
    if (selectedCountry) return "By Country";
    if (selectedStudioId || selectedUnknownCategory === "studio") {
      return "By Studio";
    }
    if (selectedPerformerAge || selectedUnknownCategory === "performer-age") {
      return "By Performer Age";
    }
    if (selectedReleaseYear || selectedUnknownCategory === "release-year") {
      return "By Scene Release Year";
    }
    if (selectedUnknownCategory === "date") return "By Year";
    if (selectedDate) return "Day Summary";
    if (selectedYear && selectedMonth) return "By Day";
    if (selectedYear) return "By Month";
    return "By Year";
  }

  const titleProps = useTitleProps("OStats", renderTitle());

  return (
    <StatsPage className="ostats-page">
      <Helmet {...titleProps} />

      <header className="ostats-header">
        <div>
          <h1>{renderTitle()}</h1>
          <p className="ostats-total">
            Date breakdowns use reliable tracked O dates from{" "}
            {O_STATS_TRACKING_START} onward. All other charts include every
            recorded O.
          </p>
        </div>
        {showDateNavigation && (
          <ButtonGroup aria-label="O date stats navigation">
            <Button
              disabled={!isDetailPage}
              onClick={() => history.push("/ostats")}
              variant={!isDetailPage ? "primary" : "secondary"}
            >
              By Year
            </Button>
            <Button
              disabled={!selectedYear || showTimeline}
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
        )}
      </header>

      {!isDetailPage &&
        (mostOsInDayQuery.data?.mostOsInDay ||
          longestPeriodWithoutOQuery.data?.longestPeriodWithoutO) && (
          <div className="ostats-summary" aria-label="O date records">
            {mostOsInDayQuery.data?.mostOsInDay && (
              <div className="ostats-summary-item">
                <div className="ostats-summary-value">
                  {mostOsInDayQuery.data.mostOsInDay.count}
                </div>
                <div className="ostats-summary-label">
                  Most O&apos;s in a day
                </div>
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
                  {
                    longestPeriodWithoutOQuery.data.longestPeriodWithoutO
                      .end_date
                  }
                </div>
              </div>
            )}
          </div>
        )}

      <section
        className={`ostats-chart-panel${
          showTimeline ? " ostats-timeline-panel" : ""
        }`}
      >
        <div className="ostats-subheader">
          <h2>{renderModeLabel()}</h2>
          <div className="ostats-subheader-actions">
            {!isDetailPage &&
              (unreliableDateCountQuery.data?.sceneOUnreliableDateCount ?? 0) >
                0 && (
                <button
                  className="ostats-unknown-count"
                  onClick={() => history.push("/ostats/unknown/date")}
                  type="button"
                >
                  Unknown:{" "}
                  {unreliableDateCountQuery.data?.sceneOUnreliableDateCount.toLocaleString()}
                </button>
              )}
            {isDetailPage && (
              <Button
                onClick={() => {
                  if (
                    selectedTagId ||
                    selectedEthnicity ||
                    selectedCountry ||
                    selectedStudioId ||
                    selectedPerformerId ||
                    selectedPerformerAge ||
                    selectedReleaseYear ||
                    selectedUnknownCategory
                  ) {
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
        </div>

        {error && <ErrorMessage error={error.message} />}
        {!error && loading && <LoadingIndicator message="Loading O stats..." />}
        {!error && !loading && isDetailPage && !showTimeline && (
          <div className="ostats-drilldown-total">
            {formatStatsTotal(chartDrilldownTotal, "O event", "O events")}
          </div>
        )}
        {!error && !loading && !showTimeline && (
          <OStatsChart
            data={chartData}
            emptyLabel="No reliable O events in this range."
          />
        )}
        {!error && !loading && showTimeline && (
          <OStatsTimeline
            date={selectedDate}
            tagId={selectedTagId}
            ethnicity={selectedEthnicity}
            country={selectedCountry}
            studioId={selectedStudioId}
            performerAge={selectedPerformerAge}
            releaseYear={selectedReleaseYear}
            unknownCategory={selectedUnknownCategory}
            performerId={selectedPerformerId}
            emptyLabel={
              selectedTagId
                ? "No O events found for this marker tag."
                : selectedPerformerId
                ? "No O events found for this vato."
                : selectedEthnicity
                ? "No O events found for this ethnicity."
                : selectedCountry
                ? "No O events found for this country."
                : selectedStudioId
                ? "No O events found for this studio."
                : selectedPerformerAge
                ? "No O events found for this performer age."
                : selectedReleaseYear
                ? "No O events found for this scene release year."
                : selectedUnknownCategory
                ? "No O events found for this unknown-value group."
                : "No reliable O events on this day."
            }
          />
        )}
        {!selectedDate && selectedYear && selectedMonth && selectedDay && (
          <Alert variant="warning">That date does not exist.</Alert>
        )}
      </section>
      {!error && !loading && !showTimeline && !selectedYear && (
        <section className="ostats-section">
          <div className="ostats-subheader">
            <h2>By Marker Tag</h2>
            {(unknownMarkerTagCountQuery.data?.sceneOCountWithoutMarkerTags ??
              0) > 0 && (
              <button
                className="ostats-unknown-count"
                onClick={() => history.push("/ostats/unknown/marker-tag")}
                type="button"
              >
                Unknown:{" "}
                {unknownMarkerTagCountQuery.data?.sceneOCountWithoutMarkerTags.toLocaleString()}
              </button>
            )}
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
            <h2>By Ethnicity</h2>
            {ethnicityUnknownCount > 0 && (
              <button
                className="ostats-unknown-count"
                onClick={() => history.push("/ostats/ethnicity/Unknown")}
                type="button"
              >
                Unknown: {ethnicityUnknownCount.toLocaleString()}
              </button>
            )}
          </div>
          <OStatsChart
            data={ethnicityChartData}
            emptyLabel="No O ethnicity counts found."
          />
        </section>
      )}
      {!error && !loading && !showTimeline && !selectedYear && (
        <section className="ostats-section">
          <div className="ostats-subheader">
            <h2>By Country</h2>
            {countryUnknownCount > 0 && (
              <button
                className="ostats-unknown-count"
                onClick={() => history.push("/ostats/country/Unknown")}
                type="button"
              >
                Unknown: {countryUnknownCount.toLocaleString()}
              </button>
            )}
          </div>
          <OStatsChart
            data={countryChartData}
            emptyLabel="No O country counts found."
            scrollable
          />
        </section>
      )}
      {!error && !loading && !showTimeline && !selectedYear && (
        <section className="ostats-section">
          <div className="ostats-subheader">
            <h2>By Studio</h2>
            {(countsByStudioQuery.data?.sceneOCountsByStudio.unknown_count ??
              0) > 0 && (
              <button
                className="ostats-unknown-count"
                onClick={() => history.push("/ostats/unknown/studio")}
                type="button"
              >
                Unknown:{" "}
                {countsByStudioQuery.data?.sceneOCountsByStudio.unknown_count.toLocaleString()}
              </button>
            )}
          </div>
          <OStatsChart
            data={studioChartData}
            emptyLabel="No O studio counts found."
            scrollable
          />
        </section>
      )}
      {!error && !loading && !showTimeline && !selectedYear && (
        <section className="ostats-section">
          <div className="ostats-subheader">
            <h2>By Performer Age</h2>
            {(countsByPerformerAgeQuery.data?.sceneOCountsByPerformerAge
              .unknown_count ?? 0) > 0 && (
              <button
                className="ostats-unknown-count"
                onClick={() => history.push("/ostats/unknown/performer-age")}
                type="button"
              >
                Unknown:{" "}
                {countsByPerformerAgeQuery.data?.sceneOCountsByPerformerAge.unknown_count.toLocaleString()}
              </button>
            )}
          </div>
          <OStatsChart
            data={performerAgeChartData}
            emptyLabel="No O performer-age counts found."
            scrollable
          />
        </section>
      )}
      {!error && !loading && !showTimeline && !selectedYear && (
        <section className="ostats-section">
          <div className="ostats-subheader">
            <h2>By Scene Release Year</h2>
            {(countsByReleaseYearQuery.data?.sceneOCountsByReleaseYear
              .unknown_count ?? 0) > 0 && (
              <button
                className="ostats-unknown-count"
                onClick={() => history.push("/ostats/unknown/release-year")}
                type="button"
              >
                Unknown:{" "}
                {countsByReleaseYearQuery.data?.sceneOCountsByReleaseYear.unknown_count.toLocaleString()}
              </button>
            )}
          </div>
          <OStatsChart
            data={releaseYearChartData}
            emptyLabel="No O scene release-year counts found."
            scrollable
          />
        </section>
      )}
    </StatsPage>
  );
};

export default OStats;
