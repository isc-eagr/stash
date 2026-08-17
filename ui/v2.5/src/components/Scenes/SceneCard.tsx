import React, { useEffect, useMemo, useRef } from "react";
import { Button, ButtonGroup, OverlayTrigger, Tooltip } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import { GalleryLink, TagLink, SceneMarkerLink } from "../Shared/TagLink";
import { HoverPopover } from "../Shared/HoverPopover";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { SceneQueue } from "src/models/sceneQueue";
import { useConfigurationContext } from "src/hooks/Config";
import { SceneCardPerformerPopover } from "./SceneCardPerformerPopover_custom"; // CUSTOM
import { GridCard } from "../Shared/GridCard/GridCard";
import { RatingBanner } from "../Shared/RatingBanner";
import { RatingCriteriaTooltip } from "../Shared/RatingAdvisor_custom"; // CUSTOM
import { FormattedMessage } from "react-intl";
import {
  faBox,
  faCopy,
  faFilm,
  faHand, // CUSTOM
  faImages,
  faMapMarkerAlt,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { objectPath, objectTitle } from "src/core/files";
import { PreviewScrubber } from "./PreviewScrubber";
import { PatchComponent } from "src/patch";
import { StudioOverlay } from "../Shared/GridCard/StudioOverlay";
import { GroupTag } from "../Groups/GroupTag";
import { FileSize } from "../Shared/FileSize";
import { OCounterButton } from "../Shared/CountButton";
import { defaultPreviewVolume } from "src/core/config";
import {
  getRatingCardClass,
  isRatingCardHomePage,
} from "src/utils/ratingCardStyles_custom"; // CUSTOM
import { SceneCardInsights } from "./SceneCardInsights_custom"; // CUSTOM
import type { SceneCardInsightPerformerRoleStats } from "./sceneCardInsightsData_custom"; // CUSTOM
import { SortMetricBadgeCustom } from "../Shared/SortMetricBadge_custom"; // CUSTOM
import { getSceneSortMetricCustom } from "./sceneSortMetric_custom"; // CUSTOM
import {
  catalogCardSortHighlightClassCustom,
  hasCatalogCardSortValueCustom,
  isCatalogCardSortHighlightedCustom,
} from "../Shared/catalogCardSortHighlight_custom"; // CUSTOM
// CUSTOM: begin - role icon SVG imports
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";
import straightSvg from "src/assets/straight.svg";
import facialPng from "src/assets/facial.png"; // CUSTOM
// CUSTOM: end

interface IScenePreviewProps {
  isPortrait: boolean;
  image?: string;
  video?: string;
  soundActive: boolean;
  volume?: number;
  vttPath?: string;
  onScrubberClick?: (timestamp: number) => void;
  disabled?: boolean;
}

export const ScenePreview: React.FC<IScenePreviewProps> = ({
  image,
  video,
  isPortrait,
  soundActive,
  vttPath,
  onScrubberClick,
  disabled,
  volume,
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
      videoEl.current.volume = soundActive ? (volume ?? 0) / 100 : 0;
  }, [volume, soundActive]);

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
      <PreviewScrubber
        vttPath={vttPath}
        onClick={onScrubberClick}
        disabled={disabled}
      />
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
  activeSortBy?: string; // CUSTOM
  activeSortDirection?: GQL.SortDirectionEnum; // CUSTOM
  roleStatsByPerformer?: ReadonlyMap<
    string,
    SceneCardInsightPerformerRoleStats
  >; // CUSTOM
}

const Description: React.FC<{
  sceneNumber?: number;
  className?: string; // CUSTOM
}> = ({ sceneNumber, className }) => {
  if (!sceneNumber) return null;

  return (
    <>
      <hr />
      {sceneNumber !== undefined && (
        <span className={cx("scene-group-scene-number", className)}>
          <FormattedMessage id="scene" /> #{sceneNumber}
        </span>
      )}
    </>
  );
};

type SceneCardTitleIcon =
  | {
      type: "gay" | "mouth" | "straight" | "goatee";
      className: string;
      title: string;
    }
  | {
      type: "hand";
      icon: typeof faHand;
      className: string;
      title: string;
    };

