import { useMemo } from "react";
import { Badge, Button, ButtonGroup } from "react-bootstrap"; // CUSTOM: added Badge
import * as GQL from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import { TagLink } from "../Shared/TagLink";
import { HoverPopover } from "../Shared/HoverPopover";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { useConfigurationContext } from "src/hooks/Config";
import { GridCard } from "../Shared/GridCard/GridCard";
import { faTag, faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons"; // CUSTOM: added faArrowUp, faArrowDown
import { markerTitle } from "src/core/markers";
import { Link } from "react-router-dom";
import { objectTitle } from "src/core/files";
import { PatchComponent } from "src/patch";
import { PerformerPopoverButton } from "../Shared/PerformerPopoverButton";
import { ScenePreview } from "./SceneCard";
import { TruncatedText } from "../Shared/TruncatedText";
import cx from "classnames"; // CUSTOM
import {
  getRatingCardClass,
  isRatingCardHomePage,
} from "src/utils/ratingCardStyles_custom"; // CUSTOM

interface ISceneMarkerCardProps {
  marker: GQL.SceneMarkerDataFragment;
  cardWidth?: number;
  previewHeight?: number;
  index?: number;
  compact?: boolean;
  selecting?: boolean;
  selected?: boolean | undefined;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
}

const SceneMarkerCardPopovers = PatchComponent(
  "SceneMarkerCard.Popovers",
  (props: ISceneMarkerCardProps) => {
    function maybeRenderPerformerPopoverButton() {
      if (props.marker.scene.performers.length <= 0) return;

      return (
        <PerformerPopoverButton
          performers={props.marker.scene.performers}
          linkType="scene_marker"
        />
      );
    }

    function renderTagPopoverButton() {
      const popoverContent = [
        <TagLink
          key={props.marker.primary_tag.id}
          tag={props.marker.primary_tag}
          linkType="scene_marker"
        />,
      ];

      props.marker.tags.map((tag) =>
        popoverContent.push(
          <TagLink key={tag.id} tag={tag} linkType="scene_marker" />
        )
      );

      return (
        <HoverPopover
          className="tag-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faTag} />
            <span>{popoverContent.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function renderPopoverButtonGroup() {
      if (!props.compact) {
        return (
          <>
            <hr />
            <ButtonGroup className="card-popovers">
              {maybeRenderPerformerPopoverButton()}
              {renderTagPopoverButton()}
            </ButtonGroup>
          </>
        );
      }
    }

    return <>{renderPopoverButtonGroup()}</>;
  }
);

const SceneMarkerCardDetails = PatchComponent(
  "SceneMarkerCard.Details",
  (props: ISceneMarkerCardProps) => {
    // CUSTOM: begin - performer chips with role arrows
    // Only show arrows if marker has performers in BOTH roles (top and bottom)
    const showRoleArrows = props.marker.top_performers.length > 0 && props.marker.bottom_performers.length > 0;

    const renderPerformerChip = (
      performer: typeof props.marker.top_performers[0],
      variant: "success" | "info",
      showArrow: boolean,
      arrowIcon: typeof faArrowUp
    ) => (
      <HoverPopover
        key={performer.id}
        className="performer-hover-popover"
        placement="top"
        content={
          <div className="performer-tag-container">
            <Link
              to={`/performers/${performer.id}`}
              className="performer-tag col m-auto zoom-2"
            >
              <img
                className="image-thumbnail"
                alt={performer.name ?? ""}
                src={performer.image_path ?? ""}
              />
            </Link>
          </div>
        }
      >
        <Link to={`/performers/${performer.id}`} className="performer-chip-link">
          <Badge variant={variant} className="performer-chip mr-1">
            {showArrow && <Icon icon={arrowIcon} className="mr-1" />}
            {performer.name}
          </Badge>
        </Link>
      </HoverPopover>
    );
    // CUSTOM: end

    return (
      <div className="scene-marker-card__details">
        <span className="scene-marker-card__time">
          {TextUtils.formatTimestampRange(
            props.marker.seconds,
            props.marker.end_seconds ?? undefined
          )}
        </span>
        {/* CUSTOM: begin - performer chips display */}
        {(props.marker.top_performers.length > 0 || props.marker.bottom_performers.length > 0) && (
          <div className="scene-marker-card__performers">
            {props.marker.top_performers.map((p) =>
              renderPerformerChip(p, "success", showRoleArrows, faArrowUp)
            )}
            {props.marker.bottom_performers.map((p) =>
              renderPerformerChip(p, "info", showRoleArrows, faArrowDown)
            )}
          </div>
        )}
        {/* CUSTOM: end */}
        <TruncatedText
          className="scene-marker-card__scene"
          lineCount={2} // CUSTOM: was 3
          text={
            <Link to={NavUtils.makeSceneMarkersSceneUrl(props.marker.scene)}>
              {objectTitle(props.marker.scene)}
            </Link>
          }
        />
      </div>
    );
  }
);

const SceneMarkerCardImage = PatchComponent(
  "SceneMarkerCard.Image",
  (props: ISceneMarkerCardProps) => {
    const { configuration } = useConfigurationContext();

    const file = useMemo(
      () =>
        props.marker.scene.files.length > 0
          ? props.marker.scene.files[0]
          : undefined,
      [props.marker.scene]
    );

    function isPortrait() {
      const width = file?.width ? file.width : 0;
      const height = file?.height ? file.height : 0;
      return height > width;
    }

    function maybeRenderSceneSpecsOverlay() {
      return (
        <div className="scene-specs-overlay">
          {props.marker.end_seconds && (
            <span className="overlay-duration">
              {TextUtils.secondsToTimestamp(
                props.marker.end_seconds - props.marker.seconds
              )}
            </span>
          )}
        </div>
      );
    }

    return (
      <>
        <ScenePreview
          image={props.marker.screenshot ?? undefined}
          video={props.marker.stream ?? undefined}
          soundActive={configuration?.interface?.soundOnPreview ?? false}
          isPortrait={isPortrait()}
        />
        {maybeRenderSceneSpecsOverlay()}
      </>
    );
  }
);

export const SceneMarkerCard = PatchComponent(
  "SceneMarkerCard",
  (props: ISceneMarkerCardProps) => {
    // CUSTOM: begin - GOAT/Royal Sapphire marker card styling
    const { configuration } = useConfigurationContext();
    const ratingCardTheme = configuration?.ui?.ratingCardTheme;
    const goatTagId = configuration?.ui?.roleTagIds?.goatTagId;
    const markerTags = useMemo(
      () => [props.marker.primary_tag, ...props.marker.tags],
      [props.marker.primary_tag, props.marker.tags]
    );
    const ratingCardClass = getRatingCardClass({
      tags: markerTags,
      goatTagId,
      theme: ratingCardTheme,
      thresholds: configuration?.ui?.ratingCardThresholds,
      overrideTagIds: configuration?.ui?.ratingCardOverrideTagIds,
      disabled: isRatingCardHomePage(),
    });
    // CUSTOM: end

    function zoomIndex() {
      if (!props.compact && props.zoomIndex !== undefined) {
        return `zoom-${props.zoomIndex}`;
      }

      return "";
    }

    return (
      <GridCard
        className={cx("scene-marker-card", zoomIndex(), ratingCardClass)} // CUSTOM
        url={NavUtils.makeSceneMarkerUrl(props.marker)}
        title={markerTitle(props.marker)}
        width={props.cardWidth}
        linkClassName="scene-marker-card-link"
        thumbnailSectionClassName="video-section"
        resumeTime={props.marker.seconds}
        image={<SceneMarkerCardImage {...props} />}
        details={<SceneMarkerCardDetails {...props} />}
        popovers={<SceneMarkerCardPopovers {...props} />}
        selected={props.selected}
        selecting={props.selecting}
        onSelectedChanged={props.onSelectedChanged}
      />
    );
  }
);
