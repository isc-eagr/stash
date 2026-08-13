import React, { useEffect, useMemo, useState } from "react";
import type { ApolloQueryResult } from "@apollo/client"; // CUSTOM
import { Button, Tabs, Tab, Col, Row } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { useHistory, Redirect, RouteComponentProps } from "react-router-dom";
import { Helmet } from "react-helmet";
import cx from "classnames";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import {
  useFindPerformer,
  usePerformerUpdate,
  usePerformerDestroy,
  mutateMetadataAutoTag,
} from "src/core/StashService";
import { DetailsEditNavbar } from "src/components/Shared/DetailsEditNavbar";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
// CUSTOM: Button imported above; removed unused ButtonGroup and duplicate import of react-bootstrap
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { useToast } from "src/hooks/Toast";
import { useConfigurationContext } from "src/hooks/Config";
import { RatingAdvisorButton } from "src/components/Shared/RatingAdvisor_custom"; // CUSTOM
import { PerformerSceneAverageRating } from "../PerformerSceneRatingAdvisor_custom"; // CUSTOM
import {
  CompressedPerformerDetailsPanel,
  PerformerDetailsPanel,
} from "./PerformerDetailsPanel";
import { PerformerScenesPanel } from "./PerformerScenesPanel";
import { PerformerGalleriesPanel } from "./PerformerGalleriesPanel";
import { PerformerGroupsPanel } from "./PerformerGroupsPanel";
import { PerformerImagesPanel } from "./PerformerImagesPanel";
import { PerformerMarkersPanel } from "./PerformerMarkersPanel"; // CUSTOM
import { PerformerAppearsWithPanel } from "./performerAppearsWithPanel";
// CUSTOM: begin
import { PerformerAppearsWithByRolePanel } from "./PerformerAppearsWithByRolePanel";
import { PerformerStudiosPanel } from "./PerformerStudiosPanel";
import { PerformerStatsPanel } from "./PerformerStatsPanel";
// CUSTOM: end
import { PerformerEditPanel } from "./PerformerEditPanel";
import { PerformerMergeModal } from "../PerformerMergeDialog";
import { PerformerSubmitButton } from "./PerformerSubmitButton";
import { DetailImage } from "src/components/Shared/DetailImage";
import { useLoadStickyHeader } from "src/hooks/detailsPanel";
import { useScrollToTopOnMount } from "src/hooks/scrollToTop";
import { ExternalLinkButtons } from "src/components/Shared/ExternalLinksButton";
import { BackgroundImage } from "src/components/Shared/DetailsPage/BackgroundImage";
import {
  TabTitleCounter,
  useTabKey,
} from "src/components/Shared/DetailsPage/Tabs";
import { DetailTitle } from "src/components/Shared/DetailsPage/DetailTitle";
import { ExpandCollapseButton } from "src/components/Shared/CollapseButton";
import { FavoriteIcon } from "src/components/Shared/FavoriteIcon";
import { AliasList } from "src/components/Shared/DetailsPage/AliasList";
import { HeaderImage } from "src/components/Shared/DetailsPage/HeaderImage";
import { LightboxLink } from "src/hooks/Lightbox/LightboxLink";
import { PatchComponent } from "src/patch";
import { ILightboxImage } from "src/hooks/Lightbox/types";
import { goBackOrReplace } from "src/utils/history";
import { OCounterButton } from "src/components/Shared/CountButton";
// CUSTOM: begin
import { PerformerCategoryStrip } from "./PerformerCategoryStrip";
import { Counter } from "src/components/Shared/Counter";
import { PerformerImageManager } from "./PerformerImageManager";
// CUSTOM: end

interface IProps {
  performer: GQL.PerformerDataFragment;
  tabKey?: TabKey;
  refetch: () => Promise<ApolloQueryResult<GQL.FindPerformerQuery>>; // CUSTOM
}

interface IPerformerParams {
  id: string;
  tab?: string;
}

const validTabs = [
  "default",
  "scenes",
  "galleries",
  "images",
  "groups",
  // CUSTOM: begin
  "markers",
  "studios",
  "stats",
  // CUSTOM: end
  "appearswith",
  "appearswithbyrole", // CUSTOM
] as const;
type TabKey = (typeof validTabs)[number];

function isTabKey(tab: string): tab is TabKey {
  return validTabs.includes(tab as TabKey);
}

