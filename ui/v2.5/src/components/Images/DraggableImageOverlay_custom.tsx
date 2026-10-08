import {
  visualToLocalClipPath,
  getRotatorStyle,
} from "src/utils/imageOverlayGeometry_custom";
import React, { useRef, useState } from "react";
import { Icon } from "src/components/Shared/Icon";
import {
  faArrowDown,
  faExternalLinkAlt,
  faRedo,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import cx from "classnames";
import {
  IPanelLayout,
  IPanelRect,
  IPanelSizeLimits,
  PanelGesture,
  trackPointerDrag,
} from "src/components/Viewers/viewerPanels_custom";
import "./ImageViewer.scss";

export interface IImageCrop {
  cropTop: number; // percent of the visual height
  cropRight: number; // percent of the visual width
  cropBottom: number;
  cropLeft: number;
}

export interface IImageTransform extends IImageCrop {
  rotation: number; // 0 | 90 | 180 | 270
}

export const DEFAULT_IMAGE_TRANSFORM: IImageTransform = {
  rotation: 0,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
};

type CropEdge = "top" | "right" | "bottom" | "left";

const IMAGE_LIMITS: IPanelSizeLimits = { minWidth: 80, minHeight: 0 };
// Opposite crops always leave this much of the image visible.
const MIN_VISIBLE_PERCENT = 5;

const cropKey: Record<CropEdge, keyof IImageCrop> = {
  top: "cropTop",
  right: "cropRight",
  bottom: "cropBottom",
  left: "cropLeft",
};
const oppositeEdge: Record<CropEdge, CropEdge> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

interface IDraggableImageProps {
  id: string;
  url: string;
  title: string;
  openUrl?: string;
  layout: IPanelLayout;
  transform: IImageTransform;
  onDrag: (
    id: string,
    gesture: PanelGesture,
    start: IPanelRect,
    dx: number,
    dy: number,
    limits: IPanelSizeLimits
  ) => void;
  onAspectRatio: (id: string, aspectRatio: number) => void;
  onRaise: (id: string) => void;
  onLower: (id: string) => void;
  onClose: (id: string) => void;
  onRotate: (id: string) => void;
  onCropChange: (id: string, crop: IImageCrop) => void;
}

const DraggableImageComponent: React.FC<IDraggableImageProps> = ({
  id,
  url,
  title,
  openUrl,
  layout,
  transform,
  onDrag,
  onAspectRatio,
  onRaise,
  onLower,
  onClose,
  onRotate,
  onCropChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { rotation, cropTop, cropRight, cropBottom, cropLeft } = transform;

  const startRect = (): IPanelRect => ({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
  });

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    onAspectRatio(id, rotation % 180 === 0 ? ratio : 1 / ratio);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      e.button !== 0 ||
      target.closest(
        ".iv-resize-handle, .iv-resize-handle-tl, .iv-controls-bar, .iv-crop-handle"
      )
    ) {
      return;
    }
    e.preventDefault();
    const start = startRect();
    setIsDragging(true);
    trackPointerDrag(
      e,
      (dx, dy) => onDrag(id, "move", start, dx, dy, IMAGE_LIMITS),
      {
        onEnd: () => setIsDragging(false),
      }
    );
  };

  const handleResizePointerDown = (
    e: React.PointerEvent,
    gesture: "resize-br" | "resize-tl"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const start = startRect();
    trackPointerDrag(e, (dx, dy) =>
      onDrag(id, gesture, start, dx, dy, IMAGE_LIMITS)
    );
  };

  const handleCropPointerDown = (e: React.PointerEvent, edge: CropEdge) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const vertical = edge === "top" || edge === "bottom";
    const size = (vertical ? rect?.height : rect?.width) || 1;
    const startCrop: IImageCrop = { cropTop, cropRight, cropBottom, cropLeft };
    const sign = edge === "right" || edge === "bottom" ? -1 : 1;
    const max =
      100 - MIN_VISIBLE_PERCENT - startCrop[cropKey[oppositeEdge[edge]]];

    trackPointerDrag(e, (dx, dy) => {
      const delta = ((vertical ? dy : dx) / size) * 100;
      const value = Math.max(
        0,
        Math.min(max, startCrop[cropKey[edge]] + sign * delta)
      );
      onCropChange(id, { ...startCrop, [cropKey[edge]]: value });
    });
  };

  const clipPath = visualToLocalClipPath(
    cropTop,
    cropRight,
    cropBottom,
    cropLeft,
    rotation
  );

  const cropHandle = (edge: CropEdge) => {
    const value = transform[cropKey[edge]];
    return (
      <div
        className={cx("iv-crop-handle", `iv-crop-${edge}`, {
          "iv-crop-active": value > 0,
        })}
        style={{ [edge]: `${value}%` }}
        onPointerDown={(e) => handleCropPointerDown(e, edge)}
        title={`Crop ${edge}`}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className={cx("image-viewer-overlay", { dragging: isDragging })}
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        zIndex: layout.zIndex,
      }}
      onPointerDownCapture={() => onRaise(id)}
      onPointerDown={handlePointerDown}
    >
      {/* controls track the visible image's top-right corner */}
      <div
        className="iv-controls-bar"
        style={{
          top: `calc(${cropTop}% + 4px)`,
          right: `calc(${cropRight}% + 4px)`,
        }}
      >
        {openUrl && (
          <a
            className="iv-ctrl-btn"
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Stash"
          >
            <Icon icon={faExternalLinkAlt} />
          </a>
        )}
        <button
          type="button"
          className="iv-ctrl-btn"
          onClick={() => onRotate(id)}
          title="Rotate 90°"
        >
          <Icon icon={faRedo} />
        </button>
        <button
          type="button"
          className="iv-ctrl-btn"
          onClick={() => onLower(id)}
          title="Send to back"
        >
          <Icon icon={faArrowDown} />
        </button>
        <button
          type="button"
          className="iv-ctrl-btn iv-ctrl-close"
          onClick={() => onClose(id)}
          title="Remove"
        >
          <Icon icon={faTimes} />
        </button>
      </div>

      {/* image: rotated via wrapper so container always matches visual bounds */}
      <div style={getRotatorStyle(rotation, layout.width, layout.height)}>
        <img
          src={url}
          alt={title}
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

      {cropHandle("top")}
      {cropHandle("right")}
      {cropHandle("bottom")}
      {cropHandle("left")}

      <div
        className="iv-resize-handle-tl"
        style={{ top: `${cropTop}%`, left: `${cropLeft}%` }}
        onPointerDown={(e) => handleResizePointerDown(e, "resize-tl")}
        title="Drag to resize"
      />
      <div
        className="iv-resize-handle"
        style={{ bottom: `${cropBottom}%`, right: `${cropRight}%` }}
        onPointerDown={(e) => handleResizePointerDown(e, "resize-br")}
        title="Drag to resize"
      />
    </div>
  );
};

export const DraggableImage = React.memo(DraggableImageComponent);
