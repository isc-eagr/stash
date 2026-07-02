// CUSTOM: Chronological scene marker search helpers.

const defaultMarkerDurationSeconds = 20;

export interface ISceneMarkerChronologySearchTag {
  id: string;
  name?: string | null;
  aliases?: string[];
  parents?: ISceneMarkerChronologySearchTag[];
}

export interface ISceneMarkerChronologySearchPerformer {
  id: string;
  name?: string | null;
  alias_list?: string[];
  disambiguation?: string | null;
}

export interface ISceneMarkerChronologySearchMarker {
  id: string;
  seconds: number;
  end_seconds?: number | null;
  scene?: { id: string };
  primary_tag: ISceneMarkerChronologySearchTag;
  tags: ISceneMarkerChronologySearchTag[];
  top_performers?: ISceneMarkerChronologySearchPerformer[];
  bottom_performers?: ISceneMarkerChronologySearchPerformer[];
}

export interface ISceneMarkerChronologySearchFilters {
  tags: ISceneMarkerChronologySearchTag[];
  topPerformers: ISceneMarkerChronologySearchPerformer[];
  bottomPerformers: ISceneMarkerChronologySearchPerformer[];
}

export type SceneMarkerChronologyDisplayTagKind =
  | "primary"
  | "secondary"
  | "overlap"
  | "parent";

export interface ISceneMarkerChronologyDisplayTag<
  T extends ISceneMarkerChronologySearchTag = ISceneMarkerChronologySearchTag
> {
  kind: SceneMarkerChronologyDisplayTagKind;
  tag: T;
}

function normalizeSearchText(value?: string | null) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function markerEndSeconds(marker: ISceneMarkerChronologySearchMarker) {
  return marker.end_seconds ?? marker.seconds + defaultMarkerDurationSeconds;
}

function markerDurationSeconds(marker: ISceneMarkerChronologySearchMarker) {
  return markerEndSeconds(marker) - marker.seconds;
}

function compareMarkerIDs(a: string, b: string) {
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return a.localeCompare(b);
}

function compareChronologicalMarkers(
  a: ISceneMarkerChronologySearchMarker,
  b: ISceneMarkerChronologySearchMarker
) {
  return (
    a.seconds - b.seconds ||
    markerEndSeconds(a) - markerEndSeconds(b) ||
    compareMarkerIDs(a.id, b.id)
  );
}

function compareNamedSearchObjects(
  a: { id: string; name?: string | null },
  b: { id: string; name?: string | null }
) {
  return (
    normalizeSearchText(a.name).localeCompare(normalizeSearchText(b.name)) ||
    compareMarkerIDs(a.id, b.id)
  );
}

function markerIsNarrowerThan(
  candidate: ISceneMarkerChronologySearchMarker,
  current: ISceneMarkerChronologySearchMarker
) {
  const durationDiff =
    markerDurationSeconds(candidate) - markerDurationSeconds(current);

  if (durationDiff !== 0) {
    return durationDiff < 0;
  }

  return compareMarkerIDs(candidate.id, current.id) < 0;
}

function markersOverlap(
  a: ISceneMarkerChronologySearchMarker,
  b: ISceneMarkerChronologySearchMarker
) {
  return (
    a.id !== b.id &&
    (!a.scene?.id || !b.scene?.id || a.scene.id === b.scene.id) &&
    b.seconds < markerEndSeconds(a) &&
    markerEndSeconds(b) > a.seconds
  );
}

function markerTags(marker: ISceneMarkerChronologySearchMarker) {
  return [marker.primary_tag, ...marker.tags];
}

function tagParents(tag: ISceneMarkerChronologySearchTag) {
  return tag.parents ?? [];
}

function markerTagsWithParents(marker: ISceneMarkerChronologySearchMarker) {
  const tags = markerTags(marker);
  return [...tags, ...tags.flatMap(tagParents)];
}

function markerOverlapsTimeRange(
  a: ISceneMarkerChronologySearchMarker,
  b: ISceneMarkerChronologySearchMarker
) {
  return (
    (!a.scene?.id || !b.scene?.id || a.scene.id === b.scene.id) &&
    b.seconds < markerEndSeconds(a) &&
    markerEndSeconds(b) > a.seconds
  );
}

function uniqueByID<T extends { id: string }>(items: T[]) {
  const itemsByID = new Map<string, T>();

  items.forEach((item) => {
    if (!itemsByID.has(item.id)) {
      itemsByID.set(item.id, item);
    }
  });

  return Array.from(itemsByID.values());
}

