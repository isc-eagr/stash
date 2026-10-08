import { useRemotePlayerCustom } from "../RemoteO/useRemotePlayer_custom"; // CUSTOM
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gql, useQuery } from "@apollo/client";
import { useHistory, useLocation } from "react-router-dom";
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
  faExclamationTriangle,
  faGripVertical,
  faList,
  faTimes,
  faExpand,
  faCompress,
  faSave,
  faFolderOpen,
  faChevronLeft,
  faChevronRight,
  faThumbsUp,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import cx from "classnames";
import { SweatDrops } from "src/components/Shared/SweatDrops"; // CUSTOM
import {
  useFindMarkerPlaylistsQuery,
  useMarkerPlaylistCreate,
  useMarkerPlaylistDestroy,
  useSceneRecordOAtTimestamp,
} from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import {
  getNextSceneMarkerIndexCustom,
  markerPreloadMatchesCustom,
} from "./markerPlaylistPreload_custom";
import { getToggledMarkerPlaylistLoopIdCustom } from "./markerPlaylistLoop_custom"; // CUSTOM
import {
  getMarkerPlaylistImageUrlCustom,
  scrollMarkerPlaylistItemIntoViewCustom,
} from "./markerPlaylistPresentation_custom"; // CUSTOM
import { getMarkerPlaylistORecordTargetCustom } from "./markerPlaylistORecord_custom"; // CUSTOM
import {
  exitMarkerPlayerFullscreenCustom,
  isMarkerPlayerNativeFullscreenCustom,
  requestMarkerPlayerFullscreenCustom,
  shouldLockMarkerPlayerLandscapeCustom,
} from "./markerPlaylistFullscreen_custom"; // CUSTOM
import {
  followRemovedIndexCustom,
  getMarkerPlayerSwipeDirectionCustom,
  getMarkerPlaylistStepIndexCustom,
  type MarkerPlaylistDirectionCustom,
} from "./markerPlaylistNavigation_custom"; // CUSTOM
import {
  followMovedIndexCustom,
  moveArrayItemCustom,
} from "src/components/Shared/pointerSortable_custom"; // CUSTOM
import { usePointerSortableCustom } from "src/components/Shared/usePointerSortable_custom"; // CUSTOM
import { useScreenWakeLockCustom } from "src/hooks/useScreenWakeLock_custom"; // CUSTOM
import { formatORecordedToastCustom } from "./oRecordToast_custom"; // CUSTOM
import { useSceneReleaseRecordOCustom } from "./sceneReleaseActivity_custom"; // CUSTOM
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
  releaseId?: string | null; // CUSTOM
  sceneTitle: string;
  streamUrl: string;
  imageUrl: string; // CUSTOM: generated screenshot with preview fallback
  topPerformers?: IPerformerHoverPerformer[]; // CUSTOM
  bottomPerformers?: IPerformerHoverPerformer[]; // CUSTOM
}

interface IPreparedVideoSlot {
  markerId: string;
  sceneId: string;
  releaseId?: string | null; // CUSTOM
  seconds: number;
  ready: boolean;
}

