import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button, ListGroup, Badge } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import {
  faPlay,
  faPause,
  faStepForward,
  faStepBackward,
  faRepeat,
  faArrowLeft,
  faArrowUp,
  faArrowDown,
  faList,
  faTimes,
  faExpand,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import cx from "classnames";
import "./MarkerPlaylistPlayer.scss";

function performerDisplayName(p: { name: string; disambiguation?: string | null }) {
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
  giverPerformerNames?: string[];
  receiverPerformerNames?: string[];
}

export const MarkerPlaylistPlayer: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [markers, setMarkers] = useState<IMarkerInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [currentSceneId, setCurrentSceneId] = useState<string>("");
  
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
        const parsedMarkers = JSON.parse(storedData) as GQL.SceneMarkerDataFragment[];
        // Sort markers to maintain the order from the URL
        const sortedMarkers = markerIds
          .map((id) => parsedMarkers.find((m) => m.id === id))
          .filter((m): m is GQL.SceneMarkerDataFragment => m !== undefined)
          .map((m) => {
            // Use scene.paths.stream if available, otherwise construct the URL
            const streamUrl = m.scene.paths?.stream || `/scene/${m.scene.id}/stream`;

            const giverPerformerNames = (m.giver_performers ?? [])
              .map((p) => performerDisplayName(p))
              .filter((n) => n.length > 0);

            const receiverPerformerNames = (m.receiver_performers ?? [])
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
              giverPerformerNames: giverPerformerNames.length > 0 ? giverPerformerNames : undefined,
              receiverPerformerNames: receiverPerformerNames.length > 0 ? receiverPerformerNames : undefined,
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
  const loadMarker = useCallback((index: number, autoPlay = true) => {
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
  }, [markers, currentSceneId, showControlsHack]);
  
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
  }, [markers, currentIndex, loopEnabled, loadMarker]);
  
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
    const prevIndex = currentIndex === 0 ? markers.length - 1 : currentIndex - 1;
    loadMarker(prevIndex);
  }, [markers, currentIndex, loadMarker]);
  
  const handleJumpToMarker = useCallback((index: number) => {
    loadMarker(index);
  }, [loadMarker]);
  
  const handleBack = useCallback(() => {
    history.goBack();
  }, [history]);
  
  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.requestFullscreen) {
      video.requestFullscreen();
    }
    // Fallback for webkit browsers - using type assertion for vendor-prefixed methods
    const videoElement = video as HTMLVideoElement & {
      webkitRequestFullscreen?: () => void;
      msRequestFullscreen?: () => void;
    };
    if (videoElement.webkitRequestFullscreen) {
      videoElement.webkitRequestFullscreen();
    } else if (videoElement.msRequestFullscreen) {
      videoElement.msRequestFullscreen();
    }
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
        <Button variant="link" onClick={handleBack} className="back-btn">
          <Icon icon={faArrowLeft} />
          <span className="ml-2">
            <FormattedMessage id="actions.back" />
          </span>
        </Button>
        <h5>
          <Icon icon={faList} className="mr-2" />
          <FormattedMessage id="marker_playlist.title" />
          <Badge variant="info" className="ml-2">
            {markers.length}
          </Badge>
        </h5>
        <Button
          variant="link"
          onClick={() => setShowPlaylist(!showPlaylist)}
          className="toggle-playlist-btn"
        >
          {showPlaylist ? (
            <Icon icon={faTimes} />
          ) : (
            <Icon icon={faList} />
          )}
        </Button>
      </div>
      
      <div className="player-container">
        <div className={cx("video-section", { "full-width": !showPlaylist })}>
          <div className="video-wrapper">
            <video
              ref={videoRef}
              playsInline
              className="video-player"
            />
          </div>
          
          <div className="now-playing">
            <span className="marker-number">
              {currentIndex + 1} / {markers.length}
            </span>
            <span className="marker-title">{currentMarker?.title}</span>
            <span className="scene-title">({currentMarker?.sceneTitle})</span>
            {currentMarker?.giverPerformerNames && currentMarker.giverPerformerNames.length > 0 && (
              <span className="marker-performers giver">
                <Icon icon={faArrowUp} className="text-success mr-1" title="Top" />
                {currentMarker.giverPerformerNames.join(", ")}
              </span>
            )}
            {currentMarker?.receiverPerformerNames && currentMarker.receiverPerformerNames.length > 0 && (
              <span className="marker-performers receiver">
                <Icon icon={faArrowDown} className="text-info mr-1" title="Bottom" />
                {currentMarker.receiverPerformerNames.join(", ")}
              </span>
            )}
          </div>
          
          <div className="player-controls">
            <Button
              variant="secondary"
              onClick={handlePrevious}
              title={intl.formatMessage({ id: "marker_playlist.previous" })}
            >
              <Icon icon={faStepBackward} />
            </Button>
            
            <Button
              variant="primary"
              onClick={handlePlayPause}
              className="play-pause-btn"
            >
              <Icon icon={isPlaying ? faPause : faPlay} />
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleNext}
              title={intl.formatMessage({ id: "marker_playlist.next" })}
            >
              <Icon icon={faStepForward} />
            </Button>
            
            <Button
              variant={loopEnabled ? "success" : "outline-secondary"}
              onClick={() => setLoopEnabled(!loopEnabled)}
              title={intl.formatMessage({ id: "marker_playlist.toggle_loop" })}
              className="loop-btn"
            >
              <Icon icon={faRepeat} />
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleFullscreen}
              title="Fullscreen"
              className="fullscreen-btn"
            >
              <Icon icon={faExpand} />
            </Button>
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
                     {marker.giverPerformerNames && marker.giverPerformerNames.length > 0 && (
                       <div className="marker-performers giver">
                         <Icon icon={faArrowUp} className="text-success mr-1" />
                         {marker.giverPerformerNames.join(", ")}
                       </div>
                     )}
                     {marker.receiverPerformerNames && marker.receiverPerformerNames.length > 0 && (
                       <div className="marker-performers receiver">
                         <Icon icon={faArrowDown} className="text-info mr-1" />
                         {marker.receiverPerformerNames.join(", ")}
                       </div>
                     )}
                     <div className="marker-times">
                       {formatTime(marker.seconds)}
                       {marker.end_seconds && ` - ${formatTime(marker.end_seconds)}`}
                       <span className="duration">
                         ({formatTime(getMarkerDuration(marker))})
                       </span>
                     </div>
                   </div>
                   <div className="marker-reorder-btns">
                     <Button
                       variant="outline-secondary"
                       size="sm"
                       disabled={index === 0}
                       onClick={e => {
                         e.stopPropagation();
                         if (index > 0) {
                           setMarkers(prev => {
                             const arr = [...prev];
                             [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
                             return arr;
                           });
                           setCurrentIndex(index - 1);
                         }
                       }}
                       title={intl.formatMessage({ id: "marker_playlist.move_up", defaultMessage: "Move up" })}
                     >↑</Button>
                     <Button
                       variant="outline-secondary"
                       size="sm"
                       disabled={index === markers.length - 1}
                       onClick={e => {
                         e.stopPropagation();
                         if (index < markers.length - 1) {
                           setMarkers(prev => {
                             const arr = [...prev];
                             [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
                             return arr;
                           });
                           setCurrentIndex(index + 1);
                         }
                       }}
                       title={intl.formatMessage({ id: "marker_playlist.move_down", defaultMessage: "Move down" })}
                     >↓</Button>
                     <Button
                       variant="outline-danger"
                       size="sm"
                       onClick={e => {
                         e.stopPropagation();
                         setMarkers(prev => {
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
                       title={intl.formatMessage({ id: "marker_playlist.delete", defaultMessage: "Delete" })}
                     >✕</Button>
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