const PerformerTabs: React.FC<{
  tabKey?: TabKey;
  performer: GQL.PerformerDataFragment;
  abbreviateCounter: boolean;
}> = ({ tabKey, performer, abbreviateCounter }) => {
  // CUSTOM: begin - fetch studios count, markers count, co-performer count
  // fetch count of studios where this performer has scenes
  const { data: studiosData } = GQL.useFindStudiosQuery({
    variables: {
      studio_filter: {
        scenes_filter: {
          performers: {
            modifier: GQL.CriterionModifier.Includes,
            value: [performer.id],
          },
        },
      },
      // no need to fetch actual studios here; we only use the count
      filter: { per_page: 1 },
    },
  });
  const studiosCount = studiosData?.findStudios.count ?? 0;

  // fetch count of markers directly assigned to this performer (as top or bottom)
  const { data: performerMarkersData } = GQL.useFindSceneMarkersQuery({
    variables: {
      scene_marker_filter: {
        scene_marker_tags: {
          modifier: GQL.CriterionModifier.Equals,
          groups_extended: [
            {
              tag_ids: [],
              top_performer_ids: [performer.id],
            },
          ],
        },
      },
      // no need to fetch actual markers here; we only use the count
      filter: { per_page: 1 },
    },
  });
  // Also count bottom markers
  const { data: performerBottomMarkersData } = GQL.useFindSceneMarkersQuery({
    variables: {
      scene_marker_filter: {
        scene_marker_tags: {
          modifier: GQL.CriterionModifier.Equals,
          groups_extended: [
            {
              tag_ids: [],
              bottom_performer_ids: [performer.id],
            },
          ],
        },
      },
      filter: { per_page: 1 },
    },
  });
  const performerMarkersCount =
    (performerMarkersData?.findSceneMarkers.count ?? 0) +
    (performerBottomMarkersData?.findSceneMarkers.count ?? 0);

  // CUSTOM: begin - fetch exact lightweight co-performer count for "Partners" tab
  const { data: coPerformerCountData } = GQL.usePerformerCoPerformerCountQuery({
    variables: { performer_id: performer.id },
  });
  const uniqueCoPerformerCount =
    coPerformerCountData?.performerCoPerformerCount ?? 0;
  // CUSTOM: end

  const populatedDefaultTab = useMemo(() => {
    let ret: TabKey = "scenes";
    if (performer.scene_count == 0) {
      if (performer.gallery_count != 0) {
        ret = "galleries";
      } else if (performer.image_count != 0) {
        ret = "images";
      } else if (performer.group_count != 0) {
        ret = "groups";
      }
    }

    return ret;
  }, [performer]);

  const { setTabKey } = useTabKey({
    tabKey,
    validTabs,
    defaultTabKey: populatedDefaultTab,
    baseURL: `/performers/${performer.id}`,
  });

  useEffect(() => {
    Mousetrap.bind("c", () => setTabKey("scenes"));
    Mousetrap.bind("g", () => setTabKey("galleries"));
    Mousetrap.bind("m", () => setTabKey("groups"));

    return () => {
      Mousetrap.unbind("c");
      Mousetrap.unbind("g");
      Mousetrap.unbind("m");
    };
  });

  return (
    <Tabs
      id="performer-tabs"
      mountOnEnter
      unmountOnExit
      activeKey={tabKey}
      onSelect={setTabKey}
    >
      <Tab
        eventKey="scenes"
        title={
          <TabTitleCounter
            messageID="scenes"
            count={performer.scene_count}
            abbreviateCounter={abbreviateCounter}
          />
        }
      >
        <PerformerScenesPanel
          active={tabKey === "scenes"}
          performer={performer}
        />
      </Tab>

      <Tab
        eventKey="galleries"
        title={
          <TabTitleCounter
            messageID="galleries"
            count={performer.gallery_count}
            abbreviateCounter={abbreviateCounter}
          />
        }
      >
        <PerformerGalleriesPanel
          active={tabKey === "galleries"}
          performer={performer}
        />
      </Tab>

      <Tab
        eventKey="images"
        title={
          <TabTitleCounter
            messageID="images"
            count={performer.image_count}
            abbreviateCounter={abbreviateCounter}
          />
        }
      >
        <PerformerImagesPanel
          active={tabKey === "images"}
          performer={performer}
        />
      </Tab>

      <Tab
        eventKey="groups"
        title={
          <TabTitleCounter
            messageID="groups"
            count={performer.group_count}
            abbreviateCounter={abbreviateCounter}
          />
        }
      >
        <PerformerGroupsPanel
          active={tabKey === "groups"}
          performer={performer}
        />
      </Tab>

      {/* CUSTOM: begin - Markers tab */}
      <Tab
        eventKey="markers"
        title={
          <>
            <FormattedMessage id="markers" defaultMessage="Markers" />
            <Counter
              count={performerMarkersCount}
              abbreviateCounter={abbreviateCounter}
              hideZero
            />
          </>
        }
      >
        <PerformerMarkersPanel
          active={tabKey === "markers"}
          performer={performer}
        />
      </Tab>
      {/* CUSTOM: end */}

      {/* CUSTOM: begin - hidden appears-with, appears-with-by-role, studios tabs */}
      {/* HIDDEN: This tab is hidden in this fork but kept for upstream merge compatibility */}
      {false && (
        <Tab
          eventKey="appearswith"
          title={
            <TabTitleCounter
              messageID="appears_with"
              count={performer.performer_count}
              abbreviateCounter={abbreviateCounter}
            />
          }
        >
          <PerformerAppearsWithPanel
            active={tabKey === "appearswith"}
            performer={performer}
          />
        </Tab>
      )}
      <Tab
        eventKey="appearswithbyrole"
        title={
          <>
            <FormattedMessage
              id="appears_with_by_role"
              defaultMessage="Partners"
            />
            {uniqueCoPerformerCount > 0 && (
              <Counter
                abbreviateCounter={abbreviateCounter}
                count={uniqueCoPerformerCount}
              />
            )}
          </>
        }
      >
        <PerformerAppearsWithByRolePanel
          active={tabKey === "appearswithbyrole"}
          performer={performer}
        />
      </Tab>
      <Tab
        eventKey="studios"
        title={
          <TabTitleCounter
            messageID="studios"
            count={studiosCount}
            abbreviateCounter={abbreviateCounter}
          />
        }
      >
        <PerformerStudiosPanel
          active={tabKey === "studios"}
          performer={performer}
        />
      </Tab>
      <Tab eventKey="stats" title="Stats">
        <PerformerStatsPanel
          active={tabKey === "stats"}
          performer={performer}
        />
      </Tab>
      {/* CUSTOM: end */}
    </Tabs>
  );
};

