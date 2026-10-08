import React, { useMemo } from "react"; // CUSTOM: added useMemo
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { GridCard } from "src/components/Shared/GridCard/GridCard";
import { PatchComponent } from "src/patch";
import { HoverPopover, PopoverCard } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import { TagLink } from "../Shared/TagLink";
import { Button, ButtonGroup, OverlayTrigger, Tooltip } from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import { PopoverCountButton } from "../Shared/PopoverCountButton";
import { RatingBanner } from "../Shared/RatingBanner";
import { FavoriteIcon } from "../Shared/FavoriteIcon";
import { useStudioUpdate } from "src/core/StashService";
import { faTag, faBox } from "@fortawesome/free-solid-svg-icons";
import { OCounterButton } from "../Shared/CountButton";
import cx from "classnames"; // CUSTOM
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import { makeStudioOStatsUrl } from "src/utils/oStatsNavigation_custom"; // CUSTOM
import {
  getRatingCardClass,
  isRatingCardHomePage,
} from "src/utils/ratingCardStyles_custom"; // CUSTOM
// CUSTOM: begin
import { StudioSceneTypesBar } from "./StudioSceneTypesBar_custom";
import facialPng from "src/assets/facial.png"; // CUSTOM
import { ActivityStatsCharts } from "../Shared/ActivityStatsCharts_custom"; // CUSTOM
import { StudioRatingAdvisorPopover } from "./StudioRatingAdvisorPopover_custom"; // CUSTOM
import { StudioSortMetricStrip } from "./StudioSortMetricStrip_custom"; // CUSTOM
import {
  PERFORMER_FACIALS_TOOLTIP,
  STUDIO_FACIALS_TOOLTIP,
} from "./studioFacialsTooltip_custom"; // CUSTOM
import {
  catalogCardSortHighlightClassCustom,
  hasCatalogCardSortValueCustom,
  isCatalogCardSortHighlightedCustom,
} from "../Shared/catalogCardSortHighlight_custom"; // CUSTOM

interface IPerformerStudioStats {
  scene_count: number;
  role_stats:
    | {
        // CUSTOM: nested from studio_performer_role_stats batch field
        sex_scene_count: number;
        oral_scene_count: number;
        solo_scene_count: number;
        facial_scene_count: number;
        sex_top_count: number;
        sex_bottom_count: number;
        sex_with_top_count: number;
        sex_with_bottom_count: number;
        oral_top_count: number;
        oral_bottom_count: number;
        oral_with_top_count: number;
        oral_with_bottom_count: number;
        facial_top_count: number;
        facial_bottom_count: number;
        facial_marker_with_top_count: number;
        facial_marker_with_bottom_count: number;
        sex_unique_partner_count: number;
        oral_unique_partner_count: number;
        facial_unique_partner_count: number;
        orgasm_top_count: number;
        facial_marker_count: number;
        feet_top_count: number;
      }
    | null
    | undefined;
  activity_stats: GQL.StudioActivityStats | null | undefined;
  group_count: number;
  image_count: number;
  gallery_count: number;
  o_counter: number | null | undefined;
}

export interface IRoleTags {
  sexTag: { id: string; name: string } | null;
  oralTag: { id: string; name: string } | null;
  soloTag: { id: string; name: string } | null;
  facialTag: { id: string; name: string } | null;
}
// CUSTOM: end

interface IProps {
  activeSortBy?: string; // CUSTOM
  activeSortDirection?: GQL.SortDirectionEnum; // CUSTOM
  studio: GQL.StudioListDataFragment; // CUSTOM
  stats?: GQL.StudioListStatsDataFragment; // CUSTOM
  cardWidth?: number;
  hideParent?: boolean;
  selecting?: boolean;
  selected?: boolean;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  // CUSTOM: begin
  performerId?: string;
  roleTags?: IRoleTags;
  // CUSTOM: end
}

function maybeRenderParent(
  studio: GQL.StudioListDataFragment, // CUSTOM
  hideParent?: boolean
) {
  if (!hideParent && studio.parent_studio) {
    return (
      <div className="studio-parent-studios">
        <FormattedMessage
          id="part_of"
          values={{
            parent: (
              <Link to={`/studios/${studio.parent_studio.id}`}>
                {studio.parent_studio.name}
              </Link>
            ),
          }}
        />
      </div>
    );
  }
}

