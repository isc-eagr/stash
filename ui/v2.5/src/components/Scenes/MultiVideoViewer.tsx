import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet";
import { Button } from "react-bootstrap";
import videojs, { VideoJsPlayer, VideoJsPlayerOptions } from "video.js";
import { UAParser } from "ua-parser-js";
import "videojs-mobile-ui";
import "videojs-seek-buttons";
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
import type { ILoopSegment } from "src/components/ScenePlayer/multi-segment-loop";
import { MultiSegmentLoopControls } from "src/components/ScenePlayer/MultiSegmentLoopControls";
import "src/components/ScenePlayer/styles.scss";
import {
  faArrowDown,
  faArrowUp,
  faCompress,
  faExpand,
  faThLarge,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { DraggableImage } from "src/components/Images/ImageViewer";
import type { IOverlayState as IImageOverlayState } from "src/components/Images/ImageViewer";
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
  }>;
}

// CUSTOM: begin - performer hover data for viewer overlay chips
interface IPerformerHoverPerformer {
  id: string;
  name: string;
  image_path?: string | null;
  disambiguation?: string | null;
}
// CUSTOM: end

export interface IVideoViewerItem {
  id: string;
  streamUrl: string;
  title: string;
  sceneId?: string;
  startTime?: number;
  endTime?: number | null;
  customControls?: boolean;
  posterUrl?: string | null;
  vttUrl?: string | null;
  duration?: number;
  sources?: IVideoViewerSource[];
  textTracks?: IVideoViewerTextTrack[];
  timelineMarkers?: IMarker[];
  negativeMarkers?: INegativeMarker[];
  oTimestamps?: IVideoViewerOTimestamp[];
  segmentPresets?: IVideoViewerSegmentPreset[];
  topPerformerNames?: string[];
  bottomPerformerNames?: string[];
  topPerformers?: IPerformerHoverPerformer[]; // CUSTOM
  bottomPerformers?: IPerformerHoverPerformer[]; // CUSTOM
}

export interface IImageViewerItem {
  id: string;
  url: string;
  title: string;
}

interface IOverlayState extends IVideoViewerItem {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  zIndex: number;
}

const MIN_WIDTH = 200;
const MIN_HEIGHT = 112;
const BASE_Z = 100000;
const HEADER_H = 60;
const LAYOUT_SPACING = 8;

function computeLayout(
  allItems: IVideoViewerItem[],
  orderedIds: string[],
  vpWidth: number,
  vpHeight: number,
  headerH: number
): IOverlayState[] {
  const n = orderedIds.length;
  if (n === 0) return [];
  const spacing = LAYOUT_SPACING;
  const videoAR = 16 / 9;
  const availH = vpHeight - headerH;

  let bestCols = 1;
  let bestScore = -1;
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c);
    const cw = (vpWidth - spacing * (c + 1)) / c;
    const ch = (availH - spacing * (r + 1)) / r;
    if (cw <= 0 || ch <= 0) continue;
    const fw = Math.min(cw, ch * videoAR);
    const fh = fw / videoAR;
    const score = n * fw * fh;
    if (score > bestScore) {
      bestScore = score;
      bestCols = c;
    }
  }

  const cols = bestCols;
  const rows = Math.ceil(n / cols);
  const cellW = Math.floor((vpWidth - spacing * (cols + 1)) / cols);
  const cellH = Math.floor((availH - spacing * (rows + 1)) / rows);

  return orderedIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is IVideoViewerItem => item !== undefined)
    .map((item, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const isLastRow = row === rows - 1;
      const panelsInRow = isLastRow ? n - (rows - 1) * cols : cols;
      const rowWidth = panelsInRow * cellW + (panelsInRow + 1) * spacing;
      const rowStartX =
        isLastRow && panelsInRow < cols
          ? Math.floor((vpWidth - rowWidth) / 2) + spacing
          : spacing;
      return {
        ...item,
        x: rowStartX + col * (cellW + spacing),
        y: headerH + spacing + row * (cellH + spacing),
        width: cellW,
        height: cellH,
        visible: true,
        zIndex: BASE_Z + index,
      };
    });
}

const IMAGE_DEFAULT_SIZE = 300;
const IMAGE_SPACING = 20;

function computeImageLayout(
  allItems: IImageViewerItem[],
  orderedIds: string[],
  vpWidth: number,
  vpHeight: number,
  headerH: number,
  hasVideos: boolean
): IImageOverlayState[] {
  const orderedItems = orderedIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is IImageViewerItem => item !== undefined);

  if (orderedItems.length === 0) return [];

  const imagesPerRow = Math.max(1, Math.ceil(Math.sqrt(orderedItems.length)));

  return orderedItems.map((item, index) => {
    const row = Math.floor(index / imagesPerRow);
    const col = index % imagesPerRow;
    const gridX = IMAGE_SPACING + col * (IMAGE_DEFAULT_SIZE + IMAGE_SPACING);
    const gridY =
      headerH + IMAGE_SPACING + row * (IMAGE_DEFAULT_SIZE + IMAGE_SPACING);

    const singleX = (vpWidth - IMAGE_DEFAULT_SIZE) / 2;
    const singleY = (vpHeight - IMAGE_DEFAULT_SIZE) / 2;
    const centerSingle = orderedItems.length === 1 && !hasVideos;

    return {
      id: item.id,
      url: item.url,
      x: centerSingle ? singleX : gridX,
      y: centerSingle ? singleY : gridY,
      width: IMAGE_DEFAULT_SIZE,
      visible: true,
      rotation: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      cropLeft: 0,
      zIndex: BASE_Z + 5000 + index,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function isDashSource(source: IVideoViewerSource) {
  return (
    source.type === "application/dash+xml" ||
    source.src.toLowerCase().includes(".mpd")
  );
}

function createAppendedVideoOverlay(
  item: IVideoViewerItem,
  index: number
): IOverlayState {
  const videoAR = 16 / 9;
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const maxWidth = Math.max(MIN_WIDTH, vpWidth - LAYOUT_SPACING * 4);
  const maxHeight = Math.max(
    MIN_HEIGHT,
    vpHeight - HEADER_H - LAYOUT_SPACING * 4
  );
  let width = Math.min(420, maxWidth);
  let height = Math.round(width / videoAR);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * videoAR);
  }

  const offset = (index % 8) * 28;

  return {
    ...item,
    x: clamp(
      LAYOUT_SPACING * 2 + offset,
      LAYOUT_SPACING,
      vpWidth - width - LAYOUT_SPACING
    ),
    y: clamp(
      HEADER_H + LAYOUT_SPACING * 2 + offset,
      LAYOUT_SPACING,
      vpHeight - height - LAYOUT_SPACING
    ),
    width,
    height,
    visible: true,
    zIndex: BASE_Z + index,
  };
}

function createAppendedImageOverlay(
  item: IImageViewerItem,
  index: number
): IImageOverlayState {
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const maxSize = Math.max(
    120,
    Math.min(
      vpWidth - IMAGE_SPACING * 2,
      vpHeight - HEADER_H - IMAGE_SPACING * 2
    )
  );
  const width = Math.min(IMAGE_DEFAULT_SIZE, maxSize);
  const offset = (index % 8) * 24;

  return {
    id: item.id,
    url: item.url,
    x: clamp(
      IMAGE_SPACING + offset,
      IMAGE_SPACING,
      vpWidth - width - IMAGE_SPACING
    ),
    y: clamp(
      HEADER_H + IMAGE_SPACING + offset,
      IMAGE_SPACING,
      vpHeight - width - IMAGE_SPACING
    ),
    width,
    visible: true,
    rotation: 0,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
    cropLeft: 0,
    zIndex: BASE_Z + 5000 + index,
  };
}

function getOrderedVideoItems(
  allItems: IVideoViewerItem[],
  orderedIds: string[]
) {
  return orderedIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is IVideoViewerItem => item !== undefined);
}

