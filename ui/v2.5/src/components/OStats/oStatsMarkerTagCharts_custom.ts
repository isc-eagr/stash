export interface IOStatsMarkerTagCountCustom {
  tag_id: string;
  tag_name: string;
  count: number;
}

interface IOStatsActivityTagIdsCustom {
  sexTagId?: string;
  oralTagId?: string;
  soloTagId?: string;
}

export function partitionOStatsMarkerTagCountsCustom(
  counts: IOStatsMarkerTagCountCustom[],
  activityTagIds: IOStatsActivityTagIdsCustom,
  excludedTagIds: string[] = []
) {
  const configuredActivityTagIds = new Set(
    [
      activityTagIds.sexTagId,
      activityTagIds.oralTagId,
      activityTagIds.soloTagId,
    ].filter((tagId): tagId is string => !!tagId)
  );
  const excludedMarkerTagIds = new Set(excludedTagIds);

  return {
    activityTypeCounts: counts.filter((item) =>
      configuredActivityTagIds.has(item.tag_id)
    ),
    markerTagCounts: counts.filter(
      (item) =>
        !configuredActivityTagIds.has(item.tag_id) &&
        !excludedMarkerTagIds.has(item.tag_id)
    ),
  };
}
