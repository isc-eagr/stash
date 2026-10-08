// Layout math and pointer tracking for the multi-panel viewer canvas.

export interface IPanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IPanelLayout extends IPanelRect {
  zIndex: number;
  // Visual width/height ratio the panel box keeps (after image rotation).
  aspectRatio: number;
}

export type PanelLayouts = Record<string, IPanelLayout>;

// Canvas area below the header: x spans 0..width, y spans top..top+height.
export interface IPanelBounds {
  top: number;
  width: number;
  height: number;
}

export interface IPanelSpec {
  id: string;
  defaultAspectRatio: number;
}

export interface IPanelSizeLimits {
  minWidth: number;
  minHeight: number;
}

export type PanelGesture = "move" | "resize-br" | "resize-tl";

export const PANEL_SPACING = 8;
// Part of a panel that must stay on screen so it can be grabbed again.
export const PANEL_KEEP_VISIBLE = 48;
const APPENDED_PANEL_SIZE = 420;
const CASCADE_STEP = 28;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fitSize(boxWidth: number, boxHeight: number, aspectRatio: number) {
  const width = Math.max(1, Math.min(boxWidth, boxHeight * aspectRatio));
  return { width, height: width / aspectRatio };
}

function roundRect(rect: IPanelRect): IPanelRect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

// Grid that shows the most total media area; each panel is centered in its
// cell at its own aspect ratio and a short last row is centered.
export function tilePanels(
  entries: { id: string; aspectRatio: number }[],
  bounds: IPanelBounds,
  spacing = PANEL_SPACING
): Record<string, IPanelRect> {
  const count = entries.length;
  if (count === 0) return {};

  const cellSize = (cols: number) => {
    const rows = Math.ceil(count / cols);
    return {
      rows,
      width: Math.max(1, (bounds.width - spacing * (cols + 1)) / cols),
      height: Math.max(1, (bounds.height - spacing * (rows + 1)) / rows),
    };
  };

  let bestCols = 1;
  let bestArea = -1;
  for (let cols = 1; cols <= count; cols++) {
    const cell = cellSize(cols);
    const area = entries.reduce((sum, entry) => {
      const size = fitSize(cell.width, cell.height, entry.aspectRatio);
      return sum + size.width * size.height;
    }, 0);
    if (area > bestArea + 0.5) {
      bestArea = area;
      bestCols = cols;
    }
  }

  const cell = cellSize(bestCols);
  const result: Record<string, IPanelRect> = {};
  entries.forEach((entry, index) => {
    const row = Math.floor(index / bestCols);
    const col = index % bestCols;
    const inRow =
      row === cell.rows - 1 ? count - (cell.rows - 1) * bestCols : bestCols;
    const rowOffset = ((bestCols - inRow) * (cell.width + spacing)) / 2;
    const cellX = spacing + rowOffset + col * (cell.width + spacing);
    const cellY = bounds.top + spacing + row * (cell.height + spacing);
    const size = fitSize(cell.width, cell.height, entry.aspectRatio);
    result[entry.id] = roundRect({
      x: cellX + (cell.width - size.width) / 2,
      y: cellY + (cell.height - size.height) / 2,
      ...size,
    });
  });
  return result;
}

// Keeps the top edge (and video title bar) inside the canvas and at least
// PANEL_KEEP_VISIBLE pixels of the panel on screen horizontally and below.
export function clampPanelRect(
  rect: IPanelRect,
  bounds: IPanelBounds,
  keep = PANEL_KEEP_VISIBLE
): IPanelRect {
  return {
    ...rect,
    x: clamp(
      rect.x,
      Math.min(0, keep - rect.width),
      bounds.width - Math.min(keep, rect.width)
    ),
    y: clamp(
      rect.y,
      bounds.top,
      bounds.top + bounds.height - Math.min(keep, rect.height)
    ),
  };
}

// Aspect-locked resize from the bottom-right or top-left handle. The opposite
// corner stays anchored and the panel never grows past the canvas.
export function resizePanelRect(
  handle: "br" | "tl",
  start: IPanelRect,
  dx: number,
  dy: number,
  aspectRatio: number,
  limits: IPanelSizeLimits,
  bounds: IPanelBounds
): IPanelRect {
  const sign = handle === "br" ? 1 : -1;
  const byWidth = start.width + sign * dx;
  const byHeight = (start.height + sign * dy) * aspectRatio;
  let width = Math.abs(dx) >= Math.abs(dy) * aspectRatio ? byWidth : byHeight;

  // A panel already hanging off the canvas may keep its current size.
  const maxWidth = Math.max(
    start.width,
    handle === "br" ? bounds.width - start.x : start.x + start.width
  );
  const maxHeight = Math.max(
    start.height,
    handle === "br"
      ? bounds.top + bounds.height - start.y
      : start.y + start.height - bounds.top
  );
  width = Math.min(width, maxWidth, maxHeight * aspectRatio);
  width = Math.max(width, limits.minWidth, limits.minHeight * aspectRatio);
  const height = width / aspectRatio;

  return roundRect(
    handle === "br"
      ? { x: start.x, y: start.y, width, height }
      : {
          x: start.x + start.width - width,
          y: start.y + start.height - height,
          width,
          height,
        }
  );
}

