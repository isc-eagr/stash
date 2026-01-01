import React from "react";
import { Link } from "react-router-dom";
import { useIntl } from "react-intl";
import { gql, useQuery } from "@apollo/client";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { GridCard } from "../Shared/GridCard/GridCard";
import { CountryFlag } from "../Shared/CountryFlag";
import { HoverPopover } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import { TagLink } from "../Shared/TagLink";
import {
  Button,
  ButtonGroup,
  Badge,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import {
  ModifierCriterion,
  CriterionValue,
} from "src/models/list-filter/criteria/criterion";
import { PopoverCountButton } from "../Shared/PopoverCountButton";
import GenderIcon from "./GenderIcon";
import {
  faLink,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { faInstagram, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { RatingBanner } from "../Shared/RatingBanner";
import { usePerformerUpdate } from "src/core/StashService";
import { ILabeledId } from "src/models/list-filter/types";
import { FavoriteIcon } from "../Shared/FavoriteIcon";
import { PatchComponent } from "src/patch";
import { ExternalLinksButton } from "../Shared/ExternalLinksButton";
import { useConfigurationContext } from "src/hooks/Config";
import { OCounterButton } from "../Shared/CountButton";
import { PerformerCategoryStrip } from "./PerformerDetails/PerformerCategoryStrip";

export interface IPerformerCardExtraCriteria {
  scenes?: ModifierCriterion<CriterionValue>[];
  images?: ModifierCriterion<CriterionValue>[];
  galleries?: ModifierCriterion<CriterionValue>[];
  groups?: ModifierCriterion<CriterionValue>[];
  performer?: ILabeledId;
}

interface IPerformerCardProps {
  performer: GQL.PerformerDataFragment;
  cardWidth?: number;
  ageFromDate?: string;
  selecting?: boolean;
  selected?: boolean;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  extraCriteria?: IPerformerCardExtraCriteria;
  /** Scene ID for scene context - enables role badges based on marker roles */
  sceneId?: string;
}

const PerformerCardPopovers: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Popovers",
  ({ performer, extraCriteria }) => {
    const { configuration } = useConfigurationContext();
    const roleTagIds = configuration?.ui?.roleTagIds ?? {};

    // Get configured tag IDs directly (no need to query by name)
    const sexTagId = roleTagIds.sexTagId;
    const oralTagId = roleTagIds.oralTagId;
    const soloTagId = roleTagIds.soloTagId;
    const facialTagId = roleTagIds.facialTagId;

    function maybeRenderScenesPopoverButton() {
      if (!performer.scene_count) return;

      return (
        <PopoverCountButton
          className="scene-count"
          type="scene"
          count={performer.scene_count}
          url={NavUtils.makePerformerScenesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.scenes
          )}
        />
      );
    }

    function maybeRenderImagesPopoverButton() {
      if (!performer.image_count) return;

      return (
        <PopoverCountButton
          className="image-count"
          type="image"
          count={performer.image_count}
          url={NavUtils.makePerformerImagesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.images
          )}
        />
      );
    }

    function maybeRenderGalleriesPopoverButton() {
      if (!performer.gallery_count) return;

      return (
        <PopoverCountButton
          className="gallery-count"
          type="gallery"
          count={performer.gallery_count}
          url={NavUtils.makePerformerGalleriesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.galleries
          )}
        />
      );
    }

    function maybeRenderOCounter() {
      if (!performer.o_counter) return;

      return <OCounterButton value={performer.o_counter} />;
    }

    function maybeRenderTagPopoverButton() {
      // Use global performer tags for the hover popover
      const displayTags = performer.tags ?? [];

      if (!displayTags || displayTags.length <= 0) {
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
          <Button className="minimal tag-count">
            <Icon icon={faTag} />
            <span>{displayTags.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    // Removed Performers page green tag navigation button per request.

    function maybeRenderGroupsPopoverButton() {
      if (!performer.group_count) return;

      return (
        <PopoverCountButton
          className="group-count"
          type="group"
          count={performer.group_count}
          url={NavUtils.makePerformerGroupsUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.groups
          )}
        />
      );
    }

    // Sex scenes - gay icon with top/bottom sub-counts
    function maybeRenderSexScenesButton() {
      if (!sexTagId) return null;

      const count = performer.sex_scene_count ?? 0;
      const topCount = performer.sex_top_count ?? 0;
      const bottomCount = performer.sex_bottom_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(
        performer,
        sexTagId,
        "sex"
      );

      return (
        <HoverPopover
          placement="bottom"
          content={
            <div className="role-counts">
              <div>
                <Icon icon={faArrowUp} /> Top: {topCount}
              </div>
              <div>
                <Icon icon={faArrowDown} /> Bottom: {bottomCount}
              </div>
            </div>
          }
        >
          <Button
            className="minimal scene-category-count sex-scene-count"
            href={url}
            title="Sex scenes"
            disabled={count === 0}
          >
            <img src={gaySvg} alt="Sex" className="category-icon" />
            <span>{count}</span>
          </Button>
        </HoverPopover>
      );
    }

    // Oral scenes - mouth icon with top/bottom sub-counts
    function maybeRenderOralScenesButton() {
      if (!oralTagId) return null;

      const count = performer.oral_scene_count ?? 0;
      const topCount = performer.oral_top_count ?? 0;
      const bottomCount = performer.oral_bottom_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(
        performer,
        oralTagId,
        "oral"
      );

      return (
        <HoverPopover
          placement="bottom"
          content={
            <div className="role-counts">
              <div>
                <Icon icon={faArrowUp} /> Top: {topCount}
              </div>
              <div>
                <Icon icon={faArrowDown} /> Bottom: {bottomCount}
              </div>
            </div>
          }
        >
          <Button
            className="minimal scene-category-count oral-scene-count"
            href={url}
            title="Oral scenes"
            disabled={count === 0}
          >
            <img src={mouthSvg} alt="Oral" className="category-icon" />
            <span>{count}</span>
          </Button>
        </HoverPopover>
      );
    }

    // Solo scenes - hand icon (no top/bottom for solo)
    function maybeRenderSoloScenesButton() {
      if (!soloTagId) return null;

      const count = performer.solo_scene_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(
        performer,
        soloTagId,
        "solo"
      );

      return (
        <Button
          className="minimal scene-category-count solo-scene-count"
          href={url}
          title="Solo scenes"
          disabled={count === 0}
        >
          <Icon icon={faHand} className="category-icon-fa" />
          <span>{count}</span>
        </Button>
      );
    }

    // Facial scenes - goatee icon with top/bottom sub-counts
    function maybeRenderFacialScenesButton() {
      if (!facialTagId) return null;

      const count = performer.facial_scene_count ?? 0;
      const topCount = performer.facial_top_count ?? 0;
      const bottomCount = performer.facial_bottom_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(
        performer,
        facialTagId,
        "facial"
      );

      return (
        <HoverPopover
          placement="bottom"
          content={
            <div className="role-counts">
              <div>
                <Icon icon={faArrowUp} /> Top: {topCount}
              </div>
              <div>
                <Icon icon={faArrowDown} /> Bottom: {bottomCount}
              </div>
            </div>
          }
        >
          <Button
            className="minimal scene-category-count facial-scene-count"
            href={url}
            title="Facial scenes"
            disabled={count === 0}
          >
            <img src={goateeSvg} alt="Facial" className="category-icon" />
            <span>{count}</span>
          </Button>
        </HoverPopover>
      );
    }

    // Check if any role tag is configured
    const hasCategoryButtons = !!(
      sexTagId ||
      oralTagId ||
      soloTagId ||
      facialTagId
    );

    const hasAnyPopover = !!(
      performer.scene_count ||
      performer.image_count ||
      performer.gallery_count ||
      performer.tags.length > 0 ||
      performer.o_counter ||
      performer.group_count
    );

    if (hasAnyPopover) {
      return (
        <>
          <hr />
          <ButtonGroup className="card-popovers">
            {maybeRenderTagPopoverButton()}
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
  ({ performer }) => {
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
      if (!performer.rating100) {
        return;
      }
      return <RatingBanner rating={performer.rating100} />;
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
  ({ performer, ageFromDate, sceneId }) => {
    const intl = useIntl();
    const { configuration } = useConfigurationContext();

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

    return (
      <>
        {/* Age line */}
        <div className="performer-card__age">
          {age !== 0 ? ageString : "\u00A0"}
        </div>

        {/* Role badges using shared component */}
        <PerformerCategoryStrip 
          performer={performer}
          sceneId={sceneId}
          markerRoles={markerRoles}
        />
      </>
    );
  }
);

const PerformerCardImage: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Image",
  ({ performer }) => {
    return (
      <>
        <img
          loading="lazy"
          decoding="async"
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
        {/* Age and scene-tag strip moved to details to align with the gender icon */}
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
    } = props;

    // Determine rating class for special styling
    // Only apply on non-home pages (exclude /scenes, /images, /galleries, etc. when viewed from home)
    const getRatingClass = () => {
      // Check if we're on the home page by looking at the current location
      const isHomePage =
        window.location.pathname === "/" ||
        window.location.pathname === "/frontpage";

      if (isHomePage || !performer.rating100) return "";
      // 5 stars = 100, 4 stars = 80, 3 stars = 60
      if (performer.rating100 === 100) return "rating-5-stars";
      if (performer.rating100 === 80) return "rating-4-stars";
      if (performer.rating100 === 60) return "rating-3-stars";
      return "";
    };

    return (
      <GridCard
        className={`performer-card zoom-${zoomIndex} ${getRatingClass()}`}
        url={`/performers/${performer.id}`}
        width={cardWidth}
        pretitleIcon={
          <GenderIcon className="gender-icon" gender={performer.gender} />
        }
        title={<PerformerCardTitle {...props} />}
        image={<PerformerCardImage {...props} />}
        overlays={<PerformerCardOverlays {...props} />}
        details={<PerformerCardDetails {...props} />}
        popovers={<PerformerCardPopovers {...props} />}
        selected={selected}
        selecting={selecting}
        onSelectedChanged={onSelectedChanged}
      />
    );
  }
);
