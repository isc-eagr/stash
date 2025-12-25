import React, {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import videojs, { VideoJsPlayer, VideoJsPlayerOptions } from "video.js";
import useScript from "src/hooks/useScript";
import "videojs-contrib-dash";
import "videojs-mobile-ui";
import "videojs-seek-buttons";
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
import goateeSvg from "src/assets/goatee.svg";

// Multi-segment loop plugin
import "./multi-segment-loop";
import type MultiSegmentLoopPlugin from "./multi-segment-loop";
import type { ILoopSegment, ILoopSegmentInput, IMultiSegmentLoopApi } from "./multi-segment-loop";
import { MultiSegmentLoopControls } from "./MultiSegmentLoopControls";

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
  performers?: Array<Pick<GQL.Performer, "name">>;
};

type SegmentPreset = {
  id?: string;
  name: string;
  segments: ILoopSegmentInput[];
  enabled: boolean;
  currentSegmentIndex: number;
};

function getMarkerTitle(marker: MarkerFragment) {
  let ret = "";
  
  if (marker.title) {
    ret = marker.title;
  } else {
    ret = marker.primary_tag.name;
    if (marker.tags.length) {
      ret += `, ${marker.tags.map((t) => t.name).join(", ")}`;
    }
  }

  // Append performer names if present
  if (marker.performers && marker.performers.length > 0) {
    const performerNames = marker.performers.map((p) => p.name).join(", ");
    ret += ` [${performerNames}]`;
  }

  return ret;
}

interface IScenePlayerProps {
  scene: GQL.SceneDataFragment;
  hideScrubberOverride: boolean;
  autoplay?: boolean;
  permitLoop?: boolean;
  initialTimestamp: number;
  sendSetTimestamp: (setTimestamp: (value: number) => void) => void;
  sendMultiSegmentLoopApi?: (api: IMultiSegmentLoopApi) => void;
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
    sendMultiSegmentLoopApi,
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
    const [segmentPresets, setSegmentPresets] = useState<SegmentPreset[]>([]);
    const [multiSegments, setMultiSegments] = useState<ILoopSegment[]>([]);
    const [multiSegmentEnabled, setMultiSegmentEnabled] = useState(false);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [pendingStart, setPendingStart] = useState<number | null>(null);
    const [showPresetModal, setShowPresetModal] = useState(false);

    const [saveLoopPreset] = GQL.useSaveSceneMultiSegmentLoopPresetMutation();
    const [deleteLoopPreset] = GQL.useDeleteSceneMultiSegmentLoopPresetMutation();

    const handleDeleteSegmentPreset = useCallback(
      async (name: string) => {
        const preset = segmentPresets.find(
          (p) => p.name.toLowerCase() === name.toLowerCase()
        );

        if (!preset) return;

        try {
          await deleteLoopPreset({ variables: { scene_id: scene.id, name: preset.name } });
          setSegmentPresets((prev) =>
            prev.filter((p) => p.name.toLowerCase() !== name.toLowerCase())
          );
        } catch (error) {
          console.warn("Failed to delete multi-segment loop preset", error);
        }
      },
      [segmentPresets, deleteLoopPreset, scene.id]
    );

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

