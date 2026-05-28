import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import cx from "classnames";
import { Icon } from "src/components/Shared/Icon";
import {
  faRedo,
  faArrowUp,
  faArrowDown,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

interface IOverlayImage {
  id: string;
  url: string;
}

interface IOverlayState {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  rotation: number;     // 0 | 90 | 180 | 270
  cropTop: number;      // 0–50 percent
  cropRight: number;    // 0–50 percent
  cropBottom: number;   // 0–50 percent
  cropLeft: number;     // 0–50 percent
  zIndex: number;
}

interface IPerformerImageOverlayProps {
  images: IOverlayImage[];
  portalTarget: HTMLElement | null;
  isFullscreen: boolean;
  overlaysVisible: boolean;
}

const DEFAULT_SIZE = 200;
const MIN_SIZE = 80;
const BASE_Z = 10000;

// Converts visual (screen-space) crop percentages to local (pre-rotation) CSS inset values.
function visualToLocalClipPath(
  vTop: number, vRight: number, vBottom: number, vLeft: number,
  rotation: number
): string {
  switch (rotation) {
    case 90:  return `inset(${vRight}% ${vBottom}% ${vLeft}% ${vTop}%)`;
    case 180: return `inset(${vBottom}% ${vLeft}% ${vTop}% ${vRight}%)`;
    case 270: return `inset(${vLeft}% ${vTop}% ${vRight}% ${vBottom}%)`;
    default:  return `inset(${vTop}% ${vRight}% ${vBottom}% ${vLeft}%)`;
  }
}

function getRotatorStyle(
  rotation: number,
  containerW: number,
  containerH: number
): React.CSSProperties {
  if (rotation === 0 || rotation === 180) {
    return { width: "100%", height: "100%", transform: `rotate(${rotation}deg)` };
  }
  return {
    position: "absolute",
    width: containerH,
    height: containerW,
    left: (containerW - containerH) / 2,
    top: (containerH - containerW) / 2,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "center",
  };
}

export const PerformerImageOverlay: React.FC<IPerformerImageOverlayProps> = ({
  images,
  portalTarget,
  isFullscreen,
  overlaysVisible,
}) => {
  const [overlayStates, setOverlayStates] = useState<IOverlayState[]>([]);
  const [nextZ, setNextZ] = useState(BASE_Z + 1);

  // Initialize overlay states when images change
  useEffect(() => {
    setOverlayStates((prev) => {
      const newStates: IOverlayState[] = images.map((img, index) => {
        const existing = prev.find((s) => s.id === img.id);
        if (existing) {
          return { ...existing, url: img.url };
        }
        return {
          id: img.id,
          url: img.url,
          x: 20 + index * 50,
          y: 20 + index * 50,
          width: DEFAULT_SIZE,
          height: DEFAULT_SIZE,
          visible: true,
          rotation: 0,
          cropTop: 0,
          cropRight: 0,
          cropBottom: 0,
          cropLeft: 0,
          zIndex: BASE_Z + index,
        };
      });
      return newStates;
    });
  }, [images]);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setOverlayStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x, y } : s))
    );
  }, []);

  const updateSize = useCallback((id: string, width: number, height: number) => {
    setOverlayStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, width, height } : s))
    );
  }, []);

  const rotateOverlay = useCallback((id: string) => {
    setOverlayStates((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const { cropTop, cropRight, cropBottom, cropLeft } = s;
        return {
          ...s,
          rotation: (s.rotation + 90) % 360,
          cropTop: cropLeft,
          cropRight: cropTop,
          cropBottom: cropRight,
          cropLeft: cropBottom,
        };
      })
    );
  }, []);

  const updateCrop = useCallback(
    (id: string, top: number, right: number, bottom: number, left: number) => {
      setOverlayStates((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, cropTop: top, cropRight: right, cropBottom: bottom, cropLeft: left }
            : s
        )
      );
    },
    []
  );

  const bringToFront = useCallback(
    (id: string) => {
      const z = nextZ;
      setNextZ((n) => n + 1);
      setOverlayStates((prev) =>
        prev.map((s) => (s.id === id ? { ...s, zIndex: z } : s))
      );
    },
    [nextZ]
  );

  const sendToBack = useCallback((id: string) => {
    setOverlayStates((prev) => {
      const minZ = Math.min(...prev.map((s) => s.zIndex));
      return prev.map((s) =>
        s.id === id ? { ...s, zIndex: minZ - 1 } : s
      );
    });
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setOverlayStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: false } : s))
    );
  }, []);

  // Don't render if no images or visibility is off
  if (overlayStates.length === 0 || !overlaysVisible) return null;

  const content = (
    <>
      {overlayStates.map((overlay) => (
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        <DraggableOverlayImage
          key={overlay.id}
          overlay={overlay}
          onPositionChange={(x, y) => updatePosition(overlay.id, x, y)}
          onSizeChange={(w, h) => updateSize(overlay.id, w, h)}
          onRotate={() => rotateOverlay(overlay.id)}
          onCropChange={(t, r, b, l) => updateCrop(overlay.id, t, r, b, l)}
          onBringToFront={() => bringToFront(overlay.id)}
          onSendToBack={() => sendToBack(overlay.id)}
          onRemove={() => removeOverlay(overlay.id)}
        />
      ))}
    </>
  );

  // Portal to player element for fullscreen support, otherwise to document.body
  const target = isFullscreen && portalTarget ? portalTarget : document.body;

  return createPortal(content, target);
};

