export interface IPointerSortRectCustom {
  top: number;
  bottom: number;
}

export type PointerSortItemStateCustom =
  | "dragging"
  | "drop-before"
  | "drop-after"
  | undefined;

export function moveArrayItemCustom<T>(
  items: readonly T[],
  from: number,
  to: number
): T[] {
  if (from === to || from < 0 || from >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

// Where an index ends up after the item at `from` moves to `to`.
export function followMovedIndexCustom(
  index: number,
  from: number,
  to: number
): number {
  if (index === from) return to;
  if (from < index && to >= index) return index - 1;
  if (from > index && to <= index) return index + 1;
  return index;
}

// The final index of the dragged item: the number of other items whose
// midpoint is above the pointer.
export function getPointerSortTargetIndexCustom(
  pointerY: number,
  rects: readonly (IPointerSortRectCustom | undefined)[],
  from: number
): number {
  let target = 0;
  rects.forEach((rect, index) => {
    if (index === from || !rect) return;
    if (pointerY > (rect.top + rect.bottom) / 2) target += 1;
  });
  return target;
}

export function getPointerSortItemStateCustom(
  index: number,
  from: number | undefined,
  target: number | undefined
): PointerSortItemStateCustom {
  if (from === undefined || target === undefined) return undefined;
  if (index === from) return "dragging";
  if (index !== target) return undefined;
  if (target < from) return "drop-before";
  if (target > from) return "drop-after";
  return undefined;
}
