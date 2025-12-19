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
import { useConfigurationContext, ConfigurationContext } from "src/hooks/Config";
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

    // Green PST (performer_scene_tags) button: shows all tags present on this scene via performer_scene_tags
    function maybeRenderPerformerSceneTagsPopoverButton() {
      // Only query if scene has performers (otherwise this button won't render anyway)
      const hasPerformers = props.scene.performers.length > 0;
      
      // Use existing FindScene query hook which includes performers.scene_tags(scene_id: $id)
      // Skip the query if there are no performers to avoid unnecessary queries
      const { data } = GQL.useFindSceneQuery({
        variables: { id: props.scene.id },
        fetchPolicy: "cache-first",
        skip: !hasPerformers,
      });

      // Aggregate unique tags across all performers for this scene
      const { tags, counts } = useMemo(() => {
        const uppercaseFirstComparator = (aName: string, bName: string) => {
          const aN = aName ?? "";
          const bN = bName ?? "";
          const isAUpper = !!(
            aN[0] && aN[0] !== aN[0].toLowerCase() && aN[0] === aN[0].toUpperCase()
          );
          const isBUpper = !!(
            bN[0] && bN[0] !== bN[0].toLowerCase() && bN[0] === bN[0].toUpperCase()
          );
          if (isAUpper !== isBUpper) return isAUpper ? -1 : 1;
          const lowerCmp = aN
            .toLowerCase()
            .localeCompare(bN.toLowerCase(), undefined, { sensitivity: "base" });
          if (lowerCmp !== 0) return lowerCmp;
          return aN.localeCompare(bN);
        };

        const m = new Map<string, { id: string; name: string }>();
        const countMap = new Map<string, number>();
        const performers = data?.findScene?.performers ?? [];
        for (const p of performers) {
          const t = (p as any).scene_tags as Array<{ id: string; name: string }> | undefined;
          if (!t) continue;
          for (const tag of t) {
            if (tag?.id && !m.has(tag.id)) {
              m.set(tag.id, { id: tag.id, name: tag.name });
            }
            if (tag?.id) {
              countMap.set(tag.id, (countMap.get(tag.id) ?? 0) + 1);
            }
          }
        }
        // alphabetic with uppercase-first ordering
        const sorted = Array.from(m.values()).sort((a, b) =>
          uppercaseFirstComparator(a.name ?? "", b.name ?? "")
        );
        return { tags: sorted, counts: countMap };
      }, [data]);

  if (!tags || tags.length === 0) return;

      const popoverContent = (
        <div className="tag-tooltip">
          {tags.map((t) => {
            const c = counts.get(t.id) ?? 0;
            return (
              <Badge key={t.id} className="tag-item" variant="secondary">
                {t.name}
                {c > 0 ? ` (${c})` : ""}
              </Badge>
            );
          })}
        </div>
      );

      return (
        <HoverPopover
          className="tag-count performer-green"
          placement="top"
          content={popoverContent}
        >
          {/* Non-linking green tag button with count */}
          <Button className="minimal performer-green">
            <Icon icon={faTag} />
            <span>{tags.length}</span>
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
              {maybeRenderPerformerSceneTagsPopoverButton()}
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
    const { configuration } = React.useContext(ConfigurationContext);
    // Determine if the scene has any facial tags (facialgiven/facialreceived)
    const { data: sceneData } = GQL.useFindSceneQuery({
      variables: { id: props.scene.id },
      fetchPolicy: "cache-first",
    });

    const hasFacial = useMemo(() => {
      const performers = sceneData?.findScene?.performers ?? [];
      if (performers.length === 0) return false;
      const allTags = new Set<string>();
      for (const p of performers) {
        const sceneTags = (p as any).scene_tags as Array<{ id: string; name: string }> | undefined;
        if (sceneTags) {
          for (const tag of sceneTags) {
            if (tag?.name) allTags.add((tag.name || "").toLowerCase());
          }
        }
      }
      const cfg = (configuration?.ui as any)?.sceneTagAliases ?? {};
      const tagFacialGiven = (cfg.facialgiven ?? "facialgiven").toLowerCase();
      const tagFacialReceived = (cfg.facialreceived ?? "facialreceived").toLowerCase();
      const tagSelfFacial = (cfg.selffacial ?? "selffacial").toLowerCase();
      return allTags.has(tagFacialGiven) || allTags.has(tagFacialReceived) || allTags.has(tagSelfFacial);
    }, [sceneData, configuration?.ui]);

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

    // Hook to determine if scene should show hand icon based on performer_scene_tags
    const shouldShowHandIcon = useMemo(() => {
      // Only check if scene has performers
      const hasPerformers = props.scene.performers.length > 0;
      if (!hasPerformers) return false;

      // Query the scene data to get performer_scene_tags
      // We'll use a separate effect to avoid hooks in conditionals
      return true; // Placeholder, will be determined by actual query
    }, [props.scene.performers.length]);

    // Fetch scene tags for performers if needed
    const { data: sceneData } = GQL.useFindSceneQuery({
      variables: { id: props.scene.id },
      fetchPolicy: "cache-first",
      skip: !shouldShowHandIcon,
    });

    // Determine which icon to show based on scene tags (highest precedence: straight) and performer_scene_tags
    const iconToShow = useMemo(() => {
      // Highest precedence: check scene.tags for straight
      const cfg = configuration?.ui?.sceneTagAliases ?? {};
      const tagStraight = (cfg.straight ?? "straight").toLowerCase();
      const sceneTagNames = (props.scene.tags ?? []).map((t) => (t?.name ?? "").toLowerCase());
      if (sceneTagNames.includes(tagStraight)) {
        return {
          type: 'straight',
          className: 'scene-straight-icon',
          title: 'Scene contains straight tag',
        } as const;
      }

      if (!sceneData?.findScene?.performers) return null;

      const performers = sceneData.findScene.performers;
      const allTags = new Set<string>();

      // Collect all unique tag names from performer_scene_tags
      for (const p of performers) {
        const sceneTags = (p as any).scene_tags as Array<{ id: string; name: string }> | undefined;
        if (sceneTags) {
          for (const tag of sceneTags) {
            if (tag?.name) {
              allTags.add(tag.name.toLowerCase());
            }
          }
        }
      }

  const tagsArray = Array.from(allTags);

  const cfg2 = configuration?.ui?.sceneTagAliases ?? {};
  const tagTop = (cfg2.top ?? "top").toLowerCase();
  const tagBottom = (cfg2.bottom ?? "bottom").toLowerCase();
  const tagOralBottom = (cfg2.oralbottom ?? "oralbottom").toLowerCase();
  const tagOralTop = (cfg2.oraltop ?? "oraltop").toLowerCase();
  const tagSolo = (cfg2.solo ?? "solo").toLowerCase();

  // Check for mouth icon conditions (prioritized)
  const hasOralBottomTag = tagsArray.includes(tagOralBottom);
  const hasOralTopTag = tagsArray.includes(tagOralTop);
  const hasTopTag = tagsArray.includes(tagTop);
  const hasBottomTag = tagsArray.includes(tagBottom);
      // Highest precedence: gay icon if Top and/or Bottom present
      if (hasTopTag || hasBottomTag) {
        return {
          type: 'gay',
          className: "scene-gay-icon",
          title: "Scene contains top/bottom tags",
        };
      }
      if ((hasOralBottomTag || hasOralTopTag) && !hasTopTag && !hasBottomTag) {
        return {
          type: 'mouth',
          className: "scene-mouth-icon",
          title: "Scene contains oral tags",
        };
      }

      // Check for hand icon conditions (secondary)
  const hasSoloTag = tagsArray.includes(tagSolo) || tagsArray.some(tag => tag.includes(tagSolo));

      if (hasSoloTag && !hasTopTag && !hasBottomTag && !hasOralBottomTag && !hasOralTopTag) {
        return {
          type: 'hand',
          icon: faHand,
          className: "scene-hand-icon",
          title: "Scene contains solo tags"
        };
      }

      return null;
  }, [sceneData, configuration?.ui]);

    const pretitleIcon = useMemo(() => {
      const pieces: JSX.Element[] = [];
      if (iconToShow) {
        const t = (iconToShow as any).type as string | undefined;
        if (t === 'mouth' || t === 'gay' || t === 'straight') {
          pieces.push(
            <img
              key="primary"
              src={t === 'gay' ? gaySvg : t === 'straight' ? straightSvg : mouthSvg}
              alt={(iconToShow as any).title || (t === 'gay' ? 'Gay' : t === 'straight' ? 'Straight' : 'Open Mouth')}
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
