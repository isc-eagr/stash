import React from "react";
import { Link } from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { useOStatsEventPageQuery } from "src/core/generated-graphql";
import type {
  OStatsTimelineEventFragment as SceneOEvent,
  StatsDateRangeInput,
} from "src/core/generated-graphql";
import { formatStatsTotal } from "src/utils/statsDrilldown_custom";
import {
  makeOStatsPerformerUrl,
  makeOStatsSceneEventUrl,
} from "src/utils/oStatsNavigation_custom";
import TextUtils from "src/utils/text";
import {
  formatSceneOOrdinalLabelCustom,
  shouldShowSceneOOrdinalChipCustom,
} from "./oStatsEventPresentation_custom";
import { commonOStatsTimelineSceneCustom } from "./oStatsTimelinePresentation_custom";
import {
  O_STATS_LATEST_COUNT_CUSTOM,
  O_STATS_TIMELINE_PAGE_SIZE_CUSTOM,
  O_STATS_TIMELINE_PATH_CUSTOM,
  oStatsTimelinePageURLCustom,
} from "./oStatsTimelinePaging_custom";

function formatODate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const OStatsTimestampImage: React.FC<{
  event: SceneOEvent;
}> = ({ event }) => {
  const hasTimestamp =
    event.video_timestamp !== null && event.video_timestamp !== undefined;
  const imagePath = hasTimestamp
    ? `/scene/${event.scene.id}/o/${event.id}/screenshot`
    : event.scene.paths.screenshot;

  if (imagePath) {
    // CUSTOM: dim fallback scene covers while exact O screenshots stay normal.
    return (
      <img
        alt={event.scene.title ?? ""}
        className={`ostats-event-thumb${
          hasTimestamp ? "" : " ostats-event-thumb-scene-cover"
        }`}
        loading="lazy"
        src={imagePath}
      />
    );
  }

  return <div className="ostats-event-thumb ostats-event-thumb-empty" />;
};

