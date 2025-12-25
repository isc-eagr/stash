import React, { useEffect, useMemo, useRef } from "react";
import { Button, ButtonGroup, OverlayTrigger, Tooltip, Badge } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import { GalleryLink, TagLink, SceneMarkerLink } from "../Shared/TagLink";
import { HoverPopover } from "../Shared/HoverPopover";
import { TruncatedText } from "../Shared/TruncatedText";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { SceneQueue } from "src/models/sceneQueue";
import { useConfigurationContext } from "src/hooks/Config";
import { PerformerPopoverButton } from "../Shared/PerformerPopoverButton";
import { GridCard } from "../Shared/GridCard/GridCard";
import { RatingBanner } from "../Shared/RatingBanner";
import { FormattedMessage } from "react-intl";
import {
  faBox,
  faCopy,
  faFilm,
  faHand,
  faImages,
  faMapMarkerAlt,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
// Using emoji for oral indicator
import { objectPath, objectTitle } from "src/core/files";
import { PreviewScrubber } from "./PreviewScrubber";
import { PatchComponent } from "src/patch";
import { StudioOverlay } from "../Shared/GridCard/StudioOverlay";
import { GroupTag } from "../Groups/GroupTag";
import { FileSize } from "../Shared/FileSize";
import { OCounterButton } from "../Shared/CountButton";
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";
import straightSvg from "src/assets/straight.svg";
import goateeSvg from "src/assets/goatee.svg";

interface IScenePreviewProps {
  isPortrait: boolean;
  image?: string;
  video?: string;
  soundActive: boolean;
  vttPath?: string;
  onScrubberClick?: (timestamp: number) => void;
}

export const ScenePreview: React.FC<IScenePreviewProps> = ({
  image,
  video,
  isPortrait,
  soundActive,
  vttPath,
  onScrubberClick,
}) => {
  const videoEl = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio > 0)
          // Catch is necessary due to DOMException if user hovers before clicking on page
          videoEl.current?.play()?.catch(() => {});
        else videoEl.current?.pause();
      });
    });

    if (videoEl.current) observer.observe(videoEl.current);
  });

  useEffect(() => {
    if (videoEl?.current?.volume)
      videoEl.current.volume = soundActive ? 0.05 : 0;
  }, [soundActive]);

  return (
    <div className={cx("scene-card-preview", { portrait: isPortrait })}>
      <img
        className="scene-card-preview-image"
        loading="lazy"
        src={image}
        alt=""
      />
      <video
        disableRemotePlayback
        playsInline
        muted={!soundActive}
        className="scene-card-preview-video"
        loop
        preload="none"
        ref={videoEl}
        src={video}
      />
      <PreviewScrubber vttPath={vttPath} onClick={onScrubberClick} />
    </div>
  );
};

interface ISceneCardProps {
  scene: GQL.SlimSceneDataFragment;
  width?: number;
  previewHeight?: number;
  index?: number;
  queue?: SceneQueue;
  compact?: boolean;
  selecting?: boolean;
  selected?: boolean | undefined;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  fromGroupId?: string;
}

const Description: React.FC<{
  sceneNumber?: number;
}> = ({ sceneNumber }) => {
  if (!sceneNumber) return null;

  return (
    <>
      <hr />
      {sceneNumber !== undefined && (
        <span className="scene-group-scene-number">
          <FormattedMessage id="scene" /> #{sceneNumber}
        </span>
      )}
    </>
  );
};

