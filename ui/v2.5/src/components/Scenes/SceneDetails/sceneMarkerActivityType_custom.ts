import type { IUIConfig } from "src/core/config";
import type * as GQL from "src/core/generated-graphql";

export type ActivityTypeTagIds = Set<string>;
export type ActivityTypeSectionTagIds = Set<string>;

const defaultMarkerDurationSeconds = 20;

type ActivityTypeSortableMarker = Pick<
  GQL.SceneMarkerDataFragment,
  "id" | "seconds" | "end_seconds" | "primary_tag"
>;

type ActivityTypeTag = Pick<GQL.Tag, "id" | "name"> & {
  parents?: Array<Pick<GQL.Tag, "id" | "name">> | null;
};

type ActivityTypeRolePerformer = Pick<GQL.Performer, "id">;

export type ActivityTypeGroupableMarker = ActivityTypeSortableMarker &
  Pick<
    GQL.SceneMarkerDataFragment,
    "tags" | "top_performers" | "bottom_performers"
  >;

export interface IActivityTypeSceneMarkerGroup<
  T extends ActivityTypeGroupableMarker = ActivityTypeGroupableMarker
> {
  key: string;
  primaryTag: T["primary_tag"];
  topPerformers: T["top_performers"];
  bottomPerformers: T["bottom_performers"];
  markers: T[];
}

export function getActivityTypeTagIds(
  roleTagIds?: IUIConfig["roleTagIds"]
): ActivityTypeTagIds {
  return new Set(
    [roleTagIds?.sexTagId, roleTagIds?.oralTagId, roleTagIds?.soloTagId].filter(
      (id): id is string => !!id
    )
  );
}

export function getActivityTypeSectionTagIds(
  roleTagIds?: IUIConfig["roleTagIds"]
): ActivityTypeSectionTagIds {
  return new Set(
    [
      roleTagIds?.sexTagId,
      roleTagIds?.oralTagId,
      roleTagIds?.soloTagId,
      roleTagIds?.feetTagId,
      roleTagIds?.orgasmTagId,
      roleTagIds?.facialTagId,
    ].filter((id): id is string => !!id)
  );
}

export function isActivityTypeSceneMarker(
  marker: {
    primary_tag: Pick<GQL.Tag, "id">;
    tags: unknown[];
  },
  activityTypeTagIds: ActivityTypeTagIds
) {
  return (
    marker.tags.length === 0 && activityTypeTagIds.has(marker.primary_tag.id)
  );
}

export function isActivityTypeSectionSceneMarker(
  marker: Pick<GQL.SceneMarkerDataFragment, "primary_tag">,
  activityTypeSectionTagIds: ActivityTypeSectionTagIds
) {
  return activityTypeSectionTagIds.has(marker.primary_tag.id);
}

function tagMatchesConfiguredTag(tag: ActivityTypeTag, tagId?: string) {
  return (
    !!tagId && (tag.id === tagId || tag.parents?.some((p) => p.id === tagId))
  );
}

export function markerDirectlyMatchesConfiguredTag(
  marker: Pick<GQL.SceneMarkerDataFragment, "primary_tag" | "tags">,
  tagId?: string
) {
  return [marker.primary_tag, ...marker.tags].some((tag) =>
    tagMatchesConfiguredTag(tag, tagId)
  );
}

function getMarkerConfiguredTag(
  marker: Pick<GQL.SceneMarkerDataFragment, "primary_tag" | "tags">,
  tagId?: string
) {
  if (!tagId) return undefined;

  for (const tag of [marker.primary_tag, ...marker.tags]) {
    if (tag.id === tagId) return tag;

    const parent = tag.parents?.find((p) => p.id === tagId);
    if (parent) return parent;
  }

  return undefined;
}

export function getActivityTypeSectionMarkerTagId(
  marker: Pick<GQL.SceneMarkerDataFragment, "primary_tag" | "tags">,
  roleTagIds?: IUIConfig["roleTagIds"]
) {
  if (
    tagMatchesConfiguredTag(marker.primary_tag, roleTagIds?.orgasmTagId) &&
    markerDirectlyMatchesConfiguredTag(marker, roleTagIds?.facialTagId)
  ) {
    return roleTagIds?.facialTagId;
  }

  return [
    roleTagIds?.oralTagId,
    roleTagIds?.sexTagId,
    roleTagIds?.soloTagId,
    roleTagIds?.feetTagId,
    roleTagIds?.orgasmTagId,
    roleTagIds?.facialTagId,
  ].find((tagId) => tagMatchesConfiguredTag(marker.primary_tag, tagId));
}

export function getActivityTypeSectionMarkerTag(
  marker: Pick<GQL.SceneMarkerDataFragment, "primary_tag" | "tags">,
  roleTagIds?: IUIConfig["roleTagIds"]
) {
  return getMarkerConfiguredTag(
    marker,
    getActivityTypeSectionMarkerTagId(marker, roleTagIds)
  );
}

function markerEndSeconds(marker: ActivityTypeSortableMarker) {
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
  a: ActivityTypeSortableMarker,
  b: ActivityTypeSortableMarker
) {
  return (
    a.seconds - b.seconds ||
    markerEndSeconds(a) - markerEndSeconds(b) ||
    compareMarkerIDs(a.id, b.id)
  );
}

function getActivityTypeMarkerRank(
  marker: ActivityTypeSortableMarker,
  roleTagIds?: IUIConfig["roleTagIds"]
) {
  const tagOrder = [
    roleTagIds?.oralTagId,
    roleTagIds?.sexTagId,
    roleTagIds?.soloTagId,
    roleTagIds?.feetTagId,
    roleTagIds?.orgasmTagId,
    roleTagIds?.facialTagId,
  ].filter((id): id is string => !!id);
  const index = tagOrder.indexOf(marker.primary_tag.id);

  return index === -1 ? tagOrder.length : index;
}

export function compareActivityTypeSceneMarkers(
  a: ActivityTypeSortableMarker,
  b: ActivityTypeSortableMarker,
  roleTagIds?: IUIConfig["roleTagIds"]
) {
  return (
    getActivityTypeMarkerRank(a, roleTagIds) -
      getActivityTypeMarkerRank(b, roleTagIds) ||
    compareChronologicalMarkers(a, b)
  );
}

function rolePerformerKey(performers: ActivityTypeRolePerformer[]) {
  return performers
    .map((performer) => performer.id)
    .sort(compareMarkerIDs)
    .join(",");
}

export function getActivityTypeSceneMarkerGroupKey(
  marker: ActivityTypeGroupableMarker
) {
  return [
    marker.primary_tag.id,
    rolePerformerKey(marker.top_performers),
    rolePerformerKey(marker.bottom_performers),
  ].join("|");
}

export function groupActivityTypeSceneMarkers<
  T extends ActivityTypeGroupableMarker
>(markers: T[]): Array<IActivityTypeSceneMarkerGroup<T>> {
  const groupsByKey = new Map<string, IActivityTypeSceneMarkerGroup<T>>();

  markers.forEach((marker) => {
    const key = getActivityTypeSceneMarkerGroupKey(marker);
    const existingGroup = groupsByKey.get(key);

    if (existingGroup) {
      existingGroup.markers.push(marker);
      return;
    }

    groupsByKey.set(key, {
      key,
      primaryTag: marker.primary_tag,
      topPerformers: marker.top_performers,
      bottomPerformers: marker.bottom_performers,
      markers: [marker],
    });
  });

  return Array.from(groupsByKey.values()).map((group) => ({
    ...group,
    markers: [...group.markers].sort(compareChronologicalMarkers),
  }));
}