function getOrderedImageItems(
  allItems: IImageViewerItem[],
  orderedIds: string[]
) {
  return orderedIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is IImageViewerItem => item !== undefined);
}

interface IDraggableVideoProps {
  overlay: IOverlayState;
  mouseActive: boolean;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, height: number) => void;
  onClose: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

interface IVideoJsPanelProps {
  overlay: IOverlayState;
  onSizeChange: (width: number, height: number) => void;
}

const VideoJsPanel: React.FC<IVideoJsPanelProps> = ({
  overlay,
  onSizeChange,
}) => {
  const { configuration } = useConfigurationContext();
  const uiConfig = configuration?.ui;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VideoJsPlayer>();
  const sizeRef = useRef({ width: overlay.width, height: overlay.height });
  const onSizeChangeRef = useRef(onSizeChange);
  const aspectRatioRef = useRef<number | null>(null);
  const lastNegativeSkipRef = useRef(0);
  const [playerReadyToken, setPlayerReadyToken] = useState(0);
  const [segmentPresets, setSegmentPresets] = useState<
    IVideoViewerSegmentPreset[]
  >([]);
  const [multiSegments, setMultiSegments] = useState<ILoopSegment[]>([]);
  const [multiSegmentEnabled, setMultiSegmentEnabled] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [loopSingleId, setLoopSingleId] = useState<string | null>(null);
  const [negativeMarkerSkipEnabled, setNegativeMarkerSkipEnabled] =
    useState(true);
  const [saveLoopPreset] = GQL.useSaveSceneMultiSegmentLoopPresetMutation();
  const [deleteLoopPreset] = GQL.useDeleteSceneMultiSegmentLoopPresetMutation();

  const getPlayer = useCallback(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return null;
    return player;
  }, []);

  const getMultiSegmentPlugin = useCallback(() => {
    const player = getPlayer();
    return player?.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
  }, [getPlayer]);

  const updateMultiSegmentButtons = useCallback(() => {
    const player = getPlayer();
    const plugin = getMultiSegmentPlugin();
    const controlBar = player?.el()?.querySelector(".vjs-control-bar");
    if (!controlBar) return;

    const toggleButton = controlBar.querySelector(".vjs-multi-segment-toggle");
    const toggleText = controlBar.querySelector(
      ".vjs-multi-segment-toggle-text"
    );
    const badge = controlBar.querySelector(
      ".vjs-multi-segment-badge"
    ) as HTMLElement | null;

    const hasSegments = (plugin?.getSegments().length ?? 0) > 0;
    const enabled = plugin?.isEnabled() ?? false;

    if (toggleText) {
      toggleText.textContent = enabled ? "Loop ON" : "Loop OFF";
    }

    if (toggleButton) {
      toggleButton.classList.toggle(
        "vjs-multi-segment-active",
        enabled && hasSegments
      );
      toggleButton.classList.toggle("vjs-disabled", !hasSegments);
      if (hasSegments) {
        toggleButton.removeAttribute("aria-disabled");
      } else {
        toggleButton.setAttribute("aria-disabled", "true");
      }
    }

    if (badge) {
      const count = segmentPresets.length;
      badge.textContent = count.toString();
      badge.style.display = count > 0 ? "" : "none";
    }
  }, [getMultiSegmentPlugin, getPlayer, segmentPresets.length]);

  const syncAndRenderMultiSegmentState = useCallback(() => {
    const plugin = getMultiSegmentPlugin();
    if (!plugin) return;

    plugin.renderSegmentMarkers();
    setMultiSegments([...plugin.getSegments()]);
    setMultiSegmentEnabled(plugin.isEnabled());
    setCurrentSegmentIndex(plugin.getCurrentSegmentIndex());
    setPendingStart(plugin.getPendingStart());
    setLoopSingleId(plugin.getLoopSingleId());
    updateMultiSegmentButtons();
  }, [getMultiSegmentPlugin, updateMultiSegmentButtons]);

  useEffect(() => {
    sizeRef.current = { width: overlay.width, height: overlay.height };
  }, [overlay.height, overlay.width]);

  useEffect(() => {
    onSizeChangeRef.current = onSizeChange;
  }, [onSizeChange]);

  const snapToAspectRatio = useCallback(() => {
    const ar = aspectRatioRef.current;
    if (!ar) return;
    const { width, height } = sizeRef.current;
    const newH = Math.round(width / ar);
    if (Math.abs(newH - height) > 2) {
      onSizeChangeRef.current(width, newH);
    }
  }, []);

  useEffect(() => {
    snapToAspectRatio();
  }, [overlay.width, snapToAspectRatio]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const playerContainer = container;
    let disposed = false;

    async function initialisePlayer() {
      const sources =
        overlay.sources && overlay.sources.length > 0
          ? overlay.sources
          : [{ src: overlay.streamUrl }];

      if (sources.some(isDashSource)) {
        await import("videojs-contrib-dash");
      }

      if (disposed) return;

      const videoEl = document.createElement("video-js");
      videoEl.setAttribute("data-vjs-player", "true");
      videoEl.setAttribute("crossorigin", "anonymous");
      videoEl.classList.add("mv-video", "vjs-big-play-centered");
      playerContainer.appendChild(videoEl);

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
            createButton: false,
          },
        },
      };

      const player = videojs(videoEl, options);
      playerRef.current = player;

      player.ready(() => {
        if (!disposed && !player.isDisposed()) {
          setPlayerReadyToken((value) => value + 1);
        }
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

      const handleLoadedMetadata = () => {
        const videoWidth = player.videoWidth();
        const videoHeight = player.videoHeight();
        if (!videoWidth || !videoHeight) return;
        aspectRatioRef.current = videoWidth / videoHeight;
        snapToAspectRatio();
        player.markers?.().setFallbackDuration(overlay.duration ?? 0);
        player.markers?.().clearMarkers();
        player.multiSegmentLoop?.().renderSegmentMarkers();
      };

      player.on("loadedmetadata", handleLoadedMetadata);
    }

    initialisePlayer();

    return () => {
      disposed = true;
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
      }
      playerRef.current = undefined;
    };
  }, [overlay.duration, overlay.sources, overlay.streamUrl, snapToAspectRatio]);

  useEffect(() => {
    setSegmentPresets(overlay.segmentPresets ?? []);
  }, [overlay.segmentPresets]);

  useEffect(() => {
    if (!playerReadyToken) return;

    const plugin = getMultiSegmentPlugin();
    if (!plugin) return;

    plugin.setOnSegmentsChange((segments) => {
      plugin.renderSegmentMarkers();
      setMultiSegments([...segments]);
      setPendingStart(plugin.getPendingStart());
      updateMultiSegmentButtons();
    });
    plugin.setOnEnabledChange((enabled) => {
      plugin.renderSegmentMarkers();
      setMultiSegmentEnabled(enabled);
      updateMultiSegmentButtons();
    });
    plugin.setOnCurrentSegmentChange((index) => {
      plugin.renderSegmentMarkers();
      setCurrentSegmentIndex(index);
      updateMultiSegmentButtons();
    });
    plugin.setOnLoopSingleChange((segmentId) => {
      plugin.renderSegmentMarkers();
      setLoopSingleId(segmentId);
      updateMultiSegmentButtons();
    });

    syncAndRenderMultiSegmentState();
  }, [
    getMultiSegmentPlugin,
    playerReadyToken,
    syncAndRenderMultiSegmentState,
    updateMultiSegmentButtons,
  ]);

  useEffect(() => {
    updateMultiSegmentButtons();
  }, [segmentPresets.length, updateMultiSegmentButtons]);

  useEffect(() => {
    const player = getPlayer();
    const plugin = getMultiSegmentPlugin();
    if (!playerReadyToken || !player || !plugin) return;

    let disposed = false;
    let rafId = 0;
    let toggleButton: HTMLDivElement | null = null;
    let editButton: HTMLDivElement | null = null;
    let handleToggleClick: ((e: MouseEvent) => void) | null = null;
    let handleEditClick: ((e: MouseEvent) => void) | null = null;

    const updateButtonState = (
      toggle: Element | null,
      text: Element | null,
      badge: Element | null
    ) => {
      const hasSegments = plugin.getSegments().length > 0;
      const enabled = plugin.isEnabled();

      if (text) {
        text.textContent = enabled ? "Loop ON" : "Loop OFF";
      }

      if (toggle) {
        toggle.classList.toggle(
          "vjs-multi-segment-active",
          enabled && hasSegments
        );
        toggle.classList.toggle("vjs-disabled", !hasSegments);
        if (hasSegments) {
          toggle.removeAttribute("aria-disabled");
        } else {
          toggle.setAttribute("aria-disabled", "true");
        }
      }

      if (badge instanceof HTMLElement) {
        const count = segmentPresets.length;
        badge.textContent = count.toString();
        badge.style.display = count > 0 ? "" : "none";
      }
    };

    const createButtons = () => {
      if (disposed || player.isDisposed()) return true;

      const controlBar = player.el()?.querySelector(".vjs-control-bar");
      if (!controlBar) return false;

      const existingToggle = controlBar.querySelector(
        ".vjs-multi-segment-toggle"
      );
      if (existingToggle) {
        updateButtonState(
          existingToggle,
          existingToggle.querySelector(".vjs-multi-segment-toggle-text"),
          controlBar.querySelector(".vjs-multi-segment-badge")
        );
        return true;
      }

      toggleButton = document.createElement("div");
      toggleButton.className = "vjs-multi-segment-toggle vjs-button";
      toggleButton.setAttribute("role", "button");
      toggleButton.tabIndex = 0;

      const toggleText = document.createElement("span");
      toggleText.className = "vjs-multi-segment-toggle-text";
      toggleButton.appendChild(toggleText);

      editButton = document.createElement("div");
      editButton.className = "vjs-multi-segment-edit vjs-button";
      editButton.setAttribute("role", "button");
      editButton.tabIndex = 0;

      const editIcon = document.createElement("span");
      editIcon.className = "vjs-icon-placeholder";
      editIcon.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor"><path d="M362.7 19.3c25-25 65.5-25 90.5 0l39.5 39.5c25 25 25 65.5 0 90.5L180.5 461.5c-7.6 7.6-17.1 13-27.5 15.7L30.5 509.8c-8.5 2.3-17.6-.2-23.8-6.4s-8.7-15.3-6.4-23.8L32.8 357c2.8-10.4 8.1-19.9 15.7-27.5L362.7 19.3z"/></svg>';
      editButton.appendChild(editIcon);

      const presetBadge = document.createElement("span");
      presetBadge.className = "vjs-multi-segment-badge";
      editButton.appendChild(presetBadge);

      handleToggleClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (plugin.getSegments().length === 0) return;
        plugin.toggleEnabled();
        syncAndRenderMultiSegmentState();
        updateButtonState(toggleButton, toggleText, presetBadge);
      };

      handleEditClick = (e: MouseEvent) => {
        e.stopPropagation();
        setShowPresetModal(true);
      };

      toggleButton.addEventListener("click", handleToggleClick);
      editButton.addEventListener("click", handleEditClick);

      const playbackRateBtn = controlBar.querySelector(".vjs-playback-rate");
      if (playbackRateBtn) {
        controlBar.insertBefore(editButton, playbackRateBtn);
        controlBar.insertBefore(toggleButton, editButton);
      } else {
        const fullscreenBtn = controlBar.querySelector(
          ".vjs-fullscreen-control"
        );
        if (fullscreenBtn) {
          controlBar.insertBefore(editButton, fullscreenBtn);
          controlBar.insertBefore(toggleButton, editButton);
        } else {
          controlBar.appendChild(toggleButton);
          controlBar.appendChild(editButton);
        }
      }

      updateButtonState(toggleButton, toggleText, presetBadge);
      return true;
    };

    const tryCreateButtons = (attemptsLeft = 10) => {
      if (createButtons()) return;
      if (attemptsLeft <= 0) return;
      rafId = window.requestAnimationFrame(() =>
        tryCreateButtons(attemptsLeft - 1)
      );
    };

    player.ready(() => tryCreateButtons());

    return () => {
      disposed = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (toggleButton && handleToggleClick) {
        toggleButton.removeEventListener("click", handleToggleClick);
      }
      if (editButton && handleEditClick) {
        editButton.removeEventListener("click", handleEditClick);
      }
      toggleButton?.remove();
      editButton?.remove();
    };
  }, [
    getMultiSegmentPlugin,
    getPlayer,
    playerReadyToken,
    segmentPresets.length,
    syncAndRenderMultiSegmentState,
  ]);

  useEffect(() => {
    const player = getPlayer();
    const controlBar = player?.el()?.querySelector(".vjs-control-bar");
    if (!playerReadyToken || !player || !controlBar) return;

    const existingButton = controlBar.querySelector(
      ".vjs-negative-marker-skip-btn"
    );
    existingButton?.remove();

    if (!overlay.negativeMarkers?.length) return;

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

    const multiSegmentToggle = controlBar.querySelector(
      ".vjs-multi-segment-toggle"
    );
    if (multiSegmentToggle) {
      controlBar.insertBefore(skipButton, multiSegmentToggle);
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
  }, [
    getPlayer,
    negativeMarkerSkipEnabled,
    overlay.negativeMarkers,
    playerReadyToken,
  ]);

  const loadTimelineMarkers = useCallback(() => {
    const player = getPlayer();
    if (!player || player.isDisposed()) return;

    const markers = player.markers?.();
    if (!markers) return;

    markers.clearMarkers();
    if (overlay.duration) {
      markers.setFallbackDuration(overlay.duration);
    }

    const markerData = overlay.timelineMarkers ?? [];
    const uniqueTagNames = markerData
      .map((marker) => marker.primaryTag.name)
      .filter((value, index, self) => self.indexOf(value) === index);
    markers.findColors(uniqueTagNames);

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
      markers.addNegativeMarkers(overlay.negativeMarkers ?? []);
      markers.addOTimestampMarkers(
        (overlay.oTimestamps ?? []).map((entry) => ({
          ts: entry.ts,
          date: entry.date ?? "",
        }))
      );
    });
  }, [
    getPlayer,
    overlay.duration,
    overlay.negativeMarkers,
    overlay.oTimestamps,
    overlay.timelineMarkers,
    uiConfig?.showRangeMarkers,
  ]);

  useEffect(() => {
    const player = getPlayer();
    if (!playerReadyToken || !player) return;

    loadTimelineMarkers();
    player.on("loadedmetadata", loadTimelineMarkers);

    return () => {
      player.off("loadedmetadata", loadTimelineMarkers);
      if (!player.isDisposed()) {
        player.markers?.().clearMarkers();
      }
    };
  }, [getPlayer, loadTimelineMarkers, playerReadyToken]);

  useEffect(() => {
    const player = getPlayer();
    const negativeMarkers = overlay.negativeMarkers ?? [];
    if (!playerReadyToken || !player || negativeMarkers.length === 0) return;

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
  }, [
    getPlayer,
    negativeMarkerSkipEnabled,
    overlay.negativeMarkers,
    playerReadyToken,
  ]);

  const handleMultiSegmentMarkPoint = useCallback(() => {
    const plugin = getMultiSegmentPlugin();
    if (!plugin) return;
    plugin.markPoint();
    syncAndRenderMultiSegmentState();
  }, [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]);

  const handleMultiSegmentCancelPending = useCallback(() => {
    const plugin = getMultiSegmentPlugin();
    if (!plugin) return;
    plugin.cancelPending();
    syncAndRenderMultiSegmentState();
  }, [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]);

  const handleMultiSegmentToggleEnabled = useCallback(() => {
    const plugin = getMultiSegmentPlugin();
    if (!plugin) return;
    plugin.toggleEnabled();
    syncAndRenderMultiSegmentState();
  }, [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]);

  const handleMultiSegmentRemove = useCallback(
    (id: string) => {
      const plugin = getMultiSegmentPlugin();
      if (!plugin) return;
      plugin.removeSegment(id);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]
  );

  const handleMultiSegmentClear = useCallback(() => {
    const plugin = getMultiSegmentPlugin();
    if (!plugin) return;
    plugin.clearSegments();
    syncAndRenderMultiSegmentState();
  }, [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]);

  const handleMultiSegmentJumpTo = useCallback(
    (index: number) => {
      const plugin = getMultiSegmentPlugin();
      plugin?.jumpToSegment(index);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]
  );

  const handleMultiSegmentReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const plugin = getMultiSegmentPlugin();
      if (!plugin) return;
      plugin.reorderSegment(fromIndex, toIndex);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]
  );

  const handleMultiSegmentToggleLoopSingle = useCallback(
    (segmentId: string) => {
      const plugin = getMultiSegmentPlugin();
      plugin?.toggleLoopSingle(segmentId);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]
  );

  const handleMultiSegmentUpdateStart = useCallback(
    (id: string) => {
      const player = getPlayer();
      const plugin = getMultiSegmentPlugin();
      const segment = plugin?.getSegments().find((s) => s.id === id);
      if (!player || !plugin || !segment) return;
      plugin.updateSegment(id, player.currentTime() || 0, segment.end);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, getPlayer, syncAndRenderMultiSegmentState]
  );

  const handleMultiSegmentUpdateEnd = useCallback(
    (id: string) => {
      const player = getPlayer();
      const plugin = getMultiSegmentPlugin();
      const segment = plugin?.getSegments().find((s) => s.id === id);
      if (!player || !plugin || !segment) return;
      plugin.updateSegment(id, segment.start, player.currentTime() || 0);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, getPlayer, syncAndRenderMultiSegmentState]
  );

  const handleMultiSegmentAdjustStart = useCallback(
    (id: string, deltaSeconds: number) => {
      const plugin = getMultiSegmentPlugin();
      const segment = plugin?.getSegments().find((s) => s.id === id);
      if (!plugin || !segment) return;
      const nextStart = Math.max(
        0,
        Math.min(segment.end - 0.1, segment.start + deltaSeconds)
      );
      plugin.updateSegment(id, nextStart, segment.end);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, syncAndRenderMultiSegmentState]
  );

  const handleMultiSegmentAdjustEnd = useCallback(
    (id: string, deltaSeconds: number) => {
      const player = getPlayer();
      const plugin = getMultiSegmentPlugin();
      const segment = plugin?.getSegments().find((s) => s.id === id);
      if (!player || !plugin || !segment) return;
      const duration = player.duration();
      const maxEnd =
        Number.isFinite(duration) && duration > 0 ? duration : Infinity;
      const nextEnd = Math.min(
        maxEnd,
        Math.max(segment.start + 0.1, segment.end + deltaSeconds)
      );
      plugin.updateSegment(id, segment.start, nextEnd);
      syncAndRenderMultiSegmentState();
    },
    [getMultiSegmentPlugin, getPlayer, syncAndRenderMultiSegmentState]
  );

  const handleSaveSegmentPreset = useCallback(
    async (name: string) => {
      if (!overlay.sceneId || multiSegments.length === 0) return false;

      try {
        const result = await saveLoopPreset({
          variables: {
            input: {
              scene_id: overlay.sceneId,
              name,
              enabled: multiSegmentEnabled,
              current_segment_index: currentSegmentIndex,
              segments: multiSegments.map(({ start, end }) => ({
                start,
                end,
              })),
            },
          },
        });
        const saved = result.data?.saveSceneMultiSegmentLoopPreset;
        if (!saved) return false;

        const updated: IVideoViewerSegmentPreset = {
          id: saved.id ?? undefined,
          name: saved.name,
          enabled: saved.enabled ?? false,
          currentSegmentIndex: saved.current_segment_index ?? 0,
          segments: (saved.segments ?? []).map((segment) => ({
            start: segment.start ?? 0,
            end: segment.end ?? 0,
          })),
        };

        setSegmentPresets((previous) => {
          const index = previous.findIndex(
            (preset) => preset.name.toLowerCase() === name.toLowerCase()
          );
          const next = [...previous];
          if (index >= 0) {
            next[index] = updated;
          } else {
            next.push(updated);
          }
          return next;
        });

        return true;
      } catch (error) {
        console.warn("Failed to save multi-segment loop preset", error);
        return false;
      }
    },
    [
      currentSegmentIndex,
      multiSegmentEnabled,
      multiSegments,
      overlay.sceneId,
      saveLoopPreset,
    ]
  );

  const handleLoadSegmentPreset = useCallback(
    (name: string) => {
      const plugin = getMultiSegmentPlugin();
      const preset = segmentPresets.find(
        (item) => item.name.toLowerCase() === name.toLowerCase()
      );
      if (!plugin || !preset) return false;

      plugin.clearSegments();
      preset.segments.forEach(({ start, end }) => {
        plugin.addSegment(start, end);
      });
      plugin.setEnabled(preset.enabled && preset.segments.length > 0);

      if (preset.enabled && preset.segments.length > 0) {
        plugin.jumpToSegment(
          Math.min(preset.currentSegmentIndex, preset.segments.length - 1)
        );
      }

      syncAndRenderMultiSegmentState();
      return true;
    },
    [getMultiSegmentPlugin, segmentPresets, syncAndRenderMultiSegmentState]
  );

  const handleDeleteSegmentPreset = useCallback(
    async (name: string) => {
      if (!overlay.sceneId) return;
      const preset = segmentPresets.find(
        (item) => item.name.toLowerCase() === name.toLowerCase()
      );
      if (!preset) return;

      try {
        await deleteLoopPreset({
          variables: { scene_id: overlay.sceneId, name: preset.name },
        });
        setSegmentPresets((previous) =>
          previous.filter(
            (item) => item.name.toLowerCase() !== name.toLowerCase()
          )
        );
      } catch (error) {
        console.warn("Failed to delete multi-segment loop preset", error);
      }
    },
    [deleteLoopPreset, overlay.sceneId, segmentPresets]
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    const sources =
      overlay.sources && overlay.sources.length > 0
        ? overlay.sources
        : [{ src: overlay.streamUrl }];

    const sourceSelector = player.sourceSelector?.();
    if (sourceSelector) {
      sourceSelector.setSources(
        sources.map((source) => ({
          src: source.src,
          type: source.type ?? undefined,
          label: source.label ?? undefined,
          offset: source.offset ?? false,
          duration: overlay.duration,
        }))
      );
      (overlay.textTracks ?? []).forEach((track) => {
        sourceSelector.addTextTrack(track as videojs.TextTrackOptions, false);
      });
    } else {
      player.src(
        sources.map((source) => ({
          src: source.src,
          type: source.type ?? undefined,
        }))
      );
    }

    player.poster(overlay.posterUrl ?? "");
    const vttThumbnails = player.vttThumbnails?.();
    vttThumbnails?.src(overlay.vttUrl ?? null);

    player.load();
    player.play()?.catch(() => {});
  }, [
    overlay.duration,
    overlay.posterUrl,
    overlay.sources,
    overlay.streamUrl,
    overlay.textTracks,
    overlay.vttUrl,
  ]);

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
      {showPresetModal &&
        createPortal(
          <MultiSegmentLoopControls
            segments={multiSegments}
            enabled={multiSegmentEnabled}
            currentSegmentIndex={currentSegmentIndex}
            pendingStart={pendingStart}
            loopSingleId={loopSingleId}
            onMarkPoint={handleMultiSegmentMarkPoint}
            onCancelPending={handleMultiSegmentCancelPending}
            onToggleEnabled={handleMultiSegmentToggleEnabled}
            onRemoveSegment={handleMultiSegmentRemove}
            onClearSegments={handleMultiSegmentClear}
            onJumpToSegment={handleMultiSegmentJumpTo}
            onReorderSegment={handleMultiSegmentReorder}
            onToggleLoopSingle={handleMultiSegmentToggleLoopSingle}
            onUpdateSegmentStart={handleMultiSegmentUpdateStart}
            onUpdateSegmentEnd={handleMultiSegmentUpdateEnd}
            onAdjustSegmentStart={handleMultiSegmentAdjustStart}
            onAdjustSegmentEnd={handleMultiSegmentAdjustEnd}
            presetNames={segmentPresets.map((preset) => preset.name)}
            onSavePreset={handleSaveSegmentPreset}
            onLoadPreset={handleLoadSegmentPreset}
            onDeletePreset={handleDeleteSegmentPreset}
            onClose={() => setShowPresetModal(false)}
            collapsed={false}
            isFullscreen={!!document.fullscreenElement}
            zIndex={300000}
          />,
          portalTarget
        )}
    </>
  );
};

