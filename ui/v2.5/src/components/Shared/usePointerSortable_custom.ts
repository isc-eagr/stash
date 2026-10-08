import type React from "react";
import { useEffect, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import {
  getPointerSortItemStateCustom,
  getPointerSortTargetIndexCustom,
} from "./pointerSortable_custom";
import "./pointerSortable_custom.scss";

const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_STEP = 12;

interface IPointerSortDragCustom {
  from: number;
  target: number;
  pointerId: number;
  scrollParent: HTMLElement | null;
  stopListening: () => void;
}

interface IPointerSortableOptionsCustom {
  count: number;
  onMove: (from: number, to: number) => void;
}

function findScrollParent(element: HTMLElement | undefined) {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }
  return null;
}

// Drag-to-reorder for vertical lists with mouse, touch, and pen. Drags start
// from a handle; ArrowUp/ArrowDown on a focused handle move one step.
export function usePointerSortableCustom({
  count,
  onMove,
}: IPointerSortableOptionsCustom) {
  const itemsRef = useRef(new Map<number, HTMLElement>());
  const dragRef = useRef<IPointerSortDragCustom>();
  const pointerYRef = useRef(0);
  const frameRef = useRef<number>();
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const [drag, setDrag] = useState<{ from: number; target: number }>();

  const updateTarget = () => {
    const state = dragRef.current;
    if (!state) return;

    const rects = Array.from({ length: count }, (_, index) =>
      itemsRef.current.get(index)?.getBoundingClientRect()
    );
    const target = getPointerSortTargetIndexCustom(
      pointerYRef.current,
      rects,
      state.from
    );
    if (target === state.target) return;
    state.target = target;
    setDrag({ from: state.from, target });
  };

  const stopAutoScroll = () => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
  };

  // Scrolls the list while the pointer rests near its top or bottom edge.
  const autoScroll = () => {
    const state = dragRef.current;
    if (!state) return;

    const bounds = state.scrollParent?.getBoundingClientRect() ?? {
      top: 0,
      bottom: window.innerHeight,
    };
    const y = pointerYRef.current;
    let step = 0;
    if (y < bounds.top + AUTO_SCROLL_EDGE) step = -AUTO_SCROLL_STEP;
    else if (y > bounds.bottom - AUTO_SCROLL_EDGE) step = AUTO_SCROLL_STEP;
    if (step) {
      (state.scrollParent ?? window).scrollBy(0, step);
      updateTarget();
    }
    frameRef.current = requestAnimationFrame(autoScroll);
  };

  const finish = (commit: boolean) => {
    const state = dragRef.current;
    if (!state) return;
    dragRef.current = undefined;
    state.stopListening();
    stopAutoScroll();
    // Drops arrive from window listeners, which React 17 does not batch;
    // callers that update several states must see them land together.
    unstable_batchedUpdates(() => {
      setDrag(undefined);
      if (commit && state.target !== state.from) {
        onMoveRef.current(state.from, state.target);
      }
    });
  };

  useEffect(() => {
    if (!drag) return;
    document.body.classList.add("pointer-sort-active");
    return () => document.body.classList.remove("pointer-sort-active");
  }, [drag]);

  useEffect(
    () => () => {
      dragRef.current?.stopListening();
      dragRef.current = undefined;
      stopAutoScroll();
    },
    []
  );

  const itemRef = (index: number) => (element: HTMLElement | null) => {
    if (element) itemsRef.current.set(index, element);
    else itemsRef.current.delete(index);
  };

  // ArrowUp/ArrowDown listen natively: some hosts (the in-player loop
  // overlay) stop keydown before it reaches React's root listener.
  const handleKeyRef = (index: number) => {
    let handle: HTMLElement | null = null;
    const onKeyDown = (event: KeyboardEvent) => {
      const step =
        event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!step) return;
      event.preventDefault();
      event.stopPropagation();
      const to = index + step;
      if (to < 0 || to >= count) return;
      unstable_batchedUpdates(() => onMoveRef.current(index, to));
    };
    return (element: HTMLElement | null) => {
      handle?.removeEventListener("keydown", onKeyDown);
      handle = element;
      handle?.addEventListener("keydown", onKeyDown);
    };
  };

  const handleProps = (index: number) => ({
    ref: handleKeyRef(index),
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || dragRef.current) return;
      event.preventDefault();
      event.stopPropagation();

      // Window listeners keep tracking once the pointer leaves the handle.
      const { pointerId } = event;
      const ours = (e: PointerEvent) => e.pointerId === pointerId;
      const onPointerMove = (e: PointerEvent) => {
        if (!ours(e)) return;
        pointerYRef.current = e.clientY;
        updateTarget();
      };
      const onPointerUp = (e: PointerEvent) => ours(e) && finish(true);
      const onPointerCancel = (e: PointerEvent) => ours(e) && finish(false);
      const onKeyDown = (e: KeyboardEvent) =>
        e.key === "Escape" && finish(false);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("keydown", onKeyDown);

      pointerYRef.current = event.clientY;
      dragRef.current = {
        from: index,
        target: index,
        pointerId,
        scrollParent: findScrollParent(itemsRef.current.get(index)),
        stopListening: () => {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerCancel);
          window.removeEventListener("keydown", onKeyDown);
        },
      };
      setDrag({ from: index, target: index });
      frameRef.current = requestAnimationFrame(autoScroll);
    },
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
  });

  const itemClassName = (index: number) => {
    const state = getPointerSortItemStateCustom(
      index,
      drag?.from,
      drag?.target
    );
    return state ? `pointer-sort-${state}` : undefined;
  };

  return { itemRef, handleProps, itemClassName };
}
