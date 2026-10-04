import { useCallback, useReducer } from "react";
import type { IToast } from "./Toast";

interface IQueuedToast extends IToast {
  id: number;
}

export interface IToastQueueState {
  active?: IQueuedToast;
  queued: IQueuedToast[];
  nextID: number;
}

type ToastQueueAction =
  | { type: "add"; item: IToast }
  | { type: "close"; id?: number };

export const taskProgressAchievementToastPriority = 50;

const toastPriority = (item: IToast) =>
  item.variant === "danger"
    ? Math.max(100, item.priority ?? 0)
    : item.priority ?? 0;

const sortToasts = (items: readonly IQueuedToast[]) =>
  [...items].sort((a, b) => toastPriority(b) - toastPriority(a));

/** Errors interrupt achievements; achievements interrupt successes, preserving deferred messages. */
export function toastQueueReducerCustom(
  state: IToastQueueState,
  action: ToastQueueAction
): IToastQueueState {
  if (action.type === "close") {
    if (!state.active || state.active.id !== action.id) return state;
    return { ...state, active: state.queued[0], queued: state.queued.slice(1) };
  }

  const item = { ...action.item, id: state.nextID };
  const activePriority = state.active ? toastPriority(state.active) : undefined;
  const itemPriority = toastPriority(item);
  if (
    activePriority !== undefined &&
    (itemPriority < activePriority ||
      (item.enqueue && itemPriority === activePriority))
  ) {
    // Ordinary pending messages retain the existing latest-message replacement behavior.
    const queued =
      item.enqueue || item.variant === "danger"
        ? state.queued
        : state.queued.filter(
            (pending) =>
              pending.enqueue ||
              pending.variant === "danger" ||
              toastPriority(pending) !== itemPriority
          );
    return {
      ...state,
      queued: sortToasts([...queued, item]),
      nextID: state.nextID + 1,
    };
  }
  return {
    active: item,
    // Resume interrupted messages before others at the same priority.
    queued:
      state.active && itemPriority > toastPriority(state.active)
        ? sortToasts([state.active, ...state.queued])
        : state.queued,
    nextID: state.nextID + 1,
  };
}

export function useToastQueueCustom() {
  const [state, dispatch] = useReducer(toastQueueReducerCustom, {
    queued: [],
    nextID: 0,
  });
  const addToast = useCallback(
    (item: IToast) => dispatch({ type: "add", item }),
    []
  );
  const id = state.active?.id;
  const closeToast = useCallback(() => dispatch({ type: "close", id }), [id]);
  return { toast: state.active, addToast, closeToast };
}
