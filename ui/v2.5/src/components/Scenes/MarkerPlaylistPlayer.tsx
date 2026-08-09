import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  Button,
  ListGroup,
  Badge,
  Form,
  Modal,
  Dropdown,
} from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { HoverPopover } from "src/components/Shared/HoverPopover"; // CUSTOM
import {
  faPlay,
  faPause,
  faRedo,
  faArrowUp,
  faArrowDown,
  faList,
  faTimes,
  faExpand,
  faSave,
  faFolderOpen,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import cx from "classnames";
import {
  useFindMarkerPlaylistsQuery,
  useMarkerPlaylistCreate,
  useMarkerPlaylistDestroy,
} from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import {
  getNextSceneMarkerIndexCustom,
  markerPreloadMatchesCustom,
} from "./markerPlaylistPreload_custom";
import "./MarkerPlaylistPlayer.scss";

const FIND_MARKERS_FOR_PLAYLIST = gql`
  query FindMarkersForPlaylist($ids: [ID!]) {
    findSceneMarkers(ids: $ids) {
      scene_markers {
        ...SceneMarkerData
      }
    }
  }
  ${GQL.SceneMarkerDataFragmentDoc}
`;

interface IFindMarkersForPlaylistResult {
  findSceneMarkers: {
    scene_markers: GQL.SceneMarkerDataFragment[];
  };
}

function performerDisplayName(p: {
  name: string;
  disambiguation?: string | null;
}) {
  return p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name;
}

// CUSTOM: begin - marker performer chip hover data
interface IPerformerHoverPerformer {
  id: string;
  name: string;
  image_path?: string | null;
  disambiguation?: string | null;
}
// CUSTOM: end

interface IMarkerInfo {
  id: string;
  title: string;
  seconds: number;
  end_seconds: number | null;
  sceneId: string;
  sceneTitle: string;
  streamUrl: string;
  previewUrl: string;
  topPerformers?: IPerformerHoverPerformer[]; // CUSTOM
  bottomPerformers?: IPerformerHoverPerformer[]; // CUSTOM
}

interface IPreparedVideoSlot {
  markerId: string;
  sceneId: string;
  seconds: number;
  ready: boolean;
}

export const MarkerPlaylistPlayer: React.FC = () => {
  const intl = useIntl();
  const location = useLocation();
  const Toast = useToast();

  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const preloadVideoRef = useRef<HTMLVideoElement>(null);
  const videoRefs = useMemo(
    () => [primaryVideoRef, preloadVideoRef] as const,
    []
  );
  const activeVideoSlotRef = useRef(0);
  const preparedVideoSlotsRef = useRef<Array<IPreparedVideoSlot | null>>([
    null,
    null,
  ]);
  const videoSlotLoadTokensRef = useRef([0, 0]);
  const videoSlotReadyCallbacksRef = useRef<Array<(() => void) | undefined>>([
    undefined,
    undefined,
  ]);
  const markerLoadRequestRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const initialLoadedRef = useRef(false);
  const [markers, setMarkers] = useState<IMarkerInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeVideoSlot, setActiveVideoSlot] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loopEnabled, _setLoopEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loopSingleMarkerId, setLoopSingleMarkerId] = useState<string | null>(
    null
  );
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const fullscreenOverlayTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Save/Load playlist state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);

  const { data: playlistsData, refetch: refetchPlaylists } =
    useFindMarkerPlaylistsQuery();
  const [createPlaylist] = useMarkerPlaylistCreate();
  const [destroyPlaylist] = useMarkerPlaylistDestroy();

  // Parse marker IDs from URL
  const markerIds = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = params.get("ids");
    return ids ? ids.split(",").filter(Boolean) : [];
  }, [location.search]);

  const { data, loading } = useQuery<IFindMarkersForPlaylistResult>(
    FIND_MARKERS_FOR_PLAYLIST,
    {
      skip: markerIds.length === 0,
      variables: { ids: markerIds },
    }
  );

  useEffect(() => {
    if (markerIds.length === 0) {
      setMarkers([]);
      return;
    }

    const fetchedMarkers = data?.findSceneMarkers.scene_markers;
    if (!fetchedMarkers) return;

    // Sort markers to maintain the order from the URL
    const sortedMarkers = markerIds
      .map((id) => fetchedMarkers.find((m) => m.id === id))
      .filter((m): m is GQL.SceneMarkerDataFragment => m !== undefined)
      .map((m) => {
        // Use scene.paths.stream if available, otherwise construct the URL
        const streamUrl =
          m.scene.paths?.stream || `/scene/${m.scene.id}/stream`;

        const topPerformers = (m.top_performers ?? []).map((p) => ({
          id: p.id,
          name: performerDisplayName(p),
          image_path: p.image_path,
          disambiguation: p.disambiguation,
        }));

        const bottomPerformers = (m.bottom_performers ?? []).map((p) => ({
          id: p.id,
          name: performerDisplayName(p),
          image_path: p.image_path,
          disambiguation: p.disambiguation,
        }));

        return {
          id: m.id,
          title: markerTitle(m),
          seconds: m.seconds,
          end_seconds: m.end_seconds ?? null,
          sceneId: m.scene.id,
          sceneTitle: m.scene.title || "Untitled Scene",
          streamUrl,
          previewUrl: m.preview,
          topPerformers: topPerformers.length > 0 ? topPerformers : undefined,
          bottomPerformers:
            bottomPerformers.length > 0 ? bottomPerformers : undefined,
        };
      });

    setMarkers(sortedMarkers);
    setCurrentIndex(0);
    preparedVideoSlotsRef.current = [null, null];
    markerLoadRequestRef.current += 1;
    initialLoadedRef.current = false;
  }, [data?.findSceneMarkers.scene_markers, markerIds]);

  const getActiveVideo = useCallback(
    () => videoRefs[activeVideoSlotRef.current].current,
    [videoRefs]
  );

  const prepareVideoSlot = useCallback(
    (slot: number, marker: IMarkerInfo, onReady?: () => void) => {
      const video = videoRefs[slot].current;
      if (!video) return;

      const preparedSlot = preparedVideoSlotsRef.current[slot];
      if (markerPreloadMatchesCustom(preparedSlot, marker)) {
        if (preparedSlot?.ready) {
          onReady?.();
        } else if (onReady) {
          videoSlotReadyCallbacksRef.current[slot] = onReady;
        }
        return;
      }

      const loadToken = videoSlotLoadTokensRef.current[slot] + 1;
      videoSlotLoadTokensRef.current[slot] = loadToken;
      videoSlotReadyCallbacksRef.current[slot] = onReady;
      preparedVideoSlotsRef.current[slot] = {
        markerId: marker.id,
        sceneId: marker.sceneId,
        seconds: marker.seconds,
        ready: false,
      };

      video.pause();
      video.muted = true;
      video.preload = "auto";

      const isCurrentLoad = () =>
        videoSlotLoadTokensRef.current[slot] === loadToken;

      const finishPreparing = () => {
        if (!isCurrentLoad() || video.seeking) return;
        if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;

        const currentPreparedSlot = preparedVideoSlotsRef.current[slot];
        if (
          !currentPreparedSlot ||
          !markerPreloadMatchesCustom(currentPreparedSlot, marker)
        ) {
          return;
        }

        currentPreparedSlot.ready = true;
        const readyCallback = videoSlotReadyCallbacksRef.current[slot];
        videoSlotReadyCallbacksRef.current[slot] = undefined;
        readyCallback?.();
      };

      const seekToMarker = () => {
        if (!isCurrentLoad()) return;

        video.addEventListener("seeked", finishPreparing, { once: true });
        video.addEventListener("canplay", finishPreparing, { once: true });
        video.currentTime = marker.seconds;
        finishPreparing();
      };

      if (
        video.getAttribute("src") === marker.streamUrl &&
        video.readyState >= HTMLMediaElement.HAVE_METADATA
      ) {
        seekToMarker();
      } else {
        video.addEventListener("loadedmetadata", seekToMarker, { once: true });
        video.src = marker.streamUrl;
        video.load();
      }
    },
    [videoRefs]
  );

  const activatePreparedVideoSlot = useCallback(
    (slot: number, index: number, marker: IMarkerInfo, autoPlay: boolean) => {
      const previousVideo = getActiveVideo();
      const nextVideo = videoRefs[slot].current;
      if (!nextVideo) return;

      if (previousVideo && previousVideo !== nextVideo) {
        nextVideo.volume = previousVideo.volume;
        nextVideo.muted = previousVideo.muted;
        previousVideo.pause();
      } else {
        nextVideo.muted = false;
      }

      if (Math.abs(nextVideo.currentTime - marker.seconds) > 0.05) {
        nextVideo.currentTime = marker.seconds;
      }
      activeVideoSlotRef.current = slot;
      setActiveVideoSlot(slot);
      setCurrentIndex(index);
      setIsPlaying(autoPlay);

      if (autoPlay) {
        nextVideo.play().catch((error) => {
          setIsPlaying(false);
          console.error(error);
        });
      }
    },
    [getActiveVideo, videoRefs]
  );

  // Load a specific marker
  const loadMarker = useCallback(
    (index: number, autoPlay = true) => {
      const video = getActiveVideo();
      if (!video || index < 0 || index >= markers.length) return;

      const marker = markers[index];
      const activeSlot = activeVideoSlotRef.current;
      const activePreparedSlot = preparedVideoSlotsRef.current[activeSlot];
      const requestId = markerLoadRequestRef.current + 1;
      markerLoadRequestRef.current = requestId;

      if (activePreparedSlot?.sceneId === marker.sceneId) {
        video.currentTime = marker.seconds;
        preparedVideoSlotsRef.current[activeSlot] = {
          markerId: marker.id,
          sceneId: marker.sceneId,
          seconds: marker.seconds,
          ready: true,
        };
        setCurrentIndex(index);
        if (autoPlay) {
          video.play().catch(console.error);
        }
        return;
      }

      const targetSlot = activeSlot === 0 ? 1 : 0;
      video.pause();
      prepareVideoSlot(targetSlot, marker, () => {
        if (markerLoadRequestRef.current !== requestId) return;
        activatePreparedVideoSlot(targetSlot, index, marker, autoPlay);
      });
    },
    [activatePreparedVideoSlot, getActiveVideo, markers, prepareVideoSlot]
  );

  // Handle timeupdate to check for marker end
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || markers.length === 0) return;

    const handleTimeUpdate = () => {
      const marker = markers[currentIndex];
      if (!marker) return;

      const { currentTime } = video;
      const endTime = marker.end_seconds ?? marker.seconds + 20; // Default 20s if no end

      if (currentTime >= endTime) {
        // Check if this marker is set to single loop
        if (loopSingleMarkerId === marker.id) {
          // Loop back to the start of this same marker
          video.currentTime = marker.seconds;
          return;
        }

        // Move to next marker
        const nextIndex = currentIndex + 1;
        if (nextIndex < markers.length) {
          loadMarker(nextIndex);
        } else if (loopEnabled) {
          // Loop back to first
          loadMarker(0);
        } else {
          video.pause();
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [
    activeVideoSlot,
    currentIndex,
    getActiveVideo,
    loadMarker,
    loopEnabled,
    loopSingleMarkerId,
    markers,
  ]);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      // Hide overlay when exiting fullscreen
      if (!isNowFullscreen) {
        setShowFullscreenOverlay(false);
        if (fullscreenOverlayTimeoutRef.current) {
          clearTimeout(fullscreenOverlayTimeoutRef.current);
          fullscreenOverlayTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  // CUSTOM: begin - Handle mouse movement in all player modes to show/hide performer chips
  const showPlayerOverlay = useCallback(() => {
    setShowFullscreenOverlay(true);

    if (fullscreenOverlayTimeoutRef.current) {
      clearTimeout(fullscreenOverlayTimeoutRef.current);
    }

    fullscreenOverlayTimeoutRef.current = setTimeout(() => {
      setShowFullscreenOverlay(false);
    }, 2000);
  }, []);

  useEffect(() => {
    const wrapper = videoWrapperRef.current;
    if (!wrapper) return;

    wrapper.addEventListener("mousemove", showPlayerOverlay);

    return () => {
      wrapper.removeEventListener("mousemove", showPlayerOverlay);
      if (fullscreenOverlayTimeoutRef.current) {
        clearTimeout(fullscreenOverlayTimeoutRef.current);
      }
    };
  }, [showPlayerOverlay]);
  // CUSTOM: end

  // Load first marker when markers are ready
  useEffect(() => {
    if (markers.length === 0) {
      initialLoadedRef.current = false;
      return;
    }
    if (!initialLoadedRef.current && getActiveVideo()) {
      initialLoadedRef.current = true;
      loadMarker(0, false);
    }
  }, [getActiveVideo, loadMarker, markers]);

  // Warm the next marker that needs a source change while the current marker plays.
  useEffect(() => {
    const activePreparedSlot =
      preparedVideoSlotsRef.current[activeVideoSlotRef.current];
    const currentMarker = markers[currentIndex];
    if (!currentMarker || activePreparedSlot?.markerId !== currentMarker.id) {
      return;
    }

    const preloadIndex = getNextSceneMarkerIndexCustom(
      markers,
      currentIndex,
      loopEnabled,
      loopSingleMarkerId
    );
    if (preloadIndex === undefined) return;

    const preloadSlot = activeVideoSlotRef.current === 0 ? 1 : 0;
    prepareVideoSlot(preloadSlot, markers[preloadIndex]);
  }, [
    activeVideoSlot,
    currentIndex,
    loopEnabled,
    loopSingleMarkerId,
    markers,
    prepareVideoSlot,
  ]);

  // When markers or currentIndex changes, ensure playback continues smoothly after deletion/reorder
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || markers.length === 0) return;
    // If currentIndex is out of bounds, fix it
    if (currentIndex >= markers.length) {
      setCurrentIndex(markers.length - 1);
      return;
    }
    // If video is paused, don't do anything
    if (video.paused) return;
    const marker = markers[currentIndex];
    if (!marker) return;
    const activePreparedSlot =
      preparedVideoSlotsRef.current[activeVideoSlotRef.current];
    if (activePreparedSlot?.markerId !== marker.id) {
      loadMarker(currentIndex);
      return;
    }

    if (video.currentTime < marker.seconds) {
      video.currentTime = marker.seconds;
    }
    video.play().catch(() => {});
  }, [currentIndex, getActiveVideo, loadMarker, markers]);

  const handlePlayPause = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;

    const currentMarker = markers[currentIndex];
    const activePreparedSlot =
      preparedVideoSlotsRef.current[activeVideoSlotRef.current];
    if (
      currentMarker &&
      !markerPreloadMatchesCustom(activePreparedSlot, currentMarker)
    ) {
      loadMarker(currentIndex);
      return;
    }

    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, [currentIndex, getActiveVideo, loadMarker, markers]);

  const handleNext = useCallback(() => {
    if (markers.length === 0) return;
    const nextIndex = (currentIndex + 1) % markers.length;
    loadMarker(nextIndex);
  }, [markers, currentIndex, loadMarker]);

  const handlePrevious = useCallback(() => {
    if (markers.length === 0) return;
    const prevIndex =
      currentIndex === 0 ? markers.length - 1 : currentIndex - 1;
    loadMarker(prevIndex);
  }, [markers, currentIndex, loadMarker]);

  const handleJumpToMarker = useCallback(
    (index: number) => {
      loadMarker(index);
    },
    [loadMarker]
  );

  const handleFullscreen = useCallback(() => {
    const wrapper = videoWrapperRef.current;
    if (!wrapper) return;

    if (!isFullscreen) {
      if (wrapper.requestFullscreen) {
        wrapper.requestFullscreen();
      } else {
        // Fallback for webkit browsers
        const wrapperElement = wrapper as HTMLDivElement & {
          webkitRequestFullscreen?: () => void;
          msRequestFullscreen?: () => void;
        };
        if (wrapperElement.webkitRequestFullscreen) {
          wrapperElement.webkitRequestFullscreen();
        } else if (wrapperElement.msRequestFullscreen) {
          wrapperElement.msRequestFullscreen();
        }
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else {
        // Fallback for webkit browsers
        const doc = document as Document & {
          webkitExitFullscreen?: () => void;
          msExitFullscreen?: () => void;
        };
        if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    }
  }, [isFullscreen]);

  const handleVideoClick = useCallback(() => {
    // In fullscreen, reset controls/cursor visibility on any click
    if (isFullscreen) {
      setShowFullscreenOverlay(true);
      if (fullscreenOverlayTimeoutRef.current) {
        clearTimeout(fullscreenOverlayTimeoutRef.current);
      }
      fullscreenOverlayTimeoutRef.current = setTimeout(() => {
        setShowFullscreenOverlay(false);
      }, 2000);
    }

    // Single click → play/pause; double click → toggle fullscreen (both modes)
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      // Double click - toggle fullscreen
      handleFullscreen();
    } else {
      // Potentially a single click - wait to disambiguate from double click
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        // Single click - toggle play/pause
        handlePlayPause();
      }, 300);
    }
  }, [isFullscreen, handleFullscreen, handlePlayPause]);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  const formatTime = (seconds: number): string => {
    return TextUtils.secondsToTimestamp(seconds);
  };

  const getMarkerDuration = (marker: IMarkerInfo): number => {
    return (marker.end_seconds ?? marker.seconds + 20) - marker.seconds;
  };

  const getTotalDuration = (): number => {
    return markers.reduce((sum, m) => sum + getMarkerDuration(m), 0);
  };

  const handleSavePlaylist = useCallback(async () => {
    if (!playlistName.trim()) {
      Toast.error("Please enter a playlist name");
      return;
    }

    try {
      await createPlaylist({
        variables: {
          input: {
            name: playlistName.trim(),
            marker_ids: markers.map((m) => m.id),
          },
        },
      });
      Toast.success(`Playlist "${playlistName}" saved!`);
      setShowSaveModal(false);
      setPlaylistName("");
      refetchPlaylists();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes("UNIQUE constraint failed")) {
        Toast.error(
          `A playlist named "${playlistName}" already exists. Please choose a different name.`
        );
      } else {
        Toast.error(`Failed to save playlist: ${errorMessage}`);
      }
    }
  }, [playlistName, markers, createPlaylist, Toast, refetchPlaylists]);

  const handleLoadPlaylist = useCallback(
    (playlist: { id: string; marker_ids: string[] }) => {
      const idsParam = playlist.marker_ids.join(",");
      window.location.href = `/scenes/markers/player?ids=${idsParam}`;
    },
    []
  );

  const handleDeletePlaylist = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete playlist "${name}"?`)) {
        return;
      }

      try {
        await destroyPlaylist({ variables: { id } });
        Toast.success(`Playlist "${name}" deleted`);
        refetchPlaylists();
      } catch (err) {
        Toast.error(`Failed to delete playlist: ${err}`);
      }
    },
    [destroyPlaylist, Toast, refetchPlaylists]
  );

  if (loading) {
    return <LoadingIndicator />;
  }

  if (markers.length === 0) {
    return (
      <div className="marker-playlist-player empty">
        <h4>
          <FormattedMessage id="marker_playlist.no_markers" />
        </h4>
      </div>
    );
  }

  const currentMarker = markers[currentIndex];
  const currentTopPerformers = currentMarker?.topPerformers ?? [];
  const currentBottomPerformers = currentMarker?.bottomPerformers ?? [];
  const currentMarkerHasPerformers =
    currentTopPerformers.length > 0 || currentBottomPerformers.length > 0;

  // CUSTOM: begin - shared marker performer chips with hover images
  const renderPerformerChips = (
    performers: IPerformerHoverPerformer[],
    role: "top" | "bottom",
    showRoleArrows: boolean,
    compact = false,
    inlinePreview = false
  ) =>
    performers.map((performer) => {
      const chip = (
        <a
          href={`/performers/${performer.id}`}
          className={cx("marker-performer-chip", role, {
            compact,
          })}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {showRoleArrows && (
            <Icon
              icon={role === "top" ? faArrowUp : faArrowDown}
              className={
                role === "top" ? "performer-icon-top" : "performer-icon-bottom"
              }
              title={role === "top" ? "Top" : "Bottom"}
            />
          )}
          <span>{performer.name}</span>
          {inlinePreview && (
            <span className="performer-chip-inline-preview">
              <img
                alt={performer.name ?? ""}
                src={performer.image_path ?? ""}
              />
            </span>
          )}
        </a>
      );

      if (inlinePreview)
        return <React.Fragment key={performer.id}>{chip}</React.Fragment>;

      return (
        <HoverPopover
          key={performer.id}
          className="marker-performer-hover-trigger"
          placement="top"
          content={
            <div className="performer-hover-grid">
              <div className="performer-tag-container performer-hover-row">
                <a
                  href={`/performers/${performer.id}`}
                  className="performer-tag performer-hover-image-link zoom-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    className="image-thumbnail performer-hover-image-thumbnail"
                    alt={performer.name ?? ""}
                    src={performer.image_path ?? ""}
                  />
                </a>
              </div>
            </div>
          }
        >
          {chip}
        </HoverPopover>
      );
    });

  const renderCurrentPerformerOverlay = () => {
    if (!showFullscreenOverlay || !currentMarkerHasPerformers) return null;

    const showRoleArrows =
      currentTopPerformers.length > 0 && currentBottomPerformers.length > 0;

    return (
      <div
        className={cx("fullscreen-performer-overlay", {
          "normal-mode": !isFullscreen,
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {currentTopPerformers.length > 0 && (
          <div className="performer-info top">
            {renderPerformerChips(
              currentTopPerformers,
              "top",
              showRoleArrows,
              false,
              true
            )}
          </div>
        )}
        {currentBottomPerformers.length > 0 && (
          <div className="performer-info bottom">
            {renderPerformerChips(
              currentBottomPerformers,
              "bottom",
              showRoleArrows,
              false,
              true
            )}
          </div>
        )}
      </div>
    );
  };
  // CUSTOM: end

  return (
    <div className="marker-playlist-player" ref={containerRef}>
      <Helmet>
        <title>Marker Playlist - Stash</title>
      </Helmet>

      <div className="player-header">
        <div className="player-header-left"></div>
        <div className="player-header-right">
          <Button
            variant="secondary"
            onClick={() => setShowSaveModal(true)}
            className="save-playlist-btn"
            size="sm"
            title="Save Playlist"
          >
            <Icon icon={faSave} />
            <span className="ml-2 d-none d-md-inline">Save</span>
          </Button>
          <Dropdown show={showLoadDropdown} onToggle={setShowLoadDropdown}>
            <Dropdown.Toggle
              as={Button}
              variant="secondary"
              size="sm"
              className="load-playlist-btn"
            >
              <Icon icon={faFolderOpen} />
              <span className="ml-2 d-none d-md-inline">Load</span>
            </Dropdown.Toggle>
            <Dropdown.Menu align="right" className="marker-playlist-dropdown">
              {!playlistsData?.findMarkerPlaylists ||
              playlistsData.findMarkerPlaylists.length === 0 ? (
                <Dropdown.Item disabled>No saved playlists</Dropdown.Item>
              ) : (
                playlistsData.findMarkerPlaylists.map((playlist) => (
                  <Dropdown.Item
                    key={playlist.id}
                    as="div"
                    className="playlist-dropdown-item"
                  >
                    <span
                      onClick={() => handleLoadPlaylist(playlist)}
                      className="playlist-name"
                    >
                      {playlist.name}
                    </span>
                    <span
                      className="delete-playlist-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlaylist(playlist.id, playlist.name);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          handleDeletePlaylist(playlist.id, playlist.name);
                        }
                      }}
                    >
                      ✕
                    </span>
                  </Dropdown.Item>
                ))
              )}
            </Dropdown.Menu>
          </Dropdown>
          <Button
            variant="secondary"
            onClick={() => setShowPlaylist(!showPlaylist)}
            className="toggle-playlist-btn"
            size="sm"
          >
            {showPlaylist ? <Icon icon={faTimes} /> : <Icon icon={faList} />}
            <span className="ml-2 d-none d-md-inline">
              {showPlaylist ? "Hide Playlist" : "Show Playlist"}
            </span>
          </Button>
        </div>
      </div>

      <Modal show={showSaveModal} onHide={() => setShowSaveModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Save Marker Playlist</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Playlist Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter playlist name..."
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  handleSavePlaylist();
                }
              }}
              autoFocus
            />
          </Form.Group>
          <div className="mt-2 text-muted small">
            This will save the current playlist of {markers.length} marker(s)
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSavePlaylist}>
            <Icon icon={faSave} className="mr-2" />
            Save Playlist
          </Button>
        </Modal.Footer>
      </Modal>

      <div className="player-container">
        <div className={cx("video-section", { "full-width": !showPlaylist })}>
          <div
            className="video-wrapper"
            ref={videoWrapperRef}
            onClick={handleVideoClick}
            onMouseMove={showPlayerOverlay}
            style={{
              cursor:
                isFullscreen && !showFullscreenOverlay ? "none" : undefined,
            }}
          >
            <video
              ref={primaryVideoRef}
              preload="auto"
              playsInline
              aria-hidden={activeVideoSlot !== 0}
              className="video-player"
              style={{
                inset: 0,
                opacity: activeVideoSlot === 0 ? 1 : 0,
                pointerEvents: activeVideoSlot === 0 ? "auto" : "none",
                position: "absolute",
              }}
            />
            <video
              ref={preloadVideoRef}
              preload="auto"
              playsInline
              aria-hidden={activeVideoSlot !== 1}
              className="video-player"
              style={{
                inset: 0,
                opacity: activeVideoSlot === 1 ? 1 : 0,
                pointerEvents: activeVideoSlot === 1 ? "auto" : "none",
                position: "absolute",
              }}
            />
            {renderCurrentPerformerOverlay()}
            {/* Fullscreen navigation buttons - prev/next marker */}
            {isFullscreen && showFullscreenOverlay && markers.length > 1 && (
              <>
                <button
                  className="fullscreen-nav-btn prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevious();
                  }}
                  title="Previous marker"
                >
                  <Icon icon={faChevronLeft} />
                </button>
                <button
                  className="fullscreen-nav-btn next"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  title="Next marker"
                >
                  <Icon icon={faChevronRight} />
                </button>
              </>
            )}
            {!isFullscreen && (
              <div className="video-overlay-controls">
                <Button
                  variant="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPause();
                  }}
                  className="play-pause-btn"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  <Icon icon={isPlaying ? faPause : faPlay} />
                </Button>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFullscreen();
                  }}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  className="fullscreen-btn"
                >
                  <Icon icon={faExpand} />
                </Button>
              </div>
            )}
          </div>

          <div className="now-playing">
            <div className="now-playing-top">
              <span className="marker-number">
                {currentIndex + 1} / {markers.length}
              </span>
              <span className="marker-title">{currentMarker?.title}</span>
              {loopSingleMarkerId === currentMarker?.id && (
                <Badge
                  variant="info"
                  className="single-loop-badge"
                  onClick={() => setLoopSingleMarkerId(null)}
                  style={{ cursor: "pointer" }}
                  title="Click to disable single marker loop"
                >
                  <Icon icon={faRedo} className="mr-1" />
                  Looping
                </Badge>
              )}
            </div>
            <div className="now-playing-scene">
              <span className="scene-label">Scene:</span>
              <a
                href={`/scenes/${currentMarker?.sceneId}`}
                className="scene-title-link"
                target="_blank"
                rel="noopener noreferrer"
                title="Open scene in new tab"
              >
                {currentMarker?.sceneTitle}
              </a>
            </div>
            {currentMarkerHasPerformers ? (
              <div className="now-playing-performers">
                {/* Only show arrows if marker has performers in BOTH roles (top and bottom) */}
                {(() => {
                  const showRoleArrows =
                    currentTopPerformers.length > 0 &&
                    currentBottomPerformers.length > 0;
                  return (
                    <>
                      {currentTopPerformers.length > 0 && (
                        <span className="marker-performers top">
                          {renderPerformerChips(
                            currentTopPerformers,
                            "top",
                            showRoleArrows,
                            true
                          )}
                        </span>
                      )}
                      {currentBottomPerformers.length > 0 && (
                        <span className="marker-performers bottom">
                          {renderPerformerChips(
                            currentBottomPerformers,
                            "bottom",
                            showRoleArrows,
                            true
                          )}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>

        {showPlaylist && (
          <div className="playlist-section">
            <div className="playlist-header">
              <h6>
                <FormattedMessage id="marker_playlist.playlist" />
              </h6>
              <small className="text-muted">
                <FormattedMessage
                  id="marker_playlist.total_duration"
                  values={{ duration: formatTime(getTotalDuration()) }}
                />
              </small>
            </div>

            <ListGroup className="marker-list">
              {markers.map((marker, index) => (
                <ListGroup.Item
                  key={marker.id}
                  className={cx("marker-item", {
                    active: index === currentIndex,
                  })}
                  action
                  onClick={() => handleJumpToMarker(index)}
                >
                  <div className="marker-preview">
                    <img src={marker.previewUrl} alt={marker.title} />
                    <span className="marker-number-badge">{index + 1}</span>
                  </div>
                  <div className="marker-info">
                    <div className="marker-title">{marker.title}</div>
                    <div className="scene-title">{marker.sceneTitle}</div>
                    {/* Only show arrows if marker has performers in BOTH roles (top and bottom) */}
                    {(() => {
                      const showRoleArrows =
                        (marker.topPerformers?.length ?? 0) > 0 &&
                        (marker.bottomPerformers?.length ?? 0) > 0;
                      return (
                        <>
                          {marker.topPerformers &&
                            marker.topPerformers.length > 0 && (
                              <div className="marker-performers top">
                                {renderPerformerChips(
                                  marker.topPerformers,
                                  "top",
                                  showRoleArrows,
                                  true
                                )}
                              </div>
                            )}
                          {marker.bottomPerformers &&
                            marker.bottomPerformers.length > 0 && (
                              <div className="marker-performers bottom">
                                {renderPerformerChips(
                                  marker.bottomPerformers,
                                  "bottom",
                                  showRoleArrows,
                                  true
                                )}
                              </div>
                            )}
                        </>
                      );
                    })()}
                    <div className="marker-times">
                      {formatTime(marker.seconds)}
                      {marker.end_seconds &&
                        ` - ${formatTime(marker.end_seconds)}`}
                      <span className="duration">
                        ({formatTime(getMarkerDuration(marker))})
                      </span>
                    </div>
                  </div>
                  <div className="marker-action-btns">
                    <Button
                      variant={
                        loopSingleMarkerId === marker.id
                          ? "primary"
                          : "outline-secondary"
                      }
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (loopSingleMarkerId === marker.id) {
                          // Disable single loop
                          setLoopSingleMarkerId(null);
                        } else {
                          // Enable single loop and immediately jump to this marker
                          setLoopSingleMarkerId(marker.id);
                          handleJumpToMarker(index);
                        }
                      }}
                      title={
                        loopSingleMarkerId === marker.id
                          ? intl.formatMessage({
                              id: "marker_playlist.disable_single_loop",
                              defaultMessage: "Disable single marker loop",
                            })
                          : intl.formatMessage({
                              id: "marker_playlist.enable_single_loop",
                              defaultMessage: "Loop this marker",
                            })
                      }
                      className="single-loop-btn"
                    >
                      <Icon icon={faRedo} />
                    </Button>
                  </div>
                  <div className="marker-reorder-btns">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (index > 0) {
                          setMarkers((prev) => {
                            const arr = [...prev];
                            [arr[index - 1], arr[index]] = [
                              arr[index],
                              arr[index - 1],
                            ];
                            return arr;
                          });
                          setCurrentIndex(index - 1);
                        }
                      }}
                      title={intl.formatMessage({
                        id: "marker_playlist.move_up",
                        defaultMessage: "Move up",
                      })}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={index === markers.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (index < markers.length - 1) {
                          setMarkers((prev) => {
                            const arr = [...prev];
                            [arr[index], arr[index + 1]] = [
                              arr[index + 1],
                              arr[index],
                            ];
                            return arr;
                          });
                          setCurrentIndex(index + 1);
                        }
                      }}
                      title={intl.formatMessage({
                        id: "marker_playlist.move_down",
                        defaultMessage: "Move down",
                      })}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMarkers((prev) => {
                          const arr = prev.filter((_, i) => i !== index);
                          if (currentIndex === index) {
                            let next = index;
                            if (index >= arr.length) next = arr.length - 1;
                            setCurrentIndex(next >= 0 ? next : 0);
                          } else if (currentIndex > index) {
                            setCurrentIndex(currentIndex - 1);
                          }
                          return arr;
                        });
                      }}
                      title={intl.formatMessage({
                        id: "marker_playlist.delete",
                        defaultMessage: "Delete",
                      })}
                    >
                      ✕
                    </Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkerPlaylistPlayer;
