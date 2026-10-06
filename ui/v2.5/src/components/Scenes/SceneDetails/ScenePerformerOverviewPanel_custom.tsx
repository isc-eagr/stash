import { usePerformerStudioCount } from "src/components/Performers/performerDetailCounts_custom";
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
import {
  faFilm,
  faImage,
  faImages,
  faPlayCircle,
  faThumbsUp,
  faTimes,
  faUser,
  faUsers,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";
import { PerformerCategoryStrip } from "src/components/Performers/PerformerDetails/PerformerCategoryStrip";
import { PerformerDetailsPanel } from "src/components/Performers/PerformerDetails/PerformerDetailsPanel";
import { PerformerVersatility } from "src/components/Performers/PerformerDetails/PerformerVersatility_custom";
import { PerformerSceneAverageRating } from "src/components/Performers/PerformerSceneRatingAdvisor_custom";
import { getPerformerRolePartnerSectionTitle } from "src/components/Performers/performerRolePartnerLabels_custom";
import { AliasList } from "src/components/Shared/DetailsPage/AliasList";
import { HoverPopover } from "src/components/Shared/HoverPopover";
import { TagLink } from "src/components/Shared/TagLink";
import { VatoPortraitHover } from "src/components/Shared/VatoPortraitHover_custom"; // CUSTOM
import { Icon } from "src/components/Shared/Icon";
import { SweatDrops } from "src/components/Shared/SweatDrops";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { RatingBanner } from "src/components/Shared/RatingBanner";
import { RatingCriteriaStrip } from "src/components/Shared/RatingCriteriaStrip_custom";
import * as GQL from "src/core/generated-graphql";
import { useFindPerformer } from "src/core/StashService";
import {
  usePerformerCardRoleStats,
  withExactPerformerMarkerCounts,
} from "src/components/Performers/performerRoleStats_custom";
import { useConfigurationContext } from "src/hooks/Config";
import NavUtils from "src/utils/navigation";
import { makePerformerOStatsUrl } from "src/utils/oStatsNavigation_custom";
import {
  SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS,
  SCENE_PERFORMER_OVERVIEW_LINK_PROPS,
  getScenePerformerOverviewInteractions,
  getUniqueScenePerformerOverviewPartners,
} from "src/utils/scenePerformerOverview_custom";
import "./ScenePerformerOverviewPanel_custom.scss";

interface IScenePerformerOverviewContext {
  openPerformerOverview: (performerId: string) => void;
}

const ScenePerformerOverviewContext =
  createContext<IScenePerformerOverviewContext | null>(null);

export function useScenePerformerOverview() {
  return useContext(ScenePerformerOverviewContext);
}

// Markers for the interactions; dates for the vato's age in the scene.
type ScenePerformerOverviewScene = Pick<
  GQL.SceneDataFragment,
  "scene_markers" | "date" | "effective_date"
>;

const CLOSE_ANIMATION_MS = 220;
const CONDENSED_HEADER_SCROLL_PX = 90;

const OverviewCountRow: React.FC<{
  icon: React.ReactNode;
  label: React.ReactNode;
  to: string;
  value: number;
}> = ({ icon, label, to, value }) => (
  <Link
    className="scene-performer-overview-count"
    to={to}
    {...SCENE_PERFORMER_OVERVIEW_LINK_PROPS}
  >
    <span className="scene-performer-overview-count-icon">{icon}</span>
    <span className="scene-performer-overview-count-label">{label}</span>
    <strong>{value}</strong>
  </Link>
);

const ScenePerformerOverviewPanel: React.FC<{
  performerId: string;
  isOpen: boolean;
  onClose: () => void;
  scene: ScenePerformerOverviewScene;
}> = ({ performerId, isOpen, onClose, scene }) => {
  const intl = useIntl();
  const { configuration } = useConfigurationContext();
  const { data, loading, error } = useFindPerformer(performerId);
  const roleStatPerformers = useMemo(
    () => [{ id: performerId }],
    [performerId]
  );
  const roleStatsByPerformer = usePerformerCardRoleStats(roleStatPerformers);
  const performer =
    data?.findPerformer?.id === performerId ? data.findPerformer : undefined;
  const roleStats = performer
    ? withExactPerformerMarkerCounts(
        roleStatsByPerformer.get(performerId),
        performer
      )
    : undefined;
  const titleId = `scene-performer-overview-title-${performerId}`;
  const { data: coPerformerCountData } = GQL.usePerformerCoPerformerCountQuery({
    variables: { performer_id: performerId },
  });
  const studiosCount = usePerformerStudioCount(performerId);
  const [
    fetchPartnerImages,
    { data: partnerImagesData, loading: partnersLoading },
  ] = GQL.usePerformerCoPerformersMiniImagesLazyQuery();
  const partnerImagesFetched = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [condensedHeader, setCondensedHeader] = useState(false);
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
  const partnerPopoverEstimatedHeight =
    partnerImages.length > 0
      ? Math.ceil(partnerImages.length / 3) * 220 + 24
      : 80;
  const sceneInteractions = useMemo(
    () =>
      getScenePerformerOverviewInteractions(
        scene.scene_markers,
        performerId,
        configuration?.ui.roleTagIds ?? {}
      ),
    [configuration?.ui.roleTagIds, performerId, scene.scene_markers]
  );

  useEffect(() => {
    setCondensedHeader(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [performerId]);

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
        {
          id: "scenes",
          icon: <Icon icon={faPlayCircle} />,
          to: NavUtils.makePerformerScenesUrl(performer),
          value: performer.scene_count,
        },
        {
          id: "groups",
          icon: <Icon icon={faFilm} />,
          to: NavUtils.makePerformerGroupsUrl(performer),
          value: performer.group_count,
        },
        {
          id: "images",
          icon: <Icon icon={faImage} />,
          to: NavUtils.makePerformerImagesUrl(performer),
          value: performer.image_count,
        },
        {
          id: "galleries",
          icon: <Icon icon={faImages} />,
          to: NavUtils.makePerformerGalleriesUrl(performer),
          value: performer.gallery_count,
        },
      ].filter((item) => item.value > 0)
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
          {condensedHeader && performer ? (
            <button
              type="button"
              className="scene-performer-overview-condensed"
              onClick={() => scrollRef.current?.scrollTo({ top: 0 })}
            >
              {performer.image_path && (
                <img alt="" src={performer.image_path} />
              )}
              <span>{performer.name}</span>
            </button>
          ) : (
            <span>Vato Overview</span>
          )}
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

        <div
          className="scene-performer-overview-scroll"
          ref={scrollRef}
          onScroll={(event) =>
            setCondensedHeader(
              event.currentTarget.scrollTop > CONDENSED_HEADER_SCROLL_PX
            )
          }
        >
          {loading && !performer && <LoadingIndicator />}
          {error && (
            <div className="scene-performer-overview-error" role="alert">
              Unable to load this vato: {error.message}
            </div>
          )}
          {performer && (
            <>
              <section className="scene-performer-overview-profile">
                <div className="scene-performer-overview-visual">
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
                  <div
                    aria-label="Vato role totals"
                    className="scene-performer-overview-role-strip"
                  >
                    <PerformerCategoryStrip
                      performer={performer}
                      globalStatsOverride={roleStats}
                      linkTarget={SCENE_PERFORMER_OVERVIEW_LINK_PROPS.target}
                      flushMargins
                    />
                  </div>
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
                  {performer.tags.length > 0 && (
                    <ul className="scene-performer-overview-tags">
                      {performer.tags.map((tag) => (
                        <TagLink
                          key={tag.id}
                          linkType="performer"
                          tag={tag}
                          target={SCENE_PERFORMER_OVERVIEW_LINK_PROPS.target}
                        />
                      ))}
                    </ul>
                  )}
                  <div
                    aria-label="Vato catalog totals"
                    className="scene-performer-overview-counts"
                    role="group"
                  >
                    {countItems.map((item) => (
                      <OverviewCountRow
                        key={item.id}
                        icon={item.icon}
                        label={<FormattedMessage id={item.id} />}
                        to={item.to}
                        value={item.value}
                      />
                    ))}
                    {uniqueCoPerformerCount > 0 && (
                      <HoverPopover
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
                        <OverviewCountRow
                          icon={<Icon icon={faUsers} />}
                          label="Partners"
                          to={`/performers/${performer.id}/appearswithbyrole`}
                          value={uniqueCoPerformerCount}
                        />
                      </HoverPopover>
                    )}
                    {studiosCount > 0 && (
                      <OverviewCountRow
                        icon={<Icon icon={faVideo} />}
                        label={<FormattedMessage id="studios" />}
                        to={`/performers/${performer.id}/studios`}
                        value={studiosCount}
                      />
                    )}
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
                {!!performer.o_counter && (
                  <Link
                    aria-label={`O Count: ${performer.o_counter}`}
                    className="scene-performer-overview-rating scene-performer-overview-rating--o-count"
                    to={makePerformerOStatsUrl(performer.id)}
                    {...SCENE_PERFORMER_OVERVIEW_LINK_PROPS}
                  >
                    <span>
                      <FormattedMessage id="o_count" />
                    </span>
                    <span className="scene-performer-overview-o-count">
                      {configuration?.interface.sfwContentMode ? (
                        <Icon icon={faThumbsUp} />
                      ) : (
                        <SweatDrops />
                      )}
                      <strong>{performer.o_counter}</strong>
                    </span>
                  </Link>
                )}
              </section>

              <RatingCriteriaStrip
                className="rating-panel rating-panel--vato scene-performer-overview-rating-strip"
                entityId={performer.id}
                entityType="performer"
                oCount={performer.o_counter}
                ratingScores={performer.rating_scores}
              />

              <PerformerDetailsPanel
                ageFromDate={scene.effective_date ?? scene.date}
                performer={performer}
                excludedFields={SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS}
                linkTarget={SCENE_PERFORMER_OVERVIEW_LINK_PROPS.target}
              />

              {roleStats && (
                <PerformerVersatility
                  className="scene-performer-overview-versatility"
                  performer={performer}
                  linkTarget={SCENE_PERFORMER_OVERVIEW_LINK_PROPS.target}
                  facialBottomedPartners={roleStats.facial_with_bottom_count}
                  facialToppedPartners={roleStats.facial_with_top_count}
                  oralBottomedPartners={roleStats.oral_with_bottom_count}
                  oralToppedPartners={roleStats.oral_with_top_count}
                  sexBottomedPartners={roleStats.sex_with_bottom_count}
                  sexToppedPartners={roleStats.sex_with_top_count}
                />
              )}

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
                            {/* CUSTOM: compact portrait; hover shows it large */}
                            <VatoPortraitHover
                              imagePath={partner.image_path}
                              name={partner.name}
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
                            </VatoPortraitHover>
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

export const SCENE_PERFORMER_OVERVIEW_OPEN_CLASS =
  "scene-performer-overview-drawer-shown";

export const ScenePerformerOverviewProvider: React.FC<
  PropsWithChildren<{
    scene: ScenePerformerOverviewScene;
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

  // Hide the player's record-O button while the drawer is on screen,
  // including its closing slide, so it cannot cover the drawer.
  useEffect(() => {
    if (!performerId) return;
    document.body.classList.add(SCENE_PERFORMER_OVERVIEW_OPEN_CLASS);
    return () => {
      document.body.classList.remove(SCENE_PERFORMER_OVERVIEW_OPEN_CLASS);
    };
  }, [performerId]);

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
