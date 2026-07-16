// CUSTOM: Chronological scene marker search helpers.

const defaultMarkerDurationSeconds = 20;
const markerContainmentToleranceSeconds = 3;
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

type SceneMarkerChronologyHighlightPerformer<
  M extends ISceneMarkerChronologySearchMarker
> =
  | NonNullable<M["top_performers"]>[number]
  | NonNullable<M["bottom_performers"]>[number];

export interface ISceneMarkerChronologyHighlightPerformer<
  M extends ISceneMarkerChronologySearchMarker = ISceneMarkerChronologySearchMarker
> {
  performer: SceneMarkerChronologyHighlightPerformer<M>;
  topTags: M["primary_tag"][];
  bottomTags: M["primary_tag"][];
}

export interface ISceneMarkerChronologyHighlightGroup<
  M extends ISceneMarkerChronologySearchMarker = ISceneMarkerChronologySearchMarker
> {
  key: string;
  performers: Array<ISceneMarkerChronologyHighlightPerformer<M>>;
  markers: M[];
  segments: Array<ISceneMarkerChronologyHighlightSegment<M>>;
}

export interface ISceneMarkerChronologyHighlightSegment<
  M extends ISceneMarkerChronologySearchMarker = ISceneMarkerChronologySearchMarker
> {
  key: string;
  seconds: number;
  end_seconds: number;
  markers: M[];
  representativeMarker: M;
}

export interface ISceneMarkerChronologyDerivedWindow<
  M extends ISceneMarkerChronologySearchMarker = ISceneMarkerChronologySearchMarker
> {
  key: string;
  seconds: number;
  end_seconds: number;
  markers: M[];
  sourceMarker: M;
}

