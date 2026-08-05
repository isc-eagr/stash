import type * as GQL from "src/core/generated-graphql";
import {
  resolveSortMetricCustom,
  type SortMetricDefinitionCustom,
} from "../Shared/sortMetric_custom";

type GallerySortMetricSource = GQL.SlimGalleryDataFragment & {
  created_at?: string;
  updated_at?: string;
};

const firstFile = (gallery: GallerySortMetricSource) => gallery.files[0];
const fileNameFromPath = (path: string) => path.replace(/^.*[\\/]/, "");
const galleryTitle = (gallery: GallerySortMetricSource) => {
  if (gallery.title) return gallery.title;
  const path = firstFile(gallery)?.path ?? gallery.folder?.path;
  return path ? fileNameFromPath(path) : "";
};

const definitions: Record<
  string,
  SortMetricDefinitionCustom<GallerySortMetricSource>
> = {
  date: {
    messageID: "date",
    format: "date",
    value: (gallery) => gallery.date,
  },
  title: {
    messageID: "title",
    format: "text",
    value: (gallery) => galleryTitle(gallery),
  },
  path: {
    messageID: "path",
    format: "text",
    value: (gallery) => firstFile(gallery)?.path ?? gallery.folder?.path,
  },
  rating: {
    messageID: "rating",
    format: "rating",
    value: (gallery) => gallery.rating100,
  },
  file_mod_time: {
    messageID: "file_mod_time",
    format: "datetime",
    value: (gallery) => firstFile(gallery)?.mod_time,
  },
  tag_count: {
    messageID: "tag_count",
    format: "count",
    value: (gallery) => gallery.tags.length,
  },
  performer_count: {
    messageID: "performer_count",
    format: "count",
    value: (gallery) => gallery.performers.length,
  },
  random: { messageID: "random", format: "none", value: () => undefined },
  images_count: {
    messageID: "image_count",
    format: "count",
    value: (gallery) => gallery.image_count,
  },
  file_count: {
    messageID: "zip_file_count",
    format: "count",
    value: (gallery) => gallery.files.length,
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: (gallery) => gallery.created_at,
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: (gallery) => gallery.updated_at,
  },
};

export function getGallerySortMetricCustom(
  sortBy: string | undefined,
  gallery: GallerySortMetricSource
) {
  return resolveSortMetricCustom(sortBy, "path", definitions, gallery);
}
