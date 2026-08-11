// CUSTOM: shared copy for performer partner role chips and sections.
export type PerformerRolePartnerCategory = "sex" | "oral" | "facial";
export type PerformerRolePartnerType = "top" | "bottom";

const actionLabels: Record<
  PerformerRolePartnerCategory,
  Record<PerformerRolePartnerType, string>
> = {
  sex: {
    top: "fucked these vatos",
    bottom: "been fucked by these pitos",
  },
  oral: {
    top: "had his pito sucked by these vatos",
    bottom: "sucked these pitos",
  },
  facial: {
    top: "put his mecos in these vatos' faces",
    bottom: "had these mecos in his face",
  },
};

export function getPerformerRolePartnerPopupText(
  category: PerformerRolePartnerCategory,
  type: PerformerRolePartnerType,
  performerName?: string | null
) {
  const name = performerName || "Performer";
  return `${name} has ${actionLabels[category][type]}`;
}

export function getPerformerRolePartnerSectionTitle(
  category: PerformerRolePartnerCategory,
  type: PerformerRolePartnerType
) {
  const label = actionLabels[category][type];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getPerformerRolePartnerSectionSubtitle(
  category: PerformerRolePartnerCategory,
  type: PerformerRolePartnerType
) {
  return `${category} ${type}`;
}

export function shouldShowPerformerRolePartnerDuration(
  category: PerformerRolePartnerCategory
) {
  return category === "sex" || category === "oral";
}
