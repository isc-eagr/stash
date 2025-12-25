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
import { Button, ButtonGroup, Badge, OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  ModifierCriterion,
  CriterionValue,
} from "src/models/list-filter/criteria/criterion";
import { PopoverCountButton } from "../Shared/PopoverCountButton";
import GenderIcon from "./GenderIcon";
import { faLink, faTag, faArrowUp, faArrowDown, faHand } from "@fortawesome/free-solid-svg-icons";
import { faInstagram, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { RatingBanner } from "../Shared/RatingBanner";
import { usePerformerUpdate } from "src/core/StashService";
import { ILabeledId } from "src/models/list-filter/types";
import { FavoriteIcon } from "../Shared/FavoriteIcon";
import { PatchComponent } from "src/patch";
import { ExternalLinksButton } from "../Shared/ExternalLinksButton";
import { useConfigurationContext } from "src/hooks/Config";
import { OCounterButton } from "../Shared/CountButton";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

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

    // Sex scenes - gay icon with giver/receiver sub-counts
    function maybeRenderSexScenesButton() {
      if (!sexTagId) return null;
      
      const count = performer.sex_scene_count ?? 0;
      const giverCount = performer.sex_giver_count ?? 0;
      const receiverCount = performer.sex_receiver_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(performer, sexTagId, "sex");

      return (
        <HoverPopover
          placement="bottom"
          content={
            <div className="role-counts">
              <div><Icon icon={faArrowUp} /> Giver: {giverCount}</div>
              <div><Icon icon={faArrowDown} /> Receiver: {receiverCount}</div>
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

    // Oral scenes - mouth icon with giver/receiver sub-counts
    function maybeRenderOralScenesButton() {
      if (!oralTagId) return null;
      
      const count = performer.oral_scene_count ?? 0;
      const giverCount = performer.oral_giver_count ?? 0;
      const receiverCount = performer.oral_receiver_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(performer, oralTagId, "oral");

      return (
        <HoverPopover
          placement="bottom"
          content={
            <div className="role-counts">
              <div><Icon icon={faArrowUp} /> Giver: {giverCount}</div>
              <div><Icon icon={faArrowDown} /> Receiver: {receiverCount}</div>
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

    // Solo scenes - hand icon (no giver/receiver for solo)
    function maybeRenderSoloScenesButton() {
      if (!soloTagId) return null;
      
      const count = performer.solo_scene_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(performer, soloTagId, "solo");

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

    // Facial scenes - goatee icon with giver/receiver sub-counts
    function maybeRenderFacialScenesButton() {
      if (!facialTagId) return null;

      const count = performer.facial_scene_count ?? 0;
      const giverCount = performer.facial_giver_count ?? 0;
      const receiverCount = performer.facial_receiver_count ?? 0;
      const url = NavUtils.makePerformerMarkerScenesUrl(performer, facialTagId, "facial");

      return (
        <HoverPopover
          placement="bottom"
          content={
            <div className="role-counts">
              <div><Icon icon={faArrowUp} /> Giver: {giverCount}</div>
              <div><Icon icon={faArrowDown} /> Receiver: {receiverCount}</div>
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
    const hasCategoryButtons = !!(sexTagId || oralTagId || soloTagId || facialTagId);

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

    // Render role badges - context-aware:
    // In scene context (sceneId present): show scene-specific roles, no counters
    // Outside scene context: show total performer counts
    function maybeRenderRoleBadges() {
      const roleTagIds = configuration?.ui?.roleTagIds ?? {};

      // Determine which categories to show based on context
      // Order: Sex, Oral, Solo, Facial (fixed order)
      let rolesToShow: Array<{
        category: 'sex' | 'oral' | 'solo' | 'facial';
        isGiver?: boolean;
        isReceiver?: boolean;
        count?: number;
        giverCount?: number;
        receiverCount?: number;
      }> = [];

      if (sceneId) {
        // Scene context: show roles based on marker roles in this scene only
        if (markerRoles.length === 0) return null;

        const sexRoles = markerRoles.filter((r: string) => r.startsWith('sex_'));
        const oralRoles = markerRoles.filter((r: string) => r.startsWith('oral_'));
        const soloRoles = markerRoles.filter((r: string) => r === 'solo'); // solo is just "solo", not "solo_"
        const facialRoles = markerRoles.filter((r: string) => r.startsWith('facial_'));

        // Fixed order: Sex, Oral, Solo, Facial
        if (sexRoles.length > 0 && roleTagIds.sexTagId) {
          rolesToShow.push({
            category: 'sex',
            isGiver: sexRoles.some((r: string) => r.endsWith('_giver')),
            isReceiver: sexRoles.some((r: string) => r.endsWith('_receiver')),
          });
        }
        if (oralRoles.length > 0 && roleTagIds.oralTagId) {
          rolesToShow.push({
            category: 'oral',
            isGiver: oralRoles.some((r: string) => r.endsWith('_giver')),
            isReceiver: oralRoles.some((r: string) => r.endsWith('_receiver')),
          });
        }
        if (soloRoles.length > 0 && roleTagIds.soloTagId) {
          rolesToShow.push({
            category: 'solo',
          });
        }
        if (facialRoles.length > 0 && roleTagIds.facialTagId) {
          rolesToShow.push({
            category: 'facial',
            isGiver: facialRoles.some((r: string) => r.endsWith('_giver')),
            isReceiver: facialRoles.some((r: string) => r.endsWith('_receiver')),
          });
        }
      } else {
        // Global context: show total counts
        const sexCount = performer.sex_scene_count ?? 0;
        const oralCount = performer.oral_scene_count ?? 0;
        const soloCount = performer.solo_scene_count ?? 0;
        const facialCount = performer.facial_scene_count ?? 0;

        // Fixed order: Sex, Oral, Solo, Facial
        if (sexCount > 0 && roleTagIds.sexTagId) {
          rolesToShow.push({
            category: 'sex',
            count: sexCount,
            giverCount: performer.sex_giver_count ?? 0,
            receiverCount: performer.sex_receiver_count ?? 0,
          });
        }
        if (oralCount > 0 && roleTagIds.oralTagId) {
          rolesToShow.push({
            category: 'oral',
            count: oralCount,
            giverCount: performer.oral_giver_count ?? 0,
            receiverCount: performer.oral_receiver_count ?? 0,
          });
        }
        if (soloCount > 0 && roleTagIds.soloTagId) {
          rolesToShow.push({
            category: 'solo',
            count: soloCount,
          });
        }
        if (facialCount > 0 && roleTagIds.facialTagId) {
          rolesToShow.push({
            category: 'facial',
            count: facialCount,
            giverCount: performer.facial_giver_count ?? 0,
            receiverCount: performer.facial_receiver_count ?? 0,
          });
        }
      }

      if (rolesToShow.length === 0) return null;

      // Helper to get tag ID for a category
      const getTagId = (category: 'sex' | 'oral' | 'solo' | 'facial') => {
        switch (category) {
          case 'sex': return roleTagIds.sexTagId;
          case 'oral': return roleTagIds.oralTagId;
          case 'solo': return roleTagIds.soloTagId;
          case 'facial': return roleTagIds.facialTagId;
        }
      };

      // Build exclude tags for oral (exclude sex) and solo (exclude sex + oral)
      const getExcludeTagsForCategory = (category: 'sex' | 'oral' | 'solo' | 'facial') => {
        const excludeTags: Array<{ id: string; label: string }> = [];
        if (category === 'oral') {
          // Oral should exclude sex tag
          if (roleTagIds.sexTagId) excludeTags.push({ id: roleTagIds.sexTagId, label: 'Sex' });
        } else if (category === 'solo') {
          // Solo should exclude both sex and oral tags
          if (roleTagIds.sexTagId) excludeTags.push({ id: roleTagIds.sexTagId, label: 'Sex' });
          if (roleTagIds.oralTagId) excludeTags.push({ id: roleTagIds.oralTagId, label: 'Oral' });
        }
        return excludeTags.length > 0 ? excludeTags : undefined;
      };

      // Render badges with category icon on top, arrows below
      return (
        <div className="performer-role-badges">
          {rolesToShow.map((role, idx) => {
            const categoryIcon = 
              role.category === 'sex' ? gaySvg :
              role.category === 'oral' ? mouthSvg :
              role.category === 'facial' ? goateeSvg :
              null; // solo uses faHand
            
            const tagId = getTagId(role.category);
            const tagLabel = role.category.charAt(0).toUpperCase() + role.category.slice(1);
            const excludeTags = getExcludeTagsForCategory(role.category);
            
            // URLs for clickable badges (only in global context, not scene context)
            const categoryUrl = !sceneId && tagId 
              ? NavUtils.makePerformerMarkerScenesWithRoleUrl(performer, tagId, tagLabel, undefined, excludeTags)
              : undefined;
            const giverUrl = !sceneId && tagId 
              ? NavUtils.makePerformerMarkerScenesWithRoleUrl(performer, tagId, tagLabel, "giver", excludeTags)
              : undefined;
            const receiverUrl = !sceneId && tagId 
              ? NavUtils.makePerformerMarkerScenesWithRoleUrl(performer, tagId, tagLabel, "receiver", excludeTags)
              : undefined;

            const categoryIconElement = categoryIcon ? (
              <img src={categoryIcon} alt={role.category} className="category-icon" />
            ) : (
              <Icon icon={faHand} className="category-icon-fa" />
            );

            return (
              <div key={idx} className="role-badge-item">
                {/* Category icon on top - clickable in global context */}
                <div className="category-icon-container">
                  {categoryUrl ? (
                    <Link to={categoryUrl} className="role-badge-link" onClick={(e) => e.stopPropagation()}>
                      {categoryIconElement}
                      {role.count !== undefined && (
                        <span className="role-total-count">{role.count}</span>
                      )}
                    </Link>
                  ) : (
                    <>
                      {categoryIconElement}
                      {!sceneId && role.count !== undefined && (
                        <span className="role-total-count">{role.count}</span>
                      )}
                    </>
                  )}
                </div>
                
                {/* Arrows below (only for sex/oral/facial, not solo) */}
                {role.category !== 'solo' && (
                  <div className="role-arrows">
                    {(sceneId ? role.isGiver : (role.giverCount ?? 0) > 0) && (
                      giverUrl ? (
                        <Link to={giverUrl} className="role-badge-link" onClick={(e) => e.stopPropagation()}>
                          <Badge pill variant="success" className="arrow-badge giver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Icon icon={faArrowUp} />
                            <span className="arrow-count">{role.giverCount}</span>
                          </Badge>
                        </Link>
                      ) : (
                        <Badge pill variant="success" className="arrow-badge giver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon icon={faArrowUp} />
                          {!sceneId && <span className="arrow-count">{role.giverCount}</span>}
                        </Badge>
                      )
                    )}
                    {(sceneId ? role.isReceiver : (role.receiverCount ?? 0) > 0) && (
                      receiverUrl ? (
                        <Link to={receiverUrl} className="role-badge-link" onClick={(e) => e.stopPropagation()}>
                          <Badge pill variant="info" className="arrow-badge receiver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Icon icon={faArrowDown} />
                            <span className="arrow-count">{role.receiverCount}</span>
                          </Badge>
                        </Link>
                      ) : (
                        <Badge pill variant="info" className="arrow-badge receiver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon icon={faArrowDown} />
                          {!sceneId && <span className="arrow-count">{role.receiverCount}</span>}
                        </Badge>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <>
        {/* Age line */}
        <div className="performer-card__age">
          {age !== 0 ? ageString : "\u00A0"}
        </div>
        
        {/* Role badges */}
        {maybeRenderRoleBadges()}
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
      const isHomePage = window.location.pathname === '/' || window.location.pathname === '/frontpage';
      
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
