export interface IHoverPopoverVerticalLayoutInput {
  preferredPlacement: string;
  triggerTop: number;
  triggerBottom: number;
  viewportHeight: number;
  contentHeight: number;
  gutter?: number;
}

export interface IHoverPopoverVerticalLayout {
  placement: string;
  maxHeight?: number;
}

export function getHoverPopoverVerticalLayout({
  preferredPlacement,
  triggerTop,
  triggerBottom,
  viewportHeight,
  contentHeight,
  gutter = 16,
}: IHoverPopoverVerticalLayoutInput): IHoverPopoverVerticalLayout {
  const preferredSide = preferredPlacement.startsWith("bottom")
    ? "bottom"
    : preferredPlacement.startsWith("top")
    ? "top"
    : undefined;
  if (!preferredSide) return { placement: preferredPlacement };

  const spaceAbove = Math.max(0, triggerTop);
  const spaceBelow = Math.max(0, viewportHeight - triggerBottom);
  const preferredSpace = preferredSide === "bottom" ? spaceBelow : spaceAbove;
  const alternateSpace = preferredSide === "bottom" ? spaceAbove : spaceBelow;
  const side =
    contentHeight + gutter > preferredSpace && alternateSpace > preferredSpace
      ? preferredSide === "bottom"
        ? "top"
        : "bottom"
      : preferredSide;
  const placement = preferredPlacement.replace(/^(top|bottom)/, side);
  const availableSpace = side === "bottom" ? spaceBelow : spaceAbove;

  return {
    placement,
    maxHeight: Math.max(48, Math.floor(availableSpace - gutter)),
  };
}
