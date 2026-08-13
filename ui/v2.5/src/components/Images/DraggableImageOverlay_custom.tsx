import React, { useEffect, useRef, useState } from "react";
import { Icon } from "src/components/Shared/Icon";
import {
  faTimes,
  faRedo,
  faArrowUp,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
import cx from "classnames";
import "./ImageViewer.scss";

export interface IOverlayState {
  // CUSTOM: exported for MultiVideoViewer image overlays
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  visible: boolean;
  rotation: number; // 0 | 90 | 180 | 270
  cropTop: number; // 0–50 percent
  cropRight: number; // 0–50 percent
  cropBottom: number; // 0–50 percent
  cropLeft: number; // 0–50 percent
  zIndex: number;
}

const MIN_SIZE = 80;

// Converts visual (screen-space) crop percentages to local (pre-rotation) CSS inset values.
// clip-path is applied before transform, so we must remap based on rotation.
function visualToLocalClipPath(
  vTop: number,
  vRight: number,
  vBottom: number,
  vLeft: number,
  rotation: number
): string {
  switch (rotation) {
    case 90:
      return `inset(${vRight}% ${vBottom}% ${vLeft}% ${vTop}%)`;
    case 180:
      return `inset(${vBottom}% ${vLeft}% ${vTop}% ${vRight}%)`;
    case 270:
      return `inset(${vLeft}% ${vTop}% ${vRight}% ${vBottom}%)`;
    default:
      return `inset(${vTop}% ${vRight}% ${vBottom}% ${vLeft}%)`;
  }
}

// Returns a style for an inner wrapper that is rotated so its visual result
// fills the container (containerW × containerH) exactly.
// For 90°/270° the wrapper dims swap; we position it centered.
function getRotatorStyle(
  rotation: number,
  containerW: number,
  containerH: number
): React.CSSProperties {
  if (rotation === 0 || rotation === 180) {
    return {
      width: "100%",
      height: "100%",
      transform: `rotate(${rotation}deg)`,
    };
  }
  // 90 or 270: pre-rotation width = containerH, height = containerW
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

interface IDraggableImageProps {
  overlay: IOverlayState;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number) => void;
  onClose: () => void;
  onRotate: () => void;
  onCropChange: (
    top: number,
    right: number,
    bottom: number,
    left: number
  ) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export const DraggableImage: React.FC<IDraggableImageProps> = ({
  // CUSTOM: exported for MultiVideoViewer
  overlay,
  onPositionChange,
  onSizeChange,
  onClose,
  onRotate,
  onCropChange,
  onBringToFront,
  onSendToBack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingTL, setIsResizingTL] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, w: 0 });
  const [resizeTLStart, setResizeTLStart] = useState({
    x: 0,
    w: 0,
    xPos: 0,
    yPos: 0,
  }); // CUSTOM
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  // crop drag state
  const [cropEdge, setCropEdge] = useState<
    "top" | "right" | "bottom" | "left" | null
  >(null);
  const [cropDragStart, setCropDragStart] = useState({
    pos: 0,
    value: 0,
    size: 0,
  });

  // When rotated 90/270 the visual w/h swap
  const isSwapped = overlay.rotation === 90 || overlay.rotation === 270;
  const displayHeight = isSwapped
    ? Math.round(overlay.width * aspectRatio)
    : Math.round(overlay.width / aspectRatio);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    setAspectRatio(ratio);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".iv-resize-handle") ||
      target.closest(".iv-resize-handle-tl") ||
      target.closest(".iv-close-btn") ||
      target.closest(".iv-controls-bar") ||
      target.closest(".iv-crop-handle")
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
    setResizeStart({ x: e.clientX, w: overlay.width });
  };

  const handleResizeTLMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingTL(true);
    setResizeTLStart({
      x: e.clientX,
      w: overlay.width,
      xPos: overlay.x,
      yPos: overlay.y,
    }); // CUSTOM
  };

  const handleCropMouseDown = (
    e: React.MouseEvent,
    edge: "top" | "right" | "bottom" | "left"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const size =
      edge === "top" || edge === "bottom"
        ? rect?.height ?? 1
        : rect?.width ?? 1;
    const currentValue =
      edge === "top"
        ? overlay.cropTop
        : edge === "right"
        ? overlay.cropRight
        : edge === "bottom"
        ? overlay.cropBottom
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
        const newWidth = Math.max(
          MIN_SIZE,
          resizeStart.w + (e.clientX - resizeStart.x)
        );
        onSizeChange(newWidth);
      }
      if (isResizingTL) {
        const delta = e.clientX - resizeTLStart.x;
        const newWidth = Math.max(MIN_SIZE, resizeTLStart.w - delta);
        const actualDelta = resizeTLStart.w - newWidth;
        // CUSTOM: begin - keep bottom edge fixed by adjusting Y when height changes
        const heightDelta = isSwapped
          ? actualDelta * aspectRatio
          : actualDelta / aspectRatio;
        const newY = resizeTLStart.yPos + heightDelta;
        // CUSTOM: end
        onSizeChange(newWidth);
        onPositionChange(resizeTLStart.xPos + actualDelta, newY);
      }
      if (cropEdge) {
        const delta = (edge: typeof cropEdge) => {
          if (edge === "top" || edge === "bottom")
            return e.clientY - cropDragStart.pos;
          return e.clientX - cropDragStart.pos;
        };
        const d = delta(cropEdge);
        const pct = (d / cropDragStart.size) * 100;
        const flipSign = cropEdge === "right" || cropEdge === "bottom" ? -1 : 1;
        const newVal = Math.max(
          0,
          Math.min(99, cropDragStart.value + flipSign * pct)
        );
        const t = cropEdge === "top" ? newVal : overlay.cropTop;
        const r = cropEdge === "right" ? newVal : overlay.cropRight;
        const b = cropEdge === "bottom" ? newVal : overlay.cropBottom;
        const l = cropEdge === "left" ? newVal : overlay.cropLeft;
        onCropChange(t, r, b, l);
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
  }, [
    isDragging,
    isResizing,
    isResizingTL,
    cropEdge,
    dragOffset,
    resizeStart,
    resizeTLStart,
    cropDragStart,
    overlay,
    aspectRatio,
    isSwapped,
    onPositionChange,
    onSizeChange,
    onCropChange,
  ]);

  if (!overlay.visible) return null;

  const clipPath = visualToLocalClipPath(
    overlay.cropTop,
    overlay.cropRight,
    overlay.cropBottom,
    overlay.cropLeft,
    overlay.rotation
  );

  return (
    <div
      ref={containerRef}
      className={cx("image-viewer-overlay", {
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
      <div
        className="iv-controls-bar"
        style={{
          top: `calc(${overlay.cropTop}% - 32px)`,
          left: `${overlay.cropLeft}%`,
        }}
      >
        <button
          type="button"
          className="iv-ctrl-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRotate();
          }}
          title="Rotate 90°"
        >
          <Icon icon={faRedo} />
        </button>
        <button
          type="button"
          className="iv-ctrl-btn"
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
          className="iv-ctrl-btn"
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
          className="iv-ctrl-btn iv-ctrl-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Remove"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      {/* image: rotated via wrapper so container always matches visual bounds */}
      <div
        style={getRotatorStyle(overlay.rotation, overlay.width, displayHeight)}
      >
        <img
          src={overlay.url}
          alt="Viewer overlay"
          draggable={false}
          onLoad={handleImageLoad}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            clipPath,
          }}
        />
      </div>

      {/* crop handles */}
      <div
        className={cx("iv-crop-handle iv-crop-top", {
          "iv-crop-active": overlay.cropTop > 0,
        })}
        style={{ top: `${overlay.cropTop}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "top")}
        title="Crop top"
      />
      <div
        className={cx("iv-crop-handle iv-crop-right", {
          "iv-crop-active": overlay.cropRight > 0,
        })}
        style={{ right: `${overlay.cropRight}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "right")}
        title="Crop right"
      />
      <div
        className={cx("iv-crop-handle iv-crop-bottom", {
          "iv-crop-active": overlay.cropBottom > 0,
        })}
        style={{ bottom: `${overlay.cropBottom}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "bottom")}
        title="Crop bottom"
      />
      <div
        className={cx("iv-crop-handle iv-crop-left", {
          "iv-crop-active": overlay.cropLeft > 0,
        })}
        style={{ left: `${overlay.cropLeft}%` }}
        onMouseDown={(e) => handleCropMouseDown(e, "left")}
        title="Crop left"
      />

      <div
        className="iv-resize-handle-tl"
        style={{ top: `${overlay.cropTop}%`, left: `${overlay.cropLeft}%` }}
        onMouseDown={handleResizeTLMouseDown}
        title="Drag to resize"
      />
      <div
        className="iv-resize-handle"
        style={{
          bottom: `${overlay.cropBottom}%`,
          right: `${overlay.cropRight}%`,
        }}
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};
