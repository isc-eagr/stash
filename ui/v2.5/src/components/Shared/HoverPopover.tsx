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
  popperConfig?: OverlayProps["popperConfig"];
  onOpen?: () => void;
  onClose?: () => void;
  target?: React.RefObject<HTMLElement>;
  children?: React.ReactNode;
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
    popperConfig,
    onOpen,
    onClose,
    target,
  }) => {
    const [show, setShow] = useState(false);
    const [triggerElement, setTriggerElement] = useState<HTMLDivElement | null>(
      null
    );
    const [effectivePlacement, setEffectivePlacement] = useState(placement); // CUSTOM
    const [popoverMaxHeight, setPopoverMaxHeight] = useState<number>(); // CUSTOM
    const [cursorAnchorPosition, setCursorAnchorPosition] = useState<{
      left: number;
      top: number;
    }>(); // CUSTOM
    const popoverRef = useRef<HTMLDivElement | null>(null); // CUSTOM
    const cursorAnchorRef = useRef<HTMLSpanElement>(null); // CUSTOM
    const enterTimer = useRef<number>();
    const leaveTimer = useRef<number>();
    const popoverId = useRef(
      `hover-popover-${Math.random().toString(36).slice(2)}`
    );

    const setTriggerRef = useCallback((element: HTMLDivElement | null) => {
      setTriggerElement(element);
    }, []);

    const getOverlayTarget = useCallback(() => {
      return target?.current ?? triggerElement;
    }, [target, triggerElement]);

    // CUSTOM: the show timer reads the latest placement, so a trigger can pick
    // its side on mouse enter.
    const placementRef = useRef(placement);
    placementRef.current = placement;

    const getPopoverTarget = useCallback(
      () =>
        (anchorToCursor ? cursorAnchorRef.current : null) ?? getOverlayTarget(),
      [anchorToCursor, getOverlayTarget]
    ); // CUSTOM

    const handleMouseEnter = useCallback(() => {
      if (disabled) return; // CUSTOM
      window.clearTimeout(leaveTimer.current);
      enterTimer.current = window.setTimeout(() => {
        // CUSTOM: begin - keep tall top/bottom popovers inside the viewport
        const currentPlacement = placementRef.current;
        const targetElement = getPopoverTarget();
        if (
          typeof currentPlacement === "string" &&
          (currentPlacement.startsWith("bottom") ||
            currentPlacement.startsWith("top")) &&
          targetElement
        ) {
          const rect = targetElement.getBoundingClientRect();
          const layout = getHoverPopoverVerticalLayout({
            preferredPlacement: currentPlacement,
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
          setEffectivePlacement(currentPlacement);
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
        const measuredContentHeight =
          popoverElement.querySelector<HTMLElement>(
            "[data-hover-popover-measure]"
          )?.scrollHeight ?? 0;
        const contentHeight = Math.max(
          estimatedContentHeight ?? 0,
          popoverRect.height,
          popoverElement.scrollHeight,
          measuredContentHeight
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
          ref={setTriggerRef}
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
        {getOverlayTarget() && (
          <Overlay
            show={show && !disabled} // CUSTOM
            placement={effectivePlacement} // CUSTOM
            target={getPopoverTarget} // CUSTOM
            container={document.body}
            popperConfig={popperConfig}
          >
            <Popover
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              id={popoverId.current}
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
export const PopoverCard: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ className, children }) => {
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
