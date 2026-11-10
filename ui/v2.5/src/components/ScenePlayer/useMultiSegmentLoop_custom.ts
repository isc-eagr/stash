import { useEffect, useMemo, useState } from "react";
import type MultiSegmentLoopPlugin from "./multi-segment-loop";
import type {
  ILoopSegmentInput,
  IMultiSegmentLoopSnapshot,
} from "./multi-segment-loop";
import {
  filterLoopSegmentsOutsideNegativeMarkers,
  type INegativeLoopMarker,
} from "./loopSegments_custom";
import type { LoopSegmentEdge } from "./multiSegmentLoopState_custom";

// CUSTOM: begin - one subscription-backed controller for every loop UI
export const EMPTY_MULTI_SEGMENT_LOOP_SNAPSHOT: IMultiSegmentLoopSnapshot = {
  segments: [],
  enabled: false,
  currentSegmentIndex: 0,
  loopSingleId: null,
  pendingStart: null,
  remoteSelectedIds: [],
  markerRepeatId: null,
};

export interface IMultiSegmentLoopController {
  ready: boolean;
  state: IMultiSegmentLoopSnapshot;
  markPoint: () => void;
  cancelPending: () => void;
  setEnabled: (enabled: boolean) => void;
  jumpTo: (index: number) => void;
  seek: (seconds: number) => void;
  addSegments: (segments: ILoopSegmentInput[]) => void;
  replaceSegments: (segments: ILoopSegmentInput[]) => ILoopSegmentInput[];
  removeSegments: (ids: string[]) => void;
  clear: () => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  toggleLoopSingle: (id: string) => void;
  setBoundaryToCurrentTime: (id: string, edge: LoopSegmentEdge) => void;
  nudgeBoundary: (id: string, edge: LoopSegmentEdge, delta: number) => void;
}

export function useMultiSegmentLoopSnapshot(
  plugin: MultiSegmentLoopPlugin | undefined
): IMultiSegmentLoopSnapshot {
  const [snapshot, setSnapshot] = useState(
    () => plugin?.getSnapshot() ?? EMPTY_MULTI_SEGMENT_LOOP_SNAPSHOT
  );

  useEffect(() => {
    if (!plugin) {
      setSnapshot(EMPTY_MULTI_SEGMENT_LOOP_SNAPSHOT);
      return;
    }
    setSnapshot(plugin.getSnapshot());
    return plugin.subscribe(setSnapshot);
  }, [plugin]);

  return snapshot;
}

export function useMultiSegmentLoop(
  plugin: MultiSegmentLoopPlugin | undefined,
  negativeMarkers?: INegativeLoopMarker[] | null
): IMultiSegmentLoopController {
  const state = useMultiSegmentLoopSnapshot(plugin);

  const actions = useMemo(() => {
    const filtered = (segments: ILoopSegmentInput[]) =>
      filterLoopSegmentsOutsideNegativeMarkers(segments, negativeMarkers);

    return {
      markPoint: () => {
        if (!plugin) return;
        const pendingStart = plugin.getPendingStart();
        if (pendingStart === null) {
          plugin.markPoint();
          return;
        }
        const end = plugin.player.currentTime() || 0;
        plugin.cancelPending();
        plugin.addSegments(filtered([{ start: pendingStart, end }]));
      },
      cancelPending: () => plugin?.cancelPending(),
      setEnabled: (enabled: boolean) => plugin?.setEnabled(enabled),
      jumpTo: (index: number) => plugin?.jumpToSegment(index),
      seek: (seconds: number) => plugin?.player.currentTime(seconds),
      addSegments: (segments: ILoopSegmentInput[]) =>
        plugin?.addSegments(filtered(segments)),
      replaceSegments: (segments: ILoopSegmentInput[]) => {
        const next = filtered(segments);
        if (!plugin) return next;
        plugin.clearSegments();
        plugin.addSegments(next);
        return next;
      },
      removeSegments: (ids: string[]) => plugin?.removeSegments(ids),
      clear: () => plugin?.clearSegments(),
      reorder: (fromIndex: number, toIndex: number) =>
        plugin?.reorderSegment(fromIndex, toIndex),
      toggleLoopSingle: (id: string) => plugin?.toggleLoopSingle(id),
      setBoundaryToCurrentTime: (id: string, edge: LoopSegmentEdge) =>
        plugin?.setSegmentBoundaryToCurrentTime(id, edge),
      nudgeBoundary: (id: string, edge: LoopSegmentEdge, delta: number) =>
        plugin?.nudgeSegmentBoundary(id, edge, delta),
    };
  }, [plugin, negativeMarkers]);

  return useMemo(
    () => ({ ready: !!plugin, state, ...actions }),
    [plugin, state, actions]
  );
}
// CUSTOM: end