function appendedRect(
  index: number,
  aspectRatio: number,
  bounds: IPanelBounds
): IPanelRect {
  const size = fitSize(
    Math.min(APPENDED_PANEL_SIZE, bounds.width - PANEL_SPACING * 4),
    Math.min(APPENDED_PANEL_SIZE, bounds.height - PANEL_SPACING * 4),
    aspectRatio
  );
  const offset = (index % 8) * CASCADE_STEP;
  return clampPanelRect(
    roundRect({
      x: PANEL_SPACING * 2 + offset,
      y: bounds.top + PANEL_SPACING * 2 + offset,
      ...size,
    }),
    bounds
  );
}

function sameLayouts(a: PanelLayouts, b: PanelLayouts) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => {
    if (bKeys[index] !== key) return false;
    const left = a[key];
    const right = b[key];
    return (
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height &&
      left.zIndex === right.zIndex &&
      left.aspectRatio === right.aspectRatio
    );
  });
}

// Tiles every panel in key order (layouts are built in viewer order).
export function tileLayouts(
  layouts: PanelLayouts,
  bounds: IPanelBounds
): PanelLayouts {
  const rects = tilePanels(
    Object.entries(layouts).map(([id, layout]) => ({
      id,
      aspectRatio: layout.aspectRatio,
    })),
    bounds
  );
  const next: PanelLayouts = {};
  Object.entries(layouts).forEach(([id, layout]) => {
    next[id] = { ...layout, ...rects[id] };
  });
  return sameLayouts(layouts, next) ? layouts : next;
}

export function clampLayouts(
  layouts: PanelLayouts,
  bounds: IPanelBounds
): PanelLayouts {
  const next: PanelLayouts = {};
  Object.entries(layouts).forEach(([id, layout]) => {
    next[id] = { ...layout, ...clampPanelRect(layout, bounds) };
  });
  return sameLayouts(layouts, next) ? layouts : next;
}

// Drops removed panels, adds new ones (cascaded unless tiling), and keeps the
// viewer order so tiling stays stable.
export function syncPanelLayouts(
  previous: PanelLayouts,
  specs: IPanelSpec[],
  bounds: IPanelBounds,
  autoLayout: boolean,
  nextZIndex: () => number
): PanelLayouts {
  const next: PanelLayouts = {};
  let index = specs.filter((spec) => previous[spec.id]).length;
  specs.forEach((spec) => {
    next[spec.id] = previous[spec.id] ?? {
      ...appendedRect(index++, spec.defaultAspectRatio, bounds),
      zIndex: nextZIndex(),
      aspectRatio: spec.defaultAspectRatio,
    };
  });
  const arranged = autoLayout ? tileLayouts(next, bounds) : next;
  return sameLayouts(previous, arranged) ? previous : arranged;
}

// Applies a newly known media aspect ratio: retile, or refit the panel in
// place keeping its longest side.
export function setPanelAspectRatio(
  layouts: PanelLayouts,
  id: string,
  aspectRatio: number,
  bounds: IPanelBounds,
  autoLayout: boolean
): PanelLayouts {
  const layout = layouts[id];
  if (!layout || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return layouts;
  }
  if (Math.abs(layout.aspectRatio - aspectRatio) < 0.001) return layouts;

  const updated = { ...layouts, [id]: { ...layout, aspectRatio } };
  if (autoLayout) return tileLayouts(updated, bounds);

  const longest = Math.max(layout.width, layout.height);
  const size = fitSize(longest, longest, aspectRatio);
  updated[id] = {
    ...updated[id],
    ...clampPanelRect(roundRect({ x: layout.x, y: layout.y, ...size }), bounds),
  };
  return updated;
}

export function raisePanel(
  layouts: PanelLayouts,
  id: string,
  nextZIndex: () => number
): PanelLayouts {
  const layout = layouts[id];
  if (!layout) return layouts;
  const others = Object.entries(layouts).filter(([key]) => key !== id);
  if (others.every(([, other]) => other.zIndex < layout.zIndex)) {
    return layouts;
  }
  return { ...layouts, [id]: { ...layout, zIndex: nextZIndex() } };
}

export function lowerPanel(layouts: PanelLayouts, id: string): PanelLayouts {
  const layout = layouts[id];
  if (!layout) return layouts;
  const others = Object.entries(layouts).filter(([key]) => key !== id);
  if (others.every(([, other]) => other.zIndex > layout.zIndex)) {
    return layouts;
  }
  const minZ = Math.min(...others.map(([, other]) => other.zIndex));
  return { ...layouts, [id]: { ...layout, zIndex: minZ - 1 } };
}

// Follows one pointer (mouse, pen, or touch) until release. Movement below
// `threshold` pixels is ignored so taps and clicks still reach the panel.
export function trackPointerDrag(
  start: { clientX: number; clientY: number; pointerId: number },
  onMove: (dx: number, dy: number) => void,
  options: { threshold?: number; onEnd?: (moved: boolean) => void } = {}
) {
  const threshold = options.threshold ?? 0;
  let moved = false;

  const handleMove = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.clientX;
    const dy = event.clientY - start.clientY;
    if (!moved && Math.abs(dx) + Math.abs(dy) < threshold) return;
    moved = true;
    event.preventDefault();
    onMove(dx, dy);
  };

  const handleEnd = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleEnd);
    window.removeEventListener("pointercancel", handleEnd);
    options.onEnd?.(moved);
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleEnd);
  window.addEventListener("pointercancel", handleEnd);
}
