export interface IVatoRoleCounts {
  scene_count: number;
  sex_top_count: number;
  sex_bottom_count: number;
  oral_top_count: number;
  oral_bottom_count: number;
  facial_given_count: number;
  facial_received_count: number;
  solo_scene_count: number;
}

type RoleCategory = "role" | "role_strictness";
type RoleDefinition = {
  key: string;
  label: string;
  matches: (vato: IVatoRoleCounts) => boolean;
};

const roleDefinitions: Record<RoleCategory, RoleDefinition[]> = {
  role_strictness: [
    {
      key: "pure_tops",
      label: "Pure tops",
      matches: (v) =>
        (v.sex_top_count > 0 || v.oral_top_count > 0) &&
        v.sex_bottom_count === 0 &&
        v.oral_bottom_count === 0,
    },
    {
      key: "lenient_tops",
      label: "Lenient tops",
      matches: (v) =>
        v.sex_top_count > 0 &&
        v.sex_bottom_count === 0 &&
        v.oral_bottom_count > 0,
    },
    {
      key: "pure_bottoms",
      label: "Pure bottoms",
      matches: (v) =>
        (v.sex_bottom_count > 0 || v.oral_bottom_count > 0) &&
        v.sex_top_count === 0 &&
        v.oral_top_count === 0,
    },
    {
      key: "lenient_bottoms",
      label: "Lenient bottoms",
      matches: (v) =>
        v.sex_bottom_count > 0 && v.sex_top_count === 0 && v.oral_top_count > 0,
    },
    {
      key: "solo_only",
      label: "Solo Only",
      matches: (v) =>
        v.solo_scene_count > 0 &&
        v.solo_scene_count === v.scene_count &&
        v.sex_top_count === 0 &&
        v.sex_bottom_count === 0 &&
        v.oral_top_count === 0 &&
        v.oral_bottom_count === 0 &&
        v.facial_given_count === 0 &&
        v.facial_received_count === 0,
    },
  ],
  role: [
    {
      key: "sex_top_count",
      label: "Sex tops",
      matches: (v) => v.sex_top_count > 0,
    },
    {
      key: "sex_bottom_count",
      label: "Sex bottoms",
      matches: (v) => v.sex_bottom_count > 0,
    },
    {
      key: "oral_top_count",
      label: "Oral Tops",
      matches: (v) => v.oral_top_count > 0,
    },
    {
      key: "oral_bottom_count",
      label: "Oral Bottoms",
      matches: (v) => v.oral_bottom_count > 0,
    },
    {
      key: "facial_given_count",
      label: "Facial Tops",
      matches: (v) => v.facial_given_count > 0,
    },
    {
      key: "facial_received_count",
      label: "Facial Bottoms",
      matches: (v) => v.facial_received_count > 0,
    },
    {
      key: "solo_scene_count",
      label: "Solo",
      matches: (v) => v.solo_scene_count > 0,
    },
  ],
};

export function vatoMatchesRole(
  performer: IVatoRoleCounts,
  category: RoleCategory,
  key: string
) {
  return (
    roleDefinitions[category]
      .find((role) => role.key === key)
      ?.matches(performer) ?? false
  );
}

export function buildVatoRoleChartData(
  performers: IVatoRoleCounts[],
  category: RoleCategory
) {
  return {
    data: roleDefinitions[category].map((role, sortValue) => ({
      key: role.key,
      label: role.label,
      count: performers.filter(role.matches).length,
      sortValue,
    })),
    unknownCount: 0,
  };
}
