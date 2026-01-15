import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import {
  faTimes,
  faExpand,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import cx from "classnames";
import "./ImageViewer.scss";

interface IOverlayState {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  visible: boolean;
}

const DEFAULT_SIZE = 300;
const MIN_SIZE = 80;

interface IDraggableImageProps {
  overlay: IOverlayState;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number) => void;
  onClose: () => void;
}

const DraggableImage: React.FC<IDraggableImageProps> = ({
  overlay,
  onPositionChange,
  onSizeChange,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, w: 0 });
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  const displayHeight = Math.round(overlay.width / aspectRatio);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    setAspectRatio(ratio);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains("iv-resize-handle") ||
      target.classList.contains("iv-close-btn")
    ) {
      return;
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

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      w: overlay.width,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        onPositionChange(newX, newY);
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const newWidth = Math.max(MIN_SIZE, resizeStart.w + deltaX);
        onSizeChange(newWidth);
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
  }, [isDragging, isResizing, dragOffset, resizeStart, onPositionChange, onSizeChange]);

  if (!overlay.visible) return null;

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
      }}
      onMouseDown={handleMouseDown}
    >
      <button
        type="button"
        className="iv-close-btn"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Remove image"
      >
        <Icon icon={faTimes} />
      </button>
      <img
        src={overlay.url}
        alt="Viewer overlay"
        draggable={false}
        onLoad={handleImageLoad}
      />
      <div
        className="iv-resize-handle"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};

export const ImageViewer: React.FC = () => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<IOverlayState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Parse image IDs from URL
  const imageIds = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = params.get("ids");
    return ids ? ids.split(",") : [];
  }, [location.search]);

  // Get image data from sessionStorage
  useEffect(() => {
    if (imageIds.length === 0) {
      setLoading(false);
      return;
    }

    const storedData = sessionStorage.getItem("imageViewerQueue");
    if (storedData) {
      try {
        const parsedImages = JSON.parse(storedData) as GQL.SlimImageDataFragment[];
        
        // Position images in a grid pattern
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const imagesPerRow = Math.ceil(Math.sqrt(parsedImages.length));
        const spacing = 20;

        const sortedImages = imageIds
          .map((id) => parsedImages.find((img) => img.id === id))
          .filter((img): img is GQL.SlimImageDataFragment => img !== undefined)
          .map((img, index) => {
            const row = Math.floor(index / imagesPerRow);
            const col = index % imagesPerRow;
            const x = spacing + col * (DEFAULT_SIZE + spacing);
            const y = 60 + row * (DEFAULT_SIZE + spacing); // 60px for header

            // Center if there's only one image
            const singleX = (viewportWidth - DEFAULT_SIZE) / 2;
            const singleY = (viewportHeight - DEFAULT_SIZE) / 2;

            return {
              id: img.id,
              url: img.paths?.image || "",
              x: parsedImages.length === 1 ? singleX : x,
              y: parsedImages.length === 1 ? singleY : y,
              width: DEFAULT_SIZE,
              visible: true,
            };
          });

        setImages(sortedImages);
      } catch (e) {
        console.error("Failed to parse image viewer data:", e);
      }
    }
    setLoading(false);
  }, [imageIds]);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, x, y } : img))
    );
  }, []);

  const updateSize = useCallback((id: string, width: number) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, width } : img))
    );
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, visible: false } : img)));
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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return <LoadingIndicator />;
  }

  if (images.length === 0) {
    return (
      <div className="image-viewer-container empty">
        <div className="image-viewer-empty">
          <p>No images in queue. Select images from the Images page and add them to the queue.</p>
        </div>
      </div>
    );
  }

  const visibleCount = images.filter((img) => img.visible).length;

  return (
    <div ref={containerRef} className="image-viewer-container">
      <Helmet>
        <title>{`Image Viewer (${visibleCount})`}</title>
      </Helmet>
      {!isFullscreen && (
        <div className="image-viewer-header">
          <Button variant="secondary" onClick={toggleFullscreen}>
            <Icon icon={faExpand} />
          </Button>
        </div>
      )}

      {images.map((overlay) => (
        <DraggableImage
          key={overlay.id}
          overlay={overlay}
          onPositionChange={(x, y) => updatePosition(overlay.id, x, y)}
          onSizeChange={(w) => updateSize(overlay.id, w)}
          onClose={() => removeImage(overlay.id)}
        />
      ))}
    </div>
  );
};

export default ImageViewer;
