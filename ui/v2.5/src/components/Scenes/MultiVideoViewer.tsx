import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Helmet } from "react-helmet";
import { useIntl } from "react-intl";
import { Button } from "react-bootstrap";
import videojs, { VideoJsPlayer, VideoJsPlayerOptions } from "video.js";
import { UAParser } from "ua-parser-js";
import "videojs-mobile-ui";
import "videojs-seek-buttons";
// Transcoded fallback streams need the offset middleware to seek correctly.
import "src/components/ScenePlayer/live";
import "src/components/ScenePlayer/source-selector";
import "src/components/ScenePlayer/vtt-thumbnails";
import "src/components/ScenePlayer/seek-buttons";
import "src/components/ScenePlayer/big-buttons";
import MarkersPlugin, {
  IMarker,
  INegativeMarker,
} from "src/components/ScenePlayer/markers";
import "src/components/ScenePlayer/multi-segment-loop";
import type MultiSegmentLoopPlugin from "src/components/ScenePlayer/multi-segment-loop";
import { useMultiSegmentLoop } from "src/components/ScenePlayer/useMultiSegmentLoop_custom";
import { useMultiSegmentLoopPresets } from "src/components/ScenePlayer/useMultiSegmentLoopPresets_custom";
import { MultiSegmentLoopButtons } from "src/components/ScenePlayer/MultiSegmentLoopButtons";
import { MultiSegmentLoopEditor } from "src/components/ScenePlayer/MultiSegmentLoopEditor";
import { showMultiSegmentLoopControlsCustom } from "src/components/ScenePlayer/multiSegmentLoopSettings_custom";
import { ModalComponent } from "src/components/Shared/Modal";
import "src/components/ScenePlayer/styles.scss";
import {
  faArrowDown,
  faArrowUp,
  faCompress,
  faExpand,
  faExternalLinkAlt,
  faThLarge,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import cx from "classnames";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import {
  DEFAULT_IMAGE_TRANSFORM,
  DraggableImage,
  IImageCrop,
  IImageTransform,
} from "src/components/Images/DraggableImageOverlay_custom";
import {
  clampLayouts,
  clampPanelRect,
  IPanelBounds,
  IPanelLayout,
  IPanelRect,
  IPanelSizeLimits,
  lowerPanel,
  PanelGesture,
  PanelLayouts,
  raisePanel,
  resizePanelRect,
  setPanelAspectRatio,
  syncPanelLayouts,
  tileLayouts,
  trackPointerDrag,
} from "src/components/Viewers/viewerPanels_custom";
import { useConfigurationContext } from "src/hooks/Config";
import ScreenUtils from "src/utils/screen";
import "./MarkerViewer.scss";

void MarkersPlugin;

export interface IVideoViewerSource {
  src: string;
  type?: string | null;
  label?: string | null;
  offset?: boolean;
}

export interface IVideoViewerTextTrack {
  src: string;
  kind: string;
  srclang?: string;
  label?: string;
  default?: boolean;
}

export interface IVideoViewerOTimestamp {
  ts: number;
  date?: string | null;
}

export interface IVideoViewerSegmentPreset {
  id?: string;
  name: string;
  enabled: boolean;
  currentSegmentIndex: number;
  segments: Array<{
    start: number;
    end: number;
    title?: string;
  }>;
}

interface IPerformerHoverPerformer {
  id: string;
  name: string;
  image_path?: string | null;
  disambiguation?: string | null;
}

export interface IVideoViewerItem {
  id: string;
  streamUrl: string;
  title: string;
  sceneId?: string;
  // Opens the item in Stash (scene page at the marker time).
  openUrl?: string;
  // Marker panels loop startTime..endTime (20s when there is no end).
  startTime?: number;
  endTime?: number | null;
  posterUrl?: string | null;
  vttUrl?: string | null;
  duration?: number;
  sources?: IVideoViewerSource[];
  textTracks?: IVideoViewerTextTrack[];
  timelineMarkers?: IMarker[];
  negativeMarkers?: INegativeMarker[];
  oTimestamps?: IVideoViewerOTimestamp[];
  segmentPresets?: IVideoViewerSegmentPreset[];
  topPerformers?: IPerformerHoverPerformer[];
  bottomPerformers?: IPerformerHoverPerformer[];
}

export interface IImageViewerItem {
  id: string;
  url: string;
  title: string;
  openUrl?: string;
}

const HEADER_H = 50;
const VIDEO_ASPECT_RATIO = 16 / 9;
const MARKER_LOOP_FALLBACK_SECONDS = 20;
const VIDEO_LIMITS: IPanelSizeLimits = { minWidth: 200, minHeight: 112 };

type DragPanelHandler = (
  id: string,
  gesture: PanelGesture,
  start: IPanelRect,
  dx: number,
  dy: number,
  limits: IPanelSizeLimits
) => void;

function getOrderedItems<T extends { id: string }>(
  allItems: T[],
  orderedIds: string[]
) {
  const byId = new Map(allItems.map((item) => [item.id, item]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);
}

function isDashSource(source: IVideoViewerSource) {
  return (
    source.type === "application/dash+xml" ||
    source.src.toLowerCase().includes(".mpd")
  );
}

interface IVideoJsPanelProps {
  item: IVideoViewerItem;
  onAspectRatio: (id: string, aspectRatio: number) => void;
}

const VideoJsPanelComponent: React.FC<IVideoJsPanelProps> = ({
  item,
  onAspectRatio,
}) => {
  const intl = useIntl();
  const { configuration } = useConfigurationContext();
  const uiConfig = configuration?.ui;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VideoJsPlayer>();
  const reportAspectRatioRef = useRef((aspectRatio: number) =>
    onAspectRatio(item.id, aspectRatio)
  );
  const lastNegativeSkipRef = useRef(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [loopPlugin, setLoopPlugin] = useState<MultiSegmentLoopPlugin>();
  const [loopControlEl, setLoopControlEl] = useState<HTMLElement>();
  const [showLoopEditor, setShowLoopEditor] = useState(false);
  const { startTime, endTime } = item;
  const showLoopControls =
    showMultiSegmentLoopControlsCustom(uiConfig) && startTime === undefined;
  const [negativeMarkerSkipEnabled, setNegativeMarkerSkipEnabled] =
    useState(true);
  const loop = useMultiSegmentLoop(loopPlugin, item.negativeMarkers);
  const loopPresetSource = useMemo(
    () => item.segmentPresets ?? [],
    [item.segmentPresets]
  );
  const loopPresets = useMultiSegmentLoopPresets(
    { sceneId: item.sceneId },
    loopPresetSource,
    loop
  );

  useEffect(() => {
    reportAspectRatioRef.current = (aspectRatio: number) =>
      onAspectRatio(item.id, aspectRatio);
  }, [item.id, onAspectRatio]);

  const getPlayer = useCallback(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return null;
    return player;
  }, []);

  const getMultiSegmentPlugin = useCallback(() => {
    const player = getPlayer();
    return player?.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
  }, [getPlayer]);

  // The player lives as long as the panel; media changes reuse it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const videoEl = document.createElement("video-js");
    videoEl.setAttribute("data-vjs-player", "true");
    videoEl.setAttribute("crossorigin", "anonymous");
    videoEl.classList.add("mv-video", "vjs-big-play-centered");
    container.appendChild(videoEl);

    const options: VideoJsPlayerOptions = {
      controls: true,
      autoplay: true,
      loop: true,
      muted: true,
      preload: "auto",
      playsinline: true,
      controlBar: {
        pictureInPictureToggle: false,
        volumePanel: {
          inline: false,
        },
        chaptersButton: false,
      },
      html5: {
        dash: {
          updateSettings: [
            {
              streaming: {
                buffer: {
                  bufferTimeAtTopQuality: 30,
                  bufferTimeAtTopQualityLongForm: 30,
                },
                gaps: {
                  jumpGaps: false,
                  jumpLargeGaps: false,
                },
              },
            },
          ],
        },
      },
      nativeControlsForTouch: false,
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      inactivityTimeout: 700,
      plugins: {
        markers: {},
        vttThumbnails: {
          showTimestamp: true,
        },
        sourceSelector: {},
        bigButtons: {},
        seekButtonsMenu: {
          forward: 10,
          back: 10,
        },
        multiSegmentLoop: {
          segments: [],
          enabled: false,
          currentSegmentIndex: 0,
        },
      },
    };

    const player = videojs(videoEl, options);
    playerRef.current = player;

    player.ready(() => {
      if (!player.isDisposed()) setPlayerReady(true);
    });

    const isSafari = UAParser().browser.name?.includes("Safari");
    if (!isSafari) {
      player.mobileUi({
        fullscreen: {
          enterOnRotate: true,
          exitOnRotate: true,
          lockOnRotate: false,
        },
        touchControls: {
          disabled: true,
        },
      });
    }

    player.on("loadedmetadata", () => {
      const videoWidth = player.videoWidth();
      const videoHeight = player.videoHeight();
      if (videoWidth && videoHeight) {
        reportAspectRatioRef.current(videoWidth / videoHeight);
      }
    });

    return () => {
      player.dispose();
      playerRef.current = undefined;
    };
  }, []);

  // Media is applied once the player exists; DASH support loads on demand.
  useEffect(() => {
    const player = getPlayer();
    if (!playerReady || !player) return;

    let cancelled = false;
    const sources =
      item.sources && item.sources.length > 0
        ? item.sources
        : [{ src: item.streamUrl }];

    async function applyMedia(target: VideoJsPlayer) {
      if (sources.some(isDashSource)) {
        await import("videojs-contrib-dash");
      }
      if (cancelled || target.isDisposed()) return;

      const sourceSelector = target.sourceSelector();
      sourceSelector.setSources(
        sources.map((source) => ({
          src: source.src,
          type: source.type ?? undefined,
          label: source.label ?? undefined,
          offset: source.offset ?? false,
          duration: item.duration,
        }))
      );
      (item.textTracks ?? []).forEach((track) => {
        sourceSelector.addTextTrack(track as videojs.TextTrackOptions, false);
      });

      target.poster(item.posterUrl ?? "");
      target.vttThumbnails?.().src(item.vttUrl ?? null);

      if (startTime !== undefined) {
        target.one("loadedmetadata", () => target.currentTime(startTime));
      }
      target.load();
      target.play()?.catch(() => {});
    }

    applyMedia(player);

    return () => {
      cancelled = true;
    };
  }, [
    getPlayer,
    playerReady,
    item.duration,
    item.posterUrl,
    item.sources,
    item.streamUrl,
    item.textTracks,
    item.vttUrl,
    startTime,
  ]);

  // Marker panels keep playback inside the marker range.
  useEffect(() => {
    const player = getPlayer();
    if (!playerReady || !player || startTime === undefined) return;

    const loopEnd =
      endTime && endTime > startTime
        ? endTime
        : startTime + MARKER_LOOP_FALLBACK_SECONDS;

    const keepInRange = () => {
      if (player.seeking()) return;
      const currentTime = player.currentTime();
      if (currentTime < startTime - 0.25 || currentTime >= loopEnd) {
        player.currentTime(startTime);
      }
    };

    player.on("timeupdate", keepInRange);
    return () => {
      player.off("timeupdate", keepInRange);
    };
  }, [endTime, getPlayer, playerReady, startTime]);

  // Share the ready player's loop plugin with the menu and editor.
  useEffect(() => {
    setLoopPlugin(playerReady ? getMultiSegmentPlugin() : undefined);
  }, [getMultiSegmentPlugin, playerReady]);

  // Host for the loop button/menu, placed left of the playback rate button.
  useEffect(() => {
    const controlBar = getPlayer()?.el()?.querySelector(".vjs-control-bar");
    if (!playerReady || !controlBar || !showLoopControls) return;

    const host = document.createElement("div");
    host.className = "vjs-control vjs-multi-segment-loop-control";
    const playbackRateBtn = controlBar.querySelector(".vjs-playback-rate");
    const fullscreenBtn = controlBar.querySelector(".vjs-fullscreen-control");
    controlBar.insertBefore(host, playbackRateBtn ?? fullscreenBtn);
    setLoopControlEl(host);

    return () => {
      host.remove();
      setLoopControlEl(undefined);
    };
  }, [getPlayer, playerReady, showLoopControls]);

  useEffect(() => {
    const player = getPlayer();
    const controlBar = player?.el()?.querySelector(".vjs-control-bar");
    if (!playerReady || !player || !controlBar) return;

    const existingButton = controlBar.querySelector(
      ".vjs-negative-marker-skip-btn"
    );
    existingButton?.remove();

    if (!item.negativeMarkers?.length) return;

    const skipButton = document.createElement("div");
    skipButton.className = "vjs-negative-marker-skip-btn vjs-button";
    skipButton.setAttribute("role", "button");
    skipButton.tabIndex = 0;
    skipButton.setAttribute("title", "Toggle Skip Negative Markers");

    const skipIcon = document.createElement("span");
    skipIcon.className = "vjs-icon-placeholder";
    skipIcon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor"><path d="M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416V96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4l192 160L224 224V96c0-12.4 7.2-23.7 18.4-29s24.5-3.6 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4s-18.4-16.6-18.4-29V288l-20.5 17.1-192 160z"/></svg>';
    skipButton.appendChild(skipIcon);
    skipButton.classList.toggle(
      "vjs-negative-skip-active",
      negativeMarkerSkipEnabled
    );

    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
      setNegativeMarkerSkipEnabled((previous) => {
        const next = !previous;
        skipButton.classList.toggle("vjs-negative-skip-active", next);
        return next;
      });
    };

    skipButton.addEventListener("click", handleClick);

    const loopControl = controlBar.querySelector(
      ".vjs-multi-segment-loop-control"
    );
    if (loopControl) {
      controlBar.insertBefore(skipButton, loopControl);
    } else {
      const playbackRateBtn = controlBar.querySelector(".vjs-playback-rate");
      if (playbackRateBtn) {
        controlBar.insertBefore(skipButton, playbackRateBtn);
      } else {
        controlBar.appendChild(skipButton);
      }
    }

    return () => {
      skipButton.removeEventListener("click", handleClick);
      skipButton.remove();
    };
  }, [getPlayer, negativeMarkerSkipEnabled, item.negativeMarkers, playerReady]);

  const loadTimelineMarkers = useCallback(() => {
    const player = getPlayer();
    if (!player) return;

    const markers = player.markers?.();
    if (!markers) return;

    markers.clearMarkers();
    if (item.duration) {
      markers.setFallbackDuration(item.duration);
    }

    const markerData = item.timelineMarkers ?? [];
    const uniqueTagNames = markerData
      .map((marker) => marker.primaryTag.name)
      .filter((value, index, self) => self.indexOf(value) === index);
    // CUSTOM: use the configured solo role ID for its shared scrubber color.
    const soloTagId = uiConfig?.roleTagIds?.soloTagId;
    const soloTagNames = soloTagId
      ? markerData
          .filter((marker) => marker.primaryTag.id === soloTagId)
          .map((marker) => marker.primaryTag.name)
      : [];
    markers.findColors(uniqueTagNames, soloTagNames); // CUSTOM

    const showRangeTags =
      !ScreenUtils.isMobile() && (uiConfig?.showRangeMarkers ?? true);
    const timestampMarkers: IMarker[] = [];
    const rangeMarkers: IMarker[] = [];

    markerData.forEach((marker) => {
      if (!showRangeTags || marker.end_seconds === null) {
        timestampMarkers.push(marker);
      } else {
        rangeMarkers.push(marker);
      }
    });

    requestAnimationFrame(() => {
      markers.addDotMarkers(timestampMarkers);
      markers.addRangeMarkers(rangeMarkers);
      markers.addNegativeMarkers(item.negativeMarkers ?? []);
      markers.addOTimestampMarkers(
        (item.oTimestamps ?? []).map((entry) => ({
          ts: entry.ts,
          date: entry.date ?? "",
        }))
      );
    });
  }, [
    getPlayer,
    item.duration,
    item.negativeMarkers,
    item.oTimestamps,
    item.timelineMarkers,
    uiConfig?.showRangeMarkers,
    uiConfig?.roleTagIds?.soloTagId,
  ]);

  useEffect(() => {
    const player = getPlayer();
    if (!playerReady || !player) return;

    loadTimelineMarkers();
    player.on("loadedmetadata", loadTimelineMarkers);

    return () => {
      player.off("loadedmetadata", loadTimelineMarkers);
      if (!player.isDisposed()) {
        player.markers?.().clearMarkers();
      }
    };
  }, [getPlayer, loadTimelineMarkers, playerReady]);

  useEffect(() => {
    const player = getPlayer();
    const negativeMarkers = item.negativeMarkers ?? [];
    if (!playerReady || !player || negativeMarkers.length === 0) return;

    function checkNegativeMarkers(this: VideoJsPlayer) {
      if (!negativeMarkerSkipEnabled || this.paused()) return;

      const currentTime = this.currentTime();
      const now = Date.now();
      if (now - lastNegativeSkipRef.current < 500) return;

      for (const marker of negativeMarkers) {
        if (
          currentTime >= marker.start_seconds &&
          currentTime < marker.end_seconds
        ) {
          lastNegativeSkipRef.current = now;
          this.currentTime(marker.end_seconds);
          break;
        }
      }
    }

    player.on("timeupdate", checkNegativeMarkers);

    return () => {
      player.off("timeupdate", checkNegativeMarkers);
    };
  }, [getPlayer, negativeMarkerSkipEnabled, item.negativeMarkers, playerReady]);

  const portalTarget =
    document.fullscreenElement instanceof HTMLElement
      ? document.fullscreenElement
      : document.body;

  return (
    <>
      <div
        ref={containerRef}
        className="mv-video"
        style={{ position: "relative" }}
      />
      {loopPlugin && loopControlEl && (
        <MultiSegmentLoopButtons
          container={loopControlEl}
          loop={loop}
          presetCount={loopPresets.presets.length}
          editorOpen={showLoopEditor}
          onEditorOpenChange={setShowLoopEditor}
        />
      )}
      <ModalComponent
        show={showLoopEditor}
        header={intl.formatMessage({ id: "multi_segment_loop.title" })}
        onHide={() => setShowLoopEditor(false)}
        closeButton
        accept={{
          text: intl.formatMessage({ id: "actions.close" }),
          variant: "secondary",
          onClick: () => setShowLoopEditor(false),
        }}
        dialogClassName="multi-segment-loop-modal"
        modalProps={{ container: portalTarget, size: "lg" }}
      >
        <MultiSegmentLoopEditor
          loop={loop}
          presets={loopPresets}
          modalContainer={portalTarget}
        />
      </ModalComponent>
    </>
  );
};