// CUSTOM: begin - role tag icon hierarchy type
type SceneMarkerTag = {
  id?: string;
  parents?: SceneMarkerTag[];
};
// CUSTOM: end

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
      const highlighted = isCatalogCardSortHighlightedCustom(
        props.activeSortBy,
        "tag_count"
      );
      if (props.scene.tags.length <= 0 && !highlighted) return;

      const popoverContent = props.scene.tags.map((tag) => (
        <TagLink key={tag.id} tag={tag} />
      ));

      return (
        <HoverPopover
          className={cx(
            "tag-count",
            catalogCardSortHighlightClassCustom(props.activeSortBy, "tag_count")
          )} // CUSTOM
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
      const highlighted = isCatalogCardSortHighlightedCustom(
        props.activeSortBy,
        "performer_count"
      );
      if (props.scene.performers.length <= 0 && !highlighted) return;

      // CUSTOM
      return (
        <SceneCardPerformerPopover
          scene={props.scene}
          className={catalogCardSortHighlightClassCustom(
            props.activeSortBy,
            "performer_count"
          )}
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
      const highlighted = isCatalogCardSortHighlightedCustom(
        props.activeSortBy,
        "o_counter"
      );
      if (props.scene.o_counter || highlighted) {
        return (
          <OCounterButton
            className={catalogCardSortHighlightClassCustom(
              props.activeSortBy,
              "o_counter"
            )}
            value={props.scene.o_counter ?? 0}
          />
        );
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
      const highlightsVisiblePopoverMetric = isCatalogCardSortHighlightedCustom(
        props.activeSortBy,
        "tag_count",
        "performer_count",
        "o_counter",
        "group_scene_number"
      ); // CUSTOM
      // CUSTOM: keep insights visible even when the card has no popover controls
      const shouldRenderPopoverGroup =
        !props.compact &&
        (props.scene.tags.length > 0 ||
          props.scene.performers.length > 0 ||
          props.scene.groups.length > 0 ||
          props.scene.scene_markers.length > 0 ||
          props.scene?.o_counter ||
          props.scene.galleries.length > 0 ||
          props.scene.organized ||
          sceneNumber !== undefined ||
          highlightsVisiblePopoverMetric);

      return (
        <>
          {shouldRenderPopoverGroup && (
            <>
              <Description
                sceneNumber={sceneNumber}
                className={catalogCardSortHighlightClassCustom(
                  props.activeSortBy,
                  "group_scene_number"
                )}
              />
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
          )}
          {/* CUSTOM: render insights independently of popover controls */}
          <SceneCardInsights
            scene={props.scene}
            roleStatsByPerformer={props.roleStatsByPerformer}
          />
        </>
      );
    }

    return <>{maybeRenderPopoverButtonGroup()}</>;
  }
);

const SceneCardDetails = PatchComponent(
  "SceneCard.Details",
  (props: ISceneCardProps) => {
    const { configuration } = useConfigurationContext(); // CUSTOM
    const sortDirection =
      props.activeSortDirection ?? GQL.SortDirectionEnum.Asc; // CUSTOM
    const sortMetric = getSceneSortMetricCustom(
      props.activeSortBy,
      props.scene,
      sortDirection,
      configuration?.ui?.roleTagIds ?? {},
      props.fromGroupId
    ); // CUSTOM
    const file = props.scene.files[0];
    const contextualGroupSceneNumber = props.fromGroupId
      ? props.scene.groups.find(
          (sceneGroup) => sceneGroup.group.id === props.fromGroupId
        )?.scene_index
      : undefined; // CUSTOM
    const embeddedSortMetric =
      (!props.compact &&
        isCatalogCardSortHighlightedCustom(
          props.activeSortBy,
          "tag_count",
          "performer_count",
          "o_counter"
        )) ||
      (!props.compact &&
        hasCatalogCardSortValueCustom(contextualGroupSceneNumber) &&
        isCatalogCardSortHighlightedCustom(
          props.activeSortBy,
          "group_scene_number"
        )) ||
      (isCatalogCardSortHighlightedCustom(
        props.activeSortBy,
        "effective_date"
      ) &&
        hasCatalogCardSortValueCustom(props.scene.effective_date)) ||
      (isCatalogCardSortHighlightedCustom(props.activeSortBy, "duration") &&
        (file?.duration ?? 0) > 0) ||
      (isCatalogCardSortHighlightedCustom(props.activeSortBy, "resolution") &&
        !!file?.width &&
        !!file.height) ||
      (isCatalogCardSortHighlightedCustom(
        props.activeSortBy,
        "interactive_speed"
      ) &&
        hasCatalogCardSortValueCustom(props.scene.interactive_speed)) ||
      (isCatalogCardSortHighlightedCustom(props.activeSortBy, "rating") &&
        hasCatalogCardSortValueCustom(props.scene.rating100)); // CUSTOM

    return (
      <div className="scene-card__details">
        <SortMetricBadgeCustom
          metric={embeddedSortMetric ? undefined : sortMetric}
          sortDirection={sortDirection}
        />
        <span
          className={cx(
            "scene-card__date",
            hasCatalogCardSortValueCustom(props.scene.effective_date) &&
              catalogCardSortHighlightClassCustom(
                props.activeSortBy,
                "effective_date"
              )
          )}
        >
          {props.scene.effective_date ?? props.scene.date}
        </span>{" "}
        {/* CUSTOM: effective_date */}
        <span className="file-path extra-scene-info">
          {objectPath(props.scene)}
        </span>
        {/* CUSTOM: scene descriptions remain exclusive to scene detail pages */}
      </div>
    );
  }
);