const DraggableVideo: React.FC<IDraggableVideoProps> = ({
  overlay,
  mouseActive,
  onPositionChange,
  onSizeChange,
  onClose,
  onBringToFront,
  onSendToBack,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const suppressClickRef = useRef(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    overlayX: number;
    overlayY: number;
    committed: boolean;
  } | null>(null);

  const snapToVideoAR = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const ar = v.videoWidth / v.videoHeight;
    const newH = Math.round(overlay.width / ar);
    if (Math.abs(newH - overlay.height) > 2) onSizeChange(overlay.width, newH);
  }, [overlay.width, overlay.height, onSizeChange]);

  useEffect(() => {
    snapToVideoAR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay.width]);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingTL, setIsResizingTL] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [resizeTLStart, setResizeTLStart] = useState({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    xPos: 0,
    yPos: 0,
  });

  const handleFrameMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      e.button !== 0 ||
      target.closest(
        [
          ".mv-close-btn",
          ".mv-layer-btn",
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

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      overlayX: overlay.x,
      overlayY: overlay.y,
      committed: false,
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: overlay.width,
      h: overlay.height,
    });
  };

  const handleResizeTLMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingTL(true);
    setResizeTLStart({
      x: e.clientX,
      y: e.clientY,
      w: overlay.width,
      h: overlay.height,
      xPos: overlay.x,
      yPos: overlay.y,
    });
  };

  const getLoopEndTime = useCallback(() => {
    if (overlay.startTime === undefined) return undefined;
    return overlay.endTime && overlay.endTime > overlay.startTime
      ? overlay.endTime
      : overlay.startTime + 20;
  }, [overlay.endTime, overlay.startTime]);

  const handleNativeLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      snapToVideoAR();
      if (overlay.startTime !== undefined) {
        e.currentTarget.currentTime = overlay.startTime;
      }
    },
    [overlay.startTime, snapToVideoAR]
  );

  const handleNativeTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (overlay.startTime === undefined) return;

      const video = e.currentTarget;
      const endTime = getLoopEndTime();
      if (endTime === undefined) return;

      if (video.currentTime < overlay.startTime - 0.25) {
        video.currentTime = overlay.startTime;
      } else if (video.currentTime >= endTime) {
        video.currentTime = overlay.startTime;
      }
    },
    [getLoopEndTime, overlay.startTime]
  );

  useEffect(() => {
    let clickResetTimer: ReturnType<typeof setTimeout> | undefined;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const start = dragStartRef.current;
        if (!start) return;

        const dx = e.clientX - start.pointerX;
        const dy = e.clientY - start.pointerY;
        if (!start.committed && Math.abs(dx) + Math.abs(dy) < 4) {
          return;
        }

        start.committed = true;
        suppressClickRef.current = true;
        onPositionChange(start.overlayX + dx, start.overlayY + dy);
      }
      if (isResizing) {
        const dw = e.clientX - resizeStart.x;
        const dh = e.clientY - resizeStart.y;
        const newWidth = Math.max(MIN_WIDTH, resizeStart.w + dw);
        const newHeight = Math.max(MIN_HEIGHT, resizeStart.h + dh);
        onSizeChange(newWidth, newHeight);
      }
      if (isResizingTL) {
        const dMouseX = e.clientX - resizeTLStart.x;
        const dMouseY = e.clientY - resizeTLStart.y;
        const rightEdge = resizeTLStart.xPos + resizeTLStart.w;
        const bottomEdge = resizeTLStart.yPos + resizeTLStart.h;
        const newWidth = Math.max(MIN_WIDTH, resizeTLStart.w - dMouseX);
        const newHeight = Math.max(MIN_HEIGHT, resizeTLStart.h - dMouseY);
        onSizeChange(newWidth, newHeight);
        onPositionChange(rightEdge - newWidth, bottomEdge - newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      if (suppressClickRef.current) {
        clickResetTimer = setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      setIsResizing(false);
      setIsResizingTL(false);
    };

    if (isDragging || isResizing || isResizingTL) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (clickResetTimer) {
        clearTimeout(clickResetTimer);
      }
    };
  }, [
    isDragging,
    isResizing,
    isResizingTL,
    resizeStart,
    resizeTLStart,
    overlay,
    onPositionChange,
    onSizeChange,
  ]);

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
  };

  // CUSTOM: begin - performer chips with hover images
  const topPerformers = overlay.topPerformers ?? [];
  const bottomPerformers = overlay.bottomPerformers ?? [];
  const hasPerformerObjects =
    topPerformers.length > 0 || bottomPerformers.length > 0;
  const hasPerformerNames =
    (overlay.topPerformerNames?.length ?? 0) > 0 ||
    (overlay.bottomPerformerNames?.length ?? 0) > 0;
  const showArrows = hasPerformerObjects
    ? topPerformers.length > 0 && bottomPerformers.length > 0
    : (overlay.topPerformerNames?.length ?? 0) > 0 &&
      (overlay.bottomPerformerNames?.length ?? 0) > 0;

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
  // CUSTOM: end

  if (!overlay.visible) return null;

  return (
    <div
      className={cx("mv-overlay", { dragging: isDragging })}
      onClickCapture={handleClickCapture}
      onMouseDown={handleFrameMouseDown}
      style={{
        left: overlay.x,
        top: overlay.y,
        width: overlay.width,
        height: overlay.height,
        zIndex: overlay.zIndex,
      }}
    >
      <div className="mv-titlebar">
        <span className="mv-title" title={overlay.title}>
          {overlay.title}
        </span>
        <button
          type="button"
          className="mv-layer-btn"
          onClick={(e) => {
            e.stopPropagation();
            onBringToFront();
          }}
          title="Bring to front"
        >
          <Icon icon={faArrowUp} />
        </button>
        <button
          type="button"
          className="mv-layer-btn"
          onClick={(e) => {
            e.stopPropagation();
            onSendToBack();
          }}
          title="Send to back"
        >
          <Icon icon={faArrowDown} />
        </button>
        <button
          type="button"
          className="mv-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Remove"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <div className="mv-video-wrap">
        {overlay.customControls ? (
          <VideoJsPanel overlay={overlay} onSizeChange={onSizeChange} />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={overlay.streamUrl}
            autoPlay
            loop
            muted
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            preload="auto"
            className={cx("mv-video", {
              "mv-marker-range-video": overlay.startTime !== undefined,
            })}
            onLoadedMetadata={handleNativeLoadedMetadata}
            onTimeUpdate={handleNativeTimeUpdate}
          />
        )}
        {mouseActive && (hasPerformerObjects || hasPerformerNames) && (
          <div className="mv-performer-overlay">
            {hasPerformerObjects ? (
              <>
                {renderPerformerChips(topPerformers, "top")}
                {renderPerformerChips(bottomPerformers, "bottom")}
              </>
            ) : (
              <>
                {overlay.topPerformerNames &&
                  overlay.topPerformerNames.length > 0 && (
                    <span className="mv-performer-info mv-performer-top">
                      {showArrows && (
                        <Icon icon={faArrowUp} className="mv-performer-icon" />
                      )}
                      <span>{overlay.topPerformerNames.join(", ")}</span>
                    </span>
                  )}
                {overlay.bottomPerformerNames &&
                  overlay.bottomPerformerNames.length > 0 && (
                    <span className="mv-performer-info mv-performer-bottom">
                      {showArrows && (
                        <Icon
                          icon={faArrowDown}
                          className="mv-performer-icon"
                        />
                      )}
                      <span>{overlay.bottomPerformerNames.join(", ")}</span>
                    </span>
                  )}
              </>
            )}
          </div>
        )}
      </div>

      <div
        className="mv-resize-handle-tl"
        onMouseDown={handleResizeTLMouseDown}
        title="Drag to resize"
      />
      <div
        className="mv-resize-handle"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};

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
  onRemoveItem?: (id: string) => void;
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
  const [overlays, setOverlays] = useState<IOverlayState[]>([]);
  const [imageOverlays, setImageOverlays] = useState<IImageOverlayState[]>([]);
  const [nextImageZ, setNextImageZ] = useState(BASE_Z + 5000);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mouseActive, setMouseActive] = useState(false);
  const mouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<IVideoViewerItem[]>([]);
  const videoLayoutInitializedRef = useRef(false);
  const imageLayoutInitializedRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = () => {
      setMouseActive(true);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = setTimeout(() => setMouseActive(false), 1500);
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    itemsRef.current = items;

    if (orderedIds.length === 0) {
      videoLayoutInitializedRef.current = true;
      setOverlays([]);
      return;
    }

    const orderedItems = getOrderedVideoItems(items, orderedIds);
    const validIds = new Set(orderedIds);

    if (!videoLayoutInitializedRef.current) {
      if (
        orderedItems.length === 0 ||
        (loading && orderedItems.length < orderedIds.length)
      ) {
        setOverlays((prev) =>
          prev.filter((overlay) => validIds.has(overlay.id))
        );
        return;
      }

      setOverlays(
        computeLayout(
          items,
          orderedIds,
          window.innerWidth,
          window.innerHeight,
          HEADER_H
        )
      );
      videoLayoutInitializedRef.current = true;
      return;
    }

    setOverlays((prev) => {
      const itemById = new Map(orderedItems.map((item) => [item.id, item]));
      const existing = prev
        .filter((overlay) => validIds.has(overlay.id))
        .map((overlay) => {
          const item = itemById.get(overlay.id);
          return item
            ? {
                ...item,
                x: overlay.x,
                y: overlay.y,
                width: overlay.width,
                height: overlay.height,
                visible: overlay.visible,
                zIndex: overlay.zIndex,
              }
            : overlay;
        });
      const existingIds = new Set(existing.map((overlay) => overlay.id));
      const additions = orderedItems
        .filter((item) => !existingIds.has(item.id))
        .map((item, index) =>
          createAppendedVideoOverlay(item, existing.length + index)
        );

      return [...existing, ...additions];
    });
  }, [items, loading, orderedIds]);

  useEffect(() => {
    if (imageOrderedIds.length === 0) {
      imageLayoutInitializedRef.current = true;
      setImageOverlays([]);
      return;
    }

    const orderedItems = getOrderedImageItems(imageItems, imageOrderedIds);
    const validIds = new Set(imageOrderedIds);

    if (!imageLayoutInitializedRef.current) {
      if (
        orderedItems.length === 0 ||
        (loading && orderedItems.length < imageOrderedIds.length)
      ) {
        setImageOverlays((prev) =>
          prev.filter((overlay) => validIds.has(overlay.id))
        );
        return;
      }

      const layouts = computeImageLayout(
        imageItems,
        imageOrderedIds,
        window.innerWidth,
        window.innerHeight,
        HEADER_H,
        orderedIds.length > 0 || itemsRef.current.length > 0
      );
      setImageOverlays(layouts);
      imageLayoutInitializedRef.current = true;
      return;
    }

    setImageOverlays((prev) => {
      const itemById = new Map(orderedItems.map((item) => [item.id, item]));
      const existing = prev
        .filter((overlay) => validIds.has(overlay.id))
        .map((overlay) => {
          const item = itemById.get(overlay.id);
          return item
            ? {
                ...overlay,
                url: item.url,
              }
            : overlay;
        });
      const existingIds = new Set(existing.map((overlay) => overlay.id));
      const additions = orderedItems
        .filter((item) => !existingIds.has(item.id))
        .map((item, index) =>
          createAppendedImageOverlay(item, existing.length + index)
        );
      return [...existing, ...additions];
    });
  }, [imageItems, imageOrderedIds, loading, orderedIds.length]);

  useEffect(() => {
    setNextImageZ(
      (prev) =>
        Math.max(
          prev,
          BASE_Z + 5000,
          ...imageOverlays.map((image) => image.zIndex)
        ) + 1
    );
  }, [imageOverlays]);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, x, y } : o)));
  }, []);

  const updateSize = useCallback(
    (id: string, width: number, height: number) => {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, width, height } : o))
      );
    },
    []
  );

  const bringVideoToFront = useCallback(
    (id: string) => {
      setOverlays((prev) => {
        const maxZ = Math.max(
          BASE_Z,
          ...prev.map((overlay) => overlay.zIndex),
          ...imageOverlays.map((image) => image.zIndex)
        );
        return prev.map((overlay) =>
          overlay.id === id ? { ...overlay, zIndex: maxZ + 1 } : overlay
        );
      });
    },
    [imageOverlays]
  );

  const sendVideoToBack = useCallback(
    (id: string) => {
      setOverlays((prev) => {
        const minZ = Math.min(
          BASE_Z,
          ...prev.map((overlay) => overlay.zIndex),
          ...imageOverlays.map((image) => image.zIndex)
        );
        return prev.map((overlay) =>
          overlay.id === id ? { ...overlay, zIndex: minZ - 1 } : overlay
        );
      });
    },
    [imageOverlays]
  );

  const removeOverlay = useCallback(
    (id: string) => {
      onRemoveItem?.(id);
      setOverlays((prev) => prev.filter((o) => o.id !== id));
    },
    [onRemoveItem]
  );

  const updateImagePosition = useCallback(
    (id: string, x: number, y: number) => {
      setImageOverlays((prev) =>
        prev.map((image) => (image.id === id ? { ...image, x, y } : image))
      );
    },
    []
  );

  const updateImageSize = useCallback((id: string, width: number) => {
    setImageOverlays((prev) =>
      prev.map((image) => (image.id === id ? { ...image, width } : image))
    );
  }, []);

  const removeImageOverlay = useCallback(
    (id: string) => {
      onRemoveItem?.(id);
      setImageOverlays((prev) => prev.filter((image) => image.id !== id));
    },
    [onRemoveItem]
  );

  const rotateImage = useCallback((id: string) => {
    setImageOverlays((prev) =>
      prev.map((image) => {
        if (image.id !== id) return image;
        const { cropTop, cropRight, cropBottom, cropLeft } = image;
        return {
          ...image,
          rotation: (image.rotation + 90) % 360,
          cropTop: cropLeft,
          cropRight: cropTop,
          cropBottom: cropRight,
          cropLeft: cropBottom,
        };
      })
    );
  }, []);

  const updateImageCrop = useCallback(
    (id: string, top: number, right: number, bottom: number, left: number) => {
      setImageOverlays((prev) =>
        prev.map((image) =>
          image.id === id
            ? {
                ...image,
                cropTop: top,
                cropRight: right,
                cropBottom: bottom,
                cropLeft: left,
              }
            : image
        )
      );
    },
    []
  );

  const bringImageToFront = useCallback(
    (id: string) => {
      const z = nextImageZ;
      setNextImageZ((value) => value + 1);
      setImageOverlays((prev) =>
        prev.map((image) => (image.id === id ? { ...image, zIndex: z } : image))
      );
    },
    [nextImageZ]
  );

  const sendImageToBack = useCallback(
    (id: string) => {
      setImageOverlays((prev) => {
        const minZ = Math.min(
          BASE_Z,
          ...prev.map((image) => image.zIndex),
          ...overlays.map((overlay) => overlay.zIndex)
        );
        return prev.map((image) =>
          image.id === id ? { ...image, zIndex: minZ - 1 } : image
        );
      });
    },
    [overlays]
  );

  const reflowVideoLayout = useCallback(() => {
    const bounds = containerRef.current?.getBoundingClientRect();
    const width = bounds?.width ?? window.innerWidth;
    const height = bounds?.height ?? window.innerHeight;

    setOverlays((prev) => {
      const visibleIds = prev
        .filter((overlay) => overlay.visible)
        .map((o) => o.id);
      const layouts = computeLayout(prev, visibleIds, width, height, 0);

      return prev.map((overlay) => {
        const nextLayout = layouts.find((layout) => layout.id === overlay.id);
        return nextLayout
          ? {
              ...nextLayout,
              zIndex: overlay.zIndex,
            }
          : overlay;
      });
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (loading && overlays.length === 0 && imageOverlays.length === 0) {
    return <LoadingIndicator />;
  }

  const visibleCount =
    overlays.filter((o) => o.visible).length +
    imageOverlays.filter((image) => image.visible).length;
  const isEmpty = overlays.length === 0 && imageOverlays.length === 0;

  return (
    <div
      ref={containerRef}
      className={cx("marker-viewer-container", "image-viewer-container", {
        empty: isEmpty,
        "fullscreen-active": isFullscreen,
      })}
    >
      <Helmet>
        <title>{`${title} (${visibleCount})`}</title>
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
          {headerContent}
          <span className="marker-count">
            {visibleCount} {itemLabel}
            {visibleCount !== 1 ? "s" : ""}
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
            onClick={reflowVideoLayout}
            title="Reflow markers and scenes"
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
      {overlays.map((overlay) => (
        <DraggableVideo
          key={overlay.id}
          overlay={overlay}
          mouseActive={mouseActive}
          onPositionChange={(x, y) => updatePosition(overlay.id, x, y)}
          onSizeChange={(w, h) => updateSize(overlay.id, w, h)}
          onClose={() => removeOverlay(overlay.id)}
          onBringToFront={() => bringVideoToFront(overlay.id)}
          onSendToBack={() => sendVideoToBack(overlay.id)}
        />
      ))}
      {imageOverlays.map((overlay) => (
        <DraggableImage
          key={overlay.id}
          overlay={overlay}
          onPositionChange={(x, y) => updateImagePosition(overlay.id, x, y)}
          onSizeChange={(w) => updateImageSize(overlay.id, w)}
          onClose={() => removeImageOverlay(overlay.id)}
          onRotate={() => rotateImage(overlay.id)}
          onCropChange={(t, r, b, l) => updateImageCrop(overlay.id, t, r, b, l)}
          onBringToFront={() => bringImageToFront(overlay.id)}
          onSendToBack={() => sendImageToBack(overlay.id)}
        />
      ))}
    </div>
  );
};

export default MultiVideoViewer;
