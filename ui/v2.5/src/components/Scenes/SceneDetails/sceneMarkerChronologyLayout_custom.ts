// CUSTOM: Unified chronological scene marker layout helpers.

import type { IUIConfig } from "src/core/config";
import {
  compareActivityTypeSceneMarkers,
  getActivityTypeSceneMarkerGroupKey,
  getActivityTypeSectionMarkerTagId,
  getActivityTypeSectionTagIds,
  groupActivityTypeSceneMarkers,
  isActivityTypeSectionSceneMarker,
  markerDirectlyMatchesConfiguredTag,
  type ActivityTypeGroupableMarker,
} from "./sceneMarkerActivityType_custom";
import {
  getChronologicalSceneMarkerHighlightContextMarkers,
  type ISceneMarkerChronologyHighlightGroup,
  type ISceneMarkerChronologyHighlightSegment,
  type ISceneMarkerChronologySearchMarker,
} from "./sceneMarkerChronologySearch_custom";

export type ChronologicalLayoutMarker = ActivityTypeGroupableMarker &
  ISceneMarkerChronologySearchMarker;

export interface IChronologicalSceneMarkerLayoutGroup<
  M extends ChronologicalLayoutMarker = ChronologicalLayoutMarker
> {
  key: string;
  primaryTag: M["primary_tag"];
  topPerformers: NonNullable<M["top_performers"]>;
  bottomPerformers: NonNullable<M["bottom_performers"]>;
  sortMarker: M;
  markers: M[];
  highlightGroups: Array<ISceneMarkerChronologyHighlightGroup<M>>;
}

export interface IChronologicalSceneMarkerLayout<
  M extends ChronologicalLayoutMarker = ChronologicalLayoutMarker
> {
  groups: Array<IChronologicalSceneMarkerLayoutGroup<M>>;
  fallbackHighlightGroups: Array<ISceneMarkerChronologyHighlightGroup<M>>;
}

interface IBuildChronologicalSceneMarkerLayout<
  M extends ChronologicalLayoutMarker
> {
  allActivityMarkers: M[];
  visibleActivityMarkers: M[];
  highlightGroups: Array<ISceneMarkerChronologyHighlightGroup<M>>;
  allMarkers: M[];
  roleTagIds?: IUIConfig["roleTagIds"];
}

function emptyLayoutGroup<M extends ChronologicalLayoutMarker>(
  group: ReturnType<typeof groupActivityTypeSceneMarkers<M>>[number]
): IChronologicalSceneMarkerLayoutGroup<M> {
  return {
    key: group.key,
    primaryTag: group.primaryTag,
    topPerformers: group.topPerformers,
    bottomPerformers: group.bottomPerformers,
    sortMarker: group.markers[0],
    markers: [],
    highlightGroups: [],
  };
}

function tagMatchesConfiguredTag(
  tag: ISceneMarkerChronologySearchMarker["primary_tag"],
  tagId?: string | null
) {
  return (
    !!tagId && (tag.id === tagId || tag.parents?.some((p) => p.id === tagId))
  );
}

function cloneHighlightGroupWithSegments<M extends ChronologicalLayoutMarker>(
  group: ISceneMarkerChronologyHighlightGroup<M>,
  segments: Array<ISceneMarkerChronologyHighlightSegment<M>>
): ISceneMarkerChronologyHighlightGroup<M> {
  const markersByID = new Map<string, M>();

  segments.forEach((segment) => {
    segment.markers.forEach((marker) => {
      if (!markersByID.has(marker.id)) {
        markersByID.set(marker.id, marker);
      }
    });
  });

  return {
    ...group,
    markers: Array.from(markersByID.values()),
    segments,
  };
}

function segmentCanAppearInActivityGroup<M extends ChronologicalLayoutMarker>(
  segment: ISceneMarkerChronologyHighlightSegment<M>,
  group: IChronologicalSceneMarkerLayoutGroup<M>,
  roleTagIds?: IUIConfig["roleTagIds"]
) {
  const sectionTagId = getActivityTypeSectionMarkerTagId(
    group.sortMarker,
    roleTagIds
  );
  const requiresDirectTag = new Set([
    roleTagIds?.feetTagId,
    roleTagIds?.orgasmTagId,
    roleTagIds?.facialTagId,
  ]).has(sectionTagId);

  // CUSTOM: Feet, Orgasm, and Facial sections only show markers carrying the
  // section tag directly; overlap inheritance must not add unrelated pills.
  return (
    !requiresDirectTag ||
    segment.markers.every((marker) =>
      markerDirectlyMatchesConfiguredTag(marker, sectionTagId)
    )
  );
}