export const MarkerPlaylistPlayer: React.FC = () => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory(); // CUSTOM
  const Toast = useToast();
  const { configuration } = useConfigurationContext(); // CUSTOM
  const { sfwContentMode } = configuration.interface; // CUSTOM

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
  const videoSlotErrorCleanupsRef = useRef<Array<(() => void) | undefined>>([
    undefined,
    undefined,
  ]); // CUSTOM
  const markerLoadRequestRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const activePlaylistItemRef = useRef<HTMLElement | null>(null); // CUSTOM
  const initialLoadedRef = useRef(false);
  const [markers, setMarkers] = useState<IMarkerInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeVideoSlot, setActiveVideoSlot] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  // CUSTOM: fills the viewport where element fullscreen is unavailable (iPhone).
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isPseudoFullscreen;
  const lastPointerTypeRef = useRef("mouse"); // CUSTOM
  const [loopSingleMarkerId, setLoopSingleMarkerId] = useState<string | null>(
    null
  );
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const fullscreenOverlayTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const playerToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  ); // CUSTOM
  // CUSTOM: toasts drawn inside the player stay visible in fullscreen.
  const [playerToast, setPlayerToast] = useState<{
    message: string;
    variant: "success" | "error";
  }>();
  const currentMarker = markers[currentIndex]; // CUSTOM
  // CUSTOM: begin - navigation that survives rapid taps, edits, and broken streams
  const markersRef = useRef(markers);
  markersRef.current = markers;
  // The marker the user last asked for, ahead of currentIndex while it loads.
  const requestedIndexRef = useRef(0);
  const pendingLoadRef = useRef<{
    requestId: number;
    markerId: string;
    direction: MarkerPlaylistDirectionCustom;
    autoPlay: boolean;
  }>();
  const [failedMarkerIds, setFailedMarkerIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const failedMarkerIdsRef = useRef(failedMarkerIds);
  failedMarkerIdsRef.current = failedMarkerIds;
  const handleVideoSlotErrorRef = useRef<
    (slot: number, marker: IMarkerInfo) => void
  >(() => {});
  const initializedPlaylistKeyRef = useRef<string>();
  const swipeStartRef = useRef<{ x: number; y: number; time: number }>();
  const suppressClickUntilRef = useRef(0);
  // CUSTOM: end

  // Save/Load playlist state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);

  const { data: playlistsData, refetch: refetchPlaylists } =
    useFindMarkerPlaylistsQuery();
  const [createPlaylist] = useMarkerPlaylistCreate();
  const [destroyPlaylist] = useMarkerPlaylistDestroy();
  const [recordOAtTimestamp, { loading: isRecordingO }] =
    useSceneRecordOAtTimestamp(currentMarker?.sceneId ?? ""); // CUSTOM
  const [recordReleaseOAtTimestamp, { loading: isRecordingReleaseO }] =
    useSceneReleaseRecordOCustom(); // CUSTOM

  // Parse marker IDs from URL
  const markerIds = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = params.get("ids");
    return ids ? ids.split(",").filter(Boolean) : [];
  }, [location.search]);

  const {
    data,
    loading,
    error: markersError, // CUSTOM
  } = useQuery<IFindMarkersForPlaylistResult>(FIND_MARKERS_FOR_PLAYLIST, {
    skip: markerIds.length === 0,
    variables: { ids: markerIds },
  });

  useEffect(() => {
    // CUSTOM: build the playlist once per navigation, so refetches and the
    // URL kept in sync with edits below never reset playback.
    const playlistKey = `${location.key ?? ""}:${markerIds.join(",")}`;
    if (initializedPlaylistKeyRef.current === playlistKey) return;

    if (markerIds.length === 0) {
      initializedPlaylistKeyRef.current = playlistKey;
      setMarkers([]);
      return;
    }

    // CUSTOM: a failed lookup (e.g. a deleted marker) empties the playlist
    // rather than leaving the previous one on screen.
    const fetchedMarkers = markersError
      ? []
      : data?.findSceneMarkers.scene_markers;
    if (!fetchedMarkers) return;
    initializedPlaylistKeyRef.current = playlistKey;

    // Sort markers to maintain the order from the URL
    const sortedMarkers = markerIds
      .map((id) => fetchedMarkers.find((m) => m.id === id))
      .filter((m): m is GQL.SceneMarkerDataFragment => m !== undefined)
      .map((m) => {
        // Use scene.paths.stream if available, otherwise construct the URL
        const streamUrl = m.release_id
          ? `/scene-release/${m.release_id}/stream`
          : m.scene.paths?.stream || `/scene/${m.scene.id}/stream`; // CUSTOM

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
          releaseId: m.release_id, // CUSTOM
          sceneTitle: m.scene.title || "Untitled Scene",
          streamUrl,
          imageUrl: getMarkerPlaylistImageUrlCustom({
            screenshot: m.screenshot,
            preview: m.preview,
          }), // CUSTOM: screenshots are generated independently of WebP previews
          topPerformers: topPerformers.length > 0 ? topPerformers : undefined,
          bottomPerformers:
            bottomPerformers.length > 0 ? bottomPerformers : undefined,
        };
      });

    setMarkers(sortedMarkers);
    setCurrentIndex(0);
    setFailedMarkerIds(new Set()); // CUSTOM
    pendingLoadRef.current = undefined; // CUSTOM
    preparedVideoSlotsRef.current = [null, null];
    markerLoadRequestRef.current += 1;
    initialLoadedRef.current = false;
  }, [
    data?.findSceneMarkers.scene_markers,
    location.key,
    markerIds,
    markersError,
  ]);

  // CUSTOM: keep the URL in step with reordering and removals so a reload or
  // shared link plays the edited playlist. The router location is left alone,
  // which would otherwise refetch and rebuild the playlist.
  useEffect(() => {
    if (!initializedPlaylistKeyRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const ids = markers.map((marker) => marker.id).join(",");
    if (params.get("ids") === ids) return;
    params.set("ids", ids);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params.toString().replace(/%2C/g, ",")}${
        window.location.hash
      }`
    );
  }, [markers]);

  const getActiveVideo = useCallback(
    () => videoRefs[activeVideoSlotRef.current].current,
    [videoRefs]
  );

  // CUSTOM: a file that fails to load fails every marker that streams it.
  const updateFailedStream = useCallback(
    (streamUrl: string, failed: boolean) => {
      const ids = markersRef.current
        .filter((marker) => marker.streamUrl === streamUrl)
        .map((marker) => marker.id);
      const { current } = failedMarkerIdsRef;
      if (ids.every((id) => current.has(id) === failed)) return current;

      const next = new Set(current);
      ids.forEach((id) => (failed ? next.add(id) : next.delete(id)));
      failedMarkerIdsRef.current = next;
      setFailedMarkerIds(next);
      return next;
    },
    []
  );

  // CUSTOM: begin - each marker activation gets a fresh remote session.
  useRemotePlayerCustom(`${currentMarker?.id ?? ""}:${currentIndex}`, () => {
    if (currentMarker?.releaseId) return undefined; // CUSTOM: remote O API owns scenes only
    const video = getActiveVideo();
    const prepared = preparedVideoSlotsRef.current[activeVideoSlotRef.current];
    if (
      !video ||
      !currentMarker ||
      !markerPreloadMatchesCustom(prepared, currentMarker)
    )
      return undefined;
    return {
      scene_id: currentMarker.sceneId,
      scene_title: currentMarker.sceneTitle,
      video_timestamp: video.currentTime,
      duration: video.duration,
      playback_rate: video.playbackRate,
      status:
        video.seeking || video.readyState < 3
          ? "buffering"
          : video.paused
          ? "paused"
          : "playing",
    };
  });
  // CUSTOM: end

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
      videoSlotErrorCleanupsRef.current[slot]?.(); // CUSTOM
      preparedVideoSlotsRef.current[slot] = {
        markerId: marker.id,
        sceneId: marker.sceneId,
        releaseId: marker.releaseId, // CUSTOM
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

      // CUSTOM: a missing or unsupported file fails the load (or later
      // playback) instead of leaving the player waiting forever.
      const handleError = () => {
        if (!isCurrentLoad()) return;
        videoSlotLoadTokensRef.current[slot] += 1;
        preparedVideoSlotsRef.current[slot] = null;
        videoSlotReadyCallbacksRef.current[slot] = undefined;
        handleVideoSlotErrorRef.current(slot, marker);
      };
      video.addEventListener("error", handleError);
      videoSlotErrorCleanupsRef.current[slot] = () =>
        video.removeEventListener("error", handleError);

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
    (slot: number, marker: IMarkerInfo, autoPlay: boolean) => {
      const previousVideo = getActiveVideo();
      const nextVideo = videoRefs[slot].current;
      // CUSTOM: the playlist may have been reordered while this marker loaded.
      const index = markersRef.current.findIndex((m) => m.id === marker.id);
      if (!nextVideo || index < 0) return;
      pendingLoadRef.current = undefined; // CUSTOM
      updateFailedStream(marker.streamUrl, false); // CUSTOM: an explicit retry worked

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
    [getActiveVideo, updateFailedStream, videoRefs]
  );

  // Load a specific marker
  const loadMarker = useCallback(
    (
      index: number,
      autoPlay = true,
      direction: MarkerPlaylistDirectionCustom = 1 // CUSTOM: where to skip if it fails
    ) => {
      const video = getActiveVideo();
      if (!video || index < 0 || index >= markers.length) return;

      const marker = markers[index];
      const activeSlot = activeVideoSlotRef.current;
      const activePreparedSlot = preparedVideoSlotsRef.current[activeSlot];
      const requestId = markerLoadRequestRef.current + 1;
      markerLoadRequestRef.current = requestId;
      requestedIndexRef.current = index; // CUSTOM
      pendingLoadRef.current = {
        requestId,
        markerId: marker.id,
        direction,
        autoPlay,
      }; // CUSTOM

      if (
        activePreparedSlot?.sceneId === marker.sceneId &&
        activePreparedSlot.releaseId === marker.releaseId
      ) {
        // CUSTOM
        video.currentTime = marker.seconds;
        preparedVideoSlotsRef.current[activeSlot] = {
          markerId: marker.id,
          sceneId: marker.sceneId,
          releaseId: marker.releaseId, // CUSTOM
          seconds: marker.seconds,
          ready: true,
        };
        pendingLoadRef.current = undefined; // CUSTOM
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
        activatePreparedVideoSlot(targetSlot, marker, autoPlay);
      });
    },
    [activatePreparedVideoSlot, getActiveVideo, markers, prepareVideoSlot]
  );

  // CUSTOM: steps from the marker last asked for, so rapid taps add up, and
  // passes over markers whose files failed to load. The playlist wraps.
  const stepMarker = useCallback(
    (direction: MarkerPlaylistDirectionCustom) => {
      const failed = failedMarkerIdsRef.current;
      const index = getMarkerPlaylistStepIndexCustom(
        markers.length,
        requestedIndexRef.current,
        direction,
        (i) => failed.has(markers[i].id)
      );
      if (index !== undefined) loadMarker(index, true, direction);
    },
    [loadMarker, markers]
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

        // Move to the next marker; the playlist always loops back to the first.
        stepMarker(1);
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
    loopSingleMarkerId,
    markers,
    stepMarker,
  ]);

  // Track native fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = isMarkerPlayerNativeFullscreenCustom(document);
      setIsNativeFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        try {
          screen.orientation?.unlock();
        } catch {
          // Orientation locking is unsupported outside mobile fullscreen.
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // CUSTOM: the viewport fallback blocks page scrolling and exits on Escape.
  useEffect(() => {
    if (!isPseudoFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPseudoFullscreen(false);
    };
    document.body.classList.add("marker-player-pseudo-fullscreen");
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("marker-player-pseudo-fullscreen");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPseudoFullscreen]);

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
    return () => {
      if (fullscreenOverlayTimeoutRef.current) {
        clearTimeout(fullscreenOverlayTimeoutRef.current);
      }
    };
  }, []);

  // Hide the overlay when leaving fullscreen
  useEffect(() => {
    if (isFullscreen) return;
    setShowFullscreenOverlay(false);
    if (fullscreenOverlayTimeoutRef.current) {
      clearTimeout(fullscreenOverlayTimeoutRef.current);
      fullscreenOverlayTimeoutRef.current = null;
    }
  }, [isFullscreen]);
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

  // CUSTOM: reordering and removals move the playing marker's index.
  useEffect(() => {
    requestedIndexRef.current = currentIndex;
  }, [currentIndex]);

  // CUSTOM: Keep the marker that is playing visible in a long playlist.
  useEffect(() => {
    if (showPlaylist) {
      scrollMarkerPlaylistItemIntoViewCustom(activePlaylistItemRef.current);
    }
  }, [currentIndex, markers, showPlaylist]);

  // Warm the next marker that needs a source change while the current marker plays.
  useEffect(() => {
    const activePreparedSlot =
      preparedVideoSlotsRef.current[activeVideoSlotRef.current];
    const activeMarker = markers[currentIndex];
    if (!activeMarker || activePreparedSlot?.markerId !== activeMarker.id) {
      return;
    }

    const preloadIndex = getNextSceneMarkerIndexCustom(
      markers,
      currentIndex,
      true,
      loopSingleMarkerId
    );
    if (
      preloadIndex === undefined ||
      failedMarkerIdsRef.current.has(markers[preloadIndex].id) // CUSTOM
    ) {
      return;
    }

    const preloadSlot = activeVideoSlotRef.current === 0 ? 1 : 0;
    prepareVideoSlot(preloadSlot, markers[preloadIndex]);
  }, [
    activeVideoSlot,
    currentIndex,
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

    const activeMarker = markers[currentIndex];
    const activePreparedSlot =
      preparedVideoSlotsRef.current[activeVideoSlotRef.current];
    if (
      activeMarker &&
      !markerPreloadMatchesCustom(activePreparedSlot, activeMarker)
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

  // CUSTOM: Share the same single-marker loop toggle between the sidebar and fullscreen overlay.
  const handleToggleSingleMarkerLoop = useCallback(
    (index: number) => {
      const marker = markers[index];
      if (!marker) return;

      const nextLoopSingleMarkerId = getToggledMarkerPlaylistLoopIdCustom(
        loopSingleMarkerId,
        marker.id
      );
      setLoopSingleMarkerId(nextLoopSingleMarkerId);

      if (nextLoopSingleMarkerId) {
        loadMarker(index);
      }
    },
    [loadMarker, loopSingleMarkerId, markers]
  );

  // CUSTOM: the global toast is outside the browser fullscreen element.
  const showPlayerToast = useCallback(
    (message: string, variant: "success" | "error" = "success") => {
      setPlayerToast({ message, variant });
      if (playerToastTimeoutRef.current) {
        clearTimeout(playerToastTimeoutRef.current);
      }
      playerToastTimeoutRef.current = setTimeout(() => {
        setPlayerToast(undefined);
      }, 3000);
    },
    []
  );

  useEffect(
    () => () => {
      if (playerToastTimeoutRef.current) {
        clearTimeout(playerToastTimeoutRef.current);
      }
    },
    []
  );

  // CUSTOM: skip markers whose file fails to load or play, in the direction
  // the user was moving; stop when nothing in the playlist plays.
  handleVideoSlotErrorRef.current = (slot, marker) => {
    const failed = updateFailedStream(marker.streamUrl, true);
    const list = markersRef.current;
    const pending = pendingLoadRef.current;
    const pendingFailed =
      pending?.requestId === markerLoadRequestRef.current &&
      failed.has(pending.markerId);
    const activeFailed =
      !pending &&
      slot === activeVideoSlotRef.current &&
      failed.has(list[requestedIndexRef.current]?.id ?? "");
    if (!pendingFailed && !activeFailed) return;

    const from = pendingFailed
      ? list.findIndex((m) => m.id === pending.markerId)
      : requestedIndexRef.current;
    const direction = pendingFailed ? pending.direction : 1;
    const autoPlay = pendingFailed ? pending.autoPlay : true;
    pendingLoadRef.current = undefined;

    const next = getMarkerPlaylistStepIndexCustom(
      list.length,
      from,
      direction,
      (i) => failed.has(list[i].id)
    );
    if (next === undefined) {
      setIsPlaying(false);
      showPlayerToast(
        intl.formatMessage({ id: "marker_playlist.nothing_playable" }),
        "error"
      );
      return;
    }

    showPlayerToast(
      intl.formatMessage(
        { id: "marker_playlist.skipped_unplayable" },
        { title: marker.title }
      ),
      "error"
    );
    loadMarker(next, autoPlay, direction);
  };

  // CUSTOM: record an O for the marker's scene at the active video's exact time.
  const handleRecordO = useCallback(async () => {
    const target = getMarkerPlaylistORecordTargetCustom(
      currentMarker,
      getActiveVideo()?.currentTime ?? Number.NaN
    );
    if (!target) return;

    try {
      if (currentMarker?.releaseId) {
        await recordReleaseOAtTimestamp({
          variables: {
            id: currentMarker.releaseId,
            video_timestamp: target.videoTimestamp,
          },
        });
      } else {
        await recordOAtTimestamp({
          variables: {
            id: target.sceneId,
            video_timestamp: target.videoTimestamp,
          },
        });
      }
      const message = formatORecordedToastCustom(target.videoTimestamp);
      if (isFullscreen) {
        showPlayerToast(message);
      } else {
        Toast.success(message);
      }
    } catch (error) {
      Toast.error(error);
    }
  }, [
    Toast,
    currentMarker,
    getActiveVideo,
    isFullscreen,
    recordOAtTimestamp,
    recordReleaseOAtTimestamp,
    showPlayerToast,
  ]);

  const handleJumpToMarker = useCallback(
    (index: number) => {
      loadMarker(index);
    },
    [loadMarker]
  );

  // CUSTOM: begin - playlist edits keep the playing marker playing
  const handleMoveMarker = useCallback((from: number, to: number) => {
    setMarkers((current) => moveArrayItemCustom(current, from, to));
    setCurrentIndex((current) => followMovedIndexCustom(current, from, to));
  }, []);

  const handleRemoveMarker = useCallback((index: number) => {
    const remainingCount = markersRef.current.length - 1;
    setMarkers((current) => current.filter((_, i) => i !== index));
    setCurrentIndex((current) =>
      followRemovedIndexCustom(current, index, remainingCount)
    );
  }, []);

  const playlistSortable = usePointerSortableCustom({
    count: markers.length,
    onMove: handleMoveMarker,
  });

  useScreenWakeLockCustom(isPlaying);
  // CUSTOM: end

  const handleFullscreen = useCallback(async () => {
    const wrapper = videoWrapperRef.current;
    if (!wrapper) return;

    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }
    if (isNativeFullscreen) {
      exitMarkerPlayerFullscreenCustom(document);
      return;
    }

    showPlayerOverlay();
    if (!(await requestMarkerPlayerFullscreenCustom(wrapper, document))) {
      setIsPseudoFullscreen(true);
      return;
    }

    // CUSTOM: rotate phones for landscape videos, like native players do.
    if (
      shouldLockMarkerPlayerLandscapeCustom(
        getActiveVideo(),
        window.matchMedia("(pointer: coarse)").matches
      )
    ) {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      orientation?.lock?.("landscape").catch(() => {});
    }
  }, [
    getActiveVideo,
    isNativeFullscreen,
    isPseudoFullscreen,
    showPlayerOverlay,
  ]);

  const handleVideoClick = useCallback(() => {
    if (Date.now() < suppressClickUntilRef.current) return; // CUSTOM: swipe
    // CUSTOM: on touch screens the first tap on hidden fullscreen controls only reveals them.
    const revealOnly =
      lastPointerTypeRef.current !== "mouse" &&
      isFullscreen &&
      !showFullscreenOverlay;
    showPlayerOverlay();
    if (revealOnly) return;

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
  }, [
    isFullscreen,
    handleFullscreen,
    handlePlayPause,
    showFullscreenOverlay,
    showPlayerOverlay,
  ]);

  // CUSTOM: begin - swipe left/right on the video for the next/previous marker
  const handleVideoTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    swipeStartRef.current =
      event.touches.length === 1
        ? { x: touch.clientX, y: touch.clientY, time: event.timeStamp }
        : undefined;
  };

  const handleVideoTouchEnd = (event: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = undefined;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const direction = getMarkerPlayerSwipeDirectionCustom(
      touch.clientX - start.x,
      touch.clientY - start.y,
      event.timeStamp - start.time
    );
    if (!direction) return;
    suppressClickUntilRef.current = Date.now() + 500;
    showPlayerOverlay();
    stepMarker(direction);
  };
  // CUSTOM: end

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
      setShowLoadDropdown(false);
      history.push(`/scenes/markers/player?ids=${idsParam}`); // CUSTOM: no page reload
    },
    [history]
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

  // CUSTOM: player controls stay visible in normal mode and auto-hide in fullscreen.
  const showPlayerControls = !isFullscreen || showFullscreenOverlay;

  // CUSTOM: keep the replay and O controls available in both normal and fullscreen player modes.
  const renderMarkerEventControls = () => {
    if (!currentMarker || !showPlayerControls) {
      return null;
    }

    const isLoopingCurrentMarker = loopSingleMarkerId === currentMarker.id;
    return (
      <div
        className="marker-event-controls"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={cx("marker-loop-btn", { active: isLoopingCurrentMarker })}
          onClick={() => handleToggleSingleMarkerLoop(currentIndex)}
          title={
            isLoopingCurrentMarker
              ? intl.formatMessage({
                  id: "marker_playlist.disable_single_loop",
                  defaultMessage: "Disable single marker loop",
                })
              : intl.formatMessage({
                  id: "marker_playlist.enable_single_loop",
                  defaultMessage: "Loop this marker",
                })
          }
        >
          <Icon icon={faRedo} />
        </button>
        <button
          type="button"
          className="marker-record-o-btn"
          disabled={isRecordingO || isRecordingReleaseO} // CUSTOM
          onClick={handleRecordO}
          title="Record O at current video time"
          aria-label="Record O at current video time"
        >
          {!sfwContentMode ? <SweatDrops /> : <Icon icon={faThumbsUp} />}
        </button>
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
            className={cx("video-wrapper", {
              "pseudo-fullscreen": isPseudoFullscreen,
            })}
            ref={videoWrapperRef}
            onClick={handleVideoClick}
            onPointerDown={(e) => {
              lastPointerTypeRef.current = e.pointerType;
            }}
            onPointerMove={(e) => {
              if (e.pointerType === "mouse") showPlayerOverlay();
            }}
            onTouchStart={handleVideoTouchStart}
            onTouchEnd={handleVideoTouchEnd}
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
            {playerToast && (
              <div
                className={cx("marker-player-toast", playerToast.variant)}
                role="status"
              >
                {playerToast.message}
              </div>
            )}
            {renderCurrentPerformerOverlay()}
            {renderMarkerEventControls()}
            {/* CUSTOM: Marker navigation in normal and fullscreen modes. */}
            {showPlayerControls && markers.length > 1 && (
              <>
                <button
                  type="button"
                  className="marker-nav-btn prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepMarker(-1);
                  }}
                  title={intl.formatMessage({ id: "marker_playlist.previous" })}
                  aria-label={intl.formatMessage({
                    id: "marker_playlist.previous",
                  })}
                >
                  <Icon icon={faChevronLeft} />
                </button>
                <button
                  type="button"
                  className="marker-nav-btn next"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepMarker(1);
                  }}
                  title={intl.formatMessage({ id: "marker_playlist.next" })}
                  aria-label={intl.formatMessage({
                    id: "marker_playlist.next",
                  })}
                >
                  <Icon icon={faChevronRight} />
                </button>
              </>
            )}
            {showPlayerControls && (
              <div
                className="video-overlay-controls"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="primary"
                  onClick={handlePlayPause}
                  className="play-pause-btn"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  <Icon icon={isPlaying ? faPause : faPlay} />
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleFullscreen}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  className="fullscreen-btn"
                >
                  <Icon icon={isFullscreen ? faCompress : faExpand} />
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
                href={`/scenes/${currentMarker?.sceneId}${
                  currentMarker?.releaseId
                    ? `?release=${currentMarker.releaseId}`
                    : ""
                }`}
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
                  // CUSTOM: a div row, so its handle and buttons are not nested in a <button>
                  as="div"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      handleJumpToMarker(index);
                    }
                  }}
                  ref={(element: HTMLDivElement | null) => {
                    playlistSortable.itemRef(index)(element);
                    if (index === currentIndex) {
                      activePlaylistItemRef.current = element;
                    }
                  }} // CUSTOM: current marker is the auto-scroll target
                  className={cx(
                    "marker-item",
                    playlistSortable.itemClassName(index),
                    {
                      active: index === currentIndex,
                      failed: failedMarkerIds.has(marker.id),
                    }
                  )}
                  action
                  onClick={() => handleJumpToMarker(index)}
                >
                  {/* CUSTOM: drag to reorder */}
                  <button
                    type="button"
                    className="pointer-sort-handle marker-drag-handle"
                    title={intl.formatMessage({
                      id: "marker_playlist.reorder",
                    })}
                    aria-label={intl.formatMessage({
                      id: "marker_playlist.reorder",
                    })}
                    {...playlistSortable.handleProps(index)}
                  >
                    <Icon icon={faGripVertical} />
                  </button>
                  <div className="marker-preview">
                    <img src={marker.imageUrl} alt={marker.title} />
                    <span className="marker-number-badge">{index + 1}</span>
                  </div>
                  <div className="marker-info">
                    <div className="marker-title">
                      {failedMarkerIds.has(marker.id) && (
                        <Icon
                          icon={faExclamationTriangle}
                          className="marker-failed-icon"
                          title={intl.formatMessage({
                            id: "marker_playlist.unplayable",
                          })}
                        />
                      )}
                      {marker.title}
                    </div>
                    <div className="scene-title">{marker.sceneTitle}</div>
                    {/* CUSTOM: Keep role chips and marker timing together in a compact row. */}
                    <div className="marker-detail-row">
                      <div className="marker-performer-roles">
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
                      </div>
                      <div className="marker-times">
                        {formatTime(marker.seconds)}
                        {marker.end_seconds &&
                          ` - ${formatTime(marker.end_seconds)}`}
                        <span className="duration">
                          ({formatTime(getMarkerDuration(marker))})
                        </span>
                      </div>
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
                        handleToggleSingleMarkerLoop(index);
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
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="remove-marker-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMarker(index);
                      }}
                      title={intl.formatMessage({
                        id: "marker_playlist.delete",
                      })}
                    >
                      <Icon icon={faTimes} />
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
