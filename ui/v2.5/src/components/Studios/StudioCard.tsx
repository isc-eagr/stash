import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { GridCard } from "src/components/Shared/GridCard/GridCard";
import { HoverPopover } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import { TagLink } from "../Shared/TagLink";
import { Button, ButtonGroup } from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import { PopoverCountButton } from "../Shared/PopoverCountButton";
import { RatingBanner } from "../Shared/RatingBanner";
import { FavoriteIcon } from "../Shared/FavoriteIcon";
import { useStudioUpdate } from "src/core/StashService";
import { faTag, faHand, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { OCounterButton } from "../Shared/CountButton";
import { ConfigurationContext } from "src/hooks/Config";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

interface PerformerStudioStats {
  scene_count: number;
  sex_scene_count: number;
  oral_scene_count: number;
  solo_scene_count: number;
  facial_scene_count: number;
  group_count: number;
  o_counter: number | null | undefined;
}

interface IProps {
  studio: GQL.StudioDataFragment;
  cardWidth?: number;
  hideParent?: boolean;
  selecting?: boolean;
  selected?: boolean;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  performerId?: string;
}

function maybeRenderParent(
  studio: GQL.StudioDataFragment,
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

function maybeRenderChildren(studio: GQL.StudioDataFragment) {
  if (studio.child_studios.length > 0) {
    return (
      <div className="studio-child-studios">
        <FormattedMessage
          id="parent_of"
          values={{
            children: (
              <Link to={NavUtils.makeChildStudiosUrl(studio)}>
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

export const StudioCard: React.FC<IProps> = ({
  studio,
  cardWidth,
  hideParent,
  selecting,
  selected,
  zoomIndex,
  onSelectedChanged,
  performerId,
}) => {
  const [updateStudio] = useStudioUpdate();
  const { configuration } = useContext(ConfigurationContext);
  const cfg = (configuration?.ui as any)?.sceneTagAliases ?? {};
  
  // Query for tag IDs based on configured tag names
  const topTagName = cfg.top ?? "top";
  const bottomTagName = cfg.bottom ?? "bottom";
  const oralTopTagName = cfg.oraltop ?? "oraltop";
  const oralBottomTagName = cfg.oralbottom ?? "oralbottom";
  const soloTagName = cfg.solo ?? "solo";
  const facialGivenTagName = cfg.facialgiven ?? "facialgiven";
  const facialReceivedTagName = cfg.facialreceived ?? "facialreceived";
  const selfFacialTagName = cfg.selffacial ?? "selffacial";
  
  // Use a simpler approach - query all tags and filter client-side
  // since we only need to match 5 specific tag names
  const { data: tagsData } = GQL.useFindTagsQuery({
    variables: {
      filter: {
        per_page: -1, // Get all tags
      },
    },
  });
  
  // When viewing from a performer's studios, fetch performer-filtered stats
  const { data: performerStatsData } = GQL.useFindStudioPerformerStatsQuery({
    variables: {
      id: studio.id,
      performerId: performerId ?? "",
    },
    skip: !performerId, // Only run this query when performerId is provided
  });
  
  // Memoize the performer stats to avoid recalculating on every render
  const performerStats: PerformerStudioStats | null = useMemo(() => {
    if (!performerId || !performerStatsData?.findStudio) return null;
    const s = performerStatsData.findStudio;
    return {
      scene_count: s.scene_count,
      sex_scene_count: s.sex_scene_count,
      oral_scene_count: s.oral_scene_count,
      solo_scene_count: s.solo_scene_count,
      facial_scene_count: s.facial_scene_count,
      group_count: s.group_count,
      o_counter: s.o_counter,
    };
  }, [performerId, performerStatsData]);
  
  // Map tag names to IDs
  const allTags = tagsData?.findTags?.tags ?? [];
  const topTag = allTags.find(t => t.name.toLowerCase() === topTagName.toLowerCase());
  const bottomTag = allTags.find(t => t.name.toLowerCase() === bottomTagName.toLowerCase());
  const oralTopTag = allTags.find(t => t.name.toLowerCase() === oralTopTagName.toLowerCase());
  const oralBottomTag = allTags.find(t => t.name.toLowerCase() === oralBottomTagName.toLowerCase());
  const soloTag = allTags.find(t => t.name.toLowerCase() === soloTagName.toLowerCase());
  const facialGivenTag = allTags.find(t => t.name.toLowerCase() === facialGivenTagName.toLowerCase());
  const facialReceivedTag = allTags.find(t => t.name.toLowerCase() === facialReceivedTagName.toLowerCase());
  const selfFacialTag = allTags.find(t => t.name.toLowerCase() === selfFacialTagName.toLowerCase());

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
    // Use performer-filtered scene count when available
    const count = performerStats?.scene_count ?? studio.scene_count;
    if (!count) return;

    const url = performerId
      ? NavUtils.makePerformerStudioScenesUrl(performerId, studio)
      : NavUtils.makeStudioScenesUrl(studio);

    return (
      <PopoverCountButton
        className="scene-count"
        type="scene"
        count={count}
        url={url}
      />
    );
  }

  // Sex scenes (top/bottom tags) - gay icon
  function maybeRenderSexScenesButton() {
    if (!topTag || !bottomTag) return null;
    
    // Use performer-filtered stats when available, otherwise use studio stats
    const count = performerStats?.sex_scene_count ?? studio.sex_scene_count ?? 0;
    const url = performerId
      ? NavUtils.makePerformerStudioSexScenesUrl(
          performerId,
          studio,
          topTag.id,
          topTag.name,
          bottomTag.id,
          bottomTag.name
        )
      : NavUtils.makeStudioSexScenesUrl(
          studio,
          topTag.id,
          topTag.name,
          bottomTag.id,
          bottomTag.name
        );

    return (
      <Button 
        className="minimal scene-category-count sex-scene-count"
        href={url}
        title={`Sex scenes (${topTag.name}/${bottomTag.name})`}
        disabled={count === 0}
      >
        <img src={gaySvg} alt="Sex" className="category-icon" />
        <span>{count}</span>
      </Button>
    );
  }

  // Oral scenes (oral tags without top/bottom) - mouth icon
  function maybeRenderOralScenesButton() {
    if (!oralTopTag || !oralBottomTag || !topTag || !bottomTag) return null;
    
    // Use performer-filtered stats when available, otherwise use studio stats
    const count = performerStats?.oral_scene_count ?? studio.oral_scene_count ?? 0;
    const url = performerId
      ? NavUtils.makePerformerStudioOralScenesUrl(
          performerId,
          studio,
          oralTopTag.id,
          oralTopTag.name,
          oralBottomTag.id,
          oralBottomTag.name,
          topTag.id,
          topTag.name,
          bottomTag.id,
          bottomTag.name
        )
      : NavUtils.makeStudioOralScenesUrl(
          studio,
          oralTopTag.id,
          oralTopTag.name,
          oralBottomTag.id,
          oralBottomTag.name,
          topTag.id,
          topTag.name,
          bottomTag.id,
          bottomTag.name
        );

    return (
      <Button 
        className="minimal scene-category-count oral-scene-count"
        href={url}
        title={`Oral scenes (${oralTopTag.name}/${oralBottomTag.name})`}
        disabled={count === 0}
      >
        <img src={mouthSvg} alt="Oral" className="category-icon" />
        <span>{count}</span>
      </Button>
    );
  }

  // Solo scenes (solo tags without top/bottom/oral) - hand icon
  function maybeRenderSoloScenesButton() {
    if (!soloTag || !topTag || !bottomTag || !oralTopTag || !oralBottomTag) return null;
    
    // Use performer-filtered stats when available, otherwise use studio stats
    const count = performerStats?.solo_scene_count ?? studio.solo_scene_count ?? 0;
    const url = performerId
      ? NavUtils.makePerformerStudioSoloScenesUrl(
          performerId,
          studio,
          soloTag.id,
          soloTag.name,
          topTag.id,
          topTag.name,
          bottomTag.id,
          bottomTag.name,
          oralTopTag.id,
          oralTopTag.name,
          oralBottomTag.id,
          oralBottomTag.name
        )
      : NavUtils.makeStudioSoloScenesUrl(
          studio,
          soloTag.id,
          soloTag.name,
          topTag.id,
          topTag.name,
          bottomTag.id,
          bottomTag.name,
          oralTopTag.id,
          oralTopTag.name,
          oralBottomTag.id,
          oralBottomTag.name
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

  // Facial scenes (facialgiven or facialreceived) - goatee icon
  function maybeRenderFacialScenesButton() {
    // At least one facial tag must be configured/found
    if (!facialGivenTag && !facialReceivedTag && !selfFacialTag) return null;

    // Use performer-filtered stats when available, otherwise use studio stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studioCount = (studio as any).facial_scene_count ?? (studio as any).facialSceneCount ?? 0;
    const count = performerStats?.facial_scene_count ?? studioCount;
    const primary1 = (facialGivenTag ?? selfFacialTag)!;
    const primary2 = (facialReceivedTag ?? selfFacialTag)!;
    const url = performerId
      ? NavUtils.makePerformerStudioFacialScenesUrl(
          performerId,
          studio,
          primary1.id,
          primary1.name,
          primary2.id,
          primary2.name,
          selfFacialTag?.id,
          selfFacialTag?.name
        )
      : NavUtils.makeStudioFacialScenesUrl(
          studio,
          primary1.id,
          primary1.name,
          primary2.id,
          primary2.name,
          selfFacialTag?.id,
          selfFacialTag?.name
        );

    return (
      <Button
        className="minimal scene-category-count facial-scene-count"
        href={url}
        title={`Facial scenes`}
        disabled={count === 0}
      >
        <img src={goateeSvg} alt="Facial" className="category-icon" />
        <span>{count}</span>
      </Button>
    );
  }

  // Unique performers (performers with only 1 scene in database, for this studio)
  function maybeRenderUniquePerformersButton() {
    // Hide this button when viewing from a performer's studios tab
    if (performerId) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = (studio as any).unique_performer_count ?? 0;
    if (count === 0) return null;

    const url = NavUtils.makeStudioUniquePerformersUrl(studio);

    return (
      <Button
        className="minimal scene-category-count unique-performer-count"
        href={url}
        title={`Unique performers (only 1 scene)`}
        disabled={count === 0}
      >
        <Icon icon={faUserPlus} className="category-icon-fa" />
        <span>{count}</span>
      </Button>
    );
  }

  function maybeRenderImagesPopoverButton() {
    if (!studio.image_count) return;

    return (
      <PopoverCountButton
        className="image-count"
        type="image"
        count={studio.image_count}
        url={NavUtils.makeStudioImagesUrl(studio)}
      />
    );
  }

  function maybeRenderGalleriesPopoverButton() {
    if (!studio.gallery_count) return;

    return (
      <PopoverCountButton
        className="gallery-count"
        type="gallery"
        count={studio.gallery_count}
        url={NavUtils.makeStudioGalleriesUrl(studio)}
      />
    );
  }

  function maybeRenderGroupsPopoverButton() {
    // Use performer-filtered group count when available
    const count = performerStats?.group_count ?? studio.group_count;
    if (!count) return;

    const url = performerId
      ? NavUtils.makePerformerStudioGroupsUrl(performerId, studio)
      : NavUtils.makeStudioGroupsUrl(studio);

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
    if (!studio.performer_count) return;

    return (
      <PopoverCountButton
        className="performer-count"
        type="performer"
        count={studio.performer_count}
        url={NavUtils.makeStudioPerformersUrl(studio)}
      />
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
    // Use performer-filtered o_counter when available
    const count = performerStats?.o_counter ?? studio.o_counter;
    if (!count) return;

    return <OCounterButton value={count} />;
  }

  function maybeRenderPopoverButtonGroup() {
    const hasCategoryButtons = !!(topTag && bottomTag && oralTopTag && oralBottomTag && soloTag);
    
    if (
      studio.scene_count ||
      studio.image_count ||
      studio.gallery_count ||
      studio.group_count ||
      studio.performer_count ||
      studio.o_counter ||
      studio.tags.length > 0 ||
      hasCategoryButtons
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
          </ButtonGroup>
        </>
      );
    }
  }

  return (
    <GridCard
      className={`studio-card zoom-${zoomIndex}`}
      url={`/studios/${studio.id}`}
      width={cardWidth}
      title={studio.name}
      linkClassName="studio-card-header"
      image={
        <img
          loading="lazy"
          className="studio-card-image"
          alt={studio.name}
          src={studio.image_path ?? ""}
        />
      }
      details={
        <div className="studio-card__details">
          {maybeRenderParent(studio, hideParent)}
          {maybeRenderChildren(studio)}
          <RatingBanner rating={studio.rating100} />
        </div>
      }
      overlays={
        <FavoriteIcon
          favorite={studio.favorite}
          onToggleFavorite={(v) => onToggleFavorite(v)}
          size="2x"
          className="hide-not-favorite"
        />
      }
      popovers={maybeRenderPopoverButtonGroup()}
      selected={selected}
      selecting={selecting}
      onSelectedChanged={onSelectedChanged}
    />
  );
};