// CUSTOM: begin - SceneCardOverlays rewrite for facial overlay
const SceneCardOverlays = PatchComponent(
  "SceneCard.Overlays",
  (props: ISceneCardProps) => {
    const { configuration } = useConfigurationContext();

    // Helper to check if a tag matches (including recursive parent/child relationships)
    const tagMatches = (
      tag: { id?: string; parents?: Array<{ id?: string }> } | null | undefined,
      targetId: string,
      visited: Set<string> = new Set()
    ): boolean => {
      if (!tag || !tag.id) return false;
      if (tag.id === targetId) return true;
      if (visited.has(tag.id)) return false;
      visited.add(tag.id);
      const parents = tag.parents ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return parents.some((p) => tagMatches(p as any, targetId, visited));
    };

    // Returns true if a marker has a given tag (primary or secondary, including subtags)
    const markerHasTag = (
      marker: GQL.SlimSceneDataFragment["scene_markers"][number],
      tagId: string
    ): boolean => {
      if (tagMatches(marker?.primary_tag, tagId)) return true;
      const markerTags: Array<{
        id?: string;
        parents?: Array<{ id?: string }>;
      }> = marker?.tags ?? [];
      return markerTags.some((t) => tagMatches(t, tagId));
    };

    // Check if scene has facial markers based on configured facial tag ID (including subtags)
    const hasFacial = useMemo(() => {
      const roleTagIds = configuration?.ui?.roleTagIds ?? {};
      const { facialTagId } = roleTagIds;
      if (!facialTagId) return false;
      const sceneMarkers = props.scene.scene_markers ?? [];
      return sceneMarkers.some((marker) => markerHasTag(marker, facialTagId));
    }, [props.scene, configuration?.ui]); // eslint-disable-line react-hooks/exhaustive-deps

    // Check if scene has a marker with BOTH facial tag AND really hot tag (gold facial icon)
    const hasReallyHotFacial = useMemo(() => {
      const roleTagIds = configuration?.ui?.roleTagIds ?? {};
      const { facialTagId, reallyHotTagId } = roleTagIds;
      if (!facialTagId || !reallyHotTagId) return false;
      const sceneMarkers = props.scene.scene_markers ?? [];
      return sceneMarkers.some(
        (marker) =>
          markerHasTag(marker, facialTagId) &&
          markerHasTag(marker, reallyHotTagId)
      );
    }, [props.scene, configuration?.ui]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <>
        <StudioOverlay studio={props.scene.studio} disabled={props.selecting} />
        {hasReallyHotFacial && (
          <img
            className="scene-facial-overlay scene-facial-overlay--gold"
            src={facialPng}
            alt="Facial (Really Hot)"
            title="Really hot facial marker present"
          />
        )}
        {!hasReallyHotFacial && hasFacial && (
          <img
            className="scene-facial-overlay"
            src={facialPng}
            alt="Facial"
            title="Facial tags present"
          />
        )}
      </>
    );
  }
);
// CUSTOM: end

