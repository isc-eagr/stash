import React from "react";
import cx from "classnames"; // CUSTOM
import { Link } from "react-router-dom";
import { useIntl } from "react-intl";
import { gql, useQuery } from "@apollo/client"; // CUSTOM
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { GridCard } from "../Shared/GridCard/GridCard";
import { CountryFlag } from "../Shared/CountryFlag";
import { HoverPopover } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import { TagLink } from "../Shared/TagLink";
import { Button, ButtonGroup } from "react-bootstrap";
import {
  ModifierCriterion,
  CriterionValue,
} from "src/models/list-filter/criteria/criterion";
import { PopoverCountButton } from "../Shared/PopoverCountButton";
import GenderIcon from "./GenderIcon";
import { faLink, faTag } from "@fortawesome/free-solid-svg-icons"; // CUSTOM
import { faInstagram, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { RatingBanner } from "../Shared/RatingBanner";
import { RatingCriteriaTooltip } from "../Shared/RatingAdvisor_custom"; // CUSTOM
import { usePerformerUpdate } from "src/core/StashService";
import { ILabeledId } from "src/models/list-filter/types";
import { FavoriteIcon } from "../Shared/FavoriteIcon";
import { PatchComponent } from "src/patch";
import { ExternalLinksButton } from "../Shared/ExternalLinksButton";
import { useConfigurationContext } from "src/hooks/Config";
import { OCounterButton } from "../Shared/CountButton";
import {
  getRatingCardClass,
  isRatingCardHomePage,
} from "src/utils/ratingCardStyles_custom"; // CUSTOM
// CUSTOM: begin
import { PerformerCategoryStrip } from "./PerformerDetails/PerformerCategoryStrip";
import type { PerformerListData } from "./performerTypes_custom";
import { SortMetricBadgeCustom } from "../Shared/SortMetricBadge_custom";
import { getPerformerSortMetricCustom } from "./performerSortMetric_custom";
import {
  catalogCardSortHighlightClassCustom,
  hasCatalogCardSortValueCustom,
  isCatalogCardSortHighlightedCustom,
} from "../Shared/catalogCardSortHighlight_custom";
import { shouldOpenScenePerformerOverview } from "src/utils/scenePerformerOverview_custom"; // CUSTOM
// CUSTOM: end

export interface IPerformerCardExtraCriteria {
  scenes?: ModifierCriterion<CriterionValue>[];
  images?: ModifierCriterion<CriterionValue>[];
  galleries?: ModifierCriterion<CriterionValue>[];
  groups?: ModifierCriterion<CriterionValue>[];
  performer?: ILabeledId;
  studio?: ILabeledId & { depth?: number };
}

export interface IPerformerRoleStats {
  sex_scene_count: number;
  sex_top_count: number;
  sex_bottom_count: number;
  sex_with_top_count: number;
  sex_with_bottom_count: number;
  sex_unique_partner_count: number;
  oral_scene_count: number;
  oral_top_count: number;
  oral_bottom_count: number;
  oral_with_top_count: number;
  oral_with_bottom_count: number;
  oral_unique_partner_count: number;
  solo_scene_count: number;
  facial_scene_count: number;
  facial_top_count: number;
  facial_bottom_count: number;
  facial_with_top_count: number;
  facial_with_bottom_count: number;
  facial_marker_with_top_count: number;
  facial_marker_with_bottom_count: number;
  facial_unique_partner_count: number;
  orgasm_top_count: number;
  facial_marker_count: number; // CUSTOM
  feet_top_count: number; // CUSTOM
}

interface IPerformerStudioStats extends IPerformerRoleStats {
  scene_count: number;
  group_count: number;
  image_count: number;
  gallery_count: number;
  o_counter?: number | null;
}

interface IPerformerCardProps {
  performer: PerformerListData;
  cardWidth?: number;
  ageFromDate?: string;
  selecting?: boolean;
  selected?: boolean;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  extraCriteria?: IPerformerCardExtraCriteria;
  // CUSTOM: begin
  /** Scene ID for scene context - enables role badges based on marker roles */
  sceneId?: string;
  /** Number of performers in the scene - used to determine whether to show partner counts */
  scenePerformerCount?: number;
  /** All performers in the scene, used to show mini images in partner tooltips */
  scenePartnerPerformers?: Pick<GQL.Performer, "id" | "name" | "image_path">[];
  /** Studio-filtered stats used when the card is rendered from a studio performer view */
  studioStats?: IPerformerStudioStats | null;
  /** Lazily loaded global role stats used to avoid heavy role-count work in the initial list query */
  roleStats?: IPerformerRoleStats | null;
  /** Active list sort key, used to show sort-specific custom stats */
  activeSortBy?: string;
  activeSortDirection?: GQL.SortDirectionEnum;
  activeSortValue?: string | null;
  /** Opens scene-specific performer UI instead of navigating the primary links. */
  onOpenSceneOverview?: (performerId: string) => void;
  // CUSTOM: end
}

const PerformerCardPopovers: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Popovers",
  ({ performer, extraCriteria, studioStats, activeSortBy }) => {
    const sceneCount = studioStats?.scene_count ?? performer.scene_count;
    const imageCount = studioStats?.image_count ?? performer.image_count;
    const galleryCount = studioStats?.gallery_count ?? performer.gallery_count;
    const groupCount = studioStats?.group_count ?? performer.group_count;
    const oCounter = studioStats?.o_counter ?? performer.o_counter;

    function maybeRenderScenesPopoverButton() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "scenes_count"
      );
      if (!sceneCount && !highlighted) return;

      return (
        <PopoverCountButton
          className={cx(
            "scene-count",
            catalogCardSortHighlightClassCustom(activeSortBy, "scenes_count")
          )}
          type="scene"
          count={sceneCount}
          url={NavUtils.makePerformerScenesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.scenes
          )}
        />
      );
    }

    function maybeRenderImagesPopoverButton() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "images_count"
      );
      if (!imageCount && !highlighted) return;

      return (
        <PopoverCountButton
          className={cx(
            "image-count",
            catalogCardSortHighlightClassCustom(activeSortBy, "images_count")
          )}
          type="image"
          count={imageCount}
          url={NavUtils.makePerformerImagesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.images
          )}
        />
      );
    }

    function maybeRenderGalleriesPopoverButton() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "galleries_count"
      );
      if (!galleryCount && !highlighted) return;

      return (
        <PopoverCountButton
          className={cx(
            "gallery-count",
            catalogCardSortHighlightClassCustom(activeSortBy, "galleries_count")
          )}
          type="gallery"
          count={galleryCount}
          url={NavUtils.makePerformerGalleriesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.galleries
          )}
        />
      );
    }

    function maybeRenderOCounter() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "o_counter"
      );
      if (!oCounter && !highlighted) return;

      // CUSTOM: begin
      const openVatoOStats = () => {
        window.open(
          `/ostats/vato/${performer.id}`,
          "_blank",
          "noopener,noreferrer"
        );
      };

      return (
        <OCounterButton
          className={catalogCardSortHighlightClassCustom(
            activeSortBy,
            "o_counter"
          )}
          value={oCounter ?? 0}
          onIncrement={openVatoOStats}
          onValueClicked={openVatoOStats}
        />
      );
      // CUSTOM: end
    }

    // CUSTOM: begin - modified tag popover (sorted, safe null checks)
    function maybeRenderTagPopoverButton() {
      // Use global performer tags for the hover popover
      const displayTags = performer.tags ?? [];

      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "tag_count"
      );
      if ((!displayTags || displayTags.length <= 0) && !highlighted) {
        // no tag-count rendered when there are no tags (original behavior)
        return null;
      }

      const sortedDisplayTags = [...displayTags].sort((a, b) =>
        (a?.name ?? "").localeCompare(b?.name ?? "", undefined, {
          sensitivity: "base",
        })
      );

      const popoverContent: JSX.Element[] = sortedDisplayTags.map((tag) => (
        <TagLink
          key={tag.id}
          linkType="performer"
          tag={{ id: tag.id, name: tag.name ?? undefined }}
        />
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
            <span>{displayTags.length}</span>
          </Button>
        </HoverPopover>
      );
    }
    // CUSTOM: end

    // Removed Performers page green tag navigation button per request. // CUSTOM

    function maybeRenderGroupsPopoverButton() {
      if (!groupCount) return;

      return (
        <PopoverCountButton
          className="group-count"
          type="group"
          count={groupCount}
          url={NavUtils.makePerformerGroupsUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.groups
          )}
        />
      );
    }

    const hasAnyPopover = !!(
      sceneCount ||
      imageCount ||
      galleryCount ||
      performer.tags.length > 0 ||
      oCounter ||
      groupCount ||
      isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "tag_count",
        "scenes_count",
        "images_count",
        "galleries_count",
        "o_counter"
      )
    );

    if (hasAnyPopover) {
      return (
        <>
          <hr />
          <ButtonGroup className="card-popovers">
            {maybeRenderTagPopoverButton()} {/* CUSTOM: moved before scenes */}
            {maybeRenderScenesPopoverButton()}
            {maybeRenderGroupsPopoverButton()}
            {maybeRenderImagesPopoverButton()}
            {maybeRenderGalleriesPopoverButton()}
            {maybeRenderOCounter()}
          </ButtonGroup>
        </>
      );
    }

    return null;
  }
);

