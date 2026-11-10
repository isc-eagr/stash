import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "react-bootstrap";
import { useIntl } from "react-intl";
import cx from "classnames";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import type { IMultiSegmentLoopController } from "./useMultiSegmentLoop_custom";
import type { IMultiSegmentLoopPresets } from "./useMultiSegmentLoopPresets_custom";
import { MultiSegmentLoopEditor } from "./MultiSegmentLoopEditor";

export interface ILoopOverlayPosition {
  x: number;
  y: number;
}

// Loop editor floating over the video. It lives inside the player element, so
// it stays usable in fullscreen and does not block the video.
interface IMultiSegmentLoopOverlayProps {
  container: HTMLElement;
  loop: IMultiSegmentLoopController;
  presets?: IMultiSegmentLoopPresets;
  /** Dragged position, kept by the host so reopening restores it. */
  position?: ILoopOverlayPosition;
  onPositionChange: (position: ILoopOverlayPosition) => void;
  modalContainer?: HTMLElement | null;
  onClose: () => void;
}

export const MultiSegmentLoopOverlay: React.FC<
  IMultiSegmentLoopOverlayProps
> = ({
  container,
  loop,
  presets,
  position,
  onPositionChange,
  modalContainer,
  onClose,
}) => {
  const intl = useIntl();
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState<ILoopOverlayPosition>();
  const title = intl.formatMessage({ id: "multi_segment_loop.title" });

  // Keys typed in the editor must not trigger player hotkeys; Escape closes.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onPanelKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") onClose();
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".modal.show")) {
        onClose();
      }
    };
    panel.addEventListener("keydown", onPanelKeyDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      panel.removeEventListener("keydown", onPanelKeyDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!dragOffset) return;
    const onMove = (event: MouseEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const bounds = container.getBoundingClientRect();
      const maxX = Math.max(bounds.width - panel.offsetWidth, 0);
      const maxY = Math.max(bounds.height - panel.offsetHeight, 0);
      onPositionChange({
        x: Math.min(
          Math.max(event.clientX - bounds.left - dragOffset.x, 0),
          maxX
        ),
        y: Math.min(
          Math.max(event.clientY - bounds.top - dragOffset.y, 0),
          maxY
        ),
      });
    };
    const onUp = () => setDragOffset(undefined);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [container, dragOffset, onPositionChange]);

  function startDrag(event: React.MouseEvent) {
    const panel = panelRef.current;
    if (!panel || (event.target as HTMLElement).closest("button")) return;
    const rect = panel.getBoundingClientRect();
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    event.preventDefault();
  }

  return createPortal(
    <div
      ref={panelRef}
      className={cx("multi-segment-loop-overlay", {
        "is-dragging": !!dragOffset,
        "is-positioned": !!position,
      })}
      role="dialog"
      aria-label={title}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div className="msl-overlay-header" onMouseDown={startDrag}>
        <span className="msl-overlay-title">{title}</span>
        <Button
          variant="link"
          className="msl-overlay-close"
          onClick={onClose}
          title={intl.formatMessage({ id: "actions.close" })}
        >
          <Icon icon={faTimes} />
        </Button>
      </div>
      <div className="msl-overlay-body">
        <MultiSegmentLoopEditor
          loop={loop}
          presets={presets}
          modalContainer={modalContainer}
        />
      </div>
    </div>,
    container
  );
};