function tagMatchesSelectedTag(
  tag: ISceneMarkerChronologySearchTag,
  selectedTag: ISceneMarkerChronologySearchTag
) {
  const selectedName = normalizeSearchText(selectedTag.name);

  return (
    tag.id === selectedTag.id ||
    (tag.parents ?? []).some((parent) => parent.id === selectedTag.id) ||
    (!!selectedName && normalizeSearchText(tag.name).includes(selectedName))
  );
}

function markerDirectlyMatchesTag(
  marker: ISceneMarkerChronologySearchMarker,
  selectedTag: ISceneMarkerChronologySearchTag
) {
  return markerTags(marker).some((tag) =>
    tagMatchesSelectedTag(tag, selectedTag)
  );
}

function markerDirectlyMatchesAnyTag(
  marker: ISceneMarkerChronologySearchMarker,
  selectedTags: ISceneMarkerChronologySearchTag[]
) {
  return selectedTags.some((tag) => markerDirectlyMatchesTag(marker, tag));
}

function markerOverlapNeighborhood(
  marker: ISceneMarkerChronologySearchMarker,
  allMarkers: ISceneMarkerChronologySearchMarker[]
) {
  return allMarkers.filter(
    (candidate) =>
      candidate.id === marker.id || markersOverlap(marker, candidate)
  );
}

function markersShareOverlapWindow(
  markerGroupsByTag: ISceneMarkerChronologySearchMarker[][]
) {
  const groupsByFewestMatches = [...markerGroupsByTag].sort(
    (a, b) => a.length - b.length
  );

  const findSharedWindow = (
    tagIndex: number,
    overlapStart: number,
    overlapEnd: number
  ): boolean => {
    if (tagIndex >= groupsByFewestMatches.length) {
      return overlapStart < overlapEnd;
    }

    return groupsByFewestMatches[tagIndex].some((candidate) => {
      const nextOverlapStart = Math.max(overlapStart, candidate.seconds);
      const nextOverlapEnd = Math.min(overlapEnd, markerEndSeconds(candidate));

      return (
        nextOverlapStart < nextOverlapEnd &&
        findSharedWindow(tagIndex + 1, nextOverlapStart, nextOverlapEnd)
      );
    });
  };

  return findSharedWindow(
    0,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY
  );
}

function markerMatchesSharedTagOverlap(
  marker: ISceneMarkerChronologySearchMarker,
  allMarkers: ISceneMarkerChronologySearchMarker[],
  selectedTags: ISceneMarkerChronologySearchTag[]
) {
  if (selectedTags.length === 0) {
    return true;
  }

  if (
    selectedTags.length > 1 &&
    !markerDirectlyMatchesAnyTag(marker, selectedTags)
  ) {
    return false;
  }

  const markerNeighborhood = markerOverlapNeighborhood(marker, allMarkers);
  const markerGroupsByTag = selectedTags.map((tag) =>
    markerNeighborhood.filter((candidate) =>
      markerDirectlyMatchesTag(candidate, tag)
    )
  );

  if (markerGroupsByTag.some((group) => group.length === 0)) {
    return false;
  }

  return markersShareOverlapWindow(markerGroupsByTag);
}

function markerMatchesTags(
  marker: ISceneMarkerChronologySearchMarker,
  allMarkers: ISceneMarkerChronologySearchMarker[],
  selectedTags: ISceneMarkerChronologySearchTag[]
) {
  return markerMatchesSharedTagOverlap(marker, allMarkers, selectedTags);
}

function markerWinsNarrowestTagMatch(
  marker: ISceneMarkerChronologySearchMarker,
  allMarkers: ISceneMarkerChronologySearchMarker[],
  selectedTags: ISceneMarkerChronologySearchTag[]
) {
  if (selectedTags.length <= 1) {
    return true;
  }

  return !allMarkers.some(
    (candidate) =>
      markersOverlap(marker, candidate) &&
      markerMatchesTags(candidate, allMarkers, selectedTags) &&
      markerIsNarrowerThan(candidate, marker)
  );
}

function performerMatchesSelectedPerformer(
  performer: ISceneMarkerChronologySearchPerformer,
  selectedPerformer: ISceneMarkerChronologySearchPerformer
) {
  const selectedName = normalizeSearchText(selectedPerformer.name);
  const searchable = [
    performer.id,
    performer.name,
    performer.disambiguation,
    ...(performer.alias_list ?? []),
  ];

  return (
    performer.id === selectedPerformer.id ||
    searchable.some((value) => {
      const normalized = normalizeSearchText(value);
      return !!selectedName && normalized.includes(selectedName);
    })
  );
}

