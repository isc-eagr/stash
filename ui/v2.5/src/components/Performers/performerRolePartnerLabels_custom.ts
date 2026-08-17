// CUSTOM: shared copy for performer partner role chips and sections.
export type PerformerRolePartnerCategory = "sex" | "oral" | "facial";
export type PerformerRolePartnerType = "top" | "bottom";

const actionLabels: Record<
  PerformerRolePartnerCategory,
  Record<PerformerRolePartnerType, string>
> = {
  sex: {
    top: "gave dick to these vatos",
    bottom: "took dick from these vatos",
  },
  oral: {
    top: "had his pito sucked by these vatos",
    bottom: "sucked these pitos",
  },
  facial: {
    top: "put his mecos in these vatos' faces",
    bottom: "had mecos from these vatos in his face",
  },
};

export function getPerformerRolePartnerPopupText(
  category: PerformerRolePartnerCategory,
  type: PerformerRolePartnerType,
  performerName?: string | null
) {
  const name = performerName || "Performer";
  return `${name} ${actionLabels[category][type]}`;
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

const rareRoleActionLabels: Record<
  Exclude<PerformerRolePartnerCategory, "facial">,
  Record<PerformerRolePartnerType, string>
> = {
  sex: {
    top: "giving dick",
    bottom: "taking dick",
  },
  oral: {
    top: "having his pito sucked",
    bottom: "sucking pito",
  },
};

// Keeps rarity-chip wording aligned with the action language in the Partners tab.
export function getPerformerRareRoleAction(
  category: Exclude<PerformerRolePartnerCategory, "facial">,
  type: PerformerRolePartnerType
) {
  return rareRoleActionLabels[category][type];
}