const PerformerCardOverlays: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Overlays",
  ({ performer, activeSortBy }) => {
    const { configuration } = useConfigurationContext();
    const uiConfig = configuration?.ui;
    const [updatePerformer] = usePerformerUpdate();

    function onToggleFavorite(v: boolean) {
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

    function maybeRenderRatingBanner() {
      if (performer.rating100 === undefined || performer.rating100 === null) {
        return;
      }
      return (
        <RatingCriteriaTooltip
          entityType="performer"
          entityId={performer.id}
          triggerClassName="rating-criteria-tooltip-card-trigger"
        >
          <RatingBanner
            rating={performer.rating100}
            compact
            className={catalogCardSortHighlightClassCustom(
              activeSortBy,
              "rating"
            )}
          />
        </RatingCriteriaTooltip>
      ); // CUSTOM
    }

    function maybeRenderFlag() {
      if (performer.country) {
        return (
          <Link to={NavUtils.makePerformersCountryUrl(performer)}>
            <CountryFlag
              className="performer-card__country-flag"
              country={performer.country}
              includeOverlay
            />
            <span className="performer-card__country-string">
              {performer.country}
            </span>
          </Link>
        );
      }
    }

    function maybeRenderLinks() {
      if (!uiConfig?.showLinksOnPerformerCard) {
        return;
      }

      if (performer.urls && performer.urls.length > 0) {
        const twitter = performer.urls.filter((u) =>
          u.match(/https?:\/\/(?:www\.)?(?:twitter|x).com\//)
        );
        const instagram = performer.urls.filter((u) =>
          u.match(/https?:\/\/(?:www\.)?instagram.com\//)
        );
        const others = performer.urls.filter(
          (u) => !twitter.includes(u) && !instagram.includes(u)
        );

        return (
          <div
            className="performer-card__links"
            style={{
              position: "absolute",
              left: "0",
              bottom: "0",
              display: "flex",
              gap: "0.5rem",
              flexDirection: "column-reverse",
            }}
          >
            {twitter.length > 0 && (
              <ExternalLinksButton
                className="performer-card__link twitter"
                urls={twitter}
                icon={faTwitter}
                openIfSingle={true}
              ></ExternalLinksButton>
            )}
            {instagram.length > 0 && (
              <ExternalLinksButton
                className="performer-card__link instagram"
                urls={instagram}
                icon={faInstagram}
                openIfSingle={true}
              ></ExternalLinksButton>
            )}
            {others.length > 0 && (
              <ExternalLinksButton
                className="performer-card__link"
                icon={faLink}
                urls={others}
                openIfSingle={true}
              />
            )}
          </div>
        );
      }
    }

    return (
      <>
        <FavoriteIcon
          favorite={performer.favorite}
          onToggleFavorite={onToggleFavorite}
          size="2x"
          className="hide-not-favorite"
        />
        {maybeRenderRatingBanner()}
        {maybeRenderLinks()}
        {maybeRenderFlag()}
      </>
    );
  }
);

const PerformerCardDetails: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Details",
  // CUSTOM: begin - added sceneId, scenePerformerCount, scenePartnerPerformers props; scene marker roles query
  ({
    performer,
    ageFromDate,
    sceneId,
    scenePerformerCount,
    scenePartnerPerformers,
    studioStats,
    roleStats,
    extraCriteria,
    activeSortBy,
    activeSortDirection,
    activeSortValue,
  }) => {
    const intl = useIntl();
    const { configuration } = useConfigurationContext(); // CUSTOM

    const age = TextUtils.age(
      performer.birthdate,
      ageFromDate ?? performer.death_date
    );
    const ageL10nId = ageFromDate
      ? "media_info.performer_card.age_context"
      : "media_info.performer_card.age";
    const ageL10String = intl.formatMessage({
      id: "years_old",
      defaultMessage: "years old",
    });
    const ageString = intl.formatMessage(
      { id: ageL10nId },
      { age, years_old: ageL10String }
    );

    // CUSTOM: begin - scene marker roles query
    // Query for scene marker roles when in scene context
    const SCENE_MARKER_ROLES_QUERY = gql`
      query PerformerSceneMarkerRoles($performer_id: ID!, $scene_id: ID!) {
        findPerformer(id: $performer_id) {
          id
          scene_marker_roles(scene_id: $scene_id)
        }
      }
    `;

    const { data: rolesData } = useQuery(SCENE_MARKER_ROLES_QUERY, {
      variables: { performer_id: performer.id, scene_id: sceneId },
      skip: !sceneId,
      fetchPolicy: "cache-and-network",
    });

    const markerRoles = rolesData?.findPerformer?.scene_marker_roles ?? [];
    // CUSTOM: end
    const sortDirection = activeSortDirection ?? GQL.SortDirectionEnum.Asc; // CUSTOM
    const performerSortData = {
      ...performer,
      scene_count: studioStats?.scene_count ?? performer.scene_count,
      image_count: studioStats?.image_count ?? performer.image_count,
      gallery_count: studioStats?.gallery_count ?? performer.gallery_count,
      group_count: studioStats?.group_count ?? performer.group_count,
      o_counter: studioStats?.o_counter ?? performer.o_counter,
    }; // CUSTOM
    const sortMetric = getPerformerSortMetricCustom(
      activeSortBy,
      performerSortData,
      studioStats ?? roleStats,
      activeSortValue
    ); // CUSTOM
    const roleTagIds = configuration?.ui?.roleTagIds ?? {};
    const embeddedRoleSortMetric =
      !sceneId &&
      ((!!roleTagIds.sexTagId &&
        isCatalogCardSortHighlightedCustom(
          activeSortBy,
          "sex_scenes_count",
          "sex_unique_partners",
          "sex_topped_partners",
          "sex_bottomed_partners"
        )) ||
        (!!roleTagIds.oralTagId &&
          isCatalogCardSortHighlightedCustom(
            activeSortBy,
            "oral_scenes_count",
            "oral_unique_partners",
            "oral_topped_partners",
            "oral_bottomed_partners"
          )) ||
        (!!roleTagIds.soloTagId &&
          isCatalogCardSortHighlightedCustom(
            activeSortBy,
            "solo_scenes_count"
          )) ||
        (!!roleTagIds.facialTagId &&
          isCatalogCardSortHighlightedCustom(
            activeSortBy,
            "facial_unique_partners",
            "facial_topped_partners",
            "facial_bottomed_partners"
          )) ||
        (!!roleTagIds.orgasmTagId &&
          isCatalogCardSortHighlightedCustom(activeSortBy, "orgasm_count")) ||
        (!!roleTagIds.feetTagId &&
          isCatalogCardSortHighlightedCustom(
            activeSortBy,
            "feet_markers_count"
          ))); // CUSTOM
    const embeddedSortMetric =
      isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "tag_count",
        "scenes_count",
        "images_count",
        "galleries_count",
        "o_counter"
      ) ||
      embeddedRoleSortMetric ||
      (isCatalogCardSortHighlightedCustom(activeSortBy, "rating") &&
        hasCatalogCardSortValueCustom(performer.rating100)); // CUSTOM

    return (
      <>
        {/* CUSTOM: begin - modified age display + PerformerCategoryStrip */}
        <SortMetricBadgeCustom
          metric={embeddedSortMetric ? undefined : sortMetric}
          sortDirection={sortDirection}
        />
        {/* Age line */}
        {(age !== 0 || !sceneId) && (
          <div className="performer-card__age">
            {age !== 0 ? ageString : "\u00A0"}
          </div>
        )}

        {/* Role badges using shared component */}
        <PerformerCategoryStrip
          performer={performer}
          sceneId={sceneId}
          markerRoles={markerRoles}
          scenePerformerCount={scenePerformerCount}
          scenePartnerPerformers={scenePartnerPerformers} // CUSTOM
          globalStatsOverride={studioStats ?? roleStats}
          hideUniquePartnerCounts={false}
          studioContext={
            extraCriteria?.studio
              ? {
                  id: extraCriteria.studio.id,
                  label: extraCriteria.studio.label,
                  depth: extraCriteria.studio.depth ?? 0,
                }
              : undefined
          } // CUSTOM
          activeSortBy={activeSortBy}
        />
        {/* CUSTOM: end */}
      </>
    );
  }
);
// CUSTOM: end

