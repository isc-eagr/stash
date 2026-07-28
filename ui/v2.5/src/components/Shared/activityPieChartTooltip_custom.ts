export interface IActivityPieTooltipSlice {
  label: string;
  percentLabel?: string;
}

export interface IActivityPieTooltipPosition {
  above: boolean;
  x: number;
  y: number;
}

const TOOLTIP_EDGE_GAP = 8;
const TOOLTIP_OFFSET = 12;
const TOOLTIP_MAX_WIDTH = 200;
const TOOLTIP_ESTIMATED_HEIGHT = 80;
const TOOLTIP_IMAGE_ESTIMATED_HEIGHT = 210;

export function formatActivityPieSliceTooltip(
  slice: IActivityPieTooltipSlice
): string {
  return slice.percentLabel
    ? `${slice.label}: ${slice.percentLabel}`
    : slice.label;
}

export function getActivityPieTooltipPosition(
  cursorX: number,
  cursorY: number,
  viewportWidth: number,
  viewportHeight: number,
  hasImage = false
): IActivityPieTooltipPosition {
  const maximumX = viewportWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_EDGE_GAP;
  const estimatedHeight = hasImage
    ? TOOLTIP_IMAGE_ESTIMATED_HEIGHT
    : TOOLTIP_ESTIMATED_HEIGHT;
  const above = cursorY > viewportHeight - estimatedHeight;

  return {
    above,
    x: Math.max(TOOLTIP_EDGE_GAP, Math.min(cursorX + TOOLTIP_OFFSET, maximumX)),
    y: above ? cursorY - TOOLTIP_OFFSET : cursorY + TOOLTIP_OFFSET,
  };
}
