import type { ILabeledId } from "../types";
import { ratingCriteriaValueToCriterionInput } from "./rating-criteria_custom";
import {
  formatUnnamedPerformerSummary,
  isUnnamedPerformerId,
} from "./unnamed-performer";
import type { IUnnamedPerformer } from "./unnamed-performer";

// Shared role, serialization, and summary rules for one marker configuration
// in Scene Markers, Scene Markers: Exclude, and Marker Match.

export type MarkerVatoRoleCustom = "top" | "bottom" | "both" | "either";

export const MARKER_VATO_ROLES_CUSTOM: MarkerVatoRoleCustom[] = [
  "top",
  "bottom",
  "both",
  "either",
];

export interface IMarkerRoleGroupCustom {
  groupId: string;
  tag_ids: ILabeledId[];
  performer_mode: "AND" | "OR";
  top_performer_ids: ILabeledId[];
  bottom_performer_ids: ILabeledId[];
  either_performer_ids?: ILabeledId[];
  depth?: number;
  include_subtags?: boolean;
}

export interface IMarkerGroupPersonCustom extends ILabeledId {
  role: MarkerVatoRoleCustom;
}

export type MarkerRoleUpdatesCustom = Pick<
  IMarkerRoleGroupCustom,
  | "performer_mode"
  | "top_performer_ids"
  | "bottom_performer_ids"
  | "either_performer_ids"
>;

export type MarkerSummaryConnectorCustom = "and" | "while" | "or";

export function copyLabeledIdsCustom(values?: ILabeledId[] | null) {
  return (values ?? []).map((value) => ({ id: value.id, label: value.label }));
}

// Legacy "Either · OR" groups meant "either role" for a vato listed as both
// top and bottom. Every configuration is now AND with an explicit role.
export function normalizeMarkerGroupRolesCustom<
  T extends IMarkerRoleGroupCustom
>(group: T): T {
  let top = copyLabeledIdsCustom(group.top_performer_ids);
  let bottom = copyLabeledIdsCustom(group.bottom_performer_ids);
  const either = copyLabeledIdsCustom(group.either_performer_ids);
  if (group.performer_mode === "OR") {
    const shared = new Set(
      top.filter((p) => bottom.some((b) => b.id === p.id)).map((p) => p.id)
    );
    top.forEach((p) => {
      if (shared.has(p.id) && !either.some((e) => e.id === p.id))
        either.push(p);
    });
    top = top.filter((p) => !shared.has(p.id));
    bottom = bottom.filter((p) => !shared.has(p.id));
  }
  return {
    ...group,
    performer_mode: "AND",
    top_performer_ids: top,
    bottom_performer_ids: bottom,
    either_performer_ids: either,
  };
}

export function markerGroupPeopleCustom(
  group: IMarkerRoleGroupCustom
): IMarkerGroupPersonCustom[] {
  const people: IMarkerGroupPersonCustom[] = [];
  const add = (person: ILabeledId, role: MarkerVatoRoleCustom) => {
    if (!people.some((p) => p.id === person.id))
      people.push({ id: person.id, label: person.label, role });
  };
  group.top_performer_ids.forEach((p) =>
    add(
      p,
      group.bottom_performer_ids.some((b) => b.id === p.id) ? "both" : "top"
    )
  );
  group.bottom_performer_ids.forEach((p) => add(p, "bottom"));
  (group.either_performer_ids ?? []).forEach((p) => add(p, "either"));
  return people;
}

function roleUpdatesCustom(
  people: IMarkerGroupPersonCustom[]
): MarkerRoleUpdatesCustom {
  const pick = (roles: MarkerVatoRoleCustom[]) =>
    people
      .filter((p) => roles.includes(p.role))
      .map((p) => ({ id: p.id, label: p.label }));
  return {
    performer_mode: "AND",
    top_performer_ids: pick(["top", "both"]),
    bottom_performer_ids: pick(["bottom", "both"]),
    either_performer_ids: pick(["either"]),
  };
}

export function setMarkerPersonRoleCustom(
  group: IMarkerRoleGroupCustom,
  id: string,
  role: MarkerVatoRoleCustom
): MarkerRoleUpdatesCustom {
  return roleUpdatesCustom(
    markerGroupPeopleCustom(group).map((p) =>
      p.id === id ? { ...p, role } : p
    )
  );
}

