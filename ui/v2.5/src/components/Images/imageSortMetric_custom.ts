import type * as GQL from "src/core/generated-graphql";
import {
  resolveSortMetricCustom,
  type SortMetricDefinitionCustom,
} from "../Shared/sortMetric_custom";

type ImageSortMetricSource = GQL.SlimImageDataFragment & {
  created_at?: string;
  updated_at?: string;
};

const firstFile = (image: ImageSortMetricSource) => image.visual_files[0];
const fileNameFromPath = (path: string) => path.replace(/^.*[\\/]/, "");
const imageTitle = (image: ImageSortMetricSource) =>
  image.title ??
  (firstFile(image)?.path ? fileNameFromPath(firstFile(image)!.path) : "");
const fileSize = (image: ImageSortMetricSource) =>
  image.visual_files.reduce((total, file) => total + (file.size ?? 0), 0);
const resolution = (image: ImageSortMetricSource) => {
  const file = firstFile(image);
  return file?.width && file?.height
    ? `${file.width}\u00d7${file.height}`
    : undefined;
};

const definitions: Record<
  string,
  SortMetricDefinitionCustom<ImageSortMetricSource>
> = {
  filesize: {
    messageID: "filesize",
    format: "bytes",
    value: fileSize,
  },
  file_count: {
    messageID: "file_count",
    format: "count",
    value: (image) => image.visual_files.length,
  },
  date: { messageID: "date", format: "date", value: (image) => image.date },
  resolution: {
    messageID: "resolution",
    format: "text",
    value: resolution,
  },
  title: {
    messageID: "title",
    format: "text",
    value: (image) => imageTitle(image),
  },
  path: {
    messageID: "path",
    format: "text",
    value: (image) => firstFile(image)?.path,
  },
  rating: {
    messageID: "rating",
    format: "rating",
    value: (image) => image.rating100,
  },
  file_mod_time: {
    messageID: "file_mod_time",
    format: "datetime",
    value: (image) => firstFile(image)?.mod_time,
  },
  tag_count: {
    messageID: "tag_count",
    format: "count",
    value: (image) => image.tags.length,
  },
  performer_count: {
    messageID: "performer_count",
    format: "count",
    value: (image) => image.performers.length,
  },
  random: { messageID: "random", format: "none", value: () => undefined },
  o_counter: {
    messageID: "o_count",
    format: "count",
    value: (image) => image.o_counter,
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: (image) => image.created_at,
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: (image) => image.updated_at,
  },
};

export function getImageSortMetricCustom(
  sortBy: string | undefined,
  image: ImageSortMetricSource
) {
  return resolveSortMetricCustom(sortBy, "path", definitions, image);
}