export const OStatsEventList: React.FC<{
  events: SceneOEvent[];
  emptyLabel: string;
  sceneId?: string;
  total?: number;
  showTotal?: boolean;
  linkToEntity: boolean;
  withScope: (path: string) => string;
}> = ({
  events,
  emptyLabel,
  sceneId,
  total = events.length,
  showTotal = true,
  linkToEntity,
  withScope,
}) => {
  const commonScene = commonOStatsTimelineSceneCustom(events, sceneId); // CUSTOM

  return (
    <>
      {showTotal && (
        <div className="ostats-drilldown-total">
          {formatStatsTotal(total, "O event", "O events")}
        </div>
      )}
      {/* CUSTOM: one identity heading for a scene-specific timeline. */}
      {commonScene && (
        <div className="mb-3">
          <h3>
            <Link to={withScope(`/scenes/${commonScene.id}`)}>
              {commonScene.title || `Scene ${commonScene.id}`}
            </Link>
          </h3>
          <div className="ostats-event-meta">
            {commonScene.studio && <span>{commonScene.studio.name}</span>}
            <span>
              {commonScene.performers.map((performer, index) => (
                <React.Fragment key={performer.id}>
                  {index > 0 && ", "}
                  <Link
                    to={withScope(
                      makeOStatsPerformerUrl(performer.id, linkToEntity)
                    )}
                  >
                    {performer.name}
                  </Link>
                </React.Fragment>
              ))}
            </span>
          </div>
        </div>
      )}
      {events.length === 0 ? (
        <div className="ostats-empty">{emptyLabel}</div>
      ) : (
        <ol className="ostats-timeline">
          {events.map((event) => {
            const scenePath = makeOStatsSceneEventUrl(
              event.scene.id,
              event.video_timestamp,
              linkToEntity
            );

            return (
              <li className="ostats-event" key={event.id}>
                <OStatsTimestampImage event={event} />
                <div className="ostats-event-body">
                  <div className="ostats-event-time">
                    {formatODate(event.o_date)}
                    {event.is_first_for_scene && (
                      <span className="ostats-event-new">NEW</span>
                    )}
                    {shouldShowSceneOOrdinalChipCustom(
                      event.is_first_for_scene
                    ) && (
                      <span className="ostats-event-ordinal">
                        {formatSceneOOrdinalLabelCustom(event.scene_o_number)}
                      </span>
                    )}
                  </div>
                  <Link
                    className="ostats-event-title"
                    to={withScope(scenePath)}
                  >
                    {/* CUSTOM: keep the seek link while dropping repeated scene identity. */}
                    {commonScene
                      ? event.video_timestamp != null
                        ? TextUtils.secondsToTimestamp(event.video_timestamp)
                        : "Open scene"
                      : event.scene.title || `Scene ${event.scene.id}`}
                  </Link>
                  <div className="ostats-event-meta">
                    {!commonScene &&
                      event.video_timestamp !== null &&
                      event.video_timestamp !== undefined && (
                        <span>
                          {TextUtils.secondsToTimestamp(event.video_timestamp)}
                        </span>
                      )}
                    {!commonScene &&
                      event.scene.studio && ( // CUSTOM
                        <span>{event.scene.studio.name}</span>
                      )}
                    {!commonScene &&
                      event.scene.performers.length > 0 && ( // CUSTOM
                        <span>
                          {event.scene.performers.map((performer, index) => (
                            <React.Fragment key={performer.id}>
                              {index > 0 && ", "}
                              <Link
                                className="ostats-event-performer"
                                to={withScope(
                                  makeOStatsPerformerUrl(
                                    performer.id,
                                    linkToEntity
                                  )
                                )}
                              >
                                {performer.name}
                              </Link>
                            </React.Fragment>
                          ))}
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
                          to={withScope(`/ostats/tag/${tag.id}`)}
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

type PageProps = {
  studioId?: string;
  depth?: number;
  dateRange?: StatsDateRangeInput | null;
  withScope: (path: string) => string;
};

// The preview requests only five events; it never downloads the full history.
export const OStatsLatest: React.FC<PageProps> = ({
  studioId,
  depth,
  dateRange,
  withScope,
}) => {
  const { data, loading, error } = useOStatsEventPageQuery({
    variables: {
      page: 1,
      perPage: O_STATS_LATEST_COUNT_CUSTOM,
      studioId,
      depth,
      dateRange,
    },
  });
  return (
    <section className="ostats-chart-panel mb-3" aria-label="Latest O events">
      <div className="ostats-subheader">
        <h2>Latest</h2>
        <Link
          className="btn btn-sm btn-secondary"
          to={withScope(O_STATS_TIMELINE_PATH_CUSTOM)}
        >
          View All
        </Link>
      </div>
      {loading ? (
        <LoadingIndicator />
      ) : error ? (
        <ErrorMessage error={error.message} />
      ) : (
        <OStatsEventList
          events={data?.sceneOEvents.events ?? []}
          emptyLabel="No O's in this range."
          showTotal={false}
          linkToEntity
          withScope={withScope}
        />
      )}
    </section>
  );
};

export const OStatsFullTimeline: React.FC<PageProps & { page: number }> = ({
  studioId,
  depth,
  dateRange,
  page,
  withScope,
}) => {
  const { data, loading, error } = useOStatsEventPageQuery({
    variables: {
      page,
      perPage: O_STATS_TIMELINE_PAGE_SIZE_CUSTOM,
      studioId,
      depth,
      dateRange,
    },
  });
  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage error={error.message} />;
  if (!data) return null;
  const result = data.sceneOEvents;
  const pageCount = Math.max(
    1,
    Math.ceil(result.count / O_STATS_TIMELINE_PAGE_SIZE_CUSTOM)
  );
  const pageURL = (next: number) =>
    oStatsTimelinePageURLCustom(withScope(O_STATS_TIMELINE_PATH_CUSTOM), next);
  return (
    <>
      <OStatsEventList
        events={result.events}
        total={result.count}
        emptyLabel="No O's in this range."
        linkToEntity
        withScope={withScope}
      />
      {pageCount > 1 && (
        <nav
          className="d-flex justify-content-between align-items-center mt-3"
          aria-label="O timeline pages"
        >
          {result.page > 1 ? (
            <Link
              className="btn btn-sm btn-secondary"
              to={pageURL(result.page - 1)}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {result.page.toLocaleString()} of {pageCount.toLocaleString()}
          </span>
          {result.page < pageCount ? (
            <Link
              className="btn btn-sm btn-secondary"
              to={pageURL(result.page + 1)}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
};
