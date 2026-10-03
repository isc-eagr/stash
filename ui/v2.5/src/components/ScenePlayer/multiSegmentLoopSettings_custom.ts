// CUSTOM: multi-segment loop setting shared by the scene player and viewer.

/** The loop controls are shown unless the Custom setting turns them off. */
export function showMultiSegmentLoopControlsCustom(
  ui?: { showMultiSegmentLoopControls?: boolean | null } | null
): boolean {
  return ui?.showMultiSegmentLoopControls ?? true;
}