const PerformerCardImage: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Image",
  ({ performer }) => {
    return (
      <>
        <img
          loading="lazy"
          decoding="async" // CUSTOM
          className="performer-card-image"
          alt={performer.name ?? ""}
          src={performer.image_path ?? ""}
        />
      </>
    );
  }
);

const PerformerCardTitle: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Title",
  ({ performer }) => {
    return (
      <div>
        <span className="performer-name">{performer.name}</span>
        {performer.disambiguation && (
          <span className="performer-disambiguation">
            {` (${performer.disambiguation})`}
          </span>
        )}
        {/* CUSTOM: Age and scene-tag strip moved to details to align with the gender icon */}
      </div>
    );
  }
);

export const PerformerCard: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard",
  (props) => {
    const {
      performer,
      cardWidth,
      selecting,
      selected,
      onSelectedChanged,
      zoomIndex,
      extraCriteria,
      onOpenSceneOverview, // CUSTOM
    } = props;
    const { configuration } = useConfigurationContext(); // CUSTOM

    const studioId = extraCriteria?.studio?.id;
    const studioDepth = extraCriteria?.studio?.depth ?? 0;
    const { data: studioStatsData } = GQL.useFindStudioPerformerStatsQuery({
      variables: {
        id: studioId ?? "",
        performerId: performer.id,
        depth: studioDepth,
      },
      skip: !studioId,
    });

    const studioStats = studioStatsData?.findStudio
      ? {
          scene_count: studioStatsData.findStudio.scene_count,
          // CUSTOM: begin - all role counts now from studio_performer_role_stats batch field
          ...studioStatsData.findStudio.studio_performer_role_stats,
          // CUSTOM: end
          group_count: studioStatsData.findStudio.group_count,
          image_count: studioStatsData.findStudio.image_count,
          gallery_count: studioStatsData.findStudio.gallery_count,
          o_counter: studioStatsData.findStudio.o_counter,
        }
      : null;

    // CUSTOM: begin - rating class for metallic card styling
    // Determine rating class for special styling
    // Only apply on non-home pages (exclude /scenes, /images, /galleries, etc. when viewed from home)
    const getRatingClass = () => {
      return getRatingCardClass({
        rating: performer.rating100,
        tags: performer.tags,
        goatTagId: configuration?.ui?.roleTagIds?.goatTagId,
        theme: configuration?.ui?.ratingCardTheme,
        thresholds: configuration?.ui?.ratingCardThresholds,
        overrideTagIds: configuration?.ui?.ratingCardOverrideTagIds,
        thresholdEntity: "performer",
        disabled: isRatingCardHomePage(),
      });
    };
    // CUSTOM: end

    return (
      <GridCard
        className={`performer-card zoom-${zoomIndex} ${getRatingClass()}`} // CUSTOM: added getRatingClass()
        url={`/performers/${performer.id}`}
        onPrimaryClick={
          onOpenSceneOverview
            ? (event) => {
                if (!shouldOpenScenePerformerOverview(event)) {
                  return;
                }

                event.preventDefault();
                onOpenSceneOverview(performer.id);
              }
            : undefined
        } // CUSTOM
        width={cardWidth}
        pretitleIcon={
          <GenderIcon className="gender-icon" gender={performer.gender} />
        }
        title={<PerformerCardTitle {...props} />}
        image={<PerformerCardImage {...props} />}
        overlays={<PerformerCardOverlays {...props} />}
        details={<PerformerCardDetails {...props} studioStats={studioStats} />}
        popovers={
          <PerformerCardPopovers {...props} studioStats={studioStats} />
        }
        selected={selected}
        selecting={selecting}
        onSelectedChanged={onSelectedChanged}
      />
    );
  }
);