interface IPerformerHeaderImageProps {
  activeImage: string | null | undefined;
  collapsed: boolean;
  encodingImage: boolean;
  lightboxImages: ILightboxImage[];
  performer: GQL.PerformerDataFragment;
  refetch: () => Promise<ApolloQueryResult<GQL.FindPerformerQuery>>; // CUSTOM
}

const PerformerHeaderImage: React.FC<IPerformerHeaderImageProps> =
  PatchComponent(
    "PerformerHeaderImage",
    // CUSTOM: begin - PerformerImageManager, currentImage state, PerformerCategoryStrip
    ({ encodingImage, activeImage, performer, refetch }) => {
      const [currentImage, setCurrentImage] = React.useState(activeImage);

      React.useEffect(() => {
        setCurrentImage(activeImage);
      }, [activeImage]);

      // Build lightbox images with current image as the displayed one
      const currentLightboxImages = React.useMemo(
        () => [{ paths: { thumbnail: currentImage, image: currentImage } }],
        [currentImage]
      );

      return (
        <HeaderImage encodingImage={encodingImage}>
          <div className="d-flex flex-column align-items-center">
            {!!currentImage && (
              <PerformerImageManager
                performer={performer}
                onImageChange={setCurrentImage}
                refetch={refetch}
              >
                <LightboxLink images={currentLightboxImages}>
                  <DetailImage
                    className="performer"
                    src={currentImage}
                    alt={performer.name}
                  />
                </LightboxLink>
              </PerformerImageManager>
            )}
            <PerformerCategoryStrip performer={performer} />
          </div>
        </HeaderImage>
      );
    }
  );
// CUSTOM: end

