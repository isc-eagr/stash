import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button, ListGroup, Badge, Form, Modal, Dropdown } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import {
  faPlay,
  faPause,
  faStepForward,
  faStepBackward,
  faRepeat,
  faRedo,
  faArrowLeft,
  faArrowUp,
  faArrowDown,
  faList,
  faTimes,
  faExpand,
  faSave,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import cx from "classnames";
import { useFindMarkerPlaylistsQuery, useMarkerPlaylistCreate, useMarkerPlaylistDestroy } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import "./MarkerPlaylistPlayer.scss";

function performerDisplayName(p: {
  name: string;
  disambiguation?: string | null;
}) {
  return p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name;
}

interface IMarkerInfo {
  id: string;
  title: string;
  seconds: number;
  end_seconds: number | null;
  sceneId: string;
  sceneTitle: string;
  streamUrl: string;
  previewUrl: string;
  topPerformerNames?: string[];
  bottomPerformerNames?: string[];
}

export const MarkerPlaylistPlayer: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  const Toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [markers, setMarkers] = useState<IMarkerInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [currentSceneId, setCurrentSceneId] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loopSingleMarkerId, setLoopSingleMarkerId] = useState<string | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Save/Load playlist state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);

  const { data: playlistsData, refetch: refetchPlaylists } = useFindMarkerPlaylistsQuery();
  const [createPlaylist] = useMarkerPlaylistCreate();
  const [destroyPlaylist] = useMarkerPlaylistDestroy();

  // Parse marker IDs from URL
  const markerIds = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = params.get("ids");
    return ids ? ids.split(",") : [];
  }, [location.search]);

  // Get marker data from sessionStorage (stored by SceneMarkerList)
  useEffect(() => {
    if (markerIds.length === 0) {
      setLoading(false);
      return;
    }

    const storedData = sessionStorage.getItem("markerPlaylist");
    if (storedData) {
      try {
        const parsedMarkers = JSON.parse(
          storedData
        ) as GQL.SceneMarkerDataFragment[];
        // Sort markers to maintain the order from the URL
        const sortedMarkers = markerIds
          .map((id) => parsedMarkers.find((m) => m.id === id))
          .filter((m): m is GQL.SceneMarkerDataFragment => m !== undefined)
          .map((m) => {
            // Use scene.paths.stream if available, otherwise construct the URL
            const streamUrl =
              m.scene.paths?.stream || `/scene/${m.scene.id}/stream`;

            const topPerformerNames = (m.top_performers ?? [])
              .map((p) => performerDisplayName(p))
              .filter((n) => n.length > 0);

            const bottomPerformerNames = (m.bottom_performers ?? [])
              .map((p) => performerDisplayName(p))
              .filter((n) => n.length > 0);

            return {
              id: m.id,
              title: markerTitle(m),
              seconds: m.seconds,
              end_seconds: m.end_seconds ?? null,
              sceneId: m.scene.id,
              sceneTitle: m.scene.title || "Untitled Scene",
              streamUrl,
              previewUrl: m.preview,
              topPerformerNames:
                topPerformerNames.length > 0 ? topPerformerNames : undefined,
              bottomPerformerNames:
                bottomPerformerNames.length > 0
                  ? bottomPerformerNames
                  : undefined,
            };
          });

        setMarkers(sortedMarkers);
      } catch (e) {
        console.error("Failed to parse marker playlist data:", e);
      }
    }
    setLoading(false);
  }, [markerIds]);

  // Hack: Hide controls briefly when loading/seeking, then show again
  const showControlsHack = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Native controls are always hidden
    video.controls = false; // controls removed, we use only custom controls below
    setTimeout(() => {
      video.controls = true;
    }, 500); // 500ms delay, tweak as needed
  }, []);

  // Load a specific marker
  const loadMarker = useCallback(
    (index: number, autoPlay = true) => {
      const video = videoRef.current;
      if (!video || index < 0 || index >= markers.length) return;
      // No need to hack controls, native controls are always hidden
      const marker = markers[index];
      const needsNewSource = currentSceneId !== marker.sceneId;

      if (needsNewSource) {
        // Load new video source
        video.src = marker.streamUrl;
        setCurrentSceneId(marker.sceneId);

        const handleLoadedMetadata = () => {
          video.currentTime = marker.seconds;
          if (autoPlay) {
            video.play().catch(console.error);
          }
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        };
        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.load();
      } else {
        // Same scene, just seek
        video.currentTime = marker.seconds;
        // Always call play() if autoPlay - calling play() on an already playing video is a no-op
        if (autoPlay) {
          video.play().catch(console.error);
        }
      }

      setCurrentIndex(index);
    },
    [markers, currentSceneId, showControlsHack]
  );

  // Handle timeupdate to check for marker end
  useEffect(() => {
    const video = videoRef.current;
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
  }, [markers, currentIndex, loopEnabled, loopSingleMarkerId, loadMarker]);

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
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Load first marker when markers are ready
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (markers.length === 0) {
      initialLoadedRef.current = false;
      return;
    }
    if (!initialLoadedRef.current && videoRef.current) {
      initialLoadedRef.current = true;
      loadMarker(0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers.length]);

  // When markers or currentIndex changes, ensure playback continues smoothly after deletion/reorder
  useEffect(() => {
    const video = videoRef.current;
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
    // If the video src or sceneId doesn't match, reload
    if (video.src !== marker.streamUrl || currentSceneId !== marker.sceneId) {
      video.src = marker.streamUrl;
      setCurrentSceneId(marker.sceneId);
      const handleLoadedMetadata = () => {
        video.currentTime = marker.seconds;
        video.play().catch(() => {});
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.load();
    } else {
      // Ensure we're within marker time bounds: seek to marker.seconds if we're before it
      if (video.currentTime < marker.seconds) {
        video.currentTime = marker.seconds;
      }
      video.play().catch(() => {});
    }
  }, [markers, currentIndex, currentSceneId]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, []);

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

  const handleBack = useCallback(() => {
    history.push("/scenes");
  }, [history]);

  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isFullscreen) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else {
        // Fallback for webkit browsers
        const videoElement = video as HTMLVideoElement & {
          webkitRequestFullscreen?: () => void;
          msRequestFullscreen?: () => void;
        };
        if (videoElement.webkitRequestFullscreen) {
          videoElement.webkitRequestFullscreen();
        } else if (videoElement.msRequestFullscreen) {
          videoElement.msRequestFullscreen();
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
    if (!isFullscreen) return;

    // Clear any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      // This is a double click - exit fullscreen
      handleFullscreen();
    } else {
      // This is potentially a single click - wait to see if double click comes
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
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
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
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes("UNIQUE constraint failed")) {
        Toast.error(`A playlist named "${playlistName}" already exists. Please choose a different name.`);
      } else {
        Toast.error(`Failed to save playlist: ${errorMessage}`);
      }
    }
  }, [playlistName, markers, createPlaylist, Toast, refetchPlaylists]);

  const handleLoadPlaylist = useCallback((playlist: { id: string; marker_ids: string[] }) => {
    const idsParam = playlist.marker_ids.join(",");
    window.location.href = `/scenes/markers/player?ids=${idsParam}`;
  }, []);

  const handleDeletePlaylist = useCallback(async (id: string, name: string) => {
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
  }, [destroyPlaylist, Toast, refetchPlaylists]);

  if (loading) {
    return <LoadingIndicator />;
  }

  if (markers.length === 0) {
    return (
      <div className="marker-playlist-player empty">
        <h4>
          <FormattedMessage id="marker_playlist.no_markers" />
        </h4>
        <Button variant="secondary" onClick={handleBack}>
          <Icon icon={faArrowLeft} className="mr-2" />
          <FormattedMessage id="actions.back" />
        </Button>
      </div>
    );
  }

  const currentMarker = markers[currentIndex];

  return (
    <div className="marker-playlist-player" ref={containerRef}>
      <Helmet>
        <title>Marker Playlist - Stash</title>
      </Helmet>

      <div className="player-header">
        <div className="player-header-left">
          <Button variant="secondary" onClick={handleBack} className="back-btn" size="sm">
            <Icon icon={faArrowLeft} />
            <span className="ml-2">
              <FormattedMessage id="actions.back" />
            </span>
          </Button>
        </div>
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
              {(!playlistsData?.findMarkerPlaylists || playlistsData.findMarkerPlaylists.length === 0) ? (
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
                        if (e.key === 'Enter' || e.key === ' ') {
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
          <div className="video-wrapper" onClick={handleVideoClick}>
            <video ref={videoRef} playsInline className="video-player" />
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
                onClick={(e) => {
                  e.preventDefault();
                  history.push(`/scenes/${currentMarker?.sceneId}`);
                }}
                title="Go to scene"
              >
                {currentMarker?.sceneTitle}
              </a>
            </div>
            {(currentMarker?.topPerformerNames && currentMarker.topPerformerNames.length > 0) || 
             (currentMarker?.bottomPerformerNames && currentMarker.bottomPerformerNames.length > 0) ? (
              <div className="now-playing-performers">
                {currentMarker?.topPerformerNames &&
                  currentMarker.topPerformerNames.length > 0 && (
                    <span className="marker-performers top">
                      <Icon
                        icon={faArrowUp}
                        className="performer-icon-top mr-1"
                        title="Top"
                      />
                      {currentMarker.topPerformerNames.join(", ")}
                    </span>
                  )}
                {currentMarker?.bottomPerformerNames &&
                  currentMarker.bottomPerformerNames.length > 0 && (
                    <span className="marker-performers bottom">
                      <Icon
                        icon={faArrowDown}
                        className="performer-icon-bottom mr-1"
                        title="Bottom"
                      />
                      {currentMarker.bottomPerformerNames.join(", ")}
                    </span>
                  )}
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
                    {marker.topPerformerNames &&
                      marker.topPerformerNames.length > 0 && (
                        <div className="marker-performers top">
                          <Icon
                            icon={faArrowUp}
                            className="performer-icon-top mr-1"
                          />
                          {marker.topPerformerNames.join(", ")}
                        </div>
                      )}
                    {marker.bottomPerformerNames &&
                      marker.bottomPerformerNames.length > 0 && (
                        <div className="marker-performers bottom">
                          <Icon icon={faArrowDown} className="performer-icon-bottom mr-1" />
                          {marker.bottomPerformerNames.join(", ")}
                        </div>
                      )}
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
                      variant={loopSingleMarkerId === marker.id ? "primary" : "outline-secondary"}
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