// Keeps each remaining vato's role and adds new vatos with defaultRole.
export function setMarkerPeopleCustom(
  group: IMarkerRoleGroupCustom,
  selected: ILabeledId[],
  defaultRole: MarkerVatoRoleCustom = "either"
): MarkerRoleUpdatesCustom {
  const current = markerGroupPeopleCustom(group);
  return roleUpdatesCustom(
    selected.map((person) => ({
      id: person.id,
      label: person.label,
      role: current.find((p) => p.id === person.id)?.role ?? defaultRole,
    }))
  );
}

export function isMarkerGroupEmptyCustom(group: IMarkerRoleGroupCustom) {
  return !group.tag_ids.length && !markerGroupPeopleCustom(group).length;
}

export function markerUnnamedInputCustom(performer: IUnnamedPerformer) {
  return {
    id: performer.id,
    ethnicities: performer.ethnicities.length
      ? performer.ethnicities
      : undefined,
    countries: performer.countries.length ? performer.countries : undefined,
    rating: performer.rating ?? undefined,
    rating_criteria: ratingCriteriaValueToCriterionInput(
      performer.rating_criteria
    ),
  };
}

// GraphQL role fields for one configuration. Named and unnamed vatos follow
// the same rules; each unnamed vato is sent with its definition.
export function markerGroupRoleInputCustom(
  source: IMarkerRoleGroupCustom,
  unnamed: IUnnamedPerformer[]
): Record<string, unknown> {
  const group = normalizeMarkerGroupRolesCustom(source);
  const input: Record<string, unknown> = { performer_mode: "AND" };
  const fields: Record<MarkerVatoRoleCustom, [string, string]> = {
    top: ["top_performer_ids", "top_unnamed_performers"],
    bottom: ["bottom_performer_ids", "bottom_unnamed_performers"],
    both: ["both_roles_performer_ids", "both_roles_unnamed_performers"],
    either: ["either_performer_ids", "either_unnamed_performers"],
  };
  for (const role of MARKER_VATO_ROLES_CUSTOM) {
    const people = markerGroupPeopleCustom(group).filter(
      (p) => p.role === role
    );
    const named = people
      .filter((p) => !isUnnamedPerformerId(p.id))
      .map((p) => p.id);
    const vatos = people
      .map((p) => unnamed.find((u) => u.id === p.id))
      .filter((u): u is IUnnamedPerformer => !!u)
      .map(markerUnnamedInputCustom);
    if (named.length) input[fields[role][0]] = named;
    if (vatos.length) input[fields[role][1]] = vatos;
  }
  return input;
}

export function nonEmptyMarkerGroupsCustom<T extends IMarkerRoleGroupCustom>(
  groups: T[]
): T[] {
  return groups.filter((group) => !isMarkerGroupEmptyCustom(group));
}

// Unnamed vatos no configuration uses.
export function unusedMarkerVatosCustom(
  groups: IMarkerRoleGroupCustom[],
  unnamed: IUnnamedPerformer[]
) {
  return unnamed.filter(
    (vato) =>
      !groups.some((group) =>
        markerGroupPeopleCustom(group).some((p) => p.id === vato.id)
      )
  );
}

export const MARKER_ROLE_PREFIX_CUSTOM: Record<MarkerVatoRoleCustom, string> = {
  top: "↑",
  bottom: "↓",
  both: "↑↓",
  either: "",
};

export function markerVatoLabelCustom(
  person: ILabeledId,
  unnamed: IUnnamedPerformer[]
) {
  const vato = unnamed.find((u) => u.id === person.id);
  if (!vato) return person.label;
  const summary = formatUnnamedPerformerSummary(vato);
  return summary === "Any performer"
    ? vato.label
    : `${vato.label} (${summary})`;
}

export function markerTagsSummaryCustom(group: IMarkerRoleGroupCustom) {
  if (!group.tag_ids.length) return "Any marker";
  const subtags = !!group.depth || !!group.include_subtags;
  return `${group.tag_ids.map((t) => t.label).join(" + ")}${
    subtags ? " (+ sub-tags)" : ""
  }`;
}

