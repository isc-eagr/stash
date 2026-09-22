import type { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import type { SceneMarkersCriterion } from "src/models/list-filter/criteria/scene-markers";
import type { SceneMarkersExcludeCriterion } from "src/models/list-filter/criteria/scene-markers-exclude";
import type { ILabeledId } from "src/models/list-filter/types";
import {
  cloneUnnamedPerformer,
  createUnnamedPerformer,
  formatUnnamedPerformerSummary,
  isUnnamedPerformerId,
} from "src/models/list-filter/criteria/unnamed-performer";
import type { IUnnamedPerformer } from "src/models/list-filter/criteria/unnamed-performer";

export type MarkerEditorCriterion =
  | MarkerPerformersCriterion
  | SceneMarkersCriterion
  | SceneMarkersExcludeCriterion;

export type MarkerEditorRole = "top_performer_ids" | "bottom_performer_ids";

export interface IMarkerEditorGroup {
  groupId: string;
  tag_ids: ILabeledId[];
  performer_mode: "AND" | "OR";
  top_performer_ids: ILabeledId[];
  bottom_performer_ids: ILabeledId[];
  depth?: number;
  include_subtags?: boolean;
}

export function markerEditorGroupsCustom(
  criterion: MarkerEditorCriterion
): IMarkerEditorGroup[] {
  return "getGroups" in criterion
    ? criterion.getGroups()
    : criterion.value.groups;
}

// Keep class instances and legacy fields intact so serialization stays unchanged.
export function markerEditorDraftCustom<T extends MarkerEditorCriterion>(
  criterion: T
): T {
  const draft = criterion.clone() as T;
  if ("ensureGroups" in draft) draft.ensureGroups();
  else if (!draft.value.groups.length) draft.addGroup();
  return draft;
}

export function mergeMarkerNamedVatosCustom(
  current: ILabeledId[],
  performers: Array<{ id: string; name?: string | null }>
): ILabeledId[] {
  return [
    ...current.filter((p) => isUnnamedPerformerId(p.id)),
    ...performers.map((p) => ({ id: p.id, label: p.name ?? p.id })),
  ];
}

export function markerSelectedVatosCustom(
  performers: Array<{ id: string; name?: string | null }>
): ILabeledId[] {
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
  role: MarkerEditorRole,
  performer: IUnnamedPerformer
) {
  if (!group[role].some((p) => p.id === performer.id)) {
    group[role] = [
      ...group[role],
      { id: performer.id, label: performer.label },
    ];
  }
}

export function saveMarkerUnnamedCustom(
  criterion: MarkerEditorCriterion,
  performer: IUnnamedPerformer,
  assignment?: { groupId: string; role: MarkerEditorRole }
) {
  const people = criterion.value.unnamed_performers ?? [];
  const saved = cloneUnnamedPerformer(performer);
  criterion.value.unnamed_performers = people.some((p) => p.id === saved.id)
    ? people.map((p) => (p.id === saved.id ? saved : p))
    : [...people, saved];
  const groups = markerEditorGroupsCustom(criterion);
  groups.forEach((group) => {
    (["top_performer_ids", "bottom_performer_ids"] as const).forEach((role) => {
      group[role] = group[role].map((p) =>
        p.id === saved.id ? { id: saved.id, label: saved.label } : p
      );
    });
    if (assignment?.groupId === group.groupId) {
      assignMarkerUnnamedCustom(group, assignment.role, saved);
    }
  });
}

export function copyMarkerUnnamedCustom(
  source: IUnnamedPerformer,
  people: IUnnamedPerformer[]
): IUnnamedPerformer {
  const { id, label, letter } = createUnnamedPerformer(people);
  return { ...cloneUnnamedPerformer(source), id, label, letter };
}

export function markerUnnamedUsesCustom(
  groups: IMarkerEditorGroup[],
  id: string
) {
  return groups.flatMap((group) =>
    (["top_performer_ids", "bottom_performer_ids"] as const)
      .filter((role) => group[role].some((p) => p.id === id))
      .map((role) => ({ groupId: group.groupId, role }))
  );
}

export function removeMarkerUnnamedCustom(
  criterion: MarkerEditorCriterion,
  id: string
) {
  criterion.value.unnamed_performers =
    criterion.value.unnamed_performers.filter((p) => p.id !== id);
  markerEditorGroupsCustom(criterion).forEach((group) => {
    group.top_performer_ids = group.top_performer_ids.filter(
      (p) => p.id !== id
    );
    group.bottom_performer_ids = group.bottom_performer_ids.filter(
      (p) => p.id !== id
    );
  });
}
