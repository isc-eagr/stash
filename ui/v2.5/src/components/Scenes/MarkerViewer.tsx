import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { faArrowDown, faArrowUp, faCompress, faExpand, faThLarge, faTimes } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { markerTitle } from "src/core/markers";
import cx from "classnames";
import "./MarkerViewer.scss";

interface IOverlayState {
  id: string;
  streamUrl: string;
  title: string;
  sceneId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  zIndex: number;
  topPerformerNames?: string[];
  bottomPerformerNames?: string[];
}

const MIN_WIDTH = 200;
const MIN_HEIGHT = 112;
const BASE_Z = 100000;
const TITLE_BAR_H = 30;
const HEADER_H = 60;
const LAYOUT_SPACING = 8;

function performerDisplayName(p: {
  name: string;
  disambiguation?: string | null;
}) {
  return p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name;
}

function computeLayout(
  allMarkers: GQL.SceneMarkerDataFragment[],
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
    .map((id) => allMarkers.find((m) => m.id === id))
    .filter((m): m is GQL.SceneMarkerDataFragment => m !== undefined)
    .map((m, index) => {
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
        id: m.id,
        streamUrl: m.stream,
        title: markerTitle(m) || m.scene?.title || `Marker ${m.id}`,
        x: rowStartX + col * (cellW + spacing),
        y: headerH + spacing + row * (cellH + spacing),
        width: cellW,
        height: cellH,
        visible: true,
        zIndex: BASE_Z + index,
        sceneId: m.scene?.id ?? undefined,
        topPerformerNames: (m.top_performers ?? []).map(performerDisplayName).filter(Boolean),
        bottomPerformerNames: (m.bottom_performers ?? []).map(performerDisplayName).filter(Boolean),
      };
    });
}

interface IDraggableVideoProps {
  overlay: IOverlayState;
  mouseActive: boolean;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, height: number) => void;
  onClose: () => void;
}

