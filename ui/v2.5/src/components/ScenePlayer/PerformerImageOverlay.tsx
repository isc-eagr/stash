import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import cx from "classnames";

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
}

interface IPerformerImageOverlayProps {
  images: IOverlayImage[];
  portalTarget: HTMLElement | null;
  isFullscreen: boolean;
  overlaysVisible: boolean;
}

const DEFAULT_SIZE = 200;
const MIN_SIZE = 80;

export const PerformerImageOverlay: React.FC<IPerformerImageOverlayProps> = ({
  images,
  portalTarget,
  isFullscreen,
  overlaysVisible,
}) => {
  const [overlayStates, setOverlayStates] = useState<IOverlayState[]>([]);

  // Initialize overlay states when images change
  useEffect(() => {
    setOverlayStates((prev) => {
      // Keep existing states for images that still exist
      const newStates: IOverlayState[] = images.map((img, index) => {
        const existing = prev.find((s) => s.id === img.id);
        if (existing) {
          return { ...existing, url: img.url };
        }
        // New image - position based on index
        return {
          id: img.id,
          url: img.url,
          x: 20 + index * 50,
          y: 20 + index * 50,
          width: DEFAULT_SIZE,
          height: DEFAULT_SIZE,
          visible: true,
        };
      });
      return newStates;
    });
  }, [images]);

  const updatePosition = useCallback(
    (id: string, x: number, y: number) => {
      setOverlayStates((prev) =>
        prev.map((s) => (s.id === id ? { ...s, x, y } : s))
      );
    },
    []
  );

  const updateSize = useCallback((id: string, width: number, height: number) => {
    setOverlayStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, width, height } : s))
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
        />
      ))}
    </>
  );

  // Portal to player element for fullscreen support, otherwise to document.body
  const target =
    isFullscreen && portalTarget ? portalTarget : document.body;

  return createPortal(content, target);
};

interface IDraggableOverlayImageProps {
  overlay: IOverlayState;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, height: number) => void;
}

const DraggableOverlayImage: React.FC<IDraggableOverlayImageProps> = ({
  overlay,
  onPositionChange,
  onSizeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [aspectRatio, setAspectRatio] = useState<number>(1); // Default to 1:1 square

  // Calculate height based on width and image aspect ratio
  const displayHeight = Math.round(overlay.width / aspectRatio);

  // Measure image dimensions on load to calculate aspect ratio
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    setAspectRatio(ratio);
  };

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if clicking on resize handle
    const target = e.target as HTMLElement;
    if (target.classList.contains("pio-resize-handle")) {
      return; // Let resize handler handle it
    }

    e.preventDefault();
    e.stopPropagation();

    if (containerRef.current) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - overlay.x,
        y: e.clientY - overlay.y,
      });
    }
  };

  // Handle resize start
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

  // Mouse move/up effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        onPositionChange(newX, newY);
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        // Maintain aspect ratio based on diagonal movement
        const delta = Math.max(deltaX, deltaY);
        const newWidth = Math.max(MIN_SIZE, resizeStart.w + delta);
        // Height adjusts automatically based on aspect ratio, but also allow some height adjustment
        const newHeight = Math.max(MIN_SIZE, resizeStart.h + deltaY);
        onSizeChange(newWidth, newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
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
    dragOffset,
    resizeStart,
    onPositionChange,
    onSizeChange,
  ]);

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
      }}
      onMouseDown={handleMouseDown}
    >
      <img
        src={overlay.url}
        alt="Performer overlay"
        draggable={false}
        onLoad={handleImageLoad}
      />
      <div
        className="pio-resize-handle"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};

export default PerformerImageOverlay;
