// CUSTOM: begin - shared SceneStats summary helpers
export type SceneStatsMarkerLinkTag = {
  id: string;
  name: string;
};

export type SceneStatsVatoCountBuckets = {
  one: number;
  standard: number;
  threesome: number;
  group: number;
};

export function sceneStatsVatoCountBuckets(
  performerCounts: readonly number[]
): SceneStatsVatoCountBuckets {
  return performerCounts.reduce<SceneStatsVatoCountBuckets>(
    (counts, performerCount) => {
      if (performerCount === 1) counts.one += 1;
      else if (performerCount === 2) counts.standard += 1;
      else if (performerCount === 3) counts.threesome += 1;
      else if (performerCount >= 4) counts.group += 1;
      return counts;
    },
    { one: 0, standard: 0, threesome: 0, group: 0 }
  );
}

export function makeSceneStatsMarkerTagURL(
  tag: SceneStatsMarkerLinkTag | undefined,
  scenes?: readonly { id: string; title?: string | null }[]
) {
  if (!tag || scenes?.length === 0) return "#";
  const criterionData = {
    type: "marker_performers",
    modifier: "INCLUDES_ALL",
    tag_ids: [{ id: tag.id, label: tag.name }],
    include_subtags: true,
    top_performer_ids: [],
    top_ethnicities: [],
    top_countries: [],
    top_rating: null,
    bottom_performer_ids: [],
    bottom_ethnicities: [],
    bottom_countries: [],
    bottom_rating: null,
  };
  const params = new URLSearchParams({ sortby: "title" });
  params.append("c", JSON.stringify(criterionData));
  if (scenes)
    params.append(
      "c",
      JSON.stringify({
        type: "scenes",
        modifier: "INCLUDES",
        value: scenes.map((scene) => ({
          id: scene.id,
          label: scene.title || `Scene ${scene.id}`,
        })),
      })
    );
  return `/scenes/markers?${params}`;
}

export type SceneStatsVatoCountBucket =
  | "one"
  | "standard"
  | "threesome"
  | "group";

export function makeSceneStatsVatoCountURL(bucket: SceneStatsVatoCountBucket) {
  const rangeByBucket = {
    one: { modifier: "EQUALS", value: { value: 1 } },
    standard: { modifier: "EQUALS", value: { value: 2 } },
    threesome: { modifier: "EQUALS", value: { value: 3 } },
    group: { modifier: "GREATER_THAN", value: { value: 3 } },
  } as const;
  const criterionData = {
    type: "performer_count",
    ...rangeByBucket[bucket],
  };
  return `/scenes?c=${encodeURIComponent(JSON.stringify(criterionData))}&z=2`;
}
// CUSTOM: end
