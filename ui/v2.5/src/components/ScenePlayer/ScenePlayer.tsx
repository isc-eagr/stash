import React, {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom"; // CUSTOM
import videojs, { VideoJsPlayer, VideoJsPlayerOptions } from "video.js";
import useScript from "src/hooks/useScript";
import "videojs-contrib-dash";
import "videojs-mobile-ui";
import "videojs-seek-buttons"; // CUSTOM: still needed for BigButtonGroup on touch devices
import "./seek-buttons"; // CUSTOM: our custom seek buttons with menu for control bar
import { UAParser } from "ua-parser-js";
import "./live";
import "./PlaylistButtons";
import "./source-selector";
import "./persist-volume";
import "./autostart-button";
import MarkersPlugin, { type IMarker } from "./markers";
void MarkersPlugin;
import "./vtt-thumbnails";
import "./big-buttons";
import "./track-activity";
import "./vrmode";
import "./media-session";
import "./wake-sentinel";
import cx from "classnames";
import {
  useSceneSaveActivity,
  useSceneIncrementPlayCount,
  useConfigureInterface,
} from "src/core/StashService";

import * as GQL from "src/core/generated-graphql";
import { ScenePlayerScrubber } from "./ScenePlayerScrubber";
import { useConfigurationContext } from "src/hooks/Config";
import {
  ConnectionState,
  InteractiveContext,
} from "src/hooks/Interactive/context";
import { SceneInteractiveStatus } from "src/hooks/Interactive/status";
import { languageMap } from "src/utils/caption";
import { VIDEO_PLAYER_ID } from "./util";

// @ts-ignore
import airplay from "@silvermine/videojs-airplay";
// @ts-ignore
import chromecast from "@silvermine/videojs-chromecast";
import abLoopPlugin from "videojs-abloop";
import ScreenUtils from "src/utils/screen";
import { PatchComponent } from "src/patch";
// CUSTOM: begin - custom imports (goatee, multi-segment loop, performer image overlay)
import facialPng from "src/assets/facial.png"; // CUSTOM

// Multi-segment loop plugin
import "./multi-segment-loop";
import type MultiSegmentLoopPlugin from "./multi-segment-loop";
import type {
  ILoopSegment,
  ILoopSegmentInput,
  IMultiSegmentLoopApi,
} from "./multi-segment-loop";
import { MultiSegmentLoopControls } from "./MultiSegmentLoopControls";

// Performer image overlay components
import { PerformerImageSelectModal } from "./PerformerImageSelectModal";
import { PerformerImageOverlay } from "./PerformerImageOverlay";
// CUSTOM: end

type ScenePlayerTagTree = {
  id: string;
  parents?: ScenePlayerTagTree[];
};

type ScenePlayerMarkerWithTags = {
  primary_tag?: ScenePlayerTagTree | null;
  tags?: ScenePlayerTagTree[] | null;
};

// register videojs plugins
airplay(videojs);
chromecast(videojs);
abLoopPlugin(window, videojs);

function handleHotkeys(player: VideoJsPlayer, event: videojs.KeyboardEvent) {
  function seekStep(step: number) {
    const time = player.currentTime() + step;
    const duration = player.duration();
    if (time < 0) {
      player.currentTime(0);
    } else if (time < duration) {
      player.currentTime(time);
    } else {
      player.currentTime(duration);
    }
  }

  function seekPercent(percent: number) {
    const duration = player.duration();
    const time = duration * percent;
    player.currentTime(time);
  }

  function seekPercentRelative(percent: number) {
    const duration = player.duration();
    const currentTime = player.currentTime();
    const time = currentTime + duration * percent;
    if (time > duration) return;
    player.currentTime(time);
  }

  function toggleABLooping() {
    const opts = player.abLoopPlugin.getOptions();
    if (!opts.start) {
      opts.start = player.currentTime();
    } else if (!opts.end) {
      opts.end = player.currentTime();
      opts.enabled = true;
    } else {
      opts.start = 0;
      opts.end = 0;
      opts.enabled = false;
    }
    player.abLoopPlugin.setOptions(opts);
  }

  let seekFactor = 10;
  if (event.shiftKey) {
    seekFactor = 5;
  } else if (event.ctrlKey || event.altKey) {
    seekFactor = 60;
  }
  switch (event.which) {
    case 39: // right arrow
      seekStep(seekFactor);
      break;
    case 37: // left arrow
      seekStep(-seekFactor);
      break;
  }

  // toggle player looping with shift+l
  if (event.shiftKey && event.which === 76) {
    player.loop(!player.loop());
    return;
  }

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  const skipButtons = player.skipButtons();
  if (skipButtons) {
    // handle multimedia keys
    switch (event.key) {
      case "MediaTrackNext":
        if (!skipButtons.onNext) return;
        skipButtons.onNext();
        break;
      case "MediaTrackPrevious":
        if (!skipButtons.onPrevious) return;
        skipButtons.onPrevious();
        break;
      // MediaPlayPause handled by videojs
    }
  }

  switch (event.which) {
    case 32: // space
    case 13: // enter
      if (player.paused()) player.play();
      else player.pause();
      break;
    case 77: // m
      player.muted(!player.muted());
      break;
    case 70: // f
      if (player.isFullscreen()) player.exitFullscreen();
      else player.requestFullscreen();
      break;
    case 76: // l
      toggleABLooping();
      break;
    case 38: // up arrow
      player.volume(player.volume() + 0.1);
      break;
    case 40: // down arrow
      player.volume(player.volume() - 0.1);
      break;
    case 48: // 0
      player.currentTime(0);
      break;
    case 49: // 1
      seekPercent(0.1);
      break;
    case 50: // 2
      seekPercent(0.2);
      break;
    case 51: // 3
      seekPercent(0.3);
      break;
    case 52: // 4
      seekPercent(0.4);
      break;
    case 53: // 5
      seekPercent(0.5);
      break;
    case 54: // 6
      seekPercent(0.6);
      break;
    case 55: // 7
      seekPercent(0.7);
      break;
    case 56: // 8
      seekPercent(0.8);
      break;
    case 57: // 9
      seekPercent(0.9);
      break;
    case 221: // ]
      seekPercentRelative(0.1);
      break;
    case 219: // [
      seekPercentRelative(-0.1);
      break;
  }
}

type MarkerFragment = Pick<GQL.SceneMarker, "title" | "seconds"> & {
  primary_tag: Pick<GQL.Tag, "name">;
  tags: Array<Pick<GQL.Tag, "name">>;
  performers?: Array<Pick<GQL.Performer, "name">>; // CUSTOM
  top_performers?: Array<Pick<GQL.Performer, "id" | "name">>; // CUSTOM
  bottom_performers?: Array<Pick<GQL.Performer, "id" | "name">>; // CUSTOM
};

// CUSTOM: begin - SegmentPreset type for multi-segment loop presets
type SegmentPreset = {
  id?: string;
  name: string;
  segments: ILoopSegmentInput[];
  enabled: boolean;
  currentSegmentIndex: number;
};
// CUSTOM: end

function getMarkerTitle(marker: MarkerFragment) {
  let ret = ""; // CUSTOM: restructured to append performer info

  if (marker.title) {
    ret = marker.title;
  } else {
    ret = marker.primary_tag.name;
    if (marker.tags.length) {
      ret += `, ${marker.tags.map((t) => t.name).join(", ")}`;
    }
  }

  // CUSTOM: Performer names with roles are now shown in the tooltip with arrows

  return ret;
}

interface IScenePlayerProps {
  scene: GQL.SceneDataFragment;
  hideScrubberOverride: boolean;
  autoplay?: boolean;
  permitLoop?: boolean;
  initialTimestamp: number;
  sendSetTimestamp: (setTimestamp: (value: number) => void) => void;
  sendMultiSegmentLoopApi?: (api: IMultiSegmentLoopApi) => void; // CUSTOM
  onComplete: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const ScenePlayer: React.FC<IScenePlayerProps> = PatchComponent(
  "ScenePlayer",
  ({
    scene,
    hideScrubberOverride,
    autoplay,
    permitLoop = true,
    initialTimestamp: _initialTimestamp,
    sendSetTimestamp,
    sendMultiSegmentLoopApi, // CUSTOM
    onComplete,
    onNext,
    onPrevious,
  }) => {
    const { configuration } = useConfigurationContext();
    const interfaceConfig = configuration?.interface;
    const uiConfig = configuration?.ui;
    const videoRef = useRef<HTMLDivElement>(null);
    const [_player, setPlayer] = useState<VideoJsPlayer>();
    const sceneId = useRef<string>();
    const [sceneSaveActivity] = useSceneSaveActivity();
    const [sceneIncrementPlayCount] = useSceneIncrementPlayCount();
    const [updateInterfaceConfig] = useConfigureInterface();

    const [time, setTime] = useState(0);
    const [ready, setReady] = useState(false);

    const {
      interactive: interactiveClient,
      uploadScript,
      currentScript,
      initialised: interactiveInitialised,
      state: interactiveState,
    } = React.useContext(InteractiveContext);

    const [fullscreen, setFullscreen] = useState(false);
    const [showScrubber, setShowScrubber] = useState(false);
    // CUSTOM: begin - multi-segment loop, negative marker, performer overlay state + handlers
    const [segmentPresets, setSegmentPresets] = useState<SegmentPreset[]>([]);
    const [multiSegments, setMultiSegments] = useState<ILoopSegment[]>([]);
    const [multiSegmentEnabled, setMultiSegmentEnabled] = useState(false);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [pendingStart, setPendingStart] = useState<number | null>(null);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [loopSingleId, setLoopSingleId] = useState<string | null>(null);

    // Negative marker skipping - enabled by default
    const [negativeMarkerSkipEnabled, setNegativeMarkerSkipEnabled] =
      useState(true);
    const lastSkipTimeRef = useRef<number>(0); // Prevent rapid re-skipping

    // Performer image overlay state
    const [showImageOverlayModal, setShowImageOverlayModal] = useState(false);
    const [selectedOverlayImages, setSelectedOverlayImages] = useState<
      { id: string; url: string }[]
    >([]);
    const [overlaysVisible, setOverlaysVisible] = useState(true);

    const [saveLoopPreset] = GQL.useSaveSceneMultiSegmentLoopPresetMutation();
    const [deleteLoopPreset] =
      GQL.useDeleteSceneMultiSegmentLoopPresetMutation();

    const handleDeleteSegmentPreset = useCallback(
      async (name: string) => {
        const preset = segmentPresets.find(
          (p) => p.name.toLowerCase() === name.toLowerCase()
        );

        if (!preset) return;

        try {
          await deleteLoopPreset({
            variables: { scene_id: scene.id, name: preset.name },
          });
          setSegmentPresets((prev) =>
            prev.filter((p) => p.name.toLowerCase() !== name.toLowerCase())
          );
        } catch (error) {
          console.warn("Failed to delete multi-segment loop preset", error);
        }
      },
      [segmentPresets, deleteLoopPreset, scene.id]
    );
    // CUSTOM: end

    const started = useRef(false);
    const auto = useRef(false);
    const interactiveReady = useRef(false);
    const minimumPlayPercent = uiConfig?.minimumPlayPercent ?? 0;
    const trackActivity = uiConfig?.trackActivity ?? true;
    const vrTag = uiConfig?.vrTag ?? undefined;

    useScript(
      "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1",
      uiConfig?.enableChromecast
    );

    const file = useMemo(
      () => (scene.files.length > 0 ? scene.files[0] : undefined),
      [scene]
    );

    const maxLoopDuration = interfaceConfig?.maximumLoopDuration ?? 0;
    const looping = useMemo(
      () =>
        !!file?.duration &&
        permitLoop &&
        maxLoopDuration !== 0 &&
        file.duration < maxLoopDuration,
      [file, permitLoop, maxLoopDuration]
    );

    const getPlayer = useCallback(() => {
      if (!_player) return null;
      if (_player.isDisposed()) return null;
      return _player;
    }, [_player]);

    useEffect(() => {
      if (hideScrubberOverride || fullscreen) {
        setShowScrubber(false);
        return;
      }

      const onResize = () => {
        const show = window.innerHeight >= 450 && !ScreenUtils.isMobile();
        setShowScrubber(show);
      };
      onResize();

      window.addEventListener("resize", onResize);

      return () => window.removeEventListener("resize", onResize);
    }, [hideScrubberOverride, fullscreen]);

    useEffect(() => {
      sendSetTimestamp((value: number) => {
        const player = getPlayer();
        if (player && value >= 0) {
          if (player.hasStarted() && player.paused()) {
            player.currentTime(value);
          } else {
            player.play()?.then(() => {
              player.currentTime(value);
            });
          }
        }
      });
    }, [sendSetTimestamp, getPlayer]);

    // CUSTOM: begin - load multi-segment loop presets from scene data
    useEffect(() => {
      const presets = (scene.multi_segment_loop_presets ?? []).map(
        (preset) => ({
          id: preset.id ?? undefined,
          name: preset.name,
          enabled: preset.enabled ?? false,
          currentSegmentIndex: preset.current_segment_index ?? 0,
          segments: (preset.segments ?? []).map((s) => ({
            start: s.start ?? 0,
            end: s.end ?? 0,
          })),
        })
      );

      setSegmentPresets(presets);
    }, [scene.multi_segment_loop_presets]);

    useEffect(() => {
      if (!sendMultiSegmentLoopApi) return;

      sendMultiSegmentLoopApi({
        addSegments: (segments: ILoopSegmentInput[]) => {
          const player = getPlayer();
          if (!player) return;

          const multiSegmentPlugin = player.multiSegmentLoop?.() as
            | MultiSegmentLoopPlugin
            | undefined;
          if (!multiSegmentPlugin) return;

          segments.forEach((s) => {
            const { start, end: endRaw, title } = s;
            const end = endRaw > start ? endRaw : start + 1;
            multiSegmentPlugin.addSegment(start, end, title);
          });

          // Force sync after adding segments from markers
          setMultiSegments([...multiSegmentPlugin.getSegments()]);
        },
        setSegments: (segments: ILoopSegmentInput[]) => {
          const player = getPlayer();
          if (!player) return;

          const multiSegmentPlugin = player.multiSegmentLoop?.() as
            | MultiSegmentLoopPlugin
            | undefined;
          if (!multiSegmentPlugin) return;

          const normalized: ILoopSegmentInput[] = segments.map((s) => ({
            start: s.start,
            end: s.end > s.start ? s.end : s.start + 1,
          }));

          multiSegmentPlugin.setSegments(
            normalized.map((s) => ({
              id: `imported_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2)}`,
              start: s.start,
              end: s.end,
            }))
          );
        },
        clearSegments: () => {
          const player = getPlayer();
          if (!player) return;

          const multiSegmentPlugin = player.multiSegmentLoop?.() as
            | MultiSegmentLoopPlugin
            | undefined;
          if (!multiSegmentPlugin) return;

          multiSegmentPlugin.clearSegments();
        },
      });
    }, [sendMultiSegmentLoopApi, getPlayer]);
    // CUSTOM: end

    // Initialize VideoJS player
    useEffect(() => {
      const options: VideoJsPlayerOptions = {
        id: VIDEO_PLAYER_ID,
        controls: true,
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
        preload: "none",
        playsinline: true,
        techOrder: ["chromecast", "html5"],
        userActions: {
          hotkeys: function (this: VideoJsPlayer, event) {
            handleHotkeys(this, event);
          },
        },
        plugins: {
          airPlay: {
            addButtonToControlBar: uiConfig?.enableChromecast ?? false,
          },
          chromecast: {},
          vttThumbnails: {
            showTimestamp: true,
          },
          markers: {},
          sourceSelector: {},
          persistVolume: {},
          bigButtons: {},
          seekButtonsMenu: {
            // CUSTOM: renamed from seekButtons
            forward: 5, // CUSTOM
            back: 5, // CUSTOM
          },
          skipButtons: {},
          trackActivity: {},
          vrMenu: {},
          autostartButton: {
            enabled: interfaceConfig?.autostartVideo ?? false,
          },
          abLoopPlugin: {
            start: 0,
            end: false,
            enabled: false,
            loopIfBeforeStart: true,
            loopIfAfterEnd: true,
            pauseAfterLooping: false,
            pauseBeforeLooping: false,
            createButtons: uiConfig?.showAbLoopControls ?? false,
          },
          // CUSTOM: begin - multi-segment loop plugin config
          multiSegmentLoop: {
            segments: [],
            enabled: false,
            currentSegmentIndex: 0,
            createButton: false, // We create our own consolidated dropdown button
          },
          // CUSTOM: end
          mediaSession: {},
          wakeSentinel: {},
        },
      };

      const videoEl = document.createElement("video-js");
      videoEl.setAttribute("data-vjs-player", "true");
      videoEl.setAttribute("crossorigin", "anonymous");
      videoEl.classList.add("vjs-big-play-centered");
      videoRef.current!.appendChild(videoEl);

      const vjs = videojs(videoEl, options);

      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const settings = (vjs as any).textTrackSettings;
      settings.setValues({
        backgroundColor: "#000",
        backgroundOpacity: "0.5",
      });
      settings.updateDisplay();

      vjs.focus();
      setPlayer(vjs);

      // Video player destructor
      return () => {
        vjs.dispose();
        videoEl.remove();
        setPlayer(undefined);

        // reset sceneId to force reload sources
        sceneId.current = undefined;
      };
      // empty deps - only init once
      // showAbLoopControls is necessary to re-init the player when the config changes
      // Note: interfaceConfig?.autostartVideo is intentionally excluded to prevent
      // player re-initialization when toggling autostart (which would interrupt playback)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uiConfig?.showAbLoopControls, uiConfig?.enableChromecast]);

    useEffect(() => {
      const player = getPlayer();
      if (!player) return;
      const skipButtons = player.skipButtons();
      skipButtons.setForwardHandler(onNext);
      skipButtons.setBackwardHandler(onPrevious);
    }, [getPlayer, onNext, onPrevious]);

    // CUSTOM: begin - multi-segment loop plugin setup, handlers, control bar buttons, negative marker skip, performer image overlay buttons
    // Multi-segment loop plugin setup
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const multiSegmentPlugin = player.multiSegmentLoop?.() as
        | MultiSegmentLoopPlugin
        | undefined;
      if (!multiSegmentPlugin) return;

      // Set up callbacks to sync state with React
      multiSegmentPlugin.setOnSegmentsChange((segments) => {
        setMultiSegments([...segments]);
      });

      multiSegmentPlugin.setOnEnabledChange((enabled) => {
        setMultiSegmentEnabled(enabled);
      });

      multiSegmentPlugin.setOnCurrentSegmentChange((index) => {
        setCurrentSegmentIndex(index);
      });

      multiSegmentPlugin.setOnLoopSingleChange((segmentId) => {
        setLoopSingleId(segmentId);
      });

      // Sync pending start
      const syncPending = () => {
        setPendingStart(multiSegmentPlugin.getPendingStart());
      };

      // Initial sync
      setMultiSegments(multiSegmentPlugin.getSegments());
      setMultiSegmentEnabled(multiSegmentPlugin.isEnabled());
      setCurrentSegmentIndex(multiSegmentPlugin.getCurrentSegmentIndex());
      setLoopSingleId(multiSegmentPlugin.getLoopSingleId());
      syncPending();
    }, [getPlayer]);

    // Multi-segment loop control handlers
    const handleMultiSegmentMarkPoint = useCallback(() => {
      const player = getPlayer();
      if (!player) return;

      const multiSegmentPlugin = player.multiSegmentLoop?.() as
        | MultiSegmentLoopPlugin
        | undefined;
      if (!multiSegmentPlugin) return;

      multiSegmentPlugin.markPoint();
      setPendingStart(multiSegmentPlugin.getPendingStart());
      // Force sync segments after marking (in case callback doesn't trigger)
      setMultiSegments([...multiSegmentPlugin.getSegments()]);
    }, [getPlayer]);

    const handleMultiSegmentCancelPending = useCallback(() => {
      const player = getPlayer();
      if (!player) return;

      const multiSegmentPlugin = player.multiSegmentLoop?.() as
        | MultiSegmentLoopPlugin
        | undefined;
      if (!multiSegmentPlugin) return;

      multiSegmentPlugin.cancelPending();
      setPendingStart(null);
    }, [getPlayer]);

    const handleMultiSegmentToggleEnabled = useCallback(() => {
      const player = getPlayer();
      if (!player) return;

      const multiSegmentPlugin = player.multiSegmentLoop?.() as
        | MultiSegmentLoopPlugin
        | undefined;
      if (!multiSegmentPlugin) return;

      multiSegmentPlugin.toggleEnabled();
      // Force sync enabled state
      setMultiSegmentEnabled(multiSegmentPlugin.isEnabled());
    }, [getPlayer]);

    const handleMultiSegmentRemove = useCallback(
      (id: string) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        multiSegmentPlugin.removeSegment(id);
        // Force sync after remove
        setMultiSegments([...multiSegmentPlugin.getSegments()]);
      },
      [getPlayer]
    );

    const handleMultiSegmentClear = useCallback(() => {
      const player = getPlayer();
      if (!player) return;

      const multiSegmentPlugin = player.multiSegmentLoop?.() as
        | MultiSegmentLoopPlugin
        | undefined;
      if (!multiSegmentPlugin) return;

      multiSegmentPlugin.clearSegments();
      // Force sync after clear
      setMultiSegments([...multiSegmentPlugin.getSegments()]);
    }, [getPlayer]);

    const handleMultiSegmentJumpTo = useCallback(
      (index: number) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        multiSegmentPlugin.jumpToSegment(index);
      },
      [getPlayer]
    );

    const handleMultiSegmentReorder = useCallback(
      (fromIndex: number, toIndex: number) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        multiSegmentPlugin.reorderSegment(fromIndex, toIndex);
        // Force sync after reorder
        setMultiSegments([...multiSegmentPlugin.getSegments()]);
      },
      [getPlayer]
    );

    const handleMultiSegmentToggleLoopSingle = useCallback(
      (segmentId: string) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        multiSegmentPlugin.toggleLoopSingle(segmentId);
      },
      [getPlayer]
    );

    const handleMultiSegmentUpdateStart = useCallback(
      (id: string) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        const currentTime = player.currentTime() || 0;
        const segment = multiSegmentPlugin
          .getSegments()
          .find((s) => s.id === id);
        if (!segment) return;

        multiSegmentPlugin.updateSegment(id, currentTime, segment.end);
      },
      [getPlayer]
    );

    const handleMultiSegmentUpdateEnd = useCallback(
      (id: string) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        const currentTime = player.currentTime() || 0;
        const segment = multiSegmentPlugin
          .getSegments()
          .find((s) => s.id === id);
        if (!segment) return;

        multiSegmentPlugin.updateSegment(id, segment.start, currentTime);
      },
      [getPlayer]
    );

    const handleMultiSegmentAdjustStart = useCallback(
      (id: string, deltaSeconds: number) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        const segment = multiSegmentPlugin
          .getSegments()
          .find((s) => s.id === id);
        if (!segment) return;

        const nextStart = Math.max(
          0,
          Math.min(segment.end - 0.1, segment.start + deltaSeconds)
        );
        multiSegmentPlugin.updateSegment(id, nextStart, segment.end);
      },
      [getPlayer]
    );

    const handleMultiSegmentAdjustEnd = useCallback(
      (id: string, deltaSeconds: number) => {
        const player = getPlayer();
        if (!player) return;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return;

        const segment = multiSegmentPlugin
          .getSegments()
          .find((s) => s.id === id);
        if (!segment) return;

        const duration = player.duration();
        const maxEnd =
          Number.isFinite(duration) && duration > 0 ? duration : Infinity;
        const nextEnd = Math.min(
          maxEnd,
          Math.max(segment.start + 0.1, segment.end + deltaSeconds)
        );
        multiSegmentPlugin.updateSegment(id, segment.start, nextEnd);
      },
      [getPlayer]
    );

    const handleSaveSegmentPreset = useCallback(
      async (name: string) => {
        if (multiSegments.length === 0) return false;

        const presetInput: GQL.SceneMultiSegmentLoopPresetInput = {
          scene_id: scene.id,
          name,
          enabled: multiSegmentEnabled,
          current_segment_index: currentSegmentIndex,
          segments: multiSegments.map(({ start, end }) => ({ start, end })),
        };

        try {
          const result = await saveLoopPreset({
            variables: { input: presetInput },
          });
          const saved = result.data?.saveSceneMultiSegmentLoopPreset;
          if (!saved) return false;

          const updated: SegmentPreset = {
            id: saved.id ?? undefined,
            name: saved.name,
            enabled: saved.enabled ?? false,
            currentSegmentIndex: saved.current_segment_index ?? 0,
            segments: (saved.segments ?? []).map((s) => ({
              start: s.start ?? 0,
              end: s.end ?? 0,
            })),
          };

          setSegmentPresets((prev) => {
            const index = prev.findIndex(
              (p) => p.name.toLowerCase() === updated.name.toLowerCase()
            );
            const next = [...prev];
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
        multiSegments,
        multiSegmentEnabled,
        currentSegmentIndex,
        scene.id,
        saveLoopPreset,
      ]
    );

    const handleLoadSegmentPreset = useCallback(
      (name: string) => {
        const player = getPlayer();
        if (!player) return false;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (!multiSegmentPlugin) return false;

        const preset = segmentPresets.find(
          (p) => p.name.toLowerCase() === name.toLowerCase()
        );

        if (!preset) return false;

        multiSegmentPlugin.clearSegments();
        preset.segments.forEach(({ start, end }) => {
          multiSegmentPlugin.addSegment(start, end);
        });

        const shouldEnable = preset.enabled && preset.segments.length > 0;
        multiSegmentPlugin.setEnabled(shouldEnable);

        if (shouldEnable && preset.segments.length > 0) {
          const targetIndex = Math.min(
            preset.currentSegmentIndex,
            preset.segments.length - 1
          );
          multiSegmentPlugin.jumpToSegment(targetIndex);
        }

        // Force sync all state after loading
        setMultiSegments([...multiSegmentPlugin.getSegments()]);
        setMultiSegmentEnabled(multiSegmentPlugin.isEnabled());
        setCurrentSegmentIndex(multiSegmentPlugin.getCurrentSegmentIndex());
        setPendingStart(multiSegmentPlugin.getPendingStart());
        return true;
      },
      [getPlayer, segmentPresets]
    );

    // Create multi-segment loop buttons in control bar
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const controlBar = player.el()?.querySelector(".vjs-control-bar");
      if (!controlBar) return;

      const createButtons = () => {
        if (controlBar.querySelector(".vjs-multi-segment-toggle")) return true;

        // Create toggle button (Loop ON/OFF)
        const toggleButton = document.createElement("div");
        toggleButton.className = "vjs-multi-segment-toggle vjs-button";
        toggleButton.setAttribute("role", "button");
        toggleButton.tabIndex = 0;

        const toggleText = document.createElement("span");
        toggleText.className = "vjs-multi-segment-toggle-text";
        toggleText.textContent = "Loop OFF";
        toggleButton.appendChild(toggleText);

        // Create edit button (pencil icon with preset count badge)
        const editButton = document.createElement("div");
        editButton.className = "vjs-multi-segment-edit vjs-button";
        editButton.setAttribute("role", "button");
        editButton.tabIndex = 0;

        const editIcon = document.createElement("span");
        editIcon.className = "vjs-icon-placeholder";
        editIcon.textContent = "✏️";
        editButton.appendChild(editIcon);

        // Create preset count badge
        const presetBadge = document.createElement("span");
        presetBadge.className = "vjs-multi-segment-badge";
        presetBadge.textContent = segmentPresets.length.toString();
        if (segmentPresets.length === 0) {
          presetBadge.style.display = "none";
        }
        editButton.appendChild(presetBadge);

        // Update toggle button state
        const updateToggleState = () => {
          const multiSegmentPlugin = player.multiSegmentLoop?.() as
            | MultiSegmentLoopPlugin
            | undefined;
          const isEnabled = multiSegmentPlugin?.isEnabled() ?? false;
          const hasSegments =
            (multiSegmentPlugin?.getSegments()?.length ?? 0) > 0;

          toggleText.textContent = isEnabled ? "Loop ON" : "Loop OFF";

          if (isEnabled && hasSegments) {
            toggleButton.classList.add("vjs-multi-segment-active");
          } else {
            toggleButton.classList.remove("vjs-multi-segment-active");
          }

          // Disable toggle if no segments
          if (!hasSegments) {
            toggleButton.classList.add("vjs-disabled");
            toggleButton.setAttribute("aria-disabled", "true");
          } else {
            toggleButton.classList.remove("vjs-disabled");
            toggleButton.removeAttribute("aria-disabled");
          }
        };

        // Toggle button click handler
        toggleButton.addEventListener("click", (e) => {
          e.stopPropagation();
          const multiSegmentPlugin = player.multiSegmentLoop?.() as
            | MultiSegmentLoopPlugin
            | undefined;
          if (!multiSegmentPlugin) return;

          const hasSegments =
            (multiSegmentPlugin.getSegments()?.length ?? 0) > 0;
          if (!hasSegments) return;

          multiSegmentPlugin.toggleEnabled();
          updateToggleState();
          // Force sync React state so modal Play button updates
          setMultiSegmentEnabled(multiSegmentPlugin.isEnabled());
        });

        // Edit button click handler
        editButton.addEventListener("click", (e) => {
          e.stopPropagation();
          setShowPresetModal(true);
        });

        // Insert buttons to the left of playback rate (1x) button
        const playbackRateBtn = controlBar.querySelector(".vjs-playback-rate");
        if (playbackRateBtn) {
          controlBar.insertBefore(editButton, playbackRateBtn);
          controlBar.insertBefore(toggleButton, editButton);
        } else {
          // Fallback: insert before fullscreen
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

        // Store update function for later use
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (toggleButton as any).__updateState = updateToggleState;

        return true;
      };

      createButtons();

      // Update button state when segments or enabled state changes
      const updateButtonState = () => {
        const toggleBtn = controlBar.querySelector(
          ".vjs-multi-segment-toggle"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;
        toggleBtn?.__updateState?.();
      };

      // Watch for plugin state changes
      const checkPluginReady = setInterval(() => {
        const multiSegmentPlugin = player.multiSegmentLoop?.() as
          | MultiSegmentLoopPlugin
          | undefined;
        if (multiSegmentPlugin) {
          clearInterval(checkPluginReady);
          multiSegmentPlugin.setOnEnabledChange(updateButtonState);
          multiSegmentPlugin.setOnSegmentsChange(updateButtonState);
        }
      }, 100);

      return () => {
        clearInterval(checkPluginReady);
      };
    }, [getPlayer, segmentPresets.length]);

    // Update preset badge count when segmentPresets changes
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const controlBar = player.el()?.querySelector(".vjs-control-bar");
      if (!controlBar) return;

      const badge = controlBar.querySelector(
        ".vjs-multi-segment-badge"
      ) as HTMLElement | null;
      if (badge) {
        const count = segmentPresets.length;
        badge.textContent = count.toString();
        badge.style.display = count > 0 ? "" : "none";
      }
      // segmentPresets.length is derived from segmentPresets, no need to add separately
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getPlayer, segmentPresets]);

    // Create negative marker skip toggle button in control bar
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const controlBar = player.el()?.querySelector(".vjs-control-bar");
      if (!controlBar) return;

      const negativeMarkers = scene.negative_markers ?? [];

      // Remove existing button if present
      const existingBtn = controlBar.querySelector(
        ".vjs-negative-marker-skip-btn"
      );
      if (existingBtn) {
        existingBtn.remove();
      }

      // Only show button if there are negative markers
      if (negativeMarkers.length === 0) return;

      // Create the skip toggle button
      const skipButton = document.createElement("div");
      skipButton.className = "vjs-negative-marker-skip-btn vjs-button";
      skipButton.setAttribute("role", "button");
      skipButton.tabIndex = 0;
      skipButton.setAttribute("title", "Toggle Skip Negative Markers");

      const skipIcon = document.createElement("span");
      skipIcon.className = "vjs-icon-placeholder";
      skipIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor"><path d="M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416V96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4l192 160L224 224V96c0-12.4 7.2-23.7 18.4-29s24.5-3.6 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4s-18.4-16.6-18.4-29V288l-20.5 17.1-192 160z"/></svg>`;
      skipButton.appendChild(skipIcon);

      // Apply initial state
      if (negativeMarkerSkipEnabled) {
        skipButton.classList.add("vjs-negative-skip-active");
      }

      // Click handler
      skipButton.addEventListener("click", (e) => {
        e.stopPropagation();
        setNegativeMarkerSkipEnabled((prev) => {
          const newState = !prev;
          if (newState) {
            skipButton.classList.add("vjs-negative-skip-active");
          } else {
            skipButton.classList.remove("vjs-negative-skip-active");
          }
          return newState;
        });
      });

      // Insert after multi-segment loop toggle or at the start
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
    }, [getPlayer, scene.negative_markers, negativeMarkerSkipEnabled]);

    // Create performer image overlay button in control bar
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const controlBar = player.el()?.querySelector(".vjs-control-bar");
      if (!controlBar) return;

      // Check if button already exists
      if (controlBar.querySelector(".vjs-performer-image-overlay-btn")) return;

      // Create the image select button
      const overlayButton = document.createElement("div");
      overlayButton.className = "vjs-performer-image-overlay-btn vjs-button";
      overlayButton.setAttribute("role", "button");
      overlayButton.tabIndex = 0;
      overlayButton.setAttribute("title", "Select Vato Images");

      const iconSpan = document.createElement("span");
      iconSpan.className = "vjs-icon-placeholder";
      iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor"><path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"/></svg>`;
      overlayButton.appendChild(iconSpan);

      // Click handler - open the image selection modal
      overlayButton.addEventListener("click", (e) => {
        e.stopPropagation();
        setShowImageOverlayModal(true);
      });

      // Create the show/hide toggle button
      const toggleButton = document.createElement("div");
      toggleButton.className = "vjs-performer-image-toggle-btn vjs-button";
      toggleButton.setAttribute("role", "button");
      toggleButton.tabIndex = 0;
      toggleButton.setAttribute("title", "Toggle Image Visibility");
      toggleButton.style.display = "none"; // Hidden until images are selected

      const toggleIconSpan = document.createElement("span");
      toggleIconSpan.className = "vjs-icon-placeholder";
      // Eye icon for visibility toggle
      toggleIconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="16" height="16" fill="currentColor"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>`;
      toggleButton.appendChild(toggleIconSpan);

      // Click handler - toggle visibility
      toggleButton.addEventListener("click", (e) => {
        e.stopPropagation();
        setOverlaysVisible((prev) => !prev);
      });

      // Insert before playback rate button (same position pattern as multi-segment loop)
      const playbackRateBtn = controlBar.querySelector(".vjs-playback-rate");
      const multiSegmentEdit = controlBar.querySelector(
        ".vjs-multi-segment-edit"
      );

      // Insert both buttons together - overlay button first, then toggle button right after it
      if (multiSegmentEdit && multiSegmentEdit.nextSibling) {
        controlBar.insertBefore(overlayButton, multiSegmentEdit.nextSibling);
        // Insert toggle right after overlay button
        if (overlayButton.nextSibling) {
          controlBar.insertBefore(toggleButton, overlayButton.nextSibling);
        } else {
          controlBar.appendChild(toggleButton);
        }
      } else if (playbackRateBtn) {
        controlBar.insertBefore(overlayButton, playbackRateBtn);
        controlBar.insertBefore(toggleButton, playbackRateBtn);
      } else {
        const fullscreenBtn = controlBar.querySelector(
          ".vjs-fullscreen-control"
        );
        if (fullscreenBtn) {
          controlBar.insertBefore(overlayButton, fullscreenBtn);
          controlBar.insertBefore(toggleButton, fullscreenBtn);
        } else {
          controlBar.appendChild(overlayButton);
          controlBar.appendChild(toggleButton);
        }
      }
    }, [getPlayer]);

    // Update performer image overlay buttons based on state
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const controlBar = player.el()?.querySelector(".vjs-control-bar");
      const overlayBtn = controlBar?.querySelector(
        ".vjs-performer-image-overlay-btn"
      ) as HTMLElement | null;
      const toggleBtn = controlBar?.querySelector(
        ".vjs-performer-image-toggle-btn"
      ) as HTMLElement | null;

      // Show/hide toggle button based on whether images are selected
      if (toggleBtn) {
        toggleBtn.style.display =
          selectedOverlayImages.length > 0 ? "" : "none";

        // Update toggle button appearance based on visibility state
        if (overlaysVisible) {
          toggleBtn.classList.remove("hidden-state");
          toggleBtn.setAttribute("title", "Hide Performer Images");
        } else {
          toggleBtn.classList.add("hidden-state");
          toggleBtn.setAttribute("title", "Show Performer Images");
        }
      }

      // Update button active state based on selected images
      if (overlayBtn) {
        if (selectedOverlayImages.length > 0) {
          overlayBtn.classList.add("active");
        } else {
          overlayBtn.classList.remove("active");
        }
      }
    }, [getPlayer, selectedOverlayImages.length, overlaysVisible]);
    // CUSTOM: end

    useEffect(() => {
      if (scene.interactive && interactiveInitialised) {
        interactiveReady.current = false;
        uploadScript(scene.paths.funscript || "").then(() => {
          interactiveReady.current = true;
        });
      }
    }, [
      uploadScript,
      interactiveInitialised,
      scene.interactive,
      scene.paths.funscript,
    ]);

    // play the script if video started before script upload finished
    useEffect(() => {
      if (interactiveState !== ConnectionState.Ready) return;
      const player = getPlayer();
      if (!player || player.paused()) return;
      interactiveClient.ensurePlaying(player.currentTime());
    }, [interactiveState, getPlayer, interactiveClient]);

    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const vrMenu = player.vrMenu();

      let showButton = false;

      if (vrTag) {
        showButton = scene.tags.some((tag) => vrTag === tag.name);
      }

      vrMenu.setShowButton(showButton);
    }, [getPlayer, scene, vrTag]);

    // Player event handlers
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      function canplay(this: VideoJsPlayer) {
        // if we're seeking before starting, don't set the initial timestamp
        // when starting from the beginning, there is a small delay before the event
        // is triggered, so we can't just check if the time is 0
        if (this.currentTime() >= 0.1) {
          return;
        }
      }

      function playing(this: VideoJsPlayer) {
        // This still runs even if autoplay failed on Safari,
        // only set flag if actually playing
        if (!started.current && !this.paused()) {
          started.current = true;
        }
      }

      function loadstart(this: VideoJsPlayer) {
        setReady(true);
      }

      function fullscreenchange(this: VideoJsPlayer) {
        setFullscreen(this.isFullscreen());
      }

      player.on("canplay", canplay);
      player.on("playing", playing);
      player.on("loadstart", loadstart);
      player.on("fullscreenchange", fullscreenchange);

      return () => {
        player.off("canplay", canplay);
        player.off("playing", playing);
        player.off("loadstart", loadstart);
        player.off("fullscreenchange", fullscreenchange);
      };
    }, [getPlayer]);

    // delay before second play event after a play event to adjust for video player issues
    const DELAY_FOR_SECOND_PLAY_MS = 1000;
    const playingTimer = useRef<number>();

    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      function playing(this: VideoJsPlayer) {
        if (scene.interactive && interactiveReady.current) {
          interactiveClient.play(this.currentTime());
          // trigger a second script play event to adjust for video player issues
          clearTimeout(playingTimer.current);
          playingTimer.current = setTimeout(() => {
            if (this.paused()) return;
            interactiveClient.play(this.currentTime());
          }, DELAY_FOR_SECOND_PLAY_MS);
        }
      }

      function pause(this: VideoJsPlayer) {
        interactiveClient.pause();
      }

      function timeupdate(this: VideoJsPlayer) {
        if (this.paused()) return;
        setTime(this.currentTime());
      }

      player.on("playing", playing);
      player.on("pause", pause);
      player.on("timeupdate", timeupdate);

      return () => {
        player.off("playing", playing);
        player.off("pause", pause);
        player.off("timeupdate", timeupdate);
        clearTimeout(playingTimer.current);
      };
    }, [getPlayer, interactiveClient, scene]);

    // CUSTOM: begin - negative marker skip logic
    // Negative marker skip logic
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      const negativeMarkers = scene.negative_markers ?? [];
      if (negativeMarkers.length === 0) return;

      function checkNegativeMarkers(this: VideoJsPlayer) {
        if (!negativeMarkerSkipEnabled) return;
        if (this.paused()) return;

        const currentTime = this.currentTime();
        const now = Date.now();

        // Prevent rapid re-skipping (debounce 500ms)
        if (now - lastSkipTimeRef.current < 500) return;

        for (const marker of negativeMarkers) {
          if (
            currentTime >= marker.start_seconds &&
            currentTime < marker.end_seconds
          ) {
            // Skip to end of this negative marker
            lastSkipTimeRef.current = now;
            this.currentTime(marker.end_seconds);
            break;
          }
        }
      }

      player.on("timeupdate", checkNegativeMarkers);

      return () => {
        player.off("timeupdate", checkNegativeMarkers);
      };
    }, [getPlayer, scene.negative_markers, negativeMarkerSkipEnabled]);
    // CUSTOM: end

    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      // don't re-initialise the player unless the scene has changed
      if (!file || scene.id === sceneId.current) return;

      sceneId.current = scene.id;

      setReady(false);

      // reset on new scene
      player.trackActivity().reset();

      // always stop the interactive client on initialisation
      interactiveClient.pause();

      const isSafari = UAParser().browser.name?.includes("Safari");
      const isLandscape = file.height && file.width && file.width > file.height;
      const mobileUiOptions = {
        fullscreen: {
          enterOnRotate: true,
          exitOnRotate: true,
          lockOnRotate: true,
          lockToLandscapeOnEnter: uiConfig?.disableMobileMediaAutoRotateEnabled
            ? false
            : isLandscape,
        },
        touchControls: {
          disabled: true,
        },
      };
      if (!isSafari) {
        player.mobileUi(mobileUiOptions);
      }

      function isDirect(src: URL) {
        return (
          src.pathname.endsWith("/stream") ||
          src.pathname.endsWith("/stream.mpd") ||
          src.pathname.endsWith("/stream.m3u8")
        );
      }

      const { duration } = file;
      const sourceSelector = player.sourceSelector();
      sourceSelector.setSources(
        scene.sceneStreams
          .filter((stream) => {
            const src = new URL(stream.url);
            const isFileTranscode = !isDirect(src);

            return !(isFileTranscode && isSafari);
          })
          .map((stream) => {
            const src = new URL(stream.url);

            return {
              src: stream.url,
              type: stream.mime_type ?? undefined,
              label: stream.label ?? undefined,
              offset: !isDirect(src),
              duration,
            };
          })
      );

      function getDefaultLanguageCode() {
        let languageCode = window.navigator.language;

        if (languageCode.indexOf("-") !== -1) {
          languageCode = languageCode.split("-")[0];
        }

        if (languageCode.indexOf("_") !== -1) {
          languageCode = languageCode.split("_")[0];
        }

        return languageCode;
      }

      if (scene.captions && scene.captions.length > 0) {
        const languageCode = getDefaultLanguageCode();
        let hasDefault = false;

        for (let caption of scene.captions) {
          const lang = caption.language_code;
          let label = lang;
          if (languageMap.has(lang)) {
            label = languageMap.get(lang)!;
          }

          label = label + " (" + caption.caption_type + ")";
          const setAsDefault = !hasDefault && languageCode == lang;
          if (setAsDefault) {
            hasDefault = true;
          }
          sourceSelector.addTextTrack(
            {
              src: `${scene.paths.caption}?lang=${lang}&type=${caption.caption_type}`,
              kind: "captions",
              srclang: lang,
              label: label,
              default: setAsDefault,
            },
            false
          );
        }
      }

      const alwaysStartFromBeginning =
        uiConfig?.alwaysStartFromBeginning ?? false;
      const resumeTime = scene.resume_time ?? 0;

      let startPosition = _initialTimestamp;
      if (
        !startPosition &&
        !alwaysStartFromBeginning &&
        file.duration > resumeTime
      ) {
        startPosition = resumeTime;
      }

      setTime(startPosition);

      player.load();
      player.focus();

      // Check the autostart button plugin for user preference
      const autostartButton = player.autostartButton();
      const buttonEnabled = autostartButton.getEnabled();
      auto.current =
        autoplay ||
        buttonEnabled ||
        (interfaceConfig?.autostartVideo ?? false) ||
        _initialTimestamp > 0;

      player.ready(() => {
        player.vttThumbnails().src(scene.paths.vtt ?? null);

        if (startPosition) {
          player.currentTime(startPosition);
        }
      });

      started.current = false;
    }, [
      getPlayer,
      file,
      scene,
      interactiveClient,
      autoplay,
      interfaceConfig?.autostartVideo,
      uiConfig?.alwaysStartFromBeginning,
      uiConfig?.disableMobileMediaAutoRotateEnabled,
      _initialTimestamp,
    ]);

    useEffect(() => {
      return () => {
        // stop the interactive client on unmount
        interactiveClient.pause();
      };
    }, [interactiveClient]);

    const loadMarkers = useCallback(() => {
      const player = getPlayer();
      if (!player) return;

      const markerData = scene.scene_markers.map((marker) => ({
        title: getMarkerTitle(marker),
        seconds: marker.seconds,
        end_seconds: marker.end_seconds ?? null,
        primaryTag: marker.primary_tag,
        top_performers: marker.top_performers?.map((p) => ({
          id: p.id,
          name: p.name,
        })), // CUSTOM
        bottom_performers: marker.bottom_performers?.map((p) => ({
          id: p.id,
          name: p.name,
        })), // CUSTOM
      }));

      const markers = player!.markers();

      // CUSTOM: provide known duration so markers render before playback (preload=none means player.duration() is 0 until play)
      if (file?.duration) {
        markers.setFallbackDuration(file.duration);
      }

      const uniqueTagNames = markerData
        .map((marker) => marker.primaryTag.name)
        .filter((value, index, self) => self.indexOf(value) === index);

      // Wait for colors
      markers.findColors(uniqueTagNames);

      const showRangeTags =
        !ScreenUtils.isMobile() && (uiConfig?.showRangeMarkers ?? true);
      const timestampMarkers: IMarker[] = [];
      const rangeMarkers: IMarker[] = [];

      if (!showRangeTags) {
        for (const marker of markerData) {
          timestampMarkers.push(marker);
        }
      } else {
        for (const marker of markerData) {
          if (marker.end_seconds === null) {
            timestampMarkers.push(marker);
          } else {
            rangeMarkers.push(marker);
          }
        }
      }

      requestAnimationFrame(() => {
        markers.addDotMarkers(timestampMarkers);
        markers.addRangeMarkers(rangeMarkers);

        // CUSTOM: begin - add negative markers (displayed in red)
        const negativeMarkers = scene.negative_markers ?? [];
        if (negativeMarkers.length > 0) {
          markers.addNegativeMarkers(
            negativeMarkers.map((m) => ({
              id: m.id,
              name: m.name,
              start_seconds: m.start_seconds,
              end_seconds: m.end_seconds,
            }))
          );
        }
        // CUSTOM: end

        // CUSTOM: begin - add O timestamp markers (gold glowing dots)
        const oTimestampEntries = (scene.o_timestamps ?? [])
          .map((ts, i) =>
            ts !== null && ts !== undefined
              ? { ts, date: (scene.o_history ?? [])[i] ?? "" }
              : null
          )
          .filter((x): x is { ts: number; date: string } => x !== null);
        markers.addOTimestampMarkers(oTimestampEntries);
        // CUSTOM: end
      });
    }, [getPlayer, scene, uiConfig, file]); // CUSTOM: file added so duration is current when scene changes

    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      if (scene.paths.screenshot) {
        player.poster(scene.paths.screenshot);
      } else {
        player.poster("");
      }

      // Define the event handler outside the useEffect
      const handleLoadMetadata = () => {
        loadMarkers();
      };

      // CUSTOM: begin - always load markers immediately so indicators are visible before play is pressed.
      // With preload=none, readyState is 0 until the user presses play, so the old else-branch (only
      // registering loadedmetadata) meant markers never appeared until playback started.
      // We now always call loadMarkers() right away (using the fallback duration from scene file data),
      // and also register loadedmetadata so markers are re-drawn with the real duration once metadata loads.
      loadMarkers();
      if (player.readyState() < 1) {
        player.on("loadedmetadata", handleLoadMetadata);
      }
      // CUSTOM: end

      return () => {
        player.off("loadedmetadata", handleLoadMetadata);
        const markers = player!.markers();
        markers.clearMarkers();
      };
    }, [getPlayer, scene, loadMarkers]);

    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      async function saveActivity(resumeTime: number, playDuration: number) {
        if (!scene.id) return;

        await sceneSaveActivity({
          variables: {
            id: scene.id,
            playDuration,
            resume_time: resumeTime,
          },
        });
      }

      async function incrementPlayCount() {
        if (!scene.id) return;

        await sceneIncrementPlayCount({
          variables: {
            id: scene.id,
          },
        });
      }

      const activity = player.trackActivity();
      activity.saveActivity = saveActivity;
      activity.incrementPlayCount = incrementPlayCount;
      activity.minimumPlayPercent = minimumPlayPercent;
      activity.setEnabled(trackActivity);
    }, [
      getPlayer,
      scene,
      vrTag,
      trackActivity,
      minimumPlayPercent,
      sceneIncrementPlayCount,
      sceneSaveActivity,
    ]);

    // Sync autostart button with config changes
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      async function updateAutoStart(enabled: boolean) {
        await updateInterfaceConfig({
          variables: {
            input: {
              autostartVideo: enabled,
            },
          },
        });
      }

      const autostartButton = player.autostartButton();
      if (autostartButton) {
        autostartButton.syncWithConfig(
          interfaceConfig?.autostartVideo ?? false
        );
        autostartButton.updateAutoStart = updateAutoStart;
      }
    }, [getPlayer, updateInterfaceConfig, interfaceConfig?.autostartVideo]);

    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      player.loop(looping);
      interactiveClient.setLooping(looping);
    }, [getPlayer, interactiveClient, looping]);

    useEffect(() => {
      const player = getPlayer();
      if (!player || !ready || !auto.current) {
        return;
      }

      // check if we're waiting for the interactive client
      if (
        scene.interactive &&
        interactiveClient.handyKey &&
        currentScript !== scene.paths.funscript
      ) {
        return;
      }

      player.play();
      auto.current = false;
    }, [getPlayer, scene, ready, interactiveClient, currentScript]);

    // Attach handler for onComplete event
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      player.on("ended", onComplete);

      return () => player.off("ended");
    }, [getPlayer, onComplete]);

    // set up mediaSession plugin
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;

      // set up mediasession plugin
      // get performer names as array
      const performers = scene?.performers.map((p) => p.name).join(", ");
      player
        .mediaSession()
        .setMetadata(
          scene?.title ?? "Stash",
          scene?.studio?.name ?? performers ?? "Stash",
          scene.paths.screenshot || ""
        );
    }, [getPlayer, scene]);

    const pausedBeforeScrubber = useRef(true);

    function onScrubberScroll() {
      const player = getPlayer();
      if (started.current && player) {
        pausedBeforeScrubber.current = player.paused();
        player.pause();
      }
    }

    function onScrubberSeek(seconds: number) {
      const player = getPlayer();
      if (started.current && player) {
        player.currentTime(seconds);
        if (!pausedBeforeScrubber.current) {
          player.play();
        }
      } else {
        setTime(seconds);
      }
    }

    // Override spacebar to always pause/play
    function onKeyDown(this: HTMLDivElement, event: KeyboardEvent) {
      const player = getPlayer();
      if (!player) return;

      // CUSTOM: begin - don't intercept keyboard events when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      // CUSTOM: end

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.key == " ") {
        event.preventDefault();
        event.stopPropagation();
        if (player.paused()) {
          player.play();
        } else {
          player.pause();
        }
      }
    }

    const isPortrait =
      file && file.height && file.width && file.height > file.width;

    // CUSTOM: begin - determine if scene has markers with facial / really hot facial tag
    // Helper to check if a tag matches (including recursive parent/child relationships)
    const tagMatchesScenePlayer = (
      tag: ScenePlayerTagTree | null | undefined,
      targetId: string,
      visited: Set<string> = new Set()
    ): boolean => {
      if (!tag) return false;
      if (tag.id === targetId) return true;
      if (visited.has(tag.id)) return false;
      visited.add(tag.id);
      const parents = tag.parents ?? [];
      return parents.some((p) => tagMatchesScenePlayer(p, targetId, visited));
    };

    const markerHasTagScenePlayer = (
      marker: ScenePlayerMarkerWithTags,
      tagId: string
    ): boolean => {
      if (tagMatchesScenePlayer(marker?.primary_tag, tagId)) return true;
      return (marker?.tags ?? []).some((t) => tagMatchesScenePlayer(t, tagId));
    };

    const roleTagIds =
      (
        configuration?.ui as unknown as {
          roleTagIds?: { facialTagId?: string; reallyHotTagId?: string };
        }
      )?.roleTagIds ?? {};

    // Determine if the scene has any markers with the configured facial tag or any of its subtags
    const hasFacial = useMemo(() => {
      const { facialTagId } = roleTagIds;
      if (!facialTagId) return false;
      const markers = scene.scene_markers ?? [];
      return markers.some((marker) =>
        markerHasTagScenePlayer(marker, facialTagId)
      );
    }, [scene.scene_markers, configuration?.ui]); // eslint-disable-line react-hooks/exhaustive-deps

    // Gold goatee: scene has a marker with BOTH facial tag AND really hot tag
    const hasReallyHotFacial = useMemo(() => {
      const { facialTagId, reallyHotTagId } = roleTagIds;
      if (!facialTagId || !reallyHotTagId) return false;
      const markers = scene.scene_markers ?? [];
      return markers.some(
        (marker) =>
          markerHasTagScenePlayer(marker, facialTagId) &&
          markerHasTagScenePlayer(marker, reallyHotTagId)
      );
    }, [scene.scene_markers, configuration?.ui]); // eslint-disable-line react-hooks/exhaustive-deps
    // CUSTOM: end

    return (
      <div
        className={cx("VideoPlayer", {
          portrait: isPortrait,
          "no-file": !file,
        })}
        onKeyDownCapture={onKeyDown}
      >
        <div className="video-wrapper" ref={videoRef}>
          {/* CUSTOM: begin - facial goatee overlay (white) or gold (really hot facial) */}
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
          {/* CUSTOM: end */}
        </div>
        {scene.interactive &&
          (interactiveState !== ConnectionState.Ready ||
            getPlayer()?.paused()) && <SceneInteractiveStatus />}
        {file && showScrubber && (
          <ScenePlayerScrubber
            file={file}
            scene={scene}
            time={time}
            onSeek={onScrubberSeek}
            onScroll={onScrubberScroll}
          />
        )}
        {/* CUSTOM: begin - multi-segment loop controls, performer image overlay modal, performer image overlays */}
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
              isFullscreen={fullscreen}
            />,
            fullscreen && _player?.el() ? _player.el()! : document.body
          )}
        {/* Performer Image Overlay Modal */}
        {showImageOverlayModal &&
          createPortal(
            <PerformerImageSelectModal
              performerIds={scene.performers.map((p) => p.id)}
              galleryIds={[
                ...(scene.galleries?.map((g) => g.id) ?? []),
                ...(scene.releases?.flatMap(
                  (r) => r.galleries?.map((g) => g.id) ?? []
                ) ?? []),
              ]}
              selectedImages={selectedOverlayImages}
              onConfirm={(images) => setSelectedOverlayImages(images)}
              onClose={() => setShowImageOverlayModal(false)}
              isFullscreen={fullscreen}
            />,
            fullscreen && _player?.el() ? _player.el()! : document.body
          )}
        {/* Performer Image Overlays */}
        {selectedOverlayImages.length > 0 && (
          <PerformerImageOverlay
            images={selectedOverlayImages}
            portalTarget={(_player?.el() as HTMLElement) ?? null}
            isFullscreen={fullscreen}
            overlaysVisible={overlaysVisible}
          />
        )}
        {/* CUSTOM: end */}
      </div>
    );
  }
);

export default ScenePlayer;
