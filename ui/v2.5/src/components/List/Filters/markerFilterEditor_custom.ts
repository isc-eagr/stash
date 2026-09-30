import type { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import type { SceneMarkersCriterion } from "src/models/list-filter/criteria/scene-markers";
import type { SceneMarkersExcludeCriterion } from "src/models/list-filter/criteria/scene-markers-exclude";
import {
  cloneUnnamedPerformer,
  formatUnnamedPerformerSummary,
} from "src/models/list-filter/criteria/unnamed-performer";
import type { IUnnamedPerformer } from "src/models/list-filter/criteria/unnamed-performer";
import {
  isMarkerGroupEmptyCustom,
  markerGroupPeopleCustom,
  normalizeMarkerGroupRolesCustom,
  setMarkerPeopleCustom,
  unusedMarkerVatosCustom,
} from "src/models/list-filter/criteria/marker-group_custom";
import type {
  IMarkerRoleGroupCustom,
  MarkerVatoRoleCustom,
} from "src/models/list-filter/criteria/marker-group_custom";

export type MarkerEditorCriterion =
  | MarkerPerformersCriterion
  | SceneMarkersCriterion
  | SceneMarkersExcludeCriterion;

export type IMarkerEditorGroup = IMarkerRoleGroupCustom;

export function markerEditorGroupsCustom(
  criterion: MarkerEditorCriterion
): IMarkerEditorGroup[] {
  return "getGroups" in criterion
    ? criterion.getGroups()
    : criterion.value.groups;
}

// Keep class instances and legacy fields intact so serialization stays
// unchanged. Legacy "Either · OR" groups open with explicit roles.
export function markerEditorDraftCustom<T extends MarkerEditorCriterion>(
  criterion: T
): T {
  const draft = criterion.clone() as T;
  if ("ensureGroups" in draft) draft.ensureGroups();
  else if (!draft.value.groups.length) draft.addGroup();
  markerEditorGroupsCustom(draft).forEach((group) =>
    Object.assign(group, normalizeMarkerGroupRolesCustom(group))
  );
  return draft;
}

// The criterion Apply commits: empty markers and unused unnamed vatos removed.
export function markerEditorAppliedCustom<T extends MarkerEditorCriterion>(
  draft: T
): T {
  const applied = draft.clone() as T;
  const groups = markerEditorGroupsCustom(applied);
  groups
    .filter((group) => isMarkerGroupEmptyCustom(group))
    .slice(groups.every((group) => isMarkerGroupEmptyCustom(group)) ? 1 : 0)
    .forEach((group) => applied.removeGroup(group.groupId));
  const unused = unusedMarkerVatosCustom(
    markerEditorGroupsCustom(applied),
    applied.value.unnamed_performers ?? []
  );
  applied.value.unnamed_performers = (
    applied.value.unnamed_performers ?? []
  ).filter((vato) => !unused.includes(vato));
  return applied;
}

export function markerSelectedVatosCustom(
  performers: Array<{ id: string; name?: string | null }>
) {
  return performers.map((performer) => ({
    id: performer.id,
    label: performer.name ?? performer.id,
  }));
}

export function markerUnnamedSelectOptionsCustom(people: IUnnamedPerformer[]) {
  return people.map((performer) => ({
    id: performer.id,
    name: performer.label,
    alias_list: [] as string[],
    disambiguation: formatUnnamedPerformerSummary(performer),
    image_path: "",
    birthdate: null,
    death_date: null,
  }));
}

export function assignMarkerUnnamedCustom(
  group: IMarkerEditorGroup,
  performer: IUnnamedPerformer,
  role: MarkerVatoRoleCustom = "either"
) {
  if (markerGroupPeopleCustom(group).some((p) => p.id === performer.id)) return;
  Object.assign(
    group,
    setMarkerPeopleCustom(
      group,
      [
        ...markerGroupPeopleCustom(group),
        { id: performer.id, label: performer.label },
      ],
      role
    )
  );
}

export function saveMarkerUnnamedCustom(
  criterion: MarkerEditorCriterion,
  performer: IUnnamedPerformer,
  assignment?: { groupId: string; role?: MarkerVatoRoleCustom }
) {
  const people = criterion.value.unnamed_performers ?? [];
  const saved = cloneUnnamedPerformer(performer);
  criterion.value.unnamed_performers = people.some((p) => p.id === saved.id)
    ? people.map((p) => (p.id === saved.id ? saved : p))
    : [...people, saved];
  const relabel = (list?: IMarkerEditorGroup["top_performer_ids"]) =>
    list?.map((p) =>
      p.id === saved.id ? { id: saved.id, label: saved.label } : p
    );
  markerEditorGroupsCustom(criterion).forEach((group) => {
    group.top_performer_ids = relabel(group.top_performer_ids) ?? [];
    group.bottom_performer_ids = relabel(group.bottom_performer_ids) ?? [];
    group.either_performer_ids = relabel(group.either_performer_ids);
    if (assignment?.groupId === group.groupId) {
      assignMarkerUnnamedCustom(group, saved, assignment.role);
    }
  });
}

export function markerUnnamedUsesCustom(
  groups: IMarkerEditorGroup[],
  id: string
) {
  return groups.flatMap((group, index) =>
    markerGroupPeopleCustom(group)
      .filter((p) => p.id === id)
      .map((p) => ({ groupId: group.groupId, index, role: p.role }))
  );
}

export function removeMarkerUnnamedCustom(
  criterion: MarkerEditorCriterion,
  id: string
) {
  criterion.value.unnamed_performers =
    criterion.value.unnamed_performers.filter((p) => p.id !== id);
  markerEditorGroupsCustom(criterion).forEach((group) => {
    Object.assign(
      group,
      setMarkerPeopleCustom(
        group,
        markerGroupPeopleCustom(group).filter((p) => p.id !== id)
      )
    );
  });
}
