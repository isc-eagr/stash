import type * as GQL from "src/core/generated-graphql";
import {
  resolveSortMetricCustom,
  type SortMetricDefinitionCustom,
} from "../Shared/sortMetric_custom";

type SceneMarkerSortMetricSource = GQL.SceneMarkerDataFragment & {
  created_at?: string;
  updated_at?: string;
  scene: GQL.SceneMarkerDataFragment["scene"] & {
    updated_at?: string;
  };
};

const definitions: Record<
  string,
  SortMetricDefinitionCustom<SceneMarkerSortMetricSource>
> = {
  duration: {
    messageID: "duration",
    format: "duration",
    value: (marker) =>
      (marker.end_seconds ?? marker.seconds + 20) - marker.seconds,
  },
  seconds: {
    messageID: "seconds",
    format: "duration",
    value: (marker) => marker.seconds,
  },
  scene_id: {
    messageID: "scene_id",
    format: "text",
    value: (marker) => marker.scene.id,
  },
  random: { messageID: "random", format: "none", value: () => undefined },
  scenes_updated_at: {
    messageID: "scenes_updated_at",
    format: "datetime",
    value: (marker) => marker.scene.updated_at,
  },
  created_at: {
    messageID: "created_at",
    format: "datetime",
    value: (marker) => marker.created_at,
  },
  updated_at: {
    messageID: "updated_at",
    format: "datetime",
    value: (marker) => marker.updated_at,
  },
};

export function getSceneMarkerSortMetricCustom(
  sortBy: string | undefined,
  marker: SceneMarkerSortMetricSource
) {
  return resolveSortMetricCustom(sortBy, "title", definitions, marker);
}
