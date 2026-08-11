import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { faTimes, faUser } from "@fortawesome/free-solid-svg-icons";
import { PerformerCategoryStrip } from "src/components/Performers/PerformerDetails/PerformerCategoryStrip";
import { PerformerDetailsPanel } from "src/components/Performers/PerformerDetails/PerformerDetailsPanel";
import { PerformerSceneAverageRating } from "src/components/Performers/PerformerSceneRatingAdvisor_custom";
import { getPerformerRolePartnerSectionTitle } from "src/components/Performers/performerRolePartnerLabels_custom";
import { AliasList } from "src/components/Shared/DetailsPage/AliasList";
import { HoverPopover } from "src/components/Shared/HoverPopover";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { RatingBanner } from "src/components/Shared/RatingBanner";
import * as GQL from "src/core/generated-graphql";
import { useFindPerformer } from "src/core/StashService";
import { useConfigurationContext } from "src/hooks/Config";
import {
  SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS,
  SCENE_PERFORMER_OVERVIEW_LINK_PROPS,
  getScenePerformerOverviewActivityMetrics,
  getScenePerformerOverviewInteractions,
  getUniqueScenePerformerOverviewPartners,
} from "src/utils/scenePerformerOverview_custom";
import TextUtils from "src/utils/text";
import "./ScenePerformerOverviewPanel_custom.scss";

interface IScenePerformerOverviewContext {
  openPerformerOverview: (performerId: string) => void;
}

const ScenePerformerOverviewContext =
  createContext<IScenePerformerOverviewContext | null>(null);

export function useScenePerformerOverview() {
  return useContext(ScenePerformerOverviewContext);
}

const CLOSE_ANIMATION_MS = 220;