function maybeRenderChildren(
  studio: GQL.StudioListDataFragment,
  activeSortBy?: string
) {
  // CUSTOM
  if (studio.child_studios.length > 0) {
    return (
      <div
        className={cx(
          "studio-child-studios",
          catalogCardSortHighlightClassCustom(activeSortBy, "child_count")
        )}
      >
        <FormattedMessage
          id="parent_of"
          values={{
            children: (
              <Link
                to={NavUtils.makeChildStudiosUrl({
                  id: studio.id,
                  name: studio.name,
                })}
              >
                {studio.child_studios.length}&nbsp;
                <FormattedMessage
                  id="countables.studios"
                  values={{ count: studio.child_studios.length }}
                />
              </Link>
            ),
          }}
        />
      </div>
    );
  }
}

export const StudioCard: React.FC<IProps> = PatchComponent(
  "StudioCard",
  ({
    activeSortBy, // CUSTOM
    activeSortDirection = GQL.SortDirectionEnum.Asc, // CUSTOM
    studio,
    stats, // CUSTOM
    cardWidth,
    hideParent,
    selecting,
    selected,
    zoomIndex,
    onSelectedChanged,
    // CUSTOM: begin
    performerId,
    roleTags,
    // CUSTOM: end
  }) => {
    const [updateStudio] = useStudioUpdate();
    const navigationStudio: Pick<GQL.StudioDataFragment, "id" | "name"> = {
      id: studio.id,
      name: studio.name,
    }; // CUSTOM
    // CUSTOM: begin - premium/classic rating card styling
    const { configuration } = useConfigurationContext();
    const ratingCardTheme = configuration?.ui?.ratingCardTheme;
    const goatTagId = configuration?.ui?.roleTagIds?.goatTagId;
    const ratingCardClass = getRatingCardClass({
      rating: studio.rating100,
      tags: studio.tags,
      goatTagId,
      theme: ratingCardTheme,
      thresholds: configuration?.ui?.ratingCardThresholds,
      overrideTagIds: configuration?.ui?.ratingCardOverrideTagIds,
      disabled: isRatingCardHomePage(),
    });
    // CUSTOM: end

    // CUSTOM: begin - role tags + performer-filtered stats
    // Use pre-fetched role tags from parent (StudioCardGrid)
    // Falls back to null when roleTags not provided
    const facialTag = roleTags?.facialTag ?? null;

    // When viewing from a performer's studios, fetch performer-filtered stats
    const { data: performerStatsData } = GQL.useFindStudioPerformerStatsQuery({
      variables: {
        id: studio.id,
        performerId: performerId ?? "",
      },
      skip: !performerId, // Only run this query when performerId is provided
    });

    // Memoize the performer stats to avoid recalculating on every render
    const performerStats: IPerformerStudioStats | null = useMemo(() => {
      if (!performerId || !performerStatsData?.findStudio) return null;
      const s = performerStatsData.findStudio;
      return {
        scene_count: s.scene_count,
        role_stats: s.studio_performer_role_stats ?? null, // CUSTOM: from batched resolver
        activity_stats: s.studio_performer_activity_stats ?? null,
        group_count: s.group_count,
        image_count: s.image_count,
        gallery_count: s.gallery_count,
        o_counter: s.o_counter,
      };
    }, [performerId, performerStatsData]);

    const performerScopedCountsReady = !performerId || !!performerStats;
    // CUSTOM: performer-scoped card counts differ from the studio-wide sort values.
    const unscopedMetricSortBy = performerId ? undefined : activeSortBy;
    const activityStats = performerId
      ? performerStats?.activity_stats
      : stats?.studio_activity_stats;
    const sceneTypeCounts = performerId
      ? performerStats?.role_stats
      : stats?.studio_role_counts;
    const embeddedSceneTypeSortMetric =
      !!sceneTypeCounts &&
      sceneTypeCounts.sex_scene_count +
        sceneTypeCounts.oral_scene_count +
        sceneTypeCounts.solo_scene_count >
        0 &&
      isCatalogCardSortHighlightedCustom(
        unscopedMetricSortBy,
        "sex_scenes_count",
        "oral_scenes_count",
        "solo_scenes_count"
      );
    const embeddedSortMetric =
      activeSortBy === "unique_performers_count" ||
      embeddedSceneTypeSortMetric ||
      (isCatalogCardSortHighlightedCustom(activeSortBy, "rating") &&
        hasCatalogCardSortValueCustom(studio.rating100)) ||
      (isCatalogCardSortHighlightedCustom(activeSortBy, "child_count") &&
        studio.child_studios.length > 0) ||
      isCatalogCardSortHighlightedCustom(activeSortBy, "tag_count") ||
      (performerScopedCountsReady &&
        isCatalogCardSortHighlightedCustom(
          unscopedMetricSortBy,
          "scenes_count",
          "images_count",
          "galleries_count",
          "o_count"
        )) ||
      (performerScopedCountsReady &&
        !!facialTag &&
        isCatalogCardSortHighlightedCustom(
          unscopedMetricSortBy,
          "facial_count"
        )); // CUSTOM
    // CUSTOM: end

    function onToggleFavorite(v: boolean) {
      if (studio.id) {
        updateStudio({
          variables: {
            input: {
              id: studio.id,
              favorite: v,
            },
          },
        });
      }
    }

    function maybeRenderScenesPopoverButton() {
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.scene_count ?? 0
        : stats?.scene_count ?? 0; // CUSTOM
      const highlighted = isCatalogCardSortHighlightedCustom(
        unscopedMetricSortBy,
        "scenes_count"
      );
      if (!count && !highlighted) return;

      const url = performerId
        ? NavUtils.makePerformerStudioScenesUrl(performerId, navigationStudio)
        : NavUtils.makeStudioScenesUrl(navigationStudio);

      const button = (
        <PopoverCountButton
          className={cx(
            "scene-count",
            catalogCardSortHighlightClassCustom(
              unscopedMetricSortBy,
              "scenes_count"
            )
          )} // CUSTOM
          type="scene"
          count={count}
          url={url}
          showTooltip={!!performerId}
        />
      );

      if (performerId) return button;

      return (
        <StudioRatingAdvisorPopover
          studioId={studio.id}
          sections={[
            "solo_scenes",
            "sex_scenes",
            "threesome_scenes",
            "group_scenes",
          ]}
        >
          {button}
        </StudioRatingAdvisorPopover>
      );
    }

    // Facials (marker count) - facial icon, links to the facial markers
    function maybeRenderFacialsButton() {
      if (!facialTag) return null;
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.role_stats?.facial_marker_count ?? 0
        : stats?.facial_count ?? 0; // CUSTOM
      const url = performerId
        ? NavUtils.withStudioScope(
            NavUtils.makePerformerFacialMarkersWithRoleUrl(
              { id: performerId },
              facialTag.id,
              facialTag.name
            ),
            navigationStudio.id,
            navigationStudio.name
          )
        : NavUtils.makeStudioMarkersUrl(
            navigationStudio,
            facialTag.id,
            facialTag.name
          );

      return (
        <Button
          className={cx(
            "minimal scene-category-count facial-marker-count",
            catalogCardSortHighlightClassCustom(
              unscopedMetricSortBy,
              "facial_count"
            )
          )} // CUSTOM
          href={url}
          title={
            performerId ? PERFORMER_FACIALS_TOOLTIP : STUDIO_FACIALS_TOOLTIP
          }
          disabled={count === 0}
        >
          <img src={facialPng} alt="Facial" className="category-icon" />
          <span>{count}</span>
        </Button>
      );
    }

    function maybeRenderImagesPopoverButton() {
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.image_count ?? 0
        : stats?.image_count ?? 0; // CUSTOM
      const highlighted = isCatalogCardSortHighlightedCustom(
        unscopedMetricSortBy,
        "images_count"
      );
      if (!count && !highlighted) return;

      const url = performerId
        ? NavUtils.makePerformerStudioImagesUrl(performerId, navigationStudio)
        : NavUtils.makeStudioImagesUrl(navigationStudio);

      return (
        <PopoverCountButton
          className={cx(
            "image-count",
            catalogCardSortHighlightClassCustom(
              unscopedMetricSortBy,
              "images_count"
            )
          )} // CUSTOM
          type="image"
          count={count}
          url={url}
        />
      );
    }

    function maybeRenderGalleriesPopoverButton() {
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.gallery_count ?? 0
        : stats?.gallery_count ?? 0; // CUSTOM
      const highlighted = isCatalogCardSortHighlightedCustom(
        unscopedMetricSortBy,
        "galleries_count"
      );
      if (!count && !highlighted) return;

      const url = performerId
        ? NavUtils.makePerformerStudioGalleriesUrl(
            performerId,
            navigationStudio
          )
        : NavUtils.makeStudioGalleriesUrl(navigationStudio);

      return (
        <PopoverCountButton
          className={cx(
            "gallery-count",
            catalogCardSortHighlightClassCustom(
              unscopedMetricSortBy,
              "galleries_count"
            )
          )} // CUSTOM
          type="gallery"
          count={count}
          url={url}
        />
      );
    }

    function maybeRenderGroupsPopoverButton() {
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.group_count ?? 0
        : stats?.group_count ?? 0; // CUSTOM
      if (!count) return;

      const url = performerId
        ? NavUtils.makePerformerStudioGroupsUrl(performerId, navigationStudio)
        : NavUtils.makeStudioGroupsUrl(navigationStudio);

      return (
        <PopoverCountButton
          className="group-count"
          type="group"
          count={count}
          url={url}
        />
      );
    }

    function maybeRenderPerformersPopoverButton() {
      // Hide performers button when viewing from performer's studios tab
      if (performerId) return null;
      if (!stats?.performer_count) return; // CUSTOM

      return (
        <StudioRatingAdvisorPopover
          studioId={studio.id}
          sections={["performers"]}
        >
          <PopoverCountButton
            className="performer-count"
            type="performer"
            count={stats.performer_count} // CUSTOM
            url={NavUtils.makeStudioPerformersUrl(navigationStudio)}
            showTooltip={false}
          />
        </StudioRatingAdvisorPopover>
      );
    }

    function maybeRenderTagPopoverButton() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "tag_count"
      );
      if (studio.tags.length <= 0 && !highlighted) return;

      const popoverContent = studio.tags.map((tag) => (
        <TagLink key={tag.id} linkType="studio" tag={tag} />
      ));

      return (
        <HoverPopover placement="bottom" content={popoverContent}>
          <Button
            className={cx(
              "minimal tag-count",
              catalogCardSortHighlightClassCustom(activeSortBy, "tag_count")
            )}
          >
            <Icon icon={faTag} />
            <span>{studio.tags.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOCounter() {
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.o_counter ?? 0
        : stats?.o_counter ?? 0; // CUSTOM
      const highlighted = isCatalogCardSortHighlightedCustom(
        unscopedMetricSortBy,
        "o_count"
      );
      if (!count && !highlighted) return;

      // CUSTOM: begin - open the studio O timeline from either counter control
      const openStudioOStats = () => {
        window.open(
          makeStudioOStatsUrl(studio.id),
          "_blank",
          "noopener,noreferrer"
        );
      };

      return (
        <OCounterButton
          className={catalogCardSortHighlightClassCustom(
            unscopedMetricSortBy,
            "o_count"
          )}
          value={count}
          onIncrement={openStudioOStats}
          onValueClicked={openStudioOStats}
        />
      );
      // CUSTOM: end
    }

    function maybeRenderOrganized() {
      if (studio.organized) {
        return (
          <OverlayTrigger
            overlay={
              <Tooltip id="organized-tooltip">
                <FormattedMessage id="organized" />
              </Tooltip>
            }
            placement="bottom"
          >
            <div className="organized">
              <Button className="minimal">
                <Icon icon={faBox} />
              </Button>
            </div>
          </OverlayTrigger>
        );
      }
    }

    // CUSTOM: begin - scene-count bar; duration quality remains on logo hover.
    function maybeRenderSceneTypesBar() {
      return (
        <StudioSceneTypesBar
          activeSortBy={unscopedMetricSortBy}
          className="studio-card-activity"
          counts={sceneTypeCounts}
          studio={navigationStudio}
          roleTags={
            roleTags ?? {
              sexTag: null,
              oralTag: null,
              soloTag: null,
              facialTag: null,
            }
          }
          performerId={performerId}
        />
      );
    }

    function renderStudioImage() {
      const image = (
        <img
          loading="lazy"
          className="studio-card-image"
          alt={studio.name}
          src={studio.image_path ?? ""}
        />
      );
      if (!activityStats || activityStats.total_seconds <= 0) return image;

      return (
        <HoverPopover
          className="studio-card-image-activity-hover"
          content={
            <PopoverCard className="studio-activity-popover-card">
              <ActivityStatsCharts
                compact
                only="quality"
                stats={activityStats}
              />
            </PopoverCard>
          }
          placement="bottom"
          popoverClassName="studio-activity-popover"
        >
          {image}
        </HoverPopover>
      );
    }
    // CUSTOM: end

    function maybeRenderPopoverButtonGroup() {
      if (!performerScopedCountsReady) {
        return null;
      }

      const hasFacials = !!facialTag; // CUSTOM
      const hasCounts = performerId
        ? !!(
            performerStats?.scene_count ||
            performerStats?.image_count ||
            performerStats?.gallery_count ||
            performerStats?.group_count ||
            performerStats?.o_counter
          )
        : !!(
            stats?.scene_count ||
            stats?.image_count ||
            stats?.gallery_count ||
            stats?.group_count ||
            stats?.performer_count ||
            stats?.o_counter
          ); // CUSTOM
      const highlightsVisibleCount =
        isCatalogCardSortHighlightedCustom(activeSortBy, "tag_count") ||
        isCatalogCardSortHighlightedCustom(
          unscopedMetricSortBy,
          "scenes_count",
          "images_count",
          "galleries_count",
          "o_count",
          "sex_scenes_count",
          "oral_scenes_count",
          "solo_scenes_count",
          "facial_count"
        ); // CUSTOM

      if (
        hasCounts || // CUSTOM
        studio.tags.length > 0 ||
        hasFacials ||
        studio.organized ||
        highlightsVisibleCount
      ) {
        return (
          <>
            <hr />
            <ButtonGroup className="card-popovers">
              {maybeRenderScenesPopoverButton()}
              {maybeRenderGroupsPopoverButton()}
              {maybeRenderImagesPopoverButton()}
              {maybeRenderGalleriesPopoverButton()}
              {maybeRenderPerformersPopoverButton()}
              {/* CUSTOM: facial count joins the main count row. */}
              {maybeRenderFacialsButton()}
              {maybeRenderTagPopoverButton()}
              {maybeRenderOCounter()}
              {maybeRenderOrganized()}
            </ButtonGroup>
          </>
        );
      }
    }

    return (
      <GridCard
        className={cx("studio-card", `zoom-${zoomIndex}`, ratingCardClass)} // CUSTOM
        url={`/studios/${studio.id}`}
        width={cardWidth}
        title={studio.name}
        linkClassName="studio-card-header"
        image={renderStudioImage()}
        details={
          <div className="studio-card__details">
            {/* CUSTOM: current Studio-list sort metric */}
            <StudioSortMetricStrip
              hidden={embeddedSortMetric}
              sortBy={activeSortBy}
              sortDirection={activeSortDirection}
              stats={stats}
              studio={studio}
            />
            {maybeRenderParent(studio, hideParent)}
            {maybeRenderChildren(studio, activeSortBy)}
            {maybeRenderSceneTypesBar()}
          </div>
        }
        overlays={
          <>
            <FavoriteIcon
              favorite={studio.favorite}
              onToggleFavorite={(v) => onToggleFavorite(v)}
              size="2x"
              className="hide-not-favorite"
            />
            <RatingBanner
              rating={studio.rating100}
              compact
              className={catalogCardSortHighlightClassCustom(
                activeSortBy,
                "rating"
              )}
            />
          </>
        }
        popovers={maybeRenderPopoverButtonGroup() ?? undefined}
        selected={selected}
        selecting={selecting}
        onSelectedChanged={onSelectedChanged}
      />
    );
  }
);
