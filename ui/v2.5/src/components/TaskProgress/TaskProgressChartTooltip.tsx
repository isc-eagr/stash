import React from "react";
import { createPortal } from "react-dom";

const viewportMargin = 8;
const anchorGap = 9;

interface IProps {
  anchor: Element;
  /** Point inside the anchor as fractions of its box; defaults to its edges. */
  at?: { x: number; y: number };
  placement?: "above" | "below";
}

/**
 * Renders chart tooltips on the document body so scrollable modals and
 * clipped cards cannot cut them off. The tooltip flips to the side with room
 * and stays inside the viewport while the page or modal scrolls.
 */
export const TaskProgressChartTooltip: React.FC<IProps> = ({
  anchor,
  at,
  placement = "above",
  children,
}) => {
  const tooltip = React.useRef<HTMLDivElement>(null);
  const place = React.useRef<() => void>();
  place.current = () => {
    const element = tooltip.current;
    if (!element) return;
    const bounds = anchor.getBoundingClientRect();
    const x = bounds.left + (at ? at.x : 0.5) * bounds.width;
    const top = at ? bounds.top + at.y * bounds.height : bounds.top;
    const bottom = at ? top : bounds.bottom;
    const { width, height } = element.getBoundingClientRect();
    const fitsAbove = top - anchorGap - height >= viewportMargin;
    const fitsBelow =
      bottom + anchorGap + height <= window.innerHeight - viewportMargin;
    const above =
      placement === "above" ? fitsAbove || !fitsBelow : fitsAbove && !fitsBelow;
    const left = Math.max(
      viewportMargin,
      Math.min(x - width / 2, window.innerWidth - viewportMargin - width)
    );
    element.style.left = `${left}px`;
    element.style.top = `${
      above ? top - anchorGap - height : bottom + anchorGap
    }px`;
    element.style.visibility = "visible";
  };

  React.useLayoutEffect(() => place.current?.());
  React.useEffect(() => {
    const update = () => place.current?.();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, []);

  return createPortal(
    <div
      className="task-progress-history-chart-tooltip"
      role="tooltip"
      ref={tooltip}
    >
      {children}
    </div>,
    document.body
  );
};