const ScenePerformerOverviewPanel: React.FC<{
  performerId: string;
  isOpen: boolean;
  onClose: () => void;
  scene: Pick<GQL.SceneDataFragment, "scene_markers">;
}> = ({ performerId, isOpen, onClose, scene }) => {
  const intl = useIntl();
  const { configuration } = useConfigurationContext();
  const { data, loading, error } = useFindPerformer(performerId);
  const performer =
    data?.findPerformer?.id === performerId ? data.findPerformer : undefined;
  const titleId = `scene-performer-overview-title-${performerId}`;
  const { data: coPerformerCountData } = GQL.usePerformerCoPerformerCountQuery({
    variables: { performer_id: performerId },
  });
  const { data: studiosData } = GQL.useFindStudiosQuery({
    variables: {
      studio_filter: {
        scenes_filter: {
          performers: {
            modifier: GQL.CriterionModifier.Includes,
            value: [performerId],
          },
        },
      },
      filter: { per_page: 1 },
    },
  });
  const [
    fetchPartnerImages,
    { data: partnerImagesData, loading: partnersLoading },
  ] = GQL.usePerformerCoPerformersMiniImagesLazyQuery();
  const partnerImagesFetched = useRef(false);
  const partnerRoleData =
    partnerImagesData?.performerCoPerformersByRole ?? undefined;
  const partnerImages = useMemo(
    () =>
      getUniqueScenePerformerOverviewPartners([
        partnerRoleData?.sex_as_top,
        partnerRoleData?.sex_as_bottom,
        partnerRoleData?.oral_as_top,
        partnerRoleData?.oral_as_bottom,
        partnerRoleData?.facial_as_top,
        partnerRoleData?.facial_as_bottom,
      ]),
    [partnerRoleData]
  );
  const uniqueCoPerformerCount =
    coPerformerCountData?.performerCoPerformerCount ?? 0;
  const studiosCount = studiosData?.findStudios.count ?? 0;
  const partnerPopoverEstimatedHeight =
    partnerImages.length > 0
      ? Math.ceil(partnerImages.length / 3) * 220 + 24
      : 80;
  const activityMetrics = useMemo(
    () =>
      performer
        ? getScenePerformerOverviewActivityMetrics(performer.activity_stats)
        : [],
    [performer]
  );
  const sceneInteractions = useMemo(
    () =>
      getScenePerformerOverviewInteractions(
        scene.scene_markers,
        performerId,
        configuration?.ui.roleTagIds ?? {}
      ),
    [configuration?.ui.roleTagIds, performerId, scene.scene_markers]
  );

  const loadPartnerImages = useCallback(() => {
    if (partnerImagesFetched.current) return;
    partnerImagesFetched.current = true;
    fetchPartnerImages({ variables: { performer_id: performerId } });
  }, [fetchPartnerImages, performerId]);

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add("scene-performer-overview-open");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("scene-performer-overview-open");
    };
  }, [isOpen, onClose]);

  const countItems = performer
    ? [
        { id: "scenes", value: performer.scene_count },
        { id: "groups", value: performer.group_count },
        { id: "images", value: performer.image_count },
        { id: "galleries", value: performer.gallery_count },
        { id: "o_count", value: performer.o_counter ?? 0 },
      ]
    : [];

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={intl.formatMessage({ id: "actions.close" })}
        className={`scene-performer-overview-backdrop ${
          isOpen ? "is-open" : ""
        }`}
        onClick={onClose}
      />
      <aside
        aria-hidden={!isOpen}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`scene-performer-overview-panel ${isOpen ? "is-open" : ""}`}
        role="dialog"
      >
        <header className="scene-performer-overview-toolbar">
          <span>Vato Overview</span>
          <Button
            autoFocus
            aria-label={intl.formatMessage({ id: "actions.close" })}
            className="minimal scene-performer-overview-close"
            onClick={onClose}
            title={intl.formatMessage({ id: "actions.close" })}
          >
            <Icon icon={faTimes} />
          </Button>
        </header>

        <div className="scene-performer-overview-scroll">
          {loading && !performer && <LoadingIndicator />}
          {error && (
            <div className="scene-performer-overview-error" role="alert">
              Unable to load this vato: {error.message}
            </div>
          )}
          {performer && (
            <>
              <section className="scene-performer-overview-profile">
                <div className="scene-performer-overview-image">
                  {performer.image_path ? (
                    <img
                      src={performer.image_path}
                      alt={performer.name ?? ""}
                    />
                  ) : (
                    <Icon icon={faUser} />
                  )}
                </div>
                <div className="scene-performer-overview-identity">
                  <Link
                    id={titleId}
                    className="scene-performer-overview-name"
                    to={`/performers/${performer.id}`}
                    {...SCENE_PERFORMER_OVERVIEW_LINK_PROPS}
                  >
                    {performer.name}
                    {performer.disambiguation && (
                      <span className="scene-performer-overview-disambiguation">
                        {` (${performer.disambiguation})`}
                      </span>
                    )}
                  </Link>
                  <AliasList aliases={performer.alias_list} />
                  <div
                    aria-label="Vato role totals"
                    className="scene-performer-overview-role-strip"
                  >
                    <PerformerCategoryStrip
                      performer={performer}
                      linkTarget={SCENE_PERFORMER_OVERVIEW_LINK_PROPS.target}
                      flushMargins
                    />
                  </div>
                </div>
              </section>

              <section
                aria-label="Vato ratings"
                className="scene-performer-overview-ratings"
              >
                {performer.rating100 !== null &&
                  performer.rating100 !== undefined && (
                    <div className="scene-performer-overview-rating">
                      <span>Vato rating</span>
                      <RatingBanner rating={performer.rating100} compact />
                    </div>
                  )}
                <div className="scene-performer-overview-rating">
                  <span>Scene average</span>
                  <PerformerSceneAverageRating performerId={performer.id} />
                </div>
              </section>

              <section
                aria-label="Vato catalog totals"
                className="scene-performer-overview-counts"
              >
                {countItems.map((item) => (
                  <div className="scene-performer-overview-count" key={item.id}>
                    <strong>{item.value}</strong>
                    <span>
                      <FormattedMessage id={item.id} />
                    </span>
                  </div>
                ))}
                <HoverPopover
                  className="scene-performer-overview-count"
                  estimatedContentHeight={partnerPopoverEstimatedHeight}
                  placement="bottom"
                  popoverClassName="performer-partner-hover-popover scene-performer-overview-partners-popover"
                  onOpen={loadPartnerImages}
                  content={
                    <div className="scene-performer-overview-partners">
                      {partnersLoading && partnerImages.length === 0 && (
                        <span>Loading partners...</span>
                      )}
                      {!partnersLoading && partnerImages.length === 0 && (
                        <span>No partner pictures available.</span>
                      )}
                      {partnerImages.map((partner) => (
                        <Link
                          key={partner.id}
                          aria-label={`Open ${partner.name}`}
                          className="scene-performer-overview-partner"
                          to={`/performers/${partner.id}`}
                          {...SCENE_PERFORMER_OVERVIEW_LINK_PROPS}
                          title={partner.name}
                        >
                          <img
                            alt={partner.name}
                            className="image-thumbnail performer-hover-image-thumbnail"
                            src={partner.image_path ?? ""}
                          />
                          <span>{partner.name}</span>
                        </Link>
                      ))}
                    </div>
                  }
                >
                  <Link
                    className="scene-performer-overview-count-link"
                    to={`/performers/${performer.id}/appearswithbyrole`}
                    {...SCENE_PERFORMER_OVERVIEW_LINK_PROPS}
                  >
                    <strong>{uniqueCoPerformerCount}</strong>
                    <span>Partners</span>
                  </Link>
                </HoverPopover>
                <div className="scene-performer-overview-count">
                  <strong>{studiosCount}</strong>
                  <span>
                    <FormattedMessage id="studios" />
                  </span>
                </div>
              </section>

              <PerformerDetailsPanel
                performer={performer}
                excludedFields={SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS}
                linkTarget={SCENE_PERFORMER_OVERVIEW_LINK_PROPS.target}
              />

              <section
                aria-labelledby={`scene-performer-overview-activity-${performer.id}`}
                className="scene-performer-overview-activity"
              >
                <h3 id={`scene-performer-overview-activity-${performer.id}`}>
                  Activity Time
                </h3>
                <div className="scene-performer-overview-activity-grid">
                  {activityMetrics.map((metric) => (
                    <div
                      className={`scene-performer-overview-activity-metric is-${metric.role}`}
                      key={metric.key}
                    >
                      <span>{metric.label}</span>
                      <strong>
                        {TextUtils.secondsToTimestamp(metric.seconds)}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section
                aria-labelledby={`scene-performer-overview-interactions-${performer.id}`}
                className="scene-performer-overview-interactions"
              >
                <h3
                  id={`scene-performer-overview-interactions-${performer.id}`}
                >
                  In This Scene
                </h3>
                {sceneInteractions.length > 0 ? (
                  sceneInteractions.map((interaction) => (
                    <div
                      className={`scene-performer-overview-interaction is-${interaction.role}`}
                      key={`${interaction.category}-${interaction.role}`}
                    >
                      <h4>
                        {getPerformerRolePartnerSectionTitle(
                          interaction.category,
                          interaction.role
                        )}
                      </h4>
                      <div className="scene-performer-overview-interaction-partners">
                        {interaction.partners.map((partner) => (
                          <Link
                            key={partner.id}
                            aria-label={`Open ${partner.name}`}
                            className="scene-performer-overview-interaction-partner"
                            to={`/performers/${partner.id}`}
                            {...SCENE_PERFORMER_OVERVIEW_LINK_PROPS}
                          >
                            <span className="scene-performer-overview-interaction-image">
                              {partner.image_path ? (
                                <img
                                  alt={partner.name}
                                  loading="lazy"
                                  src={partner.image_path}
                                />
                              ) : (
                                <Icon icon={faUser} />
                              )}
                            </span>
                            <span>{partner.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="scene-performer-overview-interactions-empty">
                    No role-based interactions recorded for this vato in this
                    scene.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export const ScenePerformerOverviewProvider: React.FC<
  PropsWithChildren<{
    scene: Pick<GQL.SceneDataFragment, "scene_markers">;
  }>
> = ({ children, scene }) => {
  const [performerId, setPerformerId] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<number>();

  const openPerformerOverview = useCallback((nextPerformerId: string) => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
    }
    setPerformerId(nextPerformerId);
    setIsOpen(true);
  }, []);

  const closePerformerOverview = useCallback(() => {
    setIsOpen(false);
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
    }
    closeTimer.current = window.setTimeout(() => {
      setPerformerId(undefined);
      closeTimer.current = undefined;
    }, CLOSE_ANIMATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
      }
    },
    []
  );

  return (
    <ScenePerformerOverviewContext.Provider value={{ openPerformerOverview }}>
      {children}
      {performerId && (
        <ScenePerformerOverviewPanel
          key={performerId}
          performerId={performerId}
          isOpen={isOpen}
          onClose={closePerformerOverview}
          scene={scene}
        />
      )}
    </ScenePerformerOverviewContext.Provider>
  );
};
