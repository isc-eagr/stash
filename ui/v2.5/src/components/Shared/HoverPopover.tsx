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
    placement = "top",
    onOpen,
    onClose,
    target,
  }) => {
    const [show, setShow] = useState(false);
    const [effectivePlacement, setEffectivePlacement] = useState(placement); // CUSTOM
    const [popoverMaxHeight, setPopoverMaxHeight] = useState<number>(); // CUSTOM
    const triggerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null); // CUSTOM
    const enterTimer = useRef<number>();
    const leaveTimer = useRef<number>();

    const handleMouseEnter = useCallback(() => {
      window.clearTimeout(leaveTimer.current);
      enterTimer.current = window.setTimeout(() => {
        // CUSTOM: begin - keep tall top/bottom popovers inside the viewport
        const targetElement = target?.current ?? triggerRef.current;
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
    }, [enterDelay, estimatedContentHeight, onOpen, placement, target]);

    // CUSTOM: begin - re-evaluate after lazy popover content loads or resizes
    useEffect(() => {
      if (!show || !popoverRef.current) return;

      const popoverElement = popoverRef.current;
      const targetElement = target?.current ?? triggerRef.current;
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
    }, [estimatedContentHeight, placement, show, target]);
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

    return (
      <>
        <div
          className={className}
          style={style} // CUSTOM
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          ref={triggerRef}
        >
          {children}
        </div>
        {triggerRef.current && (
          <Overlay
            show={show}
            placement={effectivePlacement}
            target={target?.current ?? triggerRef.current}
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