const PerformerPage: React.FC<IProps> = PatchComponent(
  "PerformerPage",
  ({ performer, tabKey, refetch }) => {
    // CUSTOM: added refetch
    const Toast = useToast();
    const history = useHistory();
    const intl = useIntl();

    // Configuration settings
    const { configuration } = useConfigurationContext();
    const uiConfig = configuration?.ui;
    const abbreviateCounter = uiConfig?.abbreviateCounters ?? false;
    const enableBackgroundImage =
      uiConfig?.enablePerformerBackgroundImage ?? false;
    const showAllDetails = uiConfig?.showAllDetails ?? true;
    const compactExpandedDetails = uiConfig?.compactExpandedDetails ?? false;

    const [collapsed, setCollapsed] = useState<boolean>(!showAllDetails);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isMerging, setIsMerging] = useState<boolean>(false);
    const [image, setImage] = useState<string | null>();
    const [encodingImage, setEncodingImage] = useState<boolean>(false);
    const loadStickyHeader = useLoadStickyHeader();
    const openVatoOStats = () => {
      window.open(
        `/ostats/vato/${performer.id}`,
        "_blank",
        "noopener,noreferrer"
      );
    }; // CUSTOM

    const activeImage = useMemo(() => {
      const performerImage = performer.image_path;
      if (isEditing) {
        if (image === null && performerImage) {
          const performerImageURL = new URL(performerImage);
          performerImageURL.searchParams.set("default", "true");
          return performerImageURL.toString();
        } else if (image) {
          return image;
        }
      }
      return performerImage;
    }, [image, isEditing, performer.image_path]);

    const lightboxImages = useMemo(
      () => [{ paths: { thumbnail: activeImage, image: activeImage } }],
      [activeImage]
    );

    const [updatePerformer] = usePerformerUpdate();
    const [deletePerformer, { loading: isDestroying }] = usePerformerDestroy();

    async function onAutoTag() {
      try {
        await mutateMetadataAutoTag({ performers: [performer.id] });
        Toast.success(intl.formatMessage({ id: "toast.started_auto_tagging" }));
      } catch (e) {
        Toast.error(e);
      }
    }

    function renderMergeButton() {
      return (
        <Button variant="secondary" onClick={() => setIsMerging(true)}>
          <FormattedMessage id="actions.merge" />
          ...
        </Button>
      );
    }

    function renderMergeDialog() {
      if (!performer.id) return;
      return (
        <PerformerMergeModal
          show={isMerging}
          onClose={(mergedId) => {
            setIsMerging(false);
            if (mergedId !== undefined && mergedId !== performer.id) {
              // By default, the merge destination is the current performer, but
              // the user can change it, in which case we need to redirect.
              history.replace(`/performers/${mergedId}`);
            }
          }}
          performers={[performer]}
        />
      );
    }

    // set up hotkeys
    useEffect(() => {
      Mousetrap.bind("e", () => toggleEditing());
      Mousetrap.bind("f", () => setFavorite(!performer.favorite));
      Mousetrap.bind(",", () => setCollapsed(!collapsed));

      return () => {
        Mousetrap.unbind("e");
        Mousetrap.unbind("f");
        Mousetrap.unbind(",");
      };
    });

    async function onSave(input: GQL.PerformerCreateInput) {
      await updatePerformer({
        variables: {
          input: {
            id: performer.id,
            ...input,
          },
        },
      });
      toggleEditing(false);
      Toast.success(
        intl.formatMessage(
          { id: "toast.updated_entity" },
          {
            entity: intl.formatMessage({ id: "performer" }).toLocaleLowerCase(),
          }
        )
      );
    }

    async function onDelete() {
      try {
        await deletePerformer({ variables: { id: performer.id } });
      } catch (e) {
        Toast.error(e);
        return;
      }

      goBackOrReplace(history, "/performers");
    }

    function toggleEditing(value?: boolean) {
      if (value !== undefined) {
        setIsEditing(value);
      } else {
        setIsEditing((e) => !e);
      }
      setImage(undefined);
    }

    function setFavorite(v: boolean) {
      if (performer.id) {
        updatePerformer({
          variables: {
            input: {
              id: performer.id,
              favorite: v,
            },
          },
        });
      }
    }

    if (isDestroying)
      return (
        <LoadingIndicator
          message={`Deleting performer ${performer.id}: ${performer.name}`}
        />
      );

    const headerClassName = cx("detail-header", {
      edit: isEditing,
      collapsed,
      "full-width": !collapsed && !compactExpandedDetails,
    });

    return (
      <div id="performer-page" className="row">
        <Helmet>
          <title>{performer.name}</title>
        </Helmet>

        <div className={headerClassName}>
          <BackgroundImage
            imagePath={activeImage ?? undefined}
            show={enableBackgroundImage && !isEditing}
          />
          <div className="detail-container">
            <PerformerHeaderImage
              activeImage={activeImage}
              collapsed={collapsed}
              encodingImage={encodingImage}
              lightboxImages={lightboxImages}
              performer={performer}
              refetch={refetch} // CUSTOM
            />
            <div className="row">
              <div className="performer-head col">
                <DetailTitle
                  name={performer.name}
                  disambiguation={performer.disambiguation ?? undefined}
                  classNamePrefix="performer"
                >
                  {!isEditing && (
                    <ExpandCollapseButton
                      collapsed={collapsed}
                      setCollapsed={(v) => setCollapsed(v)}
                    />
                  )}
                  <span className="name-icons">
                    <FavoriteIcon
                      favorite={performer.favorite}
                      onToggleFavorite={(v) => setFavorite(v)}
                    />
                    <ExternalLinkButtons urls={performer.urls ?? undefined} />
                  </span>
                </DetailTitle>
                <AliasList aliases={performer.alias_list} />
                <div className="quality-group">
                  <RatingAdvisorButton
                    entityType="performer"
                    entityId={performer.id}
                    rating100={performer.rating100}
                    ratingScores={performer.rating_scores}
                    onRatingSaved={refetch}
                  />{" "}
                  {/* CUSTOM */}
                  <PerformerSceneAverageRating performerId={performer.id} />
                  {!!performer.o_counter && (
                    // CUSTOM: begin
                    <OCounterButton
                      value={performer.o_counter}
                      onIncrement={openVatoOStats}
                      onValueClicked={openVatoOStats}
                    />
                    // CUSTOM: end
                  )}
                </div>
                {!isEditing && (
                  <PerformerDetailsPanel
                    performer={performer}
                    collapsed={collapsed}
                    fullWidth={!collapsed && !compactExpandedDetails}
                  />
                )}
                {isEditing ? (
                  <PerformerEditPanel
                    performer={performer}
                    isVisible={isEditing}
                    onSubmit={onSave}
                    onCancel={() => toggleEditing()}
                    setImage={setImage}
                    setEncodingImage={setEncodingImage}
                  />
                ) : (
                  <Col>
                    <Row xs={8}>
                      <DetailsEditNavbar
                        objectName={
                          performer?.name ??
                          intl.formatMessage({ id: "performer" })
                        }
                        onToggleEdit={() => toggleEditing()}
                        onDelete={onDelete}
                        onAutoTag={onAutoTag}
                        autoTagDisabled={performer.ignore_auto_tag}
                        isNew={false}
                        isEditing={false}
                        onSave={() => {}}
                        onImageChange={() => {}}
                        classNames="mb-2"
                        customButtons={
                          <>
                            {renderMergeButton()}
                            <div>
                              <PerformerSubmitButton performer={performer} />
                            </div>
                          </>
                        }
                      ></DetailsEditNavbar>
                    </Row>
                  </Col>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isEditing && loadStickyHeader && (
          <CompressedPerformerDetailsPanel performer={performer} />
        )}

        <div className="detail-body">
          <div className="performer-body">
            <div className="performer-tabs">
              {!isEditing && (
                <PerformerTabs
                  tabKey={tabKey}
                  performer={performer}
                  abbreviateCounter={abbreviateCounter}
                />
              )}
            </div>
          </div>
        </div>
        {renderMergeDialog()}
      </div>
    );
  }
);

const PerformerLoader: React.FC<RouteComponentProps<IPerformerParams>> = ({
  location,
  match,
}) => {
  const { id, tab } = match.params;
  const { data, loading, error, refetch } = useFindPerformer(id); // CUSTOM: added refetch

  useScrollToTopOnMount();

  // CUSTOM: begin - wrap refetch to force network-only fetch
  // Wrap refetch to force network-only fetch (bypass Apollo cache)
  const forceRefetch = React.useCallback(async () => {
    return refetch({
      fetchPolicy: "network-only",
    } as unknown as Parameters<typeof refetch>[0]);
  }, [refetch]);
  // CUSTOM: end

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage error={error.message} />;
  if (!data?.findPerformer)
    return <ErrorMessage error={`No performer found with id ${id}.`} />;

  if (tab && !isTabKey(tab)) {
    return (
      <Redirect
        to={{
          ...location,
          pathname: `/performers/${id}`,
        }}
      />
    );
  }

  return (
    <PerformerPage
      performer={data.findPerformer}
      tabKey={tab as TabKey | undefined}
      refetch={forceRefetch} // CUSTOM
    />
  );
};

export default PerformerLoader;
