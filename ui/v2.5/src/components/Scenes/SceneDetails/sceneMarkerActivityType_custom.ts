import type { IUIConfig } from "src/core/config";
import type * as GQL from "src/core/generated-graphql";

export type ActivityTypeTagIds = Set<string>;

const defaultMarkerDurationSeconds = 20;

type ActivityTypeSortableMarker = Pick<
  GQL.SceneMarkerDataFragment,
  "id" | "seconds" | "end_seconds" | "primary_tag"
>;

type ActivityTypeRolePerformer = Pick<GQL.Performer, "id">;

export type ActivityTypeGroupableMarker = ActivityTypeSortableMarker &
  Pick<GQL.SceneMarkerDataFragment, "top_performers" | "bottom_performers">;

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

export function isActivityTypeSceneMarker(
  marker: Pick<GQL.SceneMarkerDataFragment, "primary_tag" | "tags">,
  activityTypeTagIds: ActivityTypeTagIds
) {
  return (
    marker.tags.length === 0 && activityTypeTagIds.has(marker.primary_tag.id)
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