function performersMatchSelectedPerformers(
  performers: ISceneMarkerChronologySearchPerformer[] | undefined,
  selectedPerformers: ISceneMarkerChronologySearchPerformer[]
) {
  if (selectedPerformers.length === 0) {
    return true;
  }

  return selectedPerformers.every((selectedPerformer) =>
    (performers ?? []).some((performer) =>
      performerMatchesSelectedPerformer(performer, selectedPerformer)
    )
  );
}

export function filterChronologicalSceneMarkers<
  T extends ISceneMarkerChronologySearchMarker
>(markers: T[], filters: ISceneMarkerChronologySearchFilters): T[] {
  return [...markers]
    .filter(
      (marker) =>
        markerMatchesTags(marker, markers, filters.tags) &&
        markerWinsNarrowestTagMatch(marker, markers, filters.tags) &&
        performersMatchSelectedPerformers(
          marker.top_performers,
          filters.topPerformers
        ) &&
        performersMatchSelectedPerformers(
          marker.bottom_performers,
          filters.bottomPerformers
        )
    )
    .sort(compareChronologicalMarkers);
}

export function timestampBelongsToSceneMarker(
  marker: ISceneMarkerChronologySearchMarker,
  timestamp?: number
) {
  return (
    timestamp !== undefined &&
    timestamp > 0 &&
    timestamp >= marker.seconds &&
    timestamp < markerEndSeconds(marker)
  );
}

export function getChronologicalSceneMarkerTags<
  T extends ISceneMarkerChronologySearchMarker
>(markers: T[]): ISceneMarkerChronologySearchTag[] {
  return uniqueByID(markers.flatMap(markerTagsWithParents)).sort(
    compareNamedSearchObjects
  );
}

export function getCompatibleChronologicalSceneMarkerTags<
  T extends ISceneMarkerChronologySearchMarker
>(
  markers: T[],
  selectedTags: ISceneMarkerChronologySearchTag[]
): ISceneMarkerChronologySearchTag[] {
  const selectedTagIDs = new Set(selectedTags.map((tag) => tag.id));

  return getChronologicalSceneMarkerTags(markers).filter(
    (tag) =>
      !selectedTagIDs.has(tag.id) &&
      filterChronologicalSceneMarkers(markers, {
        tags: [...selectedTags, tag],
        topPerformers: [],
        bottomPerformers: [],
      }).length > 0
  );
}

export function getChronologicalSceneMarkerPerformers<
  T extends ISceneMarkerChronologySearchMarker
>(
  markers: T[],
  selectedTags: ISceneMarkerChronologySearchTag[],
  role: "top" | "bottom"
): ISceneMarkerChronologySearchPerformer[] {
  const tagFilteredMarkers = filterChronologicalSceneMarkers(markers, {
    tags: selectedTags,
    topPerformers: [],
    bottomPerformers: [],
  });
  const performerField =
    role === "top" ? "top_performers" : "bottom_performers";

  return uniqueByID(
    tagFilteredMarkers.flatMap((marker) => marker[performerField] ?? [])
  ).sort(compareNamedSearchObjects);
}

export function getChronologicalSceneMarkerDisplayTags<
  M extends ISceneMarkerChronologySearchMarker
>(marker: M, allMarkers: M[]): ISceneMarkerChronologyDisplayTag[] {
  const displayTags: ISceneMarkerChronologyDisplayTag[] = [
    { kind: "primary", tag: marker.primary_tag },
  ];
  const displayTagIDs = new Set([marker.primary_tag.id]);
  const parentCandidates: ISceneMarkerChronologySearchTag[] = [
    ...tagParents(marker.primary_tag),
  ];

  marker.tags.forEach((tag) => {
    if (!displayTagIDs.has(tag.id)) {
      displayTagIDs.add(tag.id);
      displayTags.push({ kind: "secondary", tag });
    }

    parentCandidates.push(...tagParents(tag));
  });

  [...allMarkers]
    .filter(
      (candidate) =>
        candidate.id !== marker.id && markerOverlapsTimeRange(marker, candidate)
    )
    .sort(compareChronologicalMarkers)
    .flatMap((candidate) => [candidate.primary_tag, ...candidate.tags])
    .forEach((tag) => {
      if (!displayTagIDs.has(tag.id)) {
        displayTagIDs.add(tag.id);
        displayTags.push({ kind: "overlap", tag });
      }

      parentCandidates.push(...tagParents(tag));
    });

  uniqueByID(parentCandidates)
    .sort(compareNamedSearchObjects)
    .forEach((tag) => {
      if (!displayTagIDs.has(tag.id)) {
        displayTagIDs.add(tag.id);
        displayTags.push({ kind: "parent", tag });
      }
    });

  return displayTags;
}