interface IDraggableOverlayImageProps {
  overlay: IOverlayState;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, height: number) => void;
  onRotate: () => void;
  onCropChange: (top: number, right: number, bottom: number, left: number) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onRemove: () => void;
}

const DraggableOverlayImage: React.FC<IDraggableOverlayImageProps> = ({
  overlay,
  onPositionChange,
  onSizeChange,
  onRotate,
  onCropChange,
  onBringToFront,
  onSendToBack,
  onRemove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingTL, setIsResizingTL] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [resizeTLStart, setResizeTLStart] = useState({ x: 0, w: 0, xPos: 0, yPos: 0 });
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  // crop drag state
  const [cropEdge, setCropEdge] = useState<"top"|"right"|"bottom"|"left"|null>(null);
  const [cropDragStart, setCropDragStart] = useState({ pos: 0, value: 0, size: 0 });

  // When rotated 90/270 the visual w/h swap
  const isSwapped = overlay.rotation === 90 || overlay.rotation === 270;
  const displayHeight = isSwapped
    ? Math.round(overlay.width * aspectRatio)
    : Math.round(overlay.width / aspectRatio);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setAspectRatio(img.naturalWidth / img.naturalHeight);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".pio-resize-handle") ||
      target.closest(".pio-resize-handle-tl") ||
      target.closest(".pio-controls-bar") ||
      target.closest(".pio-crop-handle")
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({ x: e.clientX - overlay.x, y: e.clientY - overlay.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, w: overlay.width, h: overlay.height });
  };

  const handleResizeTLMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingTL(true);
    setResizeTLStart({ x: e.clientX, w: overlay.width, xPos: overlay.x, yPos: overlay.y });
  };

  const handleCropMouseDown = (
    e: React.MouseEvent,
    edge: "top" | "right" | "bottom" | "left"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const size = edge === "top" || edge === "bottom" ? (rect?.height ?? 1) : (rect?.width ?? 1);
    const currentValue =
      edge === "top" ? overlay.cropTop
      : edge === "right" ? overlay.cropRight
      : edge === "bottom" ? overlay.cropBottom
      : overlay.cropLeft;
    const pos = edge === "top" || edge === "bottom" ? e.clientY : e.clientX;
    setCropEdge(edge);
    setCropDragStart({ pos, value: currentValue, size });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        onPositionChange(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
      }
      if (isResizing) {
        const delta = Math.max(
          e.clientX - resizeStart.x,
          e.clientY - resizeStart.y
        );
        onSizeChange(
          Math.max(MIN_SIZE, resizeStart.w + delta),
          Math.max(MIN_SIZE, resizeStart.h + (e.clientY - resizeStart.y))
        );
      }
      if (isResizingTL) {
        const delta = e.clientX - resizeTLStart.x;
        const newWidth = Math.max(MIN_SIZE, resizeTLStart.w - delta);
        const actualDeltaX = resizeTLStart.w - newWidth;
        // keep bottom-right fixed: as width shrinks, top moves down proportionally
        const startH = isSwapped ? resizeTLStart.w * aspectRatio : resizeTLStart.w / aspectRatio;
        const newH = isSwapped ? newWidth * aspectRatio : newWidth / aspectRatio;
        const actualDeltaY = startH - newH;
        onSizeChange(newWidth, overlay.height);
        onPositionChange(resizeTLStart.xPos + actualDeltaX, resizeTLStart.yPos + actualDeltaY);
      }
      if (cropEdge) {
        const d = (cropEdge === "top" || cropEdge === "bottom")
          ? e.clientY - cropDragStart.pos
          : e.clientX - cropDragStart.pos;
        const pct = (d / cropDragStart.size) * 100;
        const flipSign = cropEdge === "right" || cropEdge === "bottom" ? -1 : 1;
        const newVal = Math.max(0, Math.min(99, cropDragStart.value + flipSign * pct));
        onCropChange(
          cropEdge === "top" ? newVal : overlay.cropTop,
          cropEdge === "right" ? newVal : overlay.cropRight,
          cropEdge === "bottom" ? newVal : overlay.cropBottom,
          cropEdge === "left" ? newVal : overlay.cropLeft
        );
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setIsResizingTL(false);
      setCropEdge(null);
    };

    if (isDragging || isResizing || isResizingTL || cropEdge) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, isResizingTL, cropEdge, dragOffset, resizeStart, resizeTLStart, cropDragStart, overlay, onPositionChange, onSizeChange, onCropChange]);

  if (!overlay.visible) return null;

  const clipPath = visualToLocalClipPath(
    overlay.cropTop, overlay.cropRight, overlay.cropBottom, overlay.cropLeft,
    overlay.rotation
  );

  return (
    <div
      ref={containerRef}
      className={cx("performer-image-overlay", {
        dragging: isDragging,
        resizing: isResizing,
      })}
      style={{
        left: overlay.x,
        top: overlay.y,
        width: overlay.width,
        height: displayHeight,
        zIndex: overlay.zIndex,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* controls bar – appears on hover, tracks visible image top-left corner */}
      <div className="pio-controls-bar" style={{ top: `calc(${overlay.cropTop}% - 30px)`, left: `${overlay.cropLeft}%` }}>
        <button
          type="button"
          className="pio-ctrl-btn"
          onClick={(e) => { e.stopPropagation(); onRotate(); }}
          title="Rotate 90°"
        >
          <Icon icon={faRedo} />
        </button>
        <button
          type="button"
          className="pio-ctrl-btn"
          onClick={(e) => { e.stopPropagation(); onBringToFront(); }}
          title="Bring to front"
        >
          <Icon icon={faArrowUp} />
        </button>
        <button
          type="button"
          className="pio-ctrl-btn"
          onClick={(e) => { e.stopPropagation(); onSendToBack(); }}
          title="Send to back"
        >
          <Icon icon={faArrowDown} />
        </button>
        <button
          type="button"
          className="pio-ctrl-btn pio-ctrl-close"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      <div style={getRotatorStyle(overlay.rotation, overlay.width, displayHeight)}>
        <img
          src={overlay.url}
          alt="Performer overlay"
          draggable={false}
          onLoad={handleImageLoad}
          style={{ width: "100%", height: "100%", objectFit: "contain", clipPath }}
        />
      </div>

      {/* crop handles */}
      <div
        className={cx("pio-crop-handle pio-crop-top", { "pio-crop-active": overlay.cropTop > 0 })}
        style={{ top: `${overlay.cropTop}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "top")}
        title="Crop top"
      />
      <div
        className={cx("pio-crop-handle pio-crop-right", { "pio-crop-active": overlay.cropRight > 0 })}
        style={{ right: `${overlay.cropRight}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "right")}
        title="Crop right"
      />
      <div
        className={cx("pio-crop-handle pio-crop-bottom", { "pio-crop-active": overlay.cropBottom > 0 })}
        style={{ bottom: `${overlay.cropBottom}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "bottom")}
        title="Crop bottom"
      />
      <div
        className={cx("pio-crop-handle pio-crop-left", { "pio-crop-active": overlay.cropLeft > 0 })}
        style={{ left: `${overlay.cropLeft}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "left")}
        title="Crop left"
      />

      <div
        className="pio-resize-handle-tl"
        style={{ top: `${overlay.cropTop}%`, left: `${overlay.cropLeft}%` }}
        onMouseDown={handleResizeTLMouseDown}
        title="Drag to resize"
      />
      <div
        className="pio-resize-handle"
        style={{ bottom: `${overlay.cropBottom}%`, right: `${overlay.cropRight}%` }}
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};

export default PerformerImageOverlay;
