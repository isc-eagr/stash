// CUSTOM: begin - shared SceneStats summary helpers
export type SceneStatsMarkerLinkTag = {
  id: string;
  name: string;
};

export type SceneStatsVatoCountBuckets = {
  one: number;
  standard: number;
  group: number;
};

export function sceneStatsVatoCountBuckets(
  performerCounts: readonly number[]
): SceneStatsVatoCountBuckets {
  return performerCounts.reduce<SceneStatsVatoCountBuckets>(
    (counts, performerCount) => {
      if (performerCount === 1) counts.one += 1;
      else if (performerCount === 2 || performerCount === 3)
        counts.standard += 1;
      else if (performerCount >= 4) counts.group += 1;
      return counts;
    },
    { one: 0, standard: 0, group: 0 }
  );
}

export function makeSceneStatsMarkerTagURL(
  tag: SceneStatsMarkerLinkTag | undefined
) {
  if (!tag) return "#";
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
  return `/scenes/markers?c=${encodeURIComponent(
    JSON.stringify(criterionData)
  )}&sortby=title`;
}

export type SceneStatsVatoCountBucket = "one" | "standard" | "group";

export function makeSceneStatsVatoCountURL(bucket: SceneStatsVatoCountBucket) {
  const rangeByBucket = {
    one: { modifier: "EQUALS", value: { value: 1 } },
    standard: { modifier: "BETWEEN", value: { value: 2, value2: 3 } },
    group: { modifier: "GREATER_THAN", value: { value: 3 } },
  } as const;
  const criterionData = {
    type: "performer_count",
    ...rangeByBucket[bucket],
  };
  return `/scenes?c=${encodeURIComponent(JSON.stringify(criterionData))}`;
}
// CUSTOM: end
