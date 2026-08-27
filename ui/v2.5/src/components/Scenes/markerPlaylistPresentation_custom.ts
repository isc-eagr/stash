export interface IMarkerPlaylistImageSourcesCustom {
  screenshot?: string | null;
  preview?: string | null;
}

interface IMarkerPlaylistScrollTargetCustom {
  scrollIntoView(options: { behavior: "smooth"; block: "nearest" }): void;
}

export function getMarkerPlaylistImageUrlCustom({
  screenshot,
  preview,
}: IMarkerPlaylistImageSourcesCustom): string {
  return screenshot || preview || "";
}

export function scrollMarkerPlaylistItemIntoViewCustom(
  item: IMarkerPlaylistScrollTargetCustom | null
): void {
  item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
