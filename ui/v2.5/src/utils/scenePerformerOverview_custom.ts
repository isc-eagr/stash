export const SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS = [
  "tattoos",
  "piercings",
  "stash_ids",
] as const;

export const SCENE_PERFORMER_OVERVIEW_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export function isScenePerformerOverviewFieldExcluded(field: string) {
  return SCENE_PERFORMER_OVERVIEW_EXCLUDED_FIELDS.some(
    (excludedField) => excludedField === field
  );
}

interface IPrimaryActivation {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function shouldOpenScenePerformerOverview(
  activation: IPrimaryActivation
) {
  return (
    activation.button === 0 &&
    !activation.altKey &&
    !activation.ctrlKey &&
    !activation.metaKey &&
    !activation.shiftKey
  );
}

export interface IScenePerformerOverviewPartner {
  id: string;
  name: string;
  image_path?: string | null;
}

export type ScenePerformerOverviewInteractionCategory =
  | "sex"
  | "oral"
  | "facial";
export type ScenePerformerOverviewInteractionRole = "top" | "bottom";

interface IScenePerformerOverviewTag {
  id: string;
  parents?: ReadonlyArray<{ id: string }> | null;
}

interface IScenePerformerOverviewMarker {
  primary_tag: IScenePerformerOverviewTag;
  tags: ReadonlyArray<IScenePerformerOverviewTag>;
  top_performers: ReadonlyArray<IScenePerformerOverviewPartner>;
  bottom_performers: ReadonlyArray<IScenePerformerOverviewPartner>;
}

interface IScenePerformerOverviewRoleTagIds {
  sexTagId?: string;
  oralTagId?: string;
  facialTagId?: string;
  orgasmTagId?: string;
}

export interface IScenePerformerOverviewInteractionGroup {
  category: ScenePerformerOverviewInteractionCategory;
  role: ScenePerformerOverviewInteractionRole;
  partners: IScenePerformerOverviewPartner[];
}

function overviewTagMatches(
  tag: IScenePerformerOverviewTag,
  configuredTagId?: string
) {
  return (
    !!configuredTagId &&
    (tag.id === configuredTagId ||
      !!tag.parents?.some((parent) => parent.id === configuredTagId))
  );
}

function getOverviewMarkerCategory(
  marker: IScenePerformerOverviewMarker,
  roleTagIds: IScenePerformerOverviewRoleTagIds
): ScenePerformerOverviewInteractionCategory | undefined {
  if (
    overviewTagMatches(marker.primary_tag, roleTagIds.orgasmTagId) &&
    [marker.primary_tag, ...marker.tags].some((tag) =>
      overviewTagMatches(tag, roleTagIds.facialTagId)
    )
  ) {
    return "facial";
  }

  return (["oral", "sex", "facial"] as const).find((category) =>
    overviewTagMatches(marker.primary_tag, roleTagIds[`${category}TagId`])
  );
}

export function getScenePerformerOverviewInteractions(
  markers: ReadonlyArray<IScenePerformerOverviewMarker>,
  performerId: string,
  roleTagIds: IScenePerformerOverviewRoleTagIds
): IScenePerformerOverviewInteractionGroup[] {
  const groupOrder: Array<
    Pick<IScenePerformerOverviewInteractionGroup, "category" | "role">
  > = [
    { category: "sex", role: "top" },
    { category: "oral", role: "top" },
    { category: "sex", role: "bottom" },
    { category: "oral", role: "bottom" },
  ];
  const partnersByGroup = new Map<
    string,
    Map<string, IScenePerformerOverviewPartner>
  >();

  markers.forEach((marker) => {
    const category = getOverviewMarkerCategory(marker, roleTagIds);
    if (!category) return;

    const rolePartners: Array<{
      role: ScenePerformerOverviewInteractionRole;
      source: ReadonlyArray<IScenePerformerOverviewPartner>;
      opposite: ReadonlyArray<IScenePerformerOverviewPartner>;
    }> = [
      {
        role: "top",
        source: marker.top_performers,
        opposite: marker.bottom_performers,
      },
      {
        role: "bottom",
        source: marker.bottom_performers,
        opposite: marker.top_performers,
      },
    ];

    rolePartners.forEach(({ role, source, opposite }) => {
      if (!source.some((performer) => performer.id === performerId)) return;

      const key = `${category}-${role}`;
      const group = partnersByGroup.get(key) ?? new Map();
      opposite.forEach((partner) => {
        if (partner.id !== performerId) group.set(partner.id, partner);
      });
      partnersByGroup.set(key, group);
    });
  });

  return groupOrder.flatMap(({ category, role }) => {
    const partners = [
      ...(partnersByGroup.get(`${category}-${role}`)?.values() ?? []),
    ].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
      })
    );

    return partners.length > 0 ? [{ category, role, partners }] : [];
  });
}

export type ScenePerformerOverviewActivityRole = "top" | "bottom" | "solo";

export interface IScenePerformerOverviewActivityMetric {
  key: string;
  label: string;
  role: ScenePerformerOverviewActivityRole;
  seconds: number;
}

interface IScenePerformerOverviewActivityStats {
  sex_top_seconds: number;
  sex_bottom_seconds: number;
  oral_top_seconds: number;
  oral_bottom_seconds: number;
  solo_seconds: number;
}

export function getScenePerformerOverviewActivityMetrics(
  stats: IScenePerformerOverviewActivityStats
): IScenePerformerOverviewActivityMetric[] {
  return [
    {
      key: "sex-top",
      label: "Time Fucking",
      role: "top",
      seconds: stats.sex_top_seconds,
    },
    {
      key: "sex-bottom",
      label: "Time Getting Fucked",
      role: "bottom",
      seconds: stats.sex_bottom_seconds,
    },
    {
      key: "oral-top",
      label: "Time Getting His Pito Sucked",
      role: "top",
      seconds: stats.oral_top_seconds,
    },
    {
      key: "oral-bottom",
      label: "Time Sucking Pito",
      role: "bottom",
      seconds: stats.oral_bottom_seconds,
    },
    {
      key: "solo",
      label: "Time Jerking",
      role: "solo",
      seconds: stats.solo_seconds,
    },
  ];
}

interface IScenePerformerOverviewPartnerCount {
  performer: IScenePerformerOverviewPartner;
}

export function getUniqueScenePerformerOverviewPartners(
  groups: ReadonlyArray<
    ReadonlyArray<IScenePerformerOverviewPartnerCount> | null | undefined
  >
) {
  const partnersById = new Map<string, IScenePerformerOverviewPartner>();

  groups.forEach((group) => {
    group?.forEach(({ performer }) =>
      partnersById.set(performer.id, performer)
    );
  });

  return [...partnersById.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  );
}