function normalizeSearchText(value?: string | null) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function markerEndSeconds(marker: ISceneMarkerChronologySearchMarker) {
  return marker.end_seconds ?? marker.seconds + defaultMarkerDurationSeconds;
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

function markerTags(marker: ISceneMarkerChronologySearchMarker) {
  return [marker.primary_tag, ...marker.tags];
}

function uniqueMarkerTags<M extends ISceneMarkerChronologySearchMarker>(
  tags: M["primary_tag"][]
) {
  const tagsByID = new Map<string, M["primary_tag"]>();

  tags.forEach((tag) => {
    if (!tagsByID.has(tag.id)) {
      tagsByID.set(tag.id, tag);
    }
  });

  return Array.from(tagsByID.values());
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

function markersAreInSameScene(
  a: ISceneMarkerChronologySearchMarker,
  b: ISceneMarkerChronologySearchMarker
) {
  return !a.scene?.id || !b.scene?.id || a.scene.id === b.scene.id;
}

function markerContainsTimeRange(
  container: ISceneMarkerChronologySearchMarker,
  contained: ISceneMarkerChronologySearchMarker
) {
  return (
    container.id !== contained.id &&
    markersAreInSameScene(container, contained) &&
    container.seconds - contained.seconds <=
      markerContainmentToleranceSeconds &&
    markerEndSeconds(contained) - markerEndSeconds(container) <=
      markerContainmentToleranceSeconds
  );
}

function markerDurationSeconds(marker: ISceneMarkerChronologySearchMarker) {
  return markerEndSeconds(marker) - marker.seconds;
}

function rangeDurationSeconds(range: { seconds: number; end_seconds: number }) {
  return range.end_seconds - range.seconds;
}

function markerStrictlyContainsTimeRange(
  container: ISceneMarkerChronologySearchMarker,
  contained: ISceneMarkerChronologySearchMarker
) {
  return (
    markerContainsTimeRange(container, contained) &&
    markerDurationSeconds(container) > markerDurationSeconds(contained)
  );
}

function rangeTimeKey(value: number) {
  return Number(value.toFixed(3)).toString();
}

function searchHasActiveFilters(filters: ISceneMarkerChronologySearchFilters) {
  return (
    filters.tags.length > 0 ||
    filters.topPerformers.length > 0 ||
    filters.bottomPerformers.length > 0
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

function sortedIDKey(items: Array<{ id: string }>) {
  return items
    .map((item) => item.id)
    .sort(compareMarkerIDs)
    .join(",");
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

function markerTagContext(
  marker: ISceneMarkerChronologySearchMarker,
  allMarkers: ISceneMarkerChronologySearchMarker[]
) {
  return [
    marker,
    ...allMarkers
      .filter((candidate) => markerContainsTimeRange(candidate, marker))
      .sort(compareChronologicalMarkers),
  ];
}

function markerContextMatchesTag(
  marker: ISceneMarkerChronologySearchMarker,
  allMarkers: ISceneMarkerChronologySearchMarker[],
  selectedTag: ISceneMarkerChronologySearchTag
) {
  return markerTagContext(marker, allMarkers).some((candidate) =>
    markerDirectlyMatchesTag(candidate, selectedTag)
  );
}

function markerMatchesTags(
  marker: ISceneMarkerChronologySearchMarker,
  allMarkers: ISceneMarkerChronologySearchMarker[],
  selectedTags: ISceneMarkerChronologySearchTag[]
) {
  return selectedTags.every((tag) =>
    markerContextMatchesTag(marker, allMarkers, tag)
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

function activeMarkersMatchSelectedPerformers(
  markers: ISceneMarkerChronologySearchMarker[],
  selectedPerformers: ISceneMarkerChronologySearchPerformer[],
  role: "top" | "bottom"
) {
  if (selectedPerformers.length === 0) {
    return true;
  }

  return selectedPerformers.every((selectedPerformer) =>
    markers.some((marker) =>
      (role === "top" ? marker.top_performers : marker.bottom_performers)?.some(
        (performer) =>
          performerMatchesSelectedPerformer(performer, selectedPerformer)
      )
    )
  );
}

function activeMarkersMatchFilters(
  markers: ISceneMarkerChronologySearchMarker[],
  filters: ISceneMarkerChronologySearchFilters
) {
  return (
    filters.tags.every((tag) =>
      markers.some((marker) => markerDirectlyMatchesTag(marker, tag))
    ) &&
    activeMarkersMatchSelectedPerformers(
      markers,
      filters.topPerformers,
      "top"
    ) &&
    activeMarkersMatchSelectedPerformers(
      markers,
      filters.bottomPerformers,
      "bottom"
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

function createDerivedWindow<M extends ISceneMarkerChronologySearchMarker>(
  seconds: number,
  end_seconds: number,
  markers: M[]
): ISceneMarkerChronologyDerivedWindow<M> {
  const sortedMarkers = uniqueByID(markers).sort(compareChronologicalMarkers);
  const markerKey = sortedIDKey(sortedMarkers);

  return {
    key: `${rangeTimeKey(seconds)}-${rangeTimeKey(end_seconds)}-${markerKey}`,
    seconds,
    end_seconds,
    markers: sortedMarkers,
    sourceMarker: sortedMarkers[0],
  };
}

function mergeDerivedWindows<M extends ISceneMarkerChronologySearchMarker>(
  windows: Array<ISceneMarkerChronologyDerivedWindow<M>>
) {
  const merged: Array<ISceneMarkerChronologyDerivedWindow<M>> = [];

  windows
    .sort(
      (a, b) =>
        a.seconds - b.seconds ||
        a.end_seconds - b.end_seconds ||
        a.key.localeCompare(b.key)
    )
    .forEach((window) => {
      const last = merged[merged.length - 1];

      if (!last || window.seconds > last.end_seconds) {
        merged.push(window);
        return;
      }

      const nextEnd = Math.max(last.end_seconds, window.end_seconds);
      const nextMarkers = uniqueByID([...last.markers, ...window.markers]);
      merged[merged.length - 1] = createDerivedWindow(
        last.seconds,
        nextEnd,
        nextMarkers
      );
    });

  return merged;
}

function subtractCoveredMarkerRanges<
  M extends ISceneMarkerChronologySearchMarker
>(
  window: ISceneMarkerChronologyDerivedWindow<M>,
  coveredMarkers: ISceneMarkerChronologySearchMarker[]
) {
  const coverages = coveredMarkers
    .map((marker) => ({
      seconds: Math.max(window.seconds, marker.seconds),
      end_seconds: Math.min(window.end_seconds, markerEndSeconds(marker)),
    }))
    .filter((range) => range.end_seconds > range.seconds)
    .sort((a, b) => a.seconds - b.seconds || a.end_seconds - b.end_seconds);
  let remaining = [
    { seconds: window.seconds, end_seconds: window.end_seconds },
  ];

  coverages.forEach((coverage) => {
    remaining = remaining.flatMap((range) => {
      if (
        coverage.end_seconds <= range.seconds ||
        coverage.seconds >= range.end_seconds
      ) {
        return [range];
      }

      return [
        { seconds: range.seconds, end_seconds: coverage.seconds },
        { seconds: coverage.end_seconds, end_seconds: range.end_seconds },
      ].filter((part) => part.end_seconds > part.seconds);
    });
  });

  return remaining
    .filter(
      (range) =>
        rangeDurationSeconds(range) >= markerContainmentToleranceSeconds
    )
    .map((range) =>
      createDerivedWindow(range.seconds, range.end_seconds, window.markers)
    );
}

export function getChronologicalSceneMarkerDerivedWindows<
  T extends ISceneMarkerChronologySearchMarker
>(
  markers: T[],
  filters: ISceneMarkerChronologySearchFilters,
  coveredMarkers: ISceneMarkerChronologySearchMarker[]
): Array<ISceneMarkerChronologyDerivedWindow<T>> {
  if (!searchHasActiveFilters(filters) || filters.tags.length < 2) {
    return [];
  }

  const boundaries = Array.from(
    new Set(
      markers.flatMap((marker) => [marker.seconds, markerEndSeconds(marker)])
    )
  ).sort((a, b) => a - b);
  const windows: Array<ISceneMarkerChronologyDerivedWindow<T>> = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const seconds = boundaries[index];
    const end_seconds = boundaries[index + 1];

    if (end_seconds - seconds < markerContainmentToleranceSeconds) {
      continue;
    }

    const activeMarkers = markers.filter(
      (marker) =>
        marker.seconds < end_seconds && markerEndSeconds(marker) > seconds
    );

    if (activeMarkersMatchFilters(activeMarkers, filters)) {
      windows.push(createDerivedWindow(seconds, end_seconds, activeMarkers));
    }
  }

  return mergeDerivedWindows(windows).flatMap((window) =>
    subtractCoveredMarkerRanges(window, coveredMarkers)
  );
}

export function filterCoveredChronologicalSceneMarkers<
  T extends ISceneMarkerChronologySearchMarker
>(markers: T[]): T[] {
  return [...markers]
    .filter(
      (marker) =>
        !markers.some((candidate) =>
          markerStrictlyContainsTimeRange(candidate, marker)
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

  return getChronologicalSceneMarkerTags(markers).filter((tag) => {
    if (selectedTagIDs.has(tag.id)) {
      return false;
    }

    const nextFilters = {
      tags: [...selectedTags, tag],
      topPerformers: [],
      bottomPerformers: [],
    };
    const exactMatches = filterChronologicalSceneMarkers(markers, nextFilters);

    return (
      exactMatches.length > 0 ||
      getChronologicalSceneMarkerDerivedWindows(
        markers,
        nextFilters,
        exactMatches
      ).length > 0
    );
  });
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
  const derivedMarkers = getChronologicalSceneMarkerDerivedWindows(
    markers,
    {
      tags: selectedTags,
      topPerformers: [],
      bottomPerformers: [],
    },
    tagFilteredMarkers
  ).flatMap((window) => window.markers);
  const performerField =
    role === "top" ? "top_performers" : "bottom_performers";

  return uniqueByID(
    [...tagFilteredMarkers, ...derivedMarkers].flatMap(
      (marker) => marker[performerField] ?? []
    )
  ).sort(compareNamedSearchObjects);
}

function getChronologicalSceneMarkerDisplayTagsFromRelatedMarkers<
  M extends ISceneMarkerChronologySearchMarker
>(marker: M, relatedMarkers: M[]): ISceneMarkerChronologyDisplayTag[] {
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

  [...relatedMarkers]
    .filter((candidate) => candidate.id !== marker.id)
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

export function getChronologicalSceneMarkerDisplayTags<
  M extends ISceneMarkerChronologySearchMarker
>(marker: M, allMarkers: M[]): ISceneMarkerChronologyDisplayTag[] {
  return getChronologicalSceneMarkerDisplayTagsFromRelatedMarkers(
    marker,
    allMarkers.filter((candidate) => markerOverlapsTimeRange(marker, candidate))
  );
}

export function getChronologicalSceneMarkerContextDisplayTags<
  M extends ISceneMarkerChronologySearchMarker
>(marker: M, allMarkers: M[]): ISceneMarkerChronologyDisplayTag[] {
  return getChronologicalSceneMarkerDisplayTagsFromRelatedMarkers(
    marker,
    getChronologicalSceneMarkerHighlightContextMarkers(marker, allMarkers)
  );
}

function addHighlightPerformerTags<
  M extends ISceneMarkerChronologySearchMarker
>(
  performersByID: Map<string, ISceneMarkerChronologyHighlightPerformer<M>>,
  performer: SceneMarkerChronologyHighlightPerformer<M>,
  role: "top" | "bottom",
  tags: M["primary_tag"][]
) {
  const existing = performersByID.get(performer.id);
  const performerTags =
    existing ??
    ({
      performer,
      topTags: [],
      bottomTags: [],
    } as ISceneMarkerChronologyHighlightPerformer<M>);
  const roleTags =
    role === "top" ? performerTags.topTags : performerTags.bottomTags;
  const existingTagIDs = new Set(roleTags.map((tag) => tag.id));

  tags.forEach((tag) => {
    if (!existingTagIDs.has(tag.id)) {
      existingTagIDs.add(tag.id);
      roleTags.push(tag);
    }
  });

  if (!existing) {
    performersByID.set(performer.id, performerTags);
  }
}

function getHighlightPerformersFromActiveMarkers<
  M extends ISceneMarkerChronologySearchMarker
>(markers: M[]): Array<ISceneMarkerChronologyHighlightPerformer<M>> {
  const performersByID = new Map<
    string,
    ISceneMarkerChronologyHighlightPerformer<M>
  >();

  markers.forEach((candidate) => {
    const directTags = uniqueMarkerTags<M>([
      candidate.primary_tag,
      ...candidate.tags,
    ] as M["primary_tag"][]);

    (candidate.top_performers ?? []).forEach((performer) =>
      addHighlightPerformerTags(performersByID, performer, "top", directTags)
    );
    (candidate.bottom_performers ?? []).forEach((performer) =>
      addHighlightPerformerTags(performersByID, performer, "bottom", directTags)
    );
  });

  return Array.from(performersByID.values());
}

export function getSceneMarkerPerformerTagSummaries<
  M extends ISceneMarkerChronologySearchMarker
>(markers: M[]): Array<ISceneMarkerChronologyHighlightPerformer<M>> {
  const performersByID = new Map<
    string,
    ISceneMarkerChronologyHighlightPerformer<M>
  >();

  markers.forEach((marker) => {
    getChronologicalSceneMarkerHighlightPerformers(marker, markers).forEach(
      ({ performer, topTags, bottomTags }) => {
        addHighlightPerformerTags(performersByID, performer, "top", topTags);
        addHighlightPerformerTags(
          performersByID,
          performer,
          "bottom",
          bottomTags
        );
      }
    );
  });

  return Array.from(performersByID.values());
}

export function getChronologicalSceneMarkerHighlightPerformers<
  M extends ISceneMarkerChronologySearchMarker
>(
  marker: M,
  allMarkers: M[]
): Array<ISceneMarkerChronologyHighlightPerformer<M>> {
  return getHighlightPerformersFromActiveMarkers(
    getChronologicalSceneMarkerHighlightContextMarkers(marker, allMarkers)
  );
}

export function getChronologicalSceneMarkerHighlightContextMarkers<
  M extends ISceneMarkerChronologySearchMarker
>(marker: M, allMarkers: M[]): M[] {
  return [
    marker,
    ...[...allMarkers]
      .filter(
        (candidate) =>
          candidate.id !== marker.id &&
          markerContainsTimeRange(candidate, marker)
      )
      .sort(compareChronologicalMarkers),
  ];
}

function getHighlightPerformerGroupKey<
  M extends ISceneMarkerChronologySearchMarker
>(performers: Array<ISceneMarkerChronologyHighlightPerformer<M>>) {
  return performers
    .map((performer) =>
      [
        performer.performer.id,
        sortedIDKey(performer.topTags),
        sortedIDKey(performer.bottomTags),
      ].join(":")
    )
    .sort()
    .join("|");
}

export function getChronologicalSceneMarkerHighlightPerformerOrgasmRank<
  M extends ISceneMarkerChronologySearchMarker
>(
  performer: ISceneMarkerChronologyHighlightPerformer<M>,
  orgasmTagId?: string
) {
  if (!orgasmTagId) {
    return 2;
  }

  if (performer.topTags.some((tag) => tag.id === orgasmTagId)) {
    return 0;
  }

  if (performer.bottomTags.some((tag) => tag.id === orgasmTagId)) {
    return 1;
  }

  return 2;
}

export function getChronologicalSceneMarkerHighlightGroupKey<
  M extends ISceneMarkerChronologySearchMarker
>(marker: M, allMarkers: M[]) {
  return getHighlightPerformerGroupKey(
    getChronologicalSceneMarkerHighlightPerformers(marker, allMarkers)
  );
}

function getHighlightMarkerSegment<
  M extends ISceneMarkerChronologySearchMarker
>(
  marker: M,
  allMarkers: M[]
): {
  key: string;
  performers: Array<ISceneMarkerChronologyHighlightPerformer<M>>;
  seconds: number;
  end_seconds: number;
  markers: M[];
  representativeMarker: M;
} {
  const performers = getChronologicalSceneMarkerHighlightPerformers(
    marker,
    allMarkers
  );

  return {
    key: marker.id,
    performers,
    seconds: marker.seconds,
    end_seconds: markerEndSeconds(marker),
    markers: [marker],
    representativeMarker: marker,
  };
}

export function groupChronologicalSceneMarkerHighlights<
  M extends ISceneMarkerChronologySearchMarker
>(
  markers: M[],
  allMarkers: M[]
): Array<ISceneMarkerChronologyHighlightGroup<M>> {
  const groupsByKey = new Map<
    string,
    ISceneMarkerChronologyHighlightGroup<M>
  >();

  markers.forEach((marker) => {
    const segment = getHighlightMarkerSegment(marker, allMarkers);
    const key = getHighlightPerformerGroupKey(segment.performers);
    const existingGroup = groupsByKey.get(key);

    if (existingGroup) {
      existingGroup.markers.push(marker);
      existingGroup.segments.push(segment);
      return;
    }

    groupsByKey.set(key, {
      key,
      performers: segment.performers,
      markers: [marker],
      segments: [segment],
    });
  });

  return Array.from(groupsByKey.values()).map((group) => ({
    ...group,
    markers: [...group.markers].sort(compareChronologicalMarkers),
    segments: [...group.segments].sort(
      (a, b) =>
        a.seconds - b.seconds ||
        a.end_seconds - b.end_seconds ||
        compareMarkerIDs(a.key, b.key)
    ),
  }));
}
