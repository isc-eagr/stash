// CUSTOM: shared multi-segment loop wiring between the player and scene page.

/** Asks the scene page to show its Loop tab. */
export const MULTI_SEGMENT_LOOP_EDITOR_OPEN_EVENT =
  "stash:scene-loop-editor-open";

/** The loop controls are shown unless the Custom setting turns them off. */
export function showMultiSegmentLoopControlsCustom(
  ui?: { showMultiSegmentLoopControls?: boolean | null } | null
): boolean {
  return ui?.showMultiSegmentLoopControls ?? true;
}