    useEffect(() => {
      const presets = (scene.multi_segment_loop_presets ?? []).map((preset) => ({
        id: preset.id ?? undefined,
        name: preset.name,
        enabled: preset.enabled ?? false,
        currentSegmentIndex: preset.current_segment_index ?? 0,
        segments: (preset.segments ?? []).map((s) => ({
          start: s.start ?? 0,
          end: s.end ?? 0,
        })),
      }));

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
            const { start, end: endRaw } = s;
            const end = endRaw > start ? endRaw : start + 1;
            multiSegmentPlugin.addSegment(start, end);
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
              id: `imported_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
        inactivityTimeout: 2000,
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
          seekButtons: {
            forward: 10,
            back: 10,
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
          multiSegmentLoop: {
            segments: [],
            enabled: false,
            currentSegmentIndex: 0,
            createButton: false, // We create our own consolidated dropdown button
          },
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

    // Multi-segment loop plugin setup
    useEffect(() => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
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
      
      // Sync pending start
      const syncPending = () => {
        setPendingStart(multiSegmentPlugin.getPendingStart());
      };
      
      // Initial sync
      setMultiSegments(multiSegmentPlugin.getSegments());
      setMultiSegmentEnabled(multiSegmentPlugin.isEnabled());
      setCurrentSegmentIndex(multiSegmentPlugin.getCurrentSegmentIndex());
      syncPending();
    }, [getPlayer]);

    // Multi-segment loop control handlers
    const handleMultiSegmentMarkPoint = useCallback(() => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      multiSegmentPlugin.markPoint();
      setPendingStart(multiSegmentPlugin.getPendingStart());
      // Force sync segments after marking (in case callback doesn't trigger)
      setMultiSegments([...multiSegmentPlugin.getSegments()]);
    }, [getPlayer]);

    const handleMultiSegmentCancelPending = useCallback(() => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      multiSegmentPlugin.cancelPending();
      setPendingStart(null);
    }, [getPlayer]);

    const handleMultiSegmentToggleEnabled = useCallback(() => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      multiSegmentPlugin.toggleEnabled();
      // Force sync enabled state
      setMultiSegmentEnabled(multiSegmentPlugin.isEnabled());
    }, [getPlayer]);

    const handleMultiSegmentRemove = useCallback((id: string) => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      multiSegmentPlugin.removeSegment(id);
      // Force sync after remove
      setMultiSegments([...multiSegmentPlugin.getSegments()]);
    }, [getPlayer]);

    const handleMultiSegmentClear = useCallback(() => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      multiSegmentPlugin.clearSegments();
      // Force sync after clear
      setMultiSegments([...multiSegmentPlugin.getSegments()]);
    }, [getPlayer]);

    const handleMultiSegmentJumpTo = useCallback((index: number) => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      multiSegmentPlugin.jumpToSegment(index);
    }, [getPlayer]);

    const handleMultiSegmentReorder = useCallback((fromIndex: number, toIndex: number) => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      multiSegmentPlugin.reorderSegment(fromIndex, toIndex);
      // Force sync after reorder
      setMultiSegments([...multiSegmentPlugin.getSegments()]);
    }, [getPlayer]);

    const handleMultiSegmentUpdateStart = useCallback((id: string) => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      const currentTime = player.currentTime() || 0;
      const segment = multiSegmentPlugin.getSegments().find(s => s.id === id);
      if (!segment) return;
      
      multiSegmentPlugin.updateSegment(id, currentTime, segment.end);
    }, [getPlayer]);

    const handleMultiSegmentUpdateEnd = useCallback((id: string) => {
      const player = getPlayer();
      if (!player) return;
      
      const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
      if (!multiSegmentPlugin) return;
      
      const currentTime = player.currentTime() || 0;
      const segment = multiSegmentPlugin.getSegments().find(s => s.id === id);
      if (!segment) return;
      
      multiSegmentPlugin.updateSegment(id, segment.start, currentTime);
    }, [getPlayer]);

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
          const result = await saveLoopPreset({ variables: { input: presetInput } });
          const saved = result.data?.saveSceneMultiSegmentLoopPreset;
          if (!saved) return false;

          const updated: SegmentPreset = {
            id: saved.id ?? undefined,
            name: saved.name,
            enabled: saved.enabled ?? false,
            currentSegmentIndex: saved.current_segment_index ?? 0,
            segments: (saved.segments ?? []).map((s) => ({ start: s.start ?? 0, end: s.end ?? 0 })),
          };

          setSegmentPresets((prev) => {
            const index = prev.findIndex((p) => p.name.toLowerCase() === updated.name.toLowerCase());
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
      [multiSegments, multiSegmentEnabled, currentSegmentIndex, scene.id, saveLoopPreset]
    );

    const handleLoadSegmentPreset = useCallback(
      (name: string) => {
        const player = getPlayer();
        if (!player) return false;

        const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
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

        // Create edit button (pencil icon)
        const editButton = document.createElement("div");
        editButton.className = "vjs-multi-segment-edit vjs-button";
        editButton.setAttribute("role", "button");
        editButton.tabIndex = 0;

        const editIcon = document.createElement("span");
        editIcon.className = "vjs-icon-placeholder";
        editIcon.textContent = "✏️";
        editButton.appendChild(editIcon);

        // Update toggle button state
        const updateToggleState = () => {
          const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
          const isEnabled = multiSegmentPlugin?.isEnabled() ?? false;
          const hasSegments = (multiSegmentPlugin?.getSegments()?.length ?? 0) > 0;

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
          const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
          if (!multiSegmentPlugin) return;
          
          const hasSegments = (multiSegmentPlugin.getSegments()?.length ?? 0) > 0;
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
          const fullscreenBtn = controlBar.querySelector(".vjs-fullscreen-control");
          if (fullscreenBtn) {
            controlBar.insertBefore(editButton, fullscreenBtn);
            controlBar.insertBefore(toggleButton, editButton);
          } else {
            controlBar.appendChild(toggleButton);
            controlBar.appendChild(editButton);
          }
        }

        // Store update function for later use
        (toggleButton as any).__updateState = updateToggleState;

        return true;
      };

      createButtons();

      // Update button state when segments or enabled state changes
      const updateButtonState = () => {
        const toggleBtn = controlBar.querySelector(".vjs-multi-segment-toggle") as any;
        toggleBtn?.__updateState?.();
      };

      // Watch for plugin state changes
      const checkPluginReady = setInterval(() => {
        const multiSegmentPlugin = player.multiSegmentLoop?.() as MultiSegmentLoopPlugin | undefined;
        if (multiSegmentPlugin) {
          clearInterval(checkPluginReady);
          multiSegmentPlugin.setOnEnabledChange(updateButtonState);
          multiSegmentPlugin.setOnSegmentsChange(updateButtonState);
        }
      }, 100);

      return () => {
        clearInterval(checkPluginReady);
      };
    }, [getPlayer]);

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
      }));

      const markers = player!.markers();

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
      });
    }, [getPlayer, scene, uiConfig]);

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

      // Ensure markers are added after player is fully ready and sources are loaded
      if (player.readyState() >= 1) {
        loadMarkers();
      } else {
        player.on("loadedmetadata", handleLoadMetadata);
      }

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

    function onScrubberScroll() {
      if (started.current) {
        getPlayer()?.pause();
      }
    }

    function onScrubberSeek(seconds: number) {
      if (started.current) {
        getPlayer()?.currentTime(seconds);
      } else {
        setTime(seconds);
      }
    }

    // Override spacebar to always pause/play
    function onKeyDown(this: HTMLDivElement, event: KeyboardEvent) {
      const player = getPlayer();
      if (!player) return;

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

    // Determine if the scene has any markers with the configured facial tag
    const hasFacial = useMemo(() => {
      const facialTagId = (configuration?.ui as unknown as { roleTagIds?: { facialTagId?: string } })?.roleTagIds?.facialTagId;
      if (!facialTagId) return false;

      const markers = scene.scene_markers ?? [];
      // Check if any marker's primary_tag or tags contain the facial tag
      return markers.some((marker) => {
        if (marker.primary_tag?.id === facialTagId) return true;
        return (marker.tags ?? []).some((tag) => tag.id === facialTagId);
      });
    }, [scene.scene_markers, configuration?.ui]);



    return (
      <div
        className={cx("VideoPlayer", {
          portrait: isPortrait,
          "no-file": !file,
        })}
        onKeyDownCapture={onKeyDown}
      >
        <div className="video-wrapper" ref={videoRef}>
          {hasFacial && (
            <img
              className="scene-facial-overlay"
              src={goateeSvg}
              alt="Facial"
              title="Facial tags present"
            />
          )}
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
        {showPresetModal &&
          createPortal(
            <MultiSegmentLoopControls
              segments={multiSegments}
              enabled={multiSegmentEnabled}
              currentSegmentIndex={currentSegmentIndex}
              pendingStart={pendingStart}
              onMarkPoint={handleMultiSegmentMarkPoint}
              onCancelPending={handleMultiSegmentCancelPending}
              onToggleEnabled={handleMultiSegmentToggleEnabled}
              onRemoveSegment={handleMultiSegmentRemove}
              onClearSegments={handleMultiSegmentClear}
              onJumpToSegment={handleMultiSegmentJumpTo}
              onReorderSegment={handleMultiSegmentReorder}
              onUpdateSegmentStart={handleMultiSegmentUpdateStart}
              onUpdateSegmentEnd={handleMultiSegmentUpdateEnd}
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
      </div>
    );
  }
);

export default ScenePlayer;