interface ISceneSpecsOverlay {
  scene: GQL.SlimSceneDataFragment;
  activeSortBy?: string; // CUSTOM
}

export const SceneSpecsOverlay: React.FC<ISceneSpecsOverlay> = PatchComponent(
  "SceneCard.SceneSpecs",
  ({ scene, activeSortBy }) => {
    const file = scene.files?.[0];
    if (!file) return null;
    return (
      <div className="scene-specs-overlay">
        <span className="overlay-filesize extra-scene-info">
          <FileSize size={file.size} />
        </span>
        {file.width && file.height ? (
          <span
            className={cx(
              "overlay-resolution",
              catalogCardSortHighlightClassCustom(activeSortBy, "resolution")
            )}
          >
            {TextUtils.resolution(file.width, file.height)}
          </span>
        ) : (
          ""
        )}
        {file.duration > 0 ? (
          <span
            className={cx(
              "overlay-duration",
              catalogCardSortHighlightClassCustom(activeSortBy, "duration")
            )}
          >
            {TextUtils.secondsToTimestamp(file.duration)}
          </span>
        ) : (
          ""
        )}
      </div>
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

    function maybeRenderInteractiveSpeedOverlay() {
      return (
        <div
          className={cx(
            "scene-interactive-speed-overlay",
            catalogCardSortHighlightClassCustom(
              props.activeSortBy,
              "interactive_speed"
            )
          )}
        >
          {props.scene.interactive_speed ?? ""}
        </div>
      );
    }

    function onScrubberClick(timestamp: number) {
      if (props.selecting) return;
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
          volume={configuration?.ui.previewVolume ?? defaultPreviewVolume}
          vttPath={props.scene.paths.vtt ?? undefined}
          onScrubberClick={onScrubberClick}
          disabled={props.selecting}
        />
        {/* CUSTOM: begin - rating criteria hover summary */}
        {props.scene.rating100 !== undefined &&
        props.scene.rating100 !== null ? (
          <RatingCriteriaTooltip
            entityType="scene"
            entityId={props.scene.id}
            triggerClassName="rating-criteria-tooltip-card-trigger"
          >
            <RatingBanner
              rating={props.scene.rating100}
              compact
              className={catalogCardSortHighlightClassCustom(
                props.activeSortBy,
                "rating"
              )}
            />
          </RatingCriteriaTooltip>
        ) : null}
        {/* CUSTOM: end */}
        <SceneSpecsOverlay
          scene={props.scene}
          activeSortBy={props.activeSortBy}
        />
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

    // CUSTOM: begin - role tag icon logic
    // Determine which icon to show based on scene markers with role tags
    const iconToShow = useMemo<SceneCardTitleIcon | null>(() => {
      // Get role tag IDs from configuration
      const roleTagIds = configuration?.ui?.roleTagIds ?? {};
      const { sexTagId } = roleTagIds;
      const { oralTagId } = roleTagIds;
      const { soloTagId } = roleTagIds;
      const { facialTagId } = roleTagIds;

      // Helper to check if a tag matches (including recursive parent/child relationships)
      // Returns true if tag.id === targetId OR any ancestor of tag has id === targetId
      const tagMatches = (
        tag: SceneMarkerTag | null | undefined,
        targetId: string | undefined,
        visited: Set<string> = new Set()
      ): boolean => {
        if (!targetId || !tag?.id) return false;
        if (tag.id === targetId) return true;
        // Prevent infinite loops
        if (visited.has(tag.id)) return false;
        visited.add(tag.id);
        // Recursively check all parents (ancestors)
        const parents = tag.parents ?? [];
        return parents.some((p) => tagMatches(p, targetId, visited));
      };

      // Get scene marker tag IDs (including hierarchy)
      const markerTagIds = new Set<string>();
      const sceneMarkers = props.scene.scene_markers ?? [];
      for (const marker of sceneMarkers) {
        // Determine if this marker is an oral marker
        let isOralMarker = false;
        if (
          marker?.primary_tag &&
          oralTagId &&
          tagMatches(marker.primary_tag, oralTagId)
        ) {
          isOralMarker = true;
        }
        if (!isOralMarker) {
          const markerTags = marker?.tags ?? [];
          for (const tag of markerTags) {
            if (oralTagId && tagMatches(tag, oralTagId)) {
              isOralMarker = true;
              break;
            }
          }
        }

        // Add oral markers to tag set
        if (isOralMarker && oralTagId) {
          markerTagIds.add(oralTagId);
        }

        // Check primary tag for non-oral tags
        if (marker?.primary_tag) {
          if (sexTagId && tagMatches(marker.primary_tag, sexTagId))
            markerTagIds.add(sexTagId);
          if (soloTagId && tagMatches(marker.primary_tag, soloTagId))
            markerTagIds.add(soloTagId);
          if (facialTagId && tagMatches(marker.primary_tag, facialTagId))
            markerTagIds.add(facialTagId);
        }
        // Check secondary tags for non-oral tags
        const markerTags = marker?.tags ?? [];
        for (const tag of markerTags) {
          if (sexTagId && tagMatches(tag, sexTagId)) markerTagIds.add(sexTagId);
          if (soloTagId && tagMatches(tag, soloTagId))
            markerTagIds.add(soloTagId);
          if (facialTagId && tagMatches(tag, facialTagId))
            markerTagIds.add(facialTagId);
        }
      }

      // Priority: sex > oral > solo > facial
      if (sexTagId && markerTagIds.has(sexTagId)) {
        return {
          type: "gay",
          className: "scene-gay-icon",
          title: "Scene has sex markers",
        };
      }

      if (oralTagId && markerTagIds.has(oralTagId)) {
        return {
          type: "mouth",
          className: "scene-mouth-icon",
          title: "Scene has oral markers",
        };
      }

      if (soloTagId && markerTagIds.has(soloTagId)) {
        return {
          type: "hand",
          icon: faHand,
          className: "scene-hand-icon",
          title: "Scene has solo markers",
        };
      }

      // Note: facial is intentionally not included here - it shows in the overlay instead
      return null;
    }, [props.scene, configuration?.ui]);

    const pretitleIcon = useMemo(() => {
      const pieces: JSX.Element[] = [];
      if (iconToShow) {
        if (iconToShow.type === "hand") {
          pieces.push(
            <Icon
              key="primary"
              icon={iconToShow.icon}
              className={iconToShow.className}
              title={iconToShow.title}
            />
          );
        } else {
          pieces.push(
            <img
              key="primary"
              src={
                iconToShow.type === "gay"
                  ? gaySvg
                  : iconToShow.type === "straight"
                  ? straightSvg
                  : iconToShow.type === "goatee"
                  ? facialPng
                  : mouthSvg
              }
              alt={iconToShow.title}
              title={iconToShow.title}
              className={iconToShow.className}
            />
          );
        }
      }
      if (pieces.length === 0) return undefined;
      return <>{pieces}</>;
    }, [iconToShow]);
    // CUSTOM: end

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

    // CUSTOM: begin - rating-based card styling
    function getRatingClass() {
      return getRatingCardClass({
        rating: props.scene.rating100,
        tags: props.scene.tags,
        goatTagId: configuration?.ui?.roleTagIds?.goatTagId,
        theme: configuration?.ui?.ratingCardTheme,
        thresholds: configuration?.ui?.ratingCardThresholds,
        overrideTagIds: configuration?.ui?.ratingCardOverrideTagIds,
        disabled: isRatingCardHomePage(),
      });
    }
    // CUSTOM: end

    const cont = configuration?.interface.continuePlaylistDefault ?? false;

    const sceneLink = props.queue
      ? props.queue.makeLink(props.scene.id, {
          sceneIndex: props.index,
          continue: cont,
        })
      : `/scenes/${props.scene.id}`;

    return (
      <GridCard
        className={`scene-card ${zoomIndex()} ${filelessClass()} ${getRatingClass()}`} // CUSTOM: getRatingClass
        url={sceneLink}
        title={objectTitle(props.scene)}
        pretitleIcon={pretitleIcon} // CUSTOM
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