const SceneCardPopovers = PatchComponent(
  "SceneCard.Popovers",
  (props: ISceneCardProps) => {
    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    const sceneNumber = useMemo(() => {
      if (!props.fromGroupId) {
        return undefined;
      }

      const group = props.scene.groups.find(
        (g) => g.group.id === props.fromGroupId
      );
      return group?.scene_index ?? undefined;
    }, [props.fromGroupId, props.scene.groups]);

    function maybeRenderTagPopoverButton() {
      if (props.scene.tags.length <= 0) return;

      const popoverContent = props.scene.tags.map((tag) => (
        <TagLink key={tag.id} tag={tag} />
      ));

      return (
        <HoverPopover
          className="tag-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faTag} />
            <span>{props.scene.tags.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderPerformerPopoverButton() {
      if (props.scene.performers.length <= 0) return;

      return (
        <PerformerPopoverButton
          performers={props.scene.performers}
          linkType="scene"
        />
      );
    }

    function maybeRenderGroupPopoverButton() {
      if (props.scene.groups.length <= 0) return;

      const popoverContent = props.scene.groups.map((sceneGroup) => (
        <GroupTag key={sceneGroup.group.id} group={sceneGroup.group} />
      ));

      return (
        <HoverPopover
          placement="bottom"
          content={popoverContent}
          className="group-count tag-tooltip"
        >
          <Button className="minimal">
            <Icon icon={faFilm} />
            <span>{props.scene.groups.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderSceneMarkerPopoverButton() {
      if (props.scene.scene_markers.length <= 0) return;

      const popoverContent = props.scene.scene_markers.map((marker) => {
        const markerWithScene = { ...marker, scene: { id: props.scene.id } };
        return <SceneMarkerLink key={marker.id} marker={markerWithScene} />;
      });

      return (
        <HoverPopover
          className="marker-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faMapMarkerAlt} />
            <span>{props.scene.scene_markers.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOCounter() {
      if (props.scene.o_counter) {
        return <OCounterButton value={props.scene.o_counter} />;
      }
    }

    function maybeRenderGallery() {
      if (props.scene.galleries.length <= 0) return;

      const popoverContent = props.scene.galleries.map((gallery) => (
        <GalleryLink key={gallery.id} gallery={gallery} />
      ));

      return (
        <HoverPopover
          className="gallery-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faImages} />
            <span>{props.scene.galleries.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOrganized() {
      if (props.scene.organized) {
        return (
          <OverlayTrigger
            overlay={<Tooltip id="organised-tooltip">{"Organized"}</Tooltip>}
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

    function maybeRenderDupeCopies() {
      const phash = file
        ? file.fingerprints.find((fp) => fp.type === "phash")
        : undefined;

      if (phash) {
        return (
          <div className="other-copies extra-scene-info">
            <Button
              href={NavUtils.makeScenesPHashMatchUrl(phash.value)}
              className="minimal"
            >
              <Icon icon={faCopy} />
            </Button>
          </div>
        );
      }
    }

    function maybeRenderPopoverButtonGroup() {
      if (
        !props.compact &&
        (props.scene.tags.length > 0 ||
          props.scene.performers.length > 0 ||
          props.scene.groups.length > 0 ||
          props.scene.scene_markers.length > 0 ||
          props.scene?.o_counter ||
          props.scene.galleries.length > 0 ||
          props.scene.organized ||
          sceneNumber !== undefined)
      ) {
        return (
          <>
            <Description sceneNumber={sceneNumber} />
            <hr />
            <ButtonGroup className="card-popovers">
              {maybeRenderTagPopoverButton()}
              {maybeRenderPerformerPopoverButton()}
              {maybeRenderGroupPopoverButton()}
              {maybeRenderSceneMarkerPopoverButton()}
              {maybeRenderOCounter()}

              {maybeRenderGallery()}
              {maybeRenderOrganized()}
              {maybeRenderDupeCopies()}
            </ButtonGroup>
          </>
        );
      }
    }

    return <>{maybeRenderPopoverButtonGroup()}</>;
  }
);

const SceneCardDetails = PatchComponent(
  "SceneCard.Details",
  (props: ISceneCardProps) => {
    return (
      <div className="scene-card__details">
        <span className="scene-card__date">{props.scene.date}</span>
        <span className="file-path extra-scene-info">
          {objectPath(props.scene)}
        </span>
        <TruncatedText
          className="scene-card__description"
          text={props.scene.details}
          lineCount={3}
        />
      </div>
    );
  }
);

const SceneCardOverlays = PatchComponent(
  "SceneCard.Overlays",
  (props: ISceneCardProps) => {
    const { configuration } = useConfigurationContext();
    
    // Check if scene has facial markers based on configured facial tag ID
    const hasFacial = useMemo(() => {
      const roleTagIds = configuration?.ui?.roleTagIds ?? {};
      const facialTagId = roleTagIds.facialTagId;
      if (!facialTagId) return false;
      
      // Check scene markers for facial tag
      const sceneMarkers = (props.scene as any).scene_markers ?? [];
      for (const marker of sceneMarkers) {
        if (marker?.primary_tag?.id === facialTagId) {
          return true;
        }
        const markerTags: Array<{ id?: string }> = marker?.tags ?? [];
        for (const tag of markerTags) {
          if (tag?.id === facialTagId) {
            return true;
          }
        }
      }
      return false;
    }, [props.scene, configuration?.ui]);

    return (
      <>
        <StudioOverlay studio={props.scene.studio} />
        {hasFacial && (
          <img
            className="scene-facial-overlay"
            src={goateeSvg}
            alt="Facial"
            title="Facial tags present"
          />
        )}
      </>
    );
  }
);

const SceneCardImage = PatchComponent(
  "SceneCard.Image",
  (props: ISceneCardProps) => {
    const history = useHistory();
    const { configuration } = useConfigurationContext();
    const cont = configuration?.interface.continuePlaylistDefault ?? false;

    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    function maybeRenderSceneSpecsOverlay() {
      return (
        <div className="scene-specs-overlay">
          {file?.size !== undefined ? (
            <span className="overlay-filesize extra-scene-info">
              <FileSize size={file.size} />
            </span>
          ) : (
            ""
          )}
          {file?.width && file?.height ? (
            <span className="overlay-resolution">
              {" "}
              {TextUtils.resolution(file?.width, file?.height)}
            </span>
          ) : (
            ""
          )}
          {(file?.duration ?? 0) >= 1 ? (
            <span className="overlay-duration">
              {TextUtils.secondsToTimestamp(file?.duration ?? 0)}
            </span>
          ) : (
            ""
          )}
        </div>
      );
    }

    function maybeRenderInteractiveSpeedOverlay() {
      return (
        <div className="scene-interactive-speed-overlay">
          {props.scene.interactive_speed ?? ""}
        </div>
      );
    }

    function onScrubberClick(timestamp: number) {
      const link = props.queue
        ? props.queue.makeLink(props.scene.id, {
            sceneIndex: props.index,
            continue: cont,
            start: timestamp,
          })
        : `/scenes/${props.scene.id}?t=${timestamp}`;

      history.push(link);
    }

    function isPortrait() {
      const width = file?.width ? file.width : 0;
      const height = file?.height ? file.height : 0;
      return height > width;
    }

    return (
      <>
        <ScenePreview
          image={props.scene.paths.screenshot ?? undefined}
          video={props.scene.paths.preview ?? undefined}
          isPortrait={isPortrait()}
          soundActive={configuration?.interface?.soundOnPreview ?? false}
          vttPath={props.scene.paths.vtt ?? undefined}
          onScrubberClick={onScrubberClick}
        />
        <RatingBanner rating={props.scene.rating100} />
        {maybeRenderSceneSpecsOverlay()}
        {maybeRenderInteractiveSpeedOverlay()}
      </>
    );
  }
);

export const SceneCard = PatchComponent(
  "SceneCard",
  (props: ISceneCardProps) => {
    const { configuration } = useConfigurationContext();

    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    // Determine which icon to show based on scene markers with role tags
    const iconToShow = useMemo(() => {
      // Get role tag IDs from configuration
      const roleTagIds = configuration?.ui?.roleTagIds ?? {};
      const sexTagId = roleTagIds.sexTagId;
      const oralTagId = roleTagIds.oralTagId;
      const soloTagId = roleTagIds.soloTagId;
      const facialTagId = roleTagIds.facialTagId;

      // Helper to check if a tag matches (including parent/child relationships)
      const tagMatches = (tag: any, targetId: string | undefined) => {
        if (!targetId || !tag) return false;
        if (tag.id === targetId) return true;
        // Check if tag is a child of targetId
        const parents = tag.parents ?? [];
        return parents.some((p: any) => p.id === targetId);
      };

      // Get scene marker tag IDs (including hierarchy)
      const markerTagIds = new Set<string>();
      const sceneMarkers = (props.scene as any).scene_markers ?? [];
      for (const marker of sceneMarkers) {
        // Check primary tag
        if (marker?.primary_tag) {
          if (sexTagId && tagMatches(marker.primary_tag, sexTagId)) markerTagIds.add(sexTagId);
          if (oralTagId && tagMatches(marker.primary_tag, oralTagId)) markerTagIds.add(oralTagId);
          if (soloTagId && tagMatches(marker.primary_tag, soloTagId)) markerTagIds.add(soloTagId);
          if (facialTagId && tagMatches(marker.primary_tag, facialTagId)) markerTagIds.add(facialTagId);
        }
        // Check secondary tags
        const markerTags = marker?.tags ?? [];
        for (const tag of markerTags) {
          if (sexTagId && tagMatches(tag, sexTagId)) markerTagIds.add(sexTagId);
          if (oralTagId && tagMatches(tag, oralTagId)) markerTagIds.add(oralTagId);
          if (soloTagId && tagMatches(tag, soloTagId)) markerTagIds.add(soloTagId);
          if (facialTagId && tagMatches(tag, facialTagId)) markerTagIds.add(facialTagId);
        }
      }

      // Priority: sex > oral > solo > facial
      if (sexTagId && markerTagIds.has(sexTagId)) {
        return {
          type: 'gay',
          className: "scene-gay-icon",
          title: "Scene has sex markers",
        };
      }
      
      if (oralTagId && markerTagIds.has(oralTagId)) {
        return {
          type: 'mouth',
          className: "scene-mouth-icon",
          title: "Scene has oral markers",
        };
      }

      if (soloTagId && markerTagIds.has(soloTagId)) {
        return {
          type: 'hand',
          icon: faHand,
          className: "scene-hand-icon",
          title: "Scene has solo markers"
        };
      }

      if (facialTagId && markerTagIds.has(facialTagId)) {
        return {
          type: 'goatee',
          className: "scene-goatee-icon",
          title: "Scene has facial markers"
        };
      }

      return null;
  }, [props.scene, configuration?.ui]);

    const pretitleIcon = useMemo(() => {
      const pieces: JSX.Element[] = [];
      if (iconToShow) {
        const t = (iconToShow as any).type as string | undefined;
        if (t === 'mouth' || t === 'gay' || t === 'straight' || t === 'goatee') {
          pieces.push(
            <img
              key="primary"
              src={t === 'gay' ? gaySvg : t === 'straight' ? straightSvg : t === 'goatee' ? goateeSvg : mouthSvg}
              alt={(iconToShow as any).title || (t === 'gay' ? 'Gay' : t === 'straight' ? 'Straight' : t === 'goatee' ? 'Facial' : 'Open Mouth')}
              title={(iconToShow as any).title}
              className={(iconToShow as any).className}
            />
          );
        } else {
          // fallback for hand/others using FontAwesome
          pieces.push(
            <Icon
              key="primary"
              icon={(iconToShow as any).icon!}
              className={(iconToShow as any).className}
              title={(iconToShow as any).title}
            />
          );
        }
      }
      if (pieces.length === 0) return undefined;
      return <>{pieces}</>;
    }, [iconToShow]);

    function zoomIndex() {
      if (!props.compact && props.zoomIndex !== undefined) {
        return `zoom-${props.zoomIndex}`;
      }

      return "";
    }

    function filelessClass() {
      if (!props.scene.files.length) {
        return "fileless";
      }

      return "";
    }

    function getRatingClass() {
      // Exclude home page from rating effects
      const isHomePage =
        window.location.pathname === "/" ||
        window.location.pathname === "/frontpage";
      if (isHomePage) return "";

      const rating = props.scene.rating100;
      // 5 stars = 100, 4 stars = 80, 3 stars = 60
      if (rating === 100) return "rating-5-stars";
      if (rating === 80) return "rating-4-stars";
      if (rating === 60) return "rating-3-stars";
      return "";
    }

    const cont = configuration?.interface.continuePlaylistDefault ?? false;

    const sceneLink = props.queue
      ? props.queue.makeLink(props.scene.id, {
          sceneIndex: props.index,
          continue: cont,
        })
      : `/scenes/${props.scene.id}`;

    return (
      <GridCard
        className={`scene-card ${zoomIndex()} ${filelessClass()} ${getRatingClass()}`}
        url={sceneLink}
        title={objectTitle(props.scene)}
        pretitleIcon={pretitleIcon}
        width={props.width}
        linkClassName="scene-card-link"
        thumbnailSectionClassName="video-section"
        resumeTime={props.scene.resume_time ?? undefined}
        duration={file?.duration ?? undefined}
        interactiveHeatmap={
          props.scene.interactive_speed
            ? props.scene.paths.interactive_heatmap ?? undefined
            : undefined
        }
        image={<SceneCardImage {...props} />}
        overlays={<SceneCardOverlays {...props} />}
        details={<SceneCardDetails {...props} />}
        popovers={<SceneCardPopovers {...props} />}
        selected={props.selected}
        selecting={props.selecting}
        onSelectedChanged={props.onSelectedChanged}
      />
    );
  }
);
