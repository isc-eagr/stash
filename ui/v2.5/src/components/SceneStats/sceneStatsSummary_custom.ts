// CUSTOM: begin - shared SceneStats summary helpers
export type SceneStatsMarkerLinkTag = {
  id: string;
  name: string;
};

export type SceneStatsVatoCountBuckets = {
  zero: number;
  unknown: number;
  one: number;
  standard: number;
  threesome: number;
  group: number;
};

export function sceneStatsVatoCountBuckets(
  performerCounts: readonly (number | null | undefined)[]
): SceneStatsVatoCountBuckets {
  return performerCounts.reduce<SceneStatsVatoCountBuckets>(
    (counts, performerCount) => {
      if (
        typeof performerCount !== "number" ||
        !Number.isFinite(performerCount) ||
        performerCount < 0
      )
        counts.unknown += 1;
      else if (performerCount === 0) counts.zero += 1;
      else if (performerCount === 1) counts.one += 1;
      else if (performerCount === 2) counts.standard += 1;
      else if (performerCount === 3) counts.threesome += 1;
      else if (performerCount >= 4) counts.group += 1;
      return counts;
    },
    { zero: 0, unknown: 0, one: 0, standard: 0, threesome: 0, group: 0 }
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

// CUSTOM: end