const DraggableVideo: React.FC<IDraggableVideoProps> = ({
  overlay,
  mouseActive,
  onPositionChange,
  onSizeChange,
  onClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Snap container height to the video's actual aspect ratio
  const snapToVideoAR = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const ar = v.videoWidth / v.videoHeight;
    const newH = Math.round(overlay.width / ar);
    if (Math.abs(newH - overlay.height) > 2) onSizeChange(overlay.width, newH);
  }, [overlay.width, overlay.height, onSizeChange]);

  // Re-snap whenever width changes (e.g. after reflow or manual resize)
  useEffect(() => {
    snapToVideoAR();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay.width]);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingTL, setIsResizingTL] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [resizeTLStart, setResizeTLStart] = useState({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    xPos: 0,
    yPos: 0,
  });

  const handleTitleBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(".mv-close-btn")) return;
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({ x: e.clientX - overlay.x, y: e.clientY - overlay.y });
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        onPositionChange(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
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
    };
  }, [
    isDragging,
    isResizing,
    isResizingTL,
    dragOffset,
    resizeStart,
    resizeTLStart,
    overlay,
    onPositionChange,
    onSizeChange,
  ]);

  if (!overlay.visible) return null;

  return (
    <div
      className={cx("mv-overlay", { dragging: isDragging })}
      style={{
        left: overlay.x,
        top: overlay.y,
        width: overlay.width,
        height: overlay.height,
        zIndex: overlay.zIndex,
      }}
    >
      {/* Title bar – drag handle */}
      <div className="mv-titlebar" onMouseDown={handleTitleBarMouseDown}>
        <span className="mv-title" title={overlay.title}>
          {overlay.title}
        </span>
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

      {/* Video area */}
      <div className="mv-video-wrap">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={overlay.streamUrl}
          autoPlay
          loop
          muted
          controls
          preload="auto"
          className="mv-video"
          onLoadedMetadata={snapToVideoAR}
        />
        {/* Performer overlay */}
        {mouseActive &&
          ((overlay.topPerformerNames?.length ?? 0) > 0 ||
            (overlay.bottomPerformerNames?.length ?? 0) > 0) && (
          <div className="mv-performer-overlay">
            {(() => {
              const showArrows =
                (overlay.topPerformerNames?.length ?? 0) > 0 &&
                (overlay.bottomPerformerNames?.length ?? 0) > 0;
              const sceneHref = overlay.sceneId ? `/scenes/${overlay.sceneId}` : undefined;
              return (
                <>
                  {overlay.topPerformerNames && overlay.topPerformerNames.length > 0 && (
                    <a
                      className="mv-performer-info mv-performer-top"
                      href={sceneHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {showArrows && <Icon icon={faArrowUp} className="mv-performer-icon" />}
                      <span>{overlay.topPerformerNames.join(", ")}</span>
                    </a>
                  )}
                  {overlay.bottomPerformerNames && overlay.bottomPerformerNames.length > 0 && (
                    <a
                      className="mv-performer-info mv-performer-bottom"
                      href={sceneHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {showArrows && <Icon icon={faArrowDown} className="mv-performer-icon" />}
                      <span>{overlay.bottomPerformerNames.join(", ")}</span>
                    </a>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Resize handles */}
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

export const MarkerViewer: React.FC = () => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlays, setOverlays] = useState<IOverlayState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mouseActive, setMouseActive] = useState(false);
  const mouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const markerIds = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = params.get("ids");
    return ids ? ids.split(",") : [];
  }, [location.search]);

  useEffect(() => {
    if (markerIds.length === 0) {
      setLoading(false);
      return;
    }

    const storedData = sessionStorage.getItem("markerViewerQueue");
    if (storedData) {
      try {
        const parsedMarkers = JSON.parse(
          storedData
        ) as GQL.SceneMarkerDataFragment[];

        const layouts = computeLayout(
          parsedMarkers,
          markerIds,
          window.innerWidth,
          window.innerHeight,
          HEADER_H
        );
        setOverlays(layouts);
      } catch (e) {
        console.error("Failed to parse marker viewer data:", e);
      }
    }
    setLoading(false);
  }, [markerIds]);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x, y } : o))
    );
  }, []);

  const updateSize = useCallback(
    (id: string, width: number, height: number) => {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, width, height } : o))
      );
    },
    []
  );

  const removeOverlay = useCallback((id: string) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, visible: false } : o))
    );
  }, []);

  const reflowLayout = useCallback((vpWidth?: number, vpHeight?: number) => {
    const storedData = sessionStorage.getItem("markerViewerQueue");
    if (!storedData) return;
    try {
      const allMarkers = JSON.parse(storedData) as GQL.SceneMarkerDataFragment[];
      const w = vpWidth ?? window.innerWidth;
      const h = vpHeight ?? window.innerHeight;
      setOverlays((prev) => {
        const visibleIds = prev.filter((o) => o.visible).map((o) => o.id);
        const newLayouts = computeLayout(allMarkers, visibleIds, w, h, 0);
        return prev.map((o) => {
          if (!o.visible) return o;
          const n = newLayouts.find((l) => l.id === o.id);
          // preserve AR-snapped height; only update x/y/width
          return n ? { ...n, height: o.height, zIndex: o.zIndex } : o;
        });
      });
    } catch (e) {
      console.error("Failed to reflow layout:", e);
    }
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
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (isNowFullscreen) {
        // screen.width/height reflects actual fullscreen dimensions
        reflowLayout(screen.width, screen.height);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [reflowLayout]);

  if (loading) {
    return <LoadingIndicator />;
  }

  if (overlays.length === 0) {
    return (
      <div className="marker-viewer-container empty">
        <div className="marker-viewer-empty">
          <p>
            No markers in queue. Select markers from the Markers page and add
            them to the viewer queue.
          </p>
        </div>
      </div>
    );
  }

  const visibleCount = overlays.filter((o) => o.visible).length;

  return (
    <div
      ref={containerRef}
      className={cx("marker-viewer-container", {
        "fullscreen-active": isFullscreen,
      })}
    >
      <Helmet>
        <title>{`Marker Viewer (${visibleCount})`}</title>
      </Helmet>
      {!isFullscreen && (
        <div className="marker-viewer-header">
          <Button variant="secondary" onClick={toggleFullscreen} title="Enter fullscreen">
            <Icon icon={faExpand} />
          </Button>
          <span className="marker-count">
            {visibleCount} marker{visibleCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {isFullscreen && (
        <div className={cx("mv-fab", { "mv-fab--visible": mouseActive })}>
          <Button variant="secondary" className="mv-fab-btn" onClick={toggleFullscreen} title="Exit fullscreen">
            <Icon icon={faCompress} />
          </Button>
          <Button variant="secondary" className="mv-fab-btn" onClick={() => reflowLayout()} title="Reflow layout">
            <Icon icon={faThLarge} />
          </Button>
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
        />
      ))}
    </div>
  );
};

export default MarkerViewer;
