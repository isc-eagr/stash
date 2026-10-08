export interface IMarkerPlaylistImageSourcesCustom {
  screenshot?: string | null;
  preview?: string | null;
}

interface IMarkerPlaylistScrollRectCustom {
  top: number;
  bottom: number;
}

interface IMarkerPlaylistScrollTargetCustom {
  getBoundingClientRect(): IMarkerPlaylistScrollRectCustom;
  parentElement: {
    getBoundingClientRect(): IMarkerPlaylistScrollRectCustom;
    scrollBy(options: { top: number; behavior: "smooth" }): void;
  } | null;
}

export function getMarkerPlaylistImageUrlCustom({
  screenshot,
  preview,
}: IMarkerPlaylistImageSourcesCustom): string {
  return screenshot || preview || "";
}

// Scrolls only the playlist itself; scrollIntoView would also scroll the page
// away from the video on phones, where the playlist sits below the player.
export function scrollMarkerPlaylistItemIntoViewCustom(
  item: IMarkerPlaylistScrollTargetCustom | null
): void {
  const list = item?.parentElement;
  if (!item || !list) return;

  const itemRect = item.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  let top = 0;
  if (itemRect.top < listRect.top) {
    top = itemRect.top - listRect.top;
  } else if (itemRect.bottom > listRect.bottom) {
    top = Math.min(
      itemRect.bottom - listRect.bottom,
      itemRect.top - listRect.top
    );
  }

  if (top !== 0) list.scrollBy({ top, behavior: "smooth" });
}