export function isChronologicalSceneMarkerGoatTagged(
  marker: Pick<ISceneMarkerChronologySearchMarker, "primary_tag" | "tags">,
  goatTagId?: string | null
) {
  return [marker.primary_tag, ...marker.tags].some((tag) =>
    tagMatchesConfiguredTag(tag, goatTagId)
  );
}

export function buildChronologicalSceneMarkerLayout<
  M extends ChronologicalLayoutMarker
>({
  allActivityMarkers,
  visibleActivityMarkers,
  highlightGroups,
  allMarkers,
  roleTagIds,
}: IBuildChronologicalSceneMarkerLayout<M>): IChronologicalSceneMarkerLayout<M> {
  const layoutGroupsByKey = new Map<
    string,
    IChronologicalSceneMarkerLayoutGroup<M>
  >();
  const activityTypeSectionTagIds = getActivityTypeSectionTagIds(roleTagIds);
  const visibleActivityMarkerIDs = new Set(
    visibleActivityMarkers.map((marker) => marker.id)
  );

  groupActivityTypeSceneMarkers(allActivityMarkers).forEach((group) => {
    layoutGroupsByKey.set(group.key, {
      ...emptyLayoutGroup(group),
      markers: group.markers.filter((marker) =>
        visibleActivityMarkerIDs.has(marker.id)
      ),
    });
  });

  const fallbackHighlightGroups: Array<
    ISceneMarkerChronologyHighlightGroup<M>
  > = [];

  highlightGroups.forEach((highlightGroup) => {
    const segmentsByGroupKey = new Map<
      string,
      Array<ISceneMarkerChronologyHighlightSegment<M>>
    >();
    const fallbackSegments: Array<ISceneMarkerChronologyHighlightSegment<M>> =
      [];

    highlightGroup.segments.forEach((segment) => {
      const matchedGroupKeys = new Set<string>();

      segment.markers.forEach((highlightMarker) => {
        getChronologicalSceneMarkerHighlightContextMarkers(
          highlightMarker,
          allMarkers
        )
          .filter((contextMarker) =>
            isActivityTypeSectionSceneMarker(
              contextMarker,
              activityTypeSectionTagIds
            )
          )
          .forEach((contextMarker) => {
            const key = getActivityTypeSceneMarkerGroupKey(contextMarker);
            if (layoutGroupsByKey.has(key)) {
              matchedGroupKeys.add(key);
            }
          });
      });

      if (matchedGroupKeys.size === 0) {
        fallbackSegments.push(segment);
        return;
      }

      matchedGroupKeys.forEach((key) => {
        const group = layoutGroupsByKey.get(key);
        if (
          !group ||
          !segmentCanAppearInActivityGroup(segment, group, roleTagIds)
        ) {
          return;
        }

        const segments = segmentsByGroupKey.get(key) ?? [];
        segments.push(segment);
        segmentsByGroupKey.set(key, segments);
      });
    });

    if (fallbackSegments.length > 0) {
      fallbackHighlightGroups.push(
        cloneHighlightGroupWithSegments(highlightGroup, fallbackSegments)
      );
    }

    segmentsByGroupKey.forEach((segments, key) => {
      layoutGroupsByKey
        .get(key)
        ?.highlightGroups.push(
          cloneHighlightGroupWithSegments(highlightGroup, segments)
        );
    });
  });

  return {
    groups: Array.from(layoutGroupsByKey.values())
      .filter(
        (group) => group.markers.length > 0 || group.highlightGroups.length > 0
      )
      .sort((a, b) =>
        compareActivityTypeSceneMarkers(a.sortMarker, b.sortMarker, roleTagIds)
      ),
    fallbackHighlightGroups,
  };
}