// "Blowjob: ↑Juan, ↓Vato A (Black)". ↑ top, ↓ bottom, ↑↓ both roles, and
// no arrow for either role.
export function markerGroupSentenceCustom(
  group: IMarkerRoleGroupCustom,
  unnamed: IUnnamedPerformer[]
) {
  const people = markerGroupPeopleCustom(normalizeMarkerGroupRolesCustom(group))
    .map(
      (p) =>
        `${MARKER_ROLE_PREFIX_CUSTOM[p.role]}${markerVatoLabelCustom(
          p,
          unnamed
        )}`
    )
    .join(", ");
  const tags = markerTagsSummaryCustom(group);
  return people ? `${tags}: ${people}` : tags;
}

export function markerCriterionSentenceCustom(
  groups: IMarkerRoleGroupCustom[],
  unnamed: IUnnamedPerformer[],
  connector: MarkerSummaryConnectorCustom
) {
  return nonEmptyMarkerGroupsCustom(groups)
    .map((group) => markerGroupSentenceCustom(group, unnamed))
    .join(` ${connector} `);
}

// Scene Markers and Scene Markers: Exclude store configurations the same way.
export interface ISceneMarkerGroupCustom extends IMarkerRoleGroupCustom {
  depth: number; // 0 = no sub-tags, -1 = all sub-tags
  either_performer_ids: ILabeledId[];
}

interface ISceneMarkerGroupRawCustom {
  groupId: string;
  tag_ids?: ILabeledId[];
  depth?: number;
  performer_mode?: "AND" | "OR";
  top_performer_ids?: ILabeledId[];
  bottom_performer_ids?: ILabeledId[];
  either_performer_ids?: ILabeledId[];
}

export function nextMarkerGroupIdCustom(groups: { groupId: string }[]) {
  const used = new Set(groups.map((g) => g.groupId));
  let n = groups.length + 1;
  while (used.has(`${n}`)) n++;
  return `${n}`;
}

export function createSceneMarkerGroupCustom(
  groupId: string
): ISceneMarkerGroupCustom {
  return {
    groupId,
    tag_ids: [],
    depth: 0,
    performer_mode: "AND",
    top_performer_ids: [],
    bottom_performer_ids: [],
    either_performer_ids: [],
  };
}

export function encodeSceneMarkerGroupCustom(g: ISceneMarkerGroupCustom) {
  return {
    groupId: g.groupId,
    tag_ids: copyLabeledIdsCustom(g.tag_ids),
    depth: g.depth,
    performer_mode: g.performer_mode,
    top_performer_ids: copyLabeledIdsCustom(g.top_performer_ids),
    bottom_performer_ids: copyLabeledIdsCustom(g.bottom_performer_ids),
    either_performer_ids: copyLabeledIdsCustom(g.either_performer_ids),
  };
}

export function decodeSceneMarkerGroupCustom(
  raw: ISceneMarkerGroupRawCustom
): ISceneMarkerGroupCustom {
  return normalizeMarkerGroupRolesCustom({
    groupId: raw.groupId,
    tag_ids: copyLabeledIdsCustom(raw.tag_ids),
    depth: raw.depth ?? 0,
    // Groups saved before explicit roles defaulted to OR.
    performer_mode: raw.performer_mode ?? "OR",
    top_performer_ids: copyLabeledIdsCustom(raw.top_performer_ids),
    bottom_performer_ids: copyLabeledIdsCustom(raw.bottom_performer_ids),
    either_performer_ids: copyLabeledIdsCustom(raw.either_performer_ids),
  });
}

export function encodeMarkerUnnamedCustom(unnamed?: IUnnamedPerformer[]) {
  return (unnamed ?? []).map((up) => ({
    id: up.id,
    label: up.label,
    letter: up.letter,
    ethnicities: up.ethnicities,
    countries: up.countries,
    rating: up.rating,
    rating_criteria: up.rating_criteria,
  }));
}

// Tag, depth, and role fields for one Scene Markers configuration.
export function sceneMarkerGroupInputCustom(
  g: ISceneMarkerGroupCustom,
  unnamed: IUnnamedPerformer[]
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    tag_ids: g.tag_ids.map((t) => t.id),
    ...markerGroupRoleInputCustom(g, unnamed),
  };
  if (g.depth !== 0) input.depth = g.depth;
  return input;
}