const VideoJsPanel = React.memo(VideoJsPanelComponent);

interface IDraggableVideoProps {
  item: IVideoViewerItem;
  layout: IPanelLayout;
  mouseActive: boolean;
  onDrag: DragPanelHandler;
  onAspectRatio: (id: string, aspectRatio: number) => void;
  onRaise: (id: string) => void;
  onLower: (id: string) => void;
  onClose: (id: string) => void;
}

const DraggableVideoComponent: React.FC<IDraggableVideoProps> = ({
  item,
  layout,
  mouseActive,
  onDrag,
  onAspectRatio,
  onRaise,
  onLower,
  onClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const suppressClickRef = useRef(false);

  const startRect = (): IPanelRect => ({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
  });

  const handleFramePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      e.button !== 0 ||
      target.closest(
        [
          ".mv-resize-handle",
          ".mv-resize-handle-tl",
          ".vjs-control-bar",
          ".vjs-menu",
          ".vjs-modal-dialog",
          "button",
          "a",
          "input",
          "select",
          "textarea",
        ].join(",")
      )
    ) {
      return;
    }

    if (target.closest(".mv-titlebar")) {
      e.preventDefault();
    }

    const start = startRect();
    trackPointerDrag(
      e,
      (dx, dy) => {
        suppressClickRef.current = true;
        setIsDragging(true);
        onDrag(item.id, "move", start, dx, dy, VIDEO_LIMITS);
      },
      {
        threshold: 4,
        onEnd: (moved) => {
          setIsDragging(false);
          // The click that ends a drag must not toggle playback.
          if (moved) {
            setTimeout(() => {
              suppressClickRef.current = false;
            }, 0);
          }
        },
      }
    );
  };

  const handleResizePointerDown = (
    e: React.PointerEvent,
    gesture: "resize-br" | "resize-tl"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const start = startRect();
    trackPointerDrag(e, (dx, dy) =>
      onDrag(item.id, gesture, start, dx, dy, VIDEO_LIMITS)
    );
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
  };

  const topPerformers = item.topPerformers ?? [];
  const bottomPerformers = item.bottomPerformers ?? [];
  const showArrows = topPerformers.length > 0 && bottomPerformers.length > 0;

  const renderPerformerChips = (
    performers: IPerformerHoverPerformer[],
    role: "top" | "bottom"
  ) =>
    performers.map((performer) => (
      <a
        key={performer.id}
        className={cx("mv-performer-info", {
          "mv-performer-top": role === "top",
          "mv-performer-bottom": role === "bottom",
        })}
        href={`/performers/${performer.id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {showArrows && (
          <Icon
            icon={role === "top" ? faArrowUp : faArrowDown}
            className="mv-performer-icon"
          />
        )}
        <span>{performer.name}</span>
        <span className="performer-chip-inline-preview">
          <img alt={performer.name ?? ""} src={performer.image_path ?? ""} />
        </span>
      </a>
    ));

  return (
    <div
      className={cx("mv-overlay", { dragging: isDragging })}
      onClickCapture={handleClickCapture}
      onPointerDownCapture={() => onRaise(item.id)}
      onPointerDown={handleFramePointerDown}
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        zIndex: layout.zIndex,
      }}
    >
      <div className="mv-titlebar">
        <span className="mv-title" title={item.title}>
          {item.title}
        </span>
        {item.openUrl && (
          <a
            className="mv-layer-btn"
            href={item.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Stash"
          >
            <Icon icon={faExternalLinkAlt} />
          </a>
        )}
        <button
          type="button"
          className="mv-layer-btn"
          onClick={() => onLower(item.id)}
          title="Send to back"
        >
          <Icon icon={faArrowDown} />
        </button>
        <button
          type="button"
          className="mv-close-btn"
          onClick={() => onClose(item.id)}
          title="Remove"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <div className="mv-video-wrap">
        <VideoJsPanel item={item} onAspectRatio={onAspectRatio} />
        {mouseActive &&
          (topPerformers.length > 0 || bottomPerformers.length > 0) && (
            <div className="mv-performer-overlay">
              {renderPerformerChips(topPerformers, "top")}
              {renderPerformerChips(bottomPerformers, "bottom")}
            </div>
          )}
      </div>

      <div
        className="mv-resize-handle-tl"
        onPointerDown={(e) => handleResizePointerDown(e, "resize-tl")}
        title="Drag to resize"
      />
      <div
        className="mv-resize-handle"
        onPointerDown={(e) => handleResizePointerDown(e, "resize-br")}
        title="Drag to resize"
      />
    </div>
  );
};

const DraggableVideo = React.memo(DraggableVideoComponent);

interface IMultiVideoViewerProps {
  items: IVideoViewerItem[];
  orderedIds: string[];
  loading: boolean;
  title: string;
  itemLabel: string;
  emptyMessage: string;
  imageItems?: IImageViewerItem[];
  imageOrderedIds?: string[];
  headerContent?: ReactNode;
  onRemoveItem: (id: string) => void;
}

export const MultiVideoViewer: React.FC<IMultiVideoViewerProps> = ({
  items,
  orderedIds,
  loading,
  title,
  itemLabel,
  emptyMessage,
  imageItems = [],
  imageOrderedIds = [],
  headerContent,
  onRemoveItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layouts, setLayouts] = useState<PanelLayouts>({});
  const [imageTransforms, setImageTransforms] = useState<
    Record<string, IImageTransform>
  >({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mouseActive, setMouseActive] = useState(false);
  const mouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Panels tile themselves until the user moves or resizes one.
  const autoLayoutRef = useRef(true);
  const zIndexRef = useRef(0);

  const nextZIndex = useCallback(() => ++zIndexRef.current, []);

  const getBounds = useCallback((): IPanelBounds => {
    const viewerFullscreen =
      !!containerRef.current &&
      document.fullscreenElement === containerRef.current;
    const top = viewerFullscreen ? 0 : HEADER_H;
    return { top, width: window.innerWidth, height: window.innerHeight - top };
  }, []);

  const videoPanels = useMemo(
    () => getOrderedItems(items, orderedIds),
    [items, orderedIds]
  );
  const imagePanels = useMemo(
    () => getOrderedItems(imageItems, imageOrderedIds),
    [imageItems, imageOrderedIds]
  );
  const panelSpecs = useMemo(
    () => [
      ...videoPanels.map((item) => ({
        id: item.id,
        defaultAspectRatio: VIDEO_ASPECT_RATIO,
      })),
      ...imagePanels.map((item) => ({ id: item.id, defaultAspectRatio: 1 })),
    ],
    [imagePanels, videoPanels]
  );
  // While tiling, wait for every requested item so the grid is built once.
  const waitingForItems =
    loading &&
    autoLayoutRef.current &&
    panelSpecs.length < orderedIds.length + imageOrderedIds.length;

  useEffect(() => {
    if (waitingForItems) return;
    setLayouts((prev) =>
      syncPanelLayouts(
        prev,
        panelSpecs,
        getBounds(),
        autoLayoutRef.current,
        nextZIndex
      )
    );
  }, [getBounds, nextZIndex, panelSpecs, waitingForItems]);

  const relayout = useCallback(() => {
    const bounds = getBounds();
    setLayouts((prev) =>
      autoLayoutRef.current
        ? tileLayouts(prev, bounds)
        : clampLayouts(prev, bounds)
    );
  }, [getBounds]);

  useEffect(() => {
    let frame = 0;
    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(relayout);
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!containerRef.current &&
          document.fullscreenElement === containerRef.current
      );
      relayout();
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [relayout]);

  useEffect(() => {
    const handleActivity = () => {
      setMouseActive(true);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = setTimeout(() => setMouseActive(false), 1500);
    };
    document.addEventListener("pointermove", handleActivity);
    document.addEventListener("pointerdown", handleActivity);
    return () => {
      document.removeEventListener("pointermove", handleActivity);
      document.removeEventListener("pointerdown", handleActivity);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    };
  }, []);

  const dragPanel = useCallback<DragPanelHandler>(
    (id, gesture, start, dx, dy, limits) => {
      autoLayoutRef.current = false;
      const bounds = getBounds();
      setLayouts((prev) => {
        const layout = prev[id];
        if (!layout) return prev;
        const rect =
          gesture === "move"
            ? clampPanelRect(
                { ...start, x: start.x + dx, y: start.y + dy },
                bounds
              )
            : resizePanelRect(
                gesture === "resize-tl" ? "tl" : "br",
                start,
                dx,
                dy,
                layout.aspectRatio,
                limits,
                bounds
              );
        return { ...prev, [id]: { ...layout, ...rect } };
      });
    },
    [getBounds]
  );

  const handleAspectRatio = useCallback(
    (id: string, aspectRatio: number) => {
      setLayouts((prev) =>
        setPanelAspectRatio(
          prev,
          id,
          aspectRatio,
          getBounds(),
          autoLayoutRef.current
        )
      );
    },
    [getBounds]
  );

  const handleRaise = useCallback(
    (id: string) => setLayouts((prev) => raisePanel(prev, id, nextZIndex)),
    [nextZIndex]
  );

  const handleLower = useCallback(
    (id: string) => setLayouts((prev) => lowerPanel(prev, id)),
    []
  );

  const handleClose = useCallback(
    (id: string) => {
      onRemoveItem(id);
      setImageTransforms((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [onRemoveItem]
  );

  const handleRotate = useCallback(
    (id: string) => {
      setImageTransforms((prev) => {
        const current = prev[id] ?? DEFAULT_IMAGE_TRANSFORM;
        return {
          ...prev,
          [id]: {
            rotation: (current.rotation + 90) % 360,
            cropTop: current.cropLeft,
            cropRight: current.cropTop,
            cropBottom: current.cropRight,
            cropLeft: current.cropBottom,
          },
        };
      });
      setLayouts((prev) =>
        prev[id]
          ? setPanelAspectRatio(
              prev,
              id,
              1 / prev[id].aspectRatio,
              getBounds(),
              autoLayoutRef.current
            )
          : prev
      );
    },
    [getBounds]
  );

  const handleCropChange = useCallback((id: string, crop: IImageCrop) => {
    setImageTransforms((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? DEFAULT_IMAGE_TRANSFORM), ...crop },
    }));
  }, []);

  const tilePanels = useCallback(() => {
    autoLayoutRef.current = true;
    relayout();
  }, [relayout]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen().catch(() => {});
    }
  }, []);

  const panelCount = panelSpecs.length;

  if (loading && panelCount === 0) {
    return <LoadingIndicator />;
  }

  const isEmpty = panelCount === 0;

  return (
    <div
      ref={containerRef}
      className={cx("marker-viewer-container", {
        empty: isEmpty,
        "fullscreen-active": isFullscreen,
      })}
    >
      <Helmet>
        <title>{`${title} (${panelCount})`}</title>
      </Helmet>
      {!isFullscreen && (
        <div className="marker-viewer-header">
          <Button
            variant="secondary"
            onClick={toggleFullscreen}
            title="Enter fullscreen"
          >
            <Icon icon={faExpand} />
          </Button>
          <Button
            variant="secondary"
            onClick={tilePanels}
            disabled={isEmpty}
            title="Tile panels"
          >
            <Icon icon={faThLarge} />
          </Button>
          {headerContent}
          <span className="marker-count">
            {panelCount} {itemLabel}
            {panelCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {isFullscreen && (
        <div className={cx("mv-fab", { "mv-fab--visible": mouseActive })}>
          <Button
            variant="secondary"
            className="mv-fab-btn"
            onClick={toggleFullscreen}
            title="Exit fullscreen"
          >
            <Icon icon={faCompress} />
          </Button>
          <Button
            variant="secondary"
            className="mv-fab-btn"
            onClick={tilePanels}
            title="Tile panels"
          >
            <Icon icon={faThLarge} />
          </Button>
        </div>
      )}
      {isEmpty && (
        <div className="marker-viewer-empty">
          <p>{emptyMessage}</p>
        </div>
      )}
      <div className="mv-canvas">
        {videoPanels.map(
          (item) =>
            layouts[item.id] && (
              <DraggableVideo
                key={item.id}
                item={item}
                layout={layouts[item.id]}
                mouseActive={mouseActive}
                onDrag={dragPanel}
                onAspectRatio={handleAspectRatio}
                onRaise={handleRaise}
                onLower={handleLower}
                onClose={handleClose}
              />
            )
        )}
        {imagePanels.map(
          (item) =>
            layouts[item.id] && (
              <DraggableImage
                key={item.id}
                id={item.id}
                url={item.url}
                title={item.title}
                openUrl={item.openUrl}
                layout={layouts[item.id]}
                transform={imageTransforms[item.id] ?? DEFAULT_IMAGE_TRANSFORM}
                onDrag={dragPanel}
                onAspectRatio={handleAspectRatio}
                onRaise={handleRaise}
                onLower={handleLower}
                onClose={handleClose}
                onRotate={handleRotate}
                onCropChange={handleCropChange}
              />
            )
        )}
      </div>
    </div>
  );
};
