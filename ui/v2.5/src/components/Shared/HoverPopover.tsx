import React, { useState, useCallback, useEffect, useRef } from "react";
import { Overlay, Popover, OverlayProps } from "react-bootstrap";
import { PatchComponent } from "src/patch";
import { Icon } from "./Icon";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { getHoverPopoverVerticalLayout } from "./hoverPopoverPlacement_custom"; // CUSTOM

interface IHoverPopover {
  enterDelay?: number;
  leaveDelay?: number;
  content: JSX.Element[] | JSX.Element | string;
  className?: string;
  popoverClassName?: string; // CUSTOM
  estimatedContentHeight?: number; // CUSTOM
  style?: React.CSSProperties; // CUSTOM
  anchorToCursor?: boolean; // CUSTOM
  disabled?: boolean; // CUSTOM
  placement?: OverlayProps["placement"];
  onOpen?: () => void;
  onClose?: () => void;
  target?: React.RefObject<HTMLElement>;
}

export const HoverPopover: React.FC<IHoverPopover> = PatchComponent(
  "HoverPopover",
  ({
    enterDelay = 200,
    leaveDelay = 200,
    content,
    children,
    className,
    popoverClassName, // CUSTOM
    estimatedContentHeight, // CUSTOM
    style, // CUSTOM
    anchorToCursor = false, // CUSTOM
    disabled = false, // CUSTOM
    placement = "top",
    onOpen,
    onClose,
    target,
  }) => {
    const [show, setShow] = useState(false);
    const [effectivePlacement, setEffectivePlacement] = useState(placement); // CUSTOM
    const [popoverMaxHeight, setPopoverMaxHeight] = useState<number>(); // CUSTOM
    const [cursorAnchorPosition, setCursorAnchorPosition] = useState<{
      left: number;
      top: number;
    }>(); // CUSTOM
    const triggerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null); // CUSTOM
    const cursorAnchorRef = useRef<HTMLSpanElement>(null); // CUSTOM
    const enterTimer = useRef<number>();
    const leaveTimer = useRef<number>();

    const getPopoverTarget = useCallback(
      () =>
        anchorToCursor
          ? cursorAnchorRef.current
          : target?.current ?? triggerRef.current,
      [anchorToCursor, target]
    ); // CUSTOM

    const handleMouseEnter = useCallback(() => {
      if (disabled) return; // CUSTOM
      window.clearTimeout(leaveTimer.current);
      enterTimer.current = window.setTimeout(() => {
        // CUSTOM: begin - keep tall top/bottom popovers inside the viewport
        const targetElement = getPopoverTarget();
        if (
          typeof placement === "string" &&
          (placement.startsWith("bottom") || placement.startsWith("top")) &&
          targetElement
        ) {
          const rect = targetElement.getBoundingClientRect();
          const layout = getHoverPopoverVerticalLayout({
            preferredPlacement: placement,
            triggerTop: rect.top,
            triggerBottom: rect.bottom,
            viewportHeight: window.innerHeight,
            contentHeight: estimatedContentHeight ?? 260,
          });

          setEffectivePlacement(
            layout.placement as NonNullable<OverlayProps["placement"]>
          );
          setPopoverMaxHeight(layout.maxHeight);
        } else {
          setEffectivePlacement(placement);
          setPopoverMaxHeight(undefined);
        }
        // CUSTOM: end
        setShow(true);
        onOpen?.();
      }, enterDelay);
    }, [
      enterDelay,
      disabled,
      estimatedContentHeight,
      getPopoverTarget,
      onOpen,
      placement,
    ]);

    // CUSTOM: pin cursor-anchored popovers where the pointer entered so the
    // menu stays nearby without moving away while the user reaches for it.
    const handleTriggerMouseEnter = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return; // CUSTOM
        if (anchorToCursor) {
          const rect = event.currentTarget.getBoundingClientRect();
          setCursorAnchorPosition({
            left: event.clientX - rect.left,
            top: event.clientY - rect.top,
          });
        }
        handleMouseEnter();
      },
      [anchorToCursor, disabled, handleMouseEnter]
    );

    // CUSTOM: begin - re-evaluate after lazy popover content loads or resizes
    useEffect(() => {
      if (!show || !popoverRef.current) return;

      const popoverElement = popoverRef.current;
      const targetElement = getPopoverTarget();
      if (!targetElement || typeof placement !== "string") return;

      const updateLayout = () => {
        const triggerRect = targetElement.getBoundingClientRect();
        const popoverRect = popoverElement.getBoundingClientRect();
        const contentHeight = Math.max(
          estimatedContentHeight ?? 0,
          popoverRect.height,
          popoverElement.scrollHeight
        );
        const layout = getHoverPopoverVerticalLayout({
          preferredPlacement: placement,
          triggerTop: triggerRect.top,
          triggerBottom: triggerRect.bottom,
          viewportHeight: window.innerHeight,
          contentHeight,
        });

        setEffectivePlacement(
          layout.placement as NonNullable<OverlayProps["placement"]>
        );
        setPopoverMaxHeight(layout.maxHeight);
      };

      const frame = window.requestAnimationFrame(updateLayout);
      const resizeObserver =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(updateLayout)
          : undefined;
      resizeObserver?.observe(popoverElement);
      window.addEventListener("resize", updateLayout);

      return () => {
        window.cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        window.removeEventListener("resize", updateLayout);
      };
    }, [estimatedContentHeight, getPopoverTarget, placement, show]);
    // CUSTOM: end

    const handleMouseLeave = useCallback(() => {
      window.clearTimeout(enterTimer.current);
      leaveTimer.current = window.setTimeout(() => {
        setShow(false);
        onClose?.();
      }, leaveDelay);
    }, [leaveDelay, onClose]);

    useEffect(
      () => () => {
        window.clearTimeout(enterTimer.current);
        window.clearTimeout(leaveTimer.current);
      },
      []
    );

    // CUSTOM: an exclusive sibling popover can immediately dismiss this one.
    useEffect(() => {
      if (!disabled) return;

      window.clearTimeout(enterTimer.current);
      window.clearTimeout(leaveTimer.current);
      setShow(false);
    }, [disabled]);

    return (
      <>
        <div
          className={className}
          style={style} // CUSTOM
          onMouseEnter={handleTriggerMouseEnter} // CUSTOM
          onMouseLeave={handleMouseLeave}
          ref={triggerRef}
        >
          {children}
          {/* CUSTOM: cursor-local overlay target */}
          {anchorToCursor && cursorAnchorPosition && (
            <span
              ref={cursorAnchorRef}
              aria-hidden="true"
              style={{
                height: 1,
                left: cursorAnchorPosition.left,
                pointerEvents: "none",
                position: "absolute",
                top: cursorAnchorPosition.top,
                width: 1,
              }}
            />
          )}
        </div>
        {triggerRef.current && (
          <Overlay
            show={show && !disabled} // CUSTOM
            placement={effectivePlacement}
            target={getPopoverTarget() ?? triggerRef.current} // CUSTOM
          >
            <Popover
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              id="popover"
              className={`hover-popover-content ${popoverClassName ?? ""}`} // CUSTOM
              style={
                {
                  "--hover-popover-max-height": popoverMaxHeight
                    ? `${popoverMaxHeight}px`
                    : undefined,
                } as React.CSSProperties
              } // CUSTOM
              ref={(el: HTMLDivElement | null) => {
                // CUSTOM: begin
                // keep a ref to the popover DOM node
                popoverRef.current = el ?? null;
              }} // CUSTOM: end
            >
              {content}
            </Popover>
          </Overlay>
        )}
      </>
    );
  }
);

// convenience component to set the padding on popover content
export const PopoverCard: React.FC<{ className?: string }> = ({
  className,
  children,
}) => {
  return <div className={`popover-card ${className}`}>{children}</div>;
};

export const WarningHoverPopover: React.FC<IHoverPopover> = PatchComponent(
  "WarningHoverPopover",
  ({ children, ...props }) => (
    <HoverPopover {...props} className="warning-hover-popover">
      <Icon icon={faExclamationTriangle} />
    </HoverPopover>
  )
);
