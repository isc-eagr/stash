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
import {
  faTag,
  faBox,
  faHand,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons"; // CUSTOM: added faHand, faUserPlus
import { OCounterButton } from "../Shared/CountButton";
import cx from "classnames"; // CUSTOM
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import { makeStudioOStatsUrl } from "src/utils/oStatsNavigation_custom"; // CUSTOM
import {
  getRatingCardClass,
  isRatingCardHomePage,
} from "src/utils/ratingCardStyles_custom"; // CUSTOM
// CUSTOM: begin
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import facialPng from "src/assets/facial.png"; // CUSTOM
import { StudioActivityMetricsStrip } from "./StudioActivityMetricsStrip"; // CUSTOM
import { StudioRatingAdvisorPopover } from "./StudioRatingAdvisorPopover_custom"; // CUSTOM
import { StudioSortMetricStrip } from "./StudioSortMetricStrip_custom"; // CUSTOM

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

function maybeRenderChildren(studio: GQL.StudioListDataFragment) {
  // CUSTOM
  if (studio.child_studios.length > 0) {
    return (
      <div className="studio-child-studios">
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
    const sexTag = roleTags?.sexTag ?? null;
    const oralTag = roleTags?.oralTag ?? null;
    const soloTag = roleTags?.soloTag ?? null;
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
      if (!count) return;

      const url = performerId
        ? NavUtils.makePerformerStudioScenesUrl(performerId, navigationStudio)
        : NavUtils.makeStudioScenesUrl(navigationStudio);

      const button = (
        <PopoverCountButton
          className="scene-count"
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
          sections={["solo_scenes", "sex_scenes", "group_scenes"]}
        >
          {button}
        </StudioRatingAdvisorPopover>
      );
    }

    // Sex scenes (marker-based) - gay icon
    function maybeRenderSexScenesButton() {
      if (!sexTag) return null;
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.role_stats?.sex_scene_count ?? 0
        : stats?.studio_role_counts.sex_scene_count ?? 0; // CUSTOM
      const url = performerId
        ? NavUtils.makePerformerStudioMarkerScenesUrl(
            performerId,
            navigationStudio,
            sexTag.id,
            "Sex"
          )
        : NavUtils.makeStudioMarkerScenesUrl(
            navigationStudio,
            sexTag.id,
            "Sex"
          );

      return (
        <Button
          className="minimal scene-category-count sex-scene-count"
          href={url}
          title={`Sex scenes (${sexTag.name})`}
          disabled={count === 0}
        >
          <img src={gaySvg} alt="Sex" className="category-icon" />
          <span>{count}</span>
        </Button>
      );
    }

    // Oral scenes (marker-based) - mouth icon
    function maybeRenderOralScenesButton() {
      if (!oralTag) return null;
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.role_stats?.oral_scene_count ?? 0
        : stats?.studio_role_counts.oral_scene_count ?? 0; // CUSTOM

      // Oral excludes sex markers
      const excludeTags = sexTag ? [{ id: sexTag.id, label: sexTag.name }] : [];

      // Use depth -1 to include subtags
      const url = performerId
        ? NavUtils.makePerformerStudioMarkerScenesUrl(
            performerId,
            navigationStudio,
            oralTag.id,
            "Oral",
            excludeTags,
            -1
          )
        : NavUtils.makeStudioMarkerScenesUrl(
            navigationStudio,
            oralTag.id,
            "Oral",
            excludeTags,
            -1
          );

      return (
        <Button
          className="minimal scene-category-count oral-scene-count"
          href={url}
          title={`Oral scenes (${oralTag.name})`}
          disabled={count === 0}
        >
          <img src={mouthSvg} alt="Oral" className="category-icon" />
          <span>{count}</span>
        </Button>
      );
    }

    // Solo scenes (marker-based) - hand icon
    function maybeRenderSoloScenesButton() {
      if (!soloTag) return null;
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.role_stats?.solo_scene_count ?? 0
        : stats?.studio_role_counts.solo_scene_count ?? 0; // CUSTOM

      // Solo excludes both sex and oral markers
      const excludeTags = [];
      if (sexTag) excludeTags.push({ id: sexTag.id, label: sexTag.name });
      if (oralTag) excludeTags.push({ id: oralTag.id, label: oralTag.name });

      const url = performerId
        ? NavUtils.makePerformerStudioMarkerScenesUrl(
            performerId,
            navigationStudio,
            soloTag.id,
            "Solo",
            excludeTags
          )
        : NavUtils.makeStudioMarkerScenesUrl(
            navigationStudio,
            soloTag.id,
            "Solo",
            excludeTags
          );

      return (
        <Button
          className="minimal scene-category-count solo-scene-count"
          href={url}
          title={`Solo scenes (${soloTag.name})`}
          disabled={count === 0}
        >
          <Icon icon={faHand} className="category-icon-fa" />
          <span>{count}</span>
        </Button>
      );
    }

    // Facial scenes (marker-based) - facial icon
    function maybeRenderFacialScenesButton() {
      if (!facialTag) return null;
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.role_stats?.facial_scene_count ?? 0
        : stats?.studio_role_counts.facial_scene_count ?? 0; // CUSTOM
      // Use depth -1 to include subtags
      const url = performerId
        ? NavUtils.makePerformerStudioMarkerScenesUrl(
            performerId,
            navigationStudio,
            facialTag.id,
            "Facial",
            undefined,
            -1
          )
        : NavUtils.makeStudioMarkerScenesUrl(
            navigationStudio,
            facialTag.id,
            "Facial",
            undefined,
            -1
          );

      return (
        <Button
          className="minimal scene-category-count facial-scene-count"
          href={url}
          title={`Facial scenes (${facialTag.name})`}
          disabled={count === 0}
        >
          <img src={facialPng} alt="Facial" className="category-icon" />
          <span>{count}</span>
        </Button>
      );
    }

    // Unique performers (performers with only 1 scene in database, for this studio)
    function maybeRenderUniquePerformersButton() {
      // Hide this button when viewing from a performer's studios tab
      if (performerId) return null;

      const count = stats?.unique_performer_count ?? 0; // CUSTOM
      if (count === 0) return null;

      const url = NavUtils.makeStudioUniquePerformersUrl(navigationStudio);

      return (
        <Button
          className="minimal scene-category-count unique-performer-count"
          href={url}
          title={`Unique vatos (only 1 scene)`}
          disabled={count === 0}
        >
          <Icon icon={faUserPlus} className="category-icon-fa" />
          <span>{count}</span>
        </Button>
      );
    }

    function maybeRenderImagesPopoverButton() {
      if (!performerScopedCountsReady) return null;

      const count = performerId
        ? performerStats?.image_count ?? 0
        : stats?.image_count ?? 0; // CUSTOM
      if (!count) return;

      const url = performerId
        ? NavUtils.makePerformerStudioImagesUrl(performerId, navigationStudio)
        : NavUtils.makeStudioImagesUrl(navigationStudio);

      return (
        <PopoverCountButton
          className="image-count"
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
      if (!count) return;

      const url = performerId
        ? NavUtils.makePerformerStudioGalleriesUrl(
            performerId,
            navigationStudio
          )
        : NavUtils.makeStudioGalleriesUrl(navigationStudio);

      return (
        <PopoverCountButton
          className="gallery-count"
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
      if (studio.tags.length <= 0) return;

      const popoverContent = studio.tags.map((tag) => (
        <TagLink key={tag.id} linkType="studio" tag={tag} />
      ));

      return (
        <HoverPopover placement="bottom" content={popoverContent}>
          <Button className="minimal tag-count">
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
      if (!count) return;

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

    // CUSTOM: begin - studio activity duration metrics
    function getActivityStats() {
      return performerId
        ? performerStats?.activity_stats
        : stats?.studio_activity_stats;
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
      const activityStats = getActivityStats();
      if (!activityStats || activityStats.total_seconds <= 0) return image;

      return (
        <HoverPopover
          className="studio-card-image-activity-hover"
          content={
            <PopoverCard className="studio-activity-popover-card">
              <StudioActivityMetricsStrip
                stats={activityStats}
                idPrefix={`studio-activity-${studio.id}`}
                showHeadings
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

      const hasCategoryButtons = !!(sexTag || oralTag || soloTag || facialTag);
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

      if (
        hasCounts || // CUSTOM
        studio.tags.length > 0 ||
        hasCategoryButtons ||
        studio.organized
      ) {
        return (
          <>
            {hasCategoryButtons && (
              <>
                <hr />
                <div className="card-popovers scene-category-buttons d-flex align-items-center">
                  <ButtonGroup>
                    {maybeRenderSexScenesButton()}
                    {maybeRenderOralScenesButton()}
                    {maybeRenderSoloScenesButton()}
                    {maybeRenderFacialScenesButton()}
                    {maybeRenderUniquePerformersButton()}
                  </ButtonGroup>
                </div>
              </>
            )}
            <hr />
            <ButtonGroup className="card-popovers">
              {maybeRenderScenesPopoverButton()}
              {maybeRenderGroupsPopoverButton()}
              {maybeRenderImagesPopoverButton()}
              {maybeRenderGalleriesPopoverButton()}
              {maybeRenderPerformersPopoverButton()}
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
              sortBy={activeSortBy}
              sortDirection={activeSortDirection}
              stats={stats}
              studio={studio}
            />
            {maybeRenderParent(studio, hideParent)}
            {maybeRenderChildren(studio)}
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
            <RatingBanner rating={studio.rating100} compact />
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
