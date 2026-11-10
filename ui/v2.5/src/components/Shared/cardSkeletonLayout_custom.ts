// CUSTOM: loading placeholders in the shape of what is about to appear, for
// catalog lists and stats pages, instead of the full-page loading overlay.
import { DisplayMode } from "src/models/list-filter/types";

export type CardSkeletonEntity =
  | "scene"
  | "marker"
  | "performer"
  | "studio"
  | "tag"
  | "gallery"
  | "image"
  | "group";

export type CardSkeletonShape = "landscape" | "portrait";

export interface ICardGridSkeleton {
  // Grid of cards, or rows for the List and Tagger views.
  layout: "grid" | "rows";
  shape: CardSkeletonShape;
  // Minimum card width in pixels, matching the catalog's zoom level.
  cardWidth: number;
  count: number;
}

// Card widths per zoom level, as in each catalog's card grid.
const CARD_WIDTHS: Record<CardSkeletonEntity, readonly number[]> = {
  scene: [280, 340, 480, 640],
  marker: [240, 340, 480, 640],
  performer: [240, 300, 375, 470],
  studio: [280, 340, 420, 560],
  tag: [280, 340, 480, 640],
  gallery: [280, 340, 480, 640],
  image: [280, 340, 480, 640],
  group: [210, 250, 300, 375],
};

const PORTRAIT: readonly CardSkeletonEntity[] = ["performer", "group"];

// Enough placeholders to fill the first screen without a long flash of grey.
export const CARD_SKELETON_MAX_COUNT = 12;
const ROW_SKELETON_MAX_COUNT = 8;

export function cardGridSkeletonCustom(
  entity: CardSkeletonEntity,
  filter: { displayMode: DisplayMode; zoomIndex: number; itemsPerPage: number }
): ICardGridSkeleton {
  const widths = CARD_WIDTHS[entity];
  const zoom = Math.max(
    0,
    Math.min(widths.length - 1, Math.trunc(filter.zoomIndex) || 0)
  );
  const rows =
    filter.displayMode === DisplayMode.List ||
    filter.displayMode === DisplayMode.Tagger;
  const perPage =
    filter.itemsPerPage > 0 ? filter.itemsPerPage : CARD_SKELETON_MAX_COUNT;

  return {
    layout: rows ? "rows" : "grid",
    shape: PORTRAIT.includes(entity) ? "portrait" : "landscape",
    cardWidth: widths[zoom],
    count: Math.min(
      perPage,
      rows ? ROW_SKELETON_MAX_COUNT : CARD_SKELETON_MAX_COUNT
    ),
  };
}
