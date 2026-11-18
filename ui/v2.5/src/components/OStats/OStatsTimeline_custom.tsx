import { StatsSectionSkeleton } from "src/components/Shared/CardGridSkeleton_custom"; // CUSTOM
import {
  formatAppDateTimeCustom as formatODate,
  getAppLocaleCustom,
} from "src/utils/appLocale_custom";
import React, { useMemo } from "react";
import { useQuery } from "@apollo/client"; // CUSTOM
import { Link } from "react-router-dom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import {
  OStatsEventMomentsDocument,
  OStatsEventPageDocument,
  useOStatsEventPageQuery,
} from "src/core/generated-graphql";
import type {
  OStatsEventMomentsQuery,
  OStatsEventPageQuery,
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
// CUSTOM: begin - amateur instance events in the timelines.
import {
  amateurRowKeyCustom,
  markAmateurCustom,
  mergeEventsByDateCustom,
  splitMergedTimelinePageCustom,
  withAmateurSourceCustom,
  zipMergedTimelinePageCustom,
  type AmateurMarked,
} from "./oStatsAmateur_custom";
import { OStatsAmateurNotice } from "./OStatsAmateurNotice_custom";
import {
  useBothOStatsQueriesCustom,
  type IAmateurOStats,
} from "./useAmateurOStats_custom";
// CUSTOM: end

type TimelineEvent = AmateurMarked<SceneOEvent>; // CUSTOM

const OStatsTimestampImage: React.FC<{
  event: SceneOEvent;
}> = ({ event }) => {
  // CUSTOM: release O screenshots come from the release's file.
  const hasTimestamp = !!event.screenshot_path;
  const imagePath = event.screenshot_path ?? event.scene.paths.screenshot;

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

// CUSTOM: an amateur scene or vato page opens in the amateur app; amateur O
// Stats drilldowns stay here, marked with their source.
const OStatsEventLink: React.FC<
  React.PropsWithChildren<{
    path: string;
    isAmateur: boolean;
    amateur?: IAmateurOStats;
    withScope: (path: string) => string;
    className?: string;
  }>
> = ({ path, isAmateur, amateur, withScope, className, children }) => {
  if (isAmateur && amateur && !path.startsWith("/ostats")) {
    return (
      <a
        className={className}
        href={amateur.appUrl(path)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      className={className}
      to={withScope(withAmateurSourceCustom(path, isAmateur))}
    >
      {children}
    </Link>
  );
};

export const OStatsEventList: React.FC<{
  events: TimelineEvent[];
  emptyLabel: string;
  sceneId?: string;
  total?: number;
  showTotal?: boolean;
  linkToEntity: boolean;
  withScope: (path: string) => string;
  amateur?: IAmateurOStats; // CUSTOM
}> = ({
  events,
  emptyLabel,
  sceneId,
  total = events.length,
  showTotal = true,
  linkToEntity,
  withScope,
  amateur,
}) => {
  const commonScene = commonOStatsTimelineSceneCustom(events, sceneId); // CUSTOM
  const commonIsAmateur = !!events[0]?.amateur; // CUSTOM

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
            <OStatsEventLink
              path={`/scenes/${commonScene.id}`}
              isAmateur={commonIsAmateur}
              amateur={amateur}
              withScope={withScope}
            >
              {commonScene.title || `Scene ${commonScene.id}`}
            </OStatsEventLink>
          </h3>
          <div className="ostats-event-meta">
            {commonScene.studio && <span>{commonScene.studio.name}</span>}
            <span>
              {commonScene.performers.map((performer, index) => (
                <React.Fragment key={performer.id}>
                  {index > 0 && ", "}
                  <OStatsEventLink
                    path={makeOStatsPerformerUrl(performer.id, linkToEntity)}
                    isAmateur={commonIsAmateur}
                    amateur={amateur}
                    withScope={withScope}
                  >
                    {performer.name}
                  </OStatsEventLink>
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
            const isAmateur = !!event.amateur; // CUSTOM
            const scenePath = makeOStatsSceneEventUrl(
              event.scene.id,
              event.video_timestamp,
              linkToEntity,
              event.release_id
            );

            return (
              <li
                className="ostats-event"
                key={amateurRowKeyCustom(event.id, isAmateur)} // CUSTOM
              >
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
                    {/* CUSTOM */}
                    {isAmateur && (
                      <span className="ostats-event-ordinal">Amateur</span>
                    )}
                  </div>
                  <OStatsEventLink
                    className="ostats-event-title"
                    path={scenePath}
                    isAmateur={isAmateur}
                    amateur={amateur}
                    withScope={withScope}
                  >
                    {/* CUSTOM: keep the seek link while dropping repeated scene identity. */}
                    {commonScene
                      ? event.video_timestamp != null
                        ? TextUtils.secondsToTimestamp(event.video_timestamp)
                        : "Open scene"
                      : event.scene.title || `Scene ${event.scene.id}`}
                  </OStatsEventLink>
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
                              <OStatsEventLink
                                className="ostats-event-performer"
                                path={makeOStatsPerformerUrl(
                                  performer.id,
                                  linkToEntity
                                )}
                                isAmateur={isAmateur}
                                amateur={amateur}
                                withScope={withScope}
                              >
                                {performer.name}
                              </OStatsEventLink>
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
                        <OStatsEventLink
                          className="ostats-event-tag"
                          key={tag.id}
                          path={`/ostats/tag/${tag.id}`}
                          isAmateur={isAmateur}
                          amateur={amateur}
                          withScope={withScope}
                        >
                          {tag.name}
                        </OStatsEventLink>
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
  amateur: IAmateurOStats; // CUSTOM
};

// CUSTOM: begin - merged event pages from both instances.
function mergeOStatsEventPagesCustom(
  main: OStatsEventPageQuery,
  amateur: OStatsEventPageQuery
): OStatsEventPageQuery {
  return {
    sceneOEvents: {
      ...main.sceneOEvents,
      count: main.sceneOEvents.count + amateur.sceneOEvents.count,
      events: mergeEventsByDateCustom<TimelineEvent>(
        main.sceneOEvents.events,
        markAmateurCustom(amateur.sceneOEvents.events)
      ),
    },
  };
}

// CUSTOM: end

// The preview requests only five events; it never downloads the full history.
export const OStatsLatest: React.FC<PageProps> = ({
  studioId,
  depth,
  dateRange,
  withScope,
  amateur,
}) => {
  // CUSTOM: the newest five across both instances.
  const options = {
    variables: {
      page: 1,
      perPage: O_STATS_LATEST_COUNT_CUSTOM,
      studioId,
      depth,
      dateRange,
    },
  };
  const { data, loading, error } = useBothOStatsQueriesCustom(
    amateur,
    OStatsEventPageDocument,
    options,
    options,
    mergeOStatsEventPagesCustom
  );
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
        <StatsSectionSkeleton />
      ) : error ? (
        <ErrorMessage error={error.message} />
      ) : (
        <OStatsEventList
          events={(data?.sceneOEvents.events ?? []).slice(
            0,
            O_STATS_LATEST_COUNT_CUSTOM
          )}
          emptyLabel="No O's in this range."
          showTotal={false}
          linkToEntity
          withScope={withScope}
          amateur={amateur} // CUSTOM
        />
      )}
    </section>
  );
};

// CUSTOM: the Previous/Next pager shared by both timeline variants.
const OStatsTimelinePager: React.FC<{
  page: number;
  pageCount: number;
  withScope: (path: string) => string;
}> = ({ page, pageCount, withScope }) => {
  if (pageCount <= 1) return null;
  const pageURL = (next: number) =>
    oStatsTimelinePageURLCustom(withScope(O_STATS_TIMELINE_PATH_CUSTOM), next);
  return (
    <nav
      className="d-flex justify-content-between align-items-center mt-3"
      aria-label="O timeline pages"
    >
      {page > 1 ? (
        <Link className="btn btn-sm btn-secondary" to={pageURL(page - 1)}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span>
        Page {page.toLocaleString(getAppLocaleCustom())} of{" "}
        {pageCount.toLocaleString(getAppLocaleCustom())}
      </span>
      {page < pageCount ? (
        <Link className="btn btn-sm btn-secondary" to={pageURL(page + 1)}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
};

type FullTimelineProps = PageProps & { page: number };

const OStatsSingleFullTimeline: React.FC<FullTimelineProps> = ({
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
  if (loading) return <StatsSectionSkeleton />;
  if (error) return <ErrorMessage error={error.message} />;
  if (!data) return null;
  const result = data.sceneOEvents;
  const pageCount = Math.max(
    1,
    Math.ceil(result.count / O_STATS_TIMELINE_PAGE_SIZE_CUSTOM)
  );
  return (
    <>
      <OStatsEventList
        events={result.events}
        total={result.count}
        emptyLabel="No O's in this range."
        linkToEntity
        withScope={withScope}
      />
      <OStatsTimelinePager
        page={result.page}
        pageCount={pageCount}
        withScope={withScope}
      />
    </>
  );
};

// CUSTOM: begin - both instances' O moments decide which slice of each
// timeline fills the page, then each instance loads only that slice.
const OStatsMergedFullTimeline: React.FC<FullTimelineProps> = (props) => {
  const { studioId, depth, dateRange, page, withScope, amateur } = props;
  const scope = { studioId, depth, dateRange };
  const mainMoments = useQuery<OStatsEventMomentsQuery>(
    OStatsEventMomentsDocument,
    { variables: scope }
  );
  const amateurMoments = useQuery<OStatsEventMomentsQuery>(
    OStatsEventMomentsDocument,
    { variables: scope, client: amateur.client, skip: !amateur.active }
  );
  const mainList = mainMoments.data?.moments;
  const amateurList = amateurMoments.data?.moments;
  const size = O_STATS_TIMELINE_PAGE_SIZE_CUSTOM;
  const total = (mainList?.length ?? 0) + (amateurList?.length ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const shownPage = Math.min(page, pageCount);
  const split = useMemo(
    () =>
      mainList && amateurList
        ? splitMergedTimelinePageCustom(
            mainList,
            amateurList,
            (shownPage - 1) * size,
            size
          )
        : undefined,
    [amateurList, mainList, shownPage]
  );
  const sliceOptions = (slice?: { offset: number; count: number }) => ({
    variables: {
      page: 1,
      perPage: Math.max(1, slice?.count ?? 0),
      offset: slice?.offset ?? 0,
      ...scope,
    },
    skip: !slice || slice.count === 0,
  });
  const mainSlice = useQuery<OStatsEventPageQuery>(
    OStatsEventPageDocument,
    sliceOptions(split?.main)
  );
  const amateurOptions = sliceOptions(split?.amateur);
  const amateurSlice = useQuery<OStatsEventPageQuery>(OStatsEventPageDocument, {
    ...amateurOptions,
    client: amateur.client,
    skip: amateurOptions.skip || !amateur.active,
  });
  const events = useMemo(
    () =>
      split
        ? zipMergedTimelinePageCustom<TimelineEvent>(
            split.order,
            mainSlice.data?.sceneOEvents.events ?? [],
            markAmateurCustom(amateurSlice.data?.sceneOEvents.events ?? [])
          )
        : [],
    [amateurSlice.data, mainSlice.data, split]
  );

  // Without the amateur side, fall back to this instance's own pages.
  if (amateurMoments.error || amateurSlice.error) {
    return (
      <>
        <OStatsAmateurNotice amateur={amateur} failed />
        <OStatsSingleFullTimeline {...props} />
      </>
    );
  }
  if (
    amateur.loading ||
    mainMoments.loading ||
    amateurMoments.loading ||
    mainSlice.loading ||
    amateurSlice.loading
  ) {
    return <StatsSectionSkeleton />;
  }
  const error = mainMoments.error ?? mainSlice.error;
  if (error) return <ErrorMessage error={error.message} />;
  return (
    <>
      <OStatsEventList
        events={events}
        total={total}
        emptyLabel="No O's in this range."
        linkToEntity
        withScope={withScope}
        amateur={amateur}
      />
      <OStatsTimelinePager
        page={shownPage}
        pageCount={pageCount}
        withScope={withScope}
      />
    </>
  );
};
// CUSTOM: end

export const OStatsFullTimeline: React.FC<FullTimelineProps> = (props) =>
  // CUSTOM: the merged timeline while the amateur instance is included.
  props.amateur.enabled && !props.amateur.problem ? (
    <OStatsMergedFullTimeline {...props} />
  ) : (
    <OStatsSingleFullTimeline {...props} />
  );
