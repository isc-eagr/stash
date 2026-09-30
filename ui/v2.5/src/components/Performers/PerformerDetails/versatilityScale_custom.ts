export type PerformerVersatility = {
  // 1 = only topped, 0 = only bottomed, based on unique partners per role.
  topShare: number;
  label: string;
  color: string;
  textColor: string;
};

type RGB = [number, number, number];

// Neutral in the middle, darker blue toward top, darker green toward bottom.
const NEUTRAL: RGB = [206, 212, 218];
const DARK_TOP: RGB = [13, 59, 140];
const DARK_BOTTOM: RGB = [14, 92, 46];

function mix(from: RGB, to: RGB, amount: number): RGB {
  return from.map((value, index) =>
    Math.round(value + (to[index] - value) * amount)
  ) as RGB;
}

function hex([r, g, b]: RGB) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function performerVersatilityColor(topShare: number) {
  const share = Math.min(Math.max(topShare, 0), 1);
  const intensity = Math.abs(share - 0.5) * 2;
  const rgb = mix(NEUTRAL, share >= 0.5 ? DARK_TOP : DARK_BOTTOM, intensity);
  return {
    color: hex(rgb),
    textColor: intensity > 0.45 ? "#ffffff" : "#16191d",
  };
}

export function performerVersatilityLabel(topShare: number) {
  if (topShare >= 1) return "Exclusive top";
  if (topShare <= 0) return "Exclusive bottom";
  if (topShare >= 0.8) return "Mostly top";
  if (topShare >= 0.6) return "Top-leaning versatile";
  if (topShare > 0.4) return "Versatile";
  if (topShare > 0.2) return "Bottom-leaning versatile";
  return "Mostly bottom";
}

// Share of partners he topped among all partners he topped or bottomed for,
// for one activity (sex or oral). A partner he both topped and bottomed for
// counts on both sides. Returns undefined when he has no role partners.
export function performerVersatility(
  toppedPartners: number,
  bottomedPartners: number
): PerformerVersatility | undefined {
  const top = Math.max(toppedPartners, 0);
  const bottom = Math.max(bottomedPartners, 0);
  if (top + bottom <= 0) return undefined;

  const topShare = top / (top + bottom);
  return {
    topShare,
    label: performerVersatilityLabel(topShare),
    ...performerVersatilityColor(topShare),
  };
}

export type VersatilityCategory = "sex" | "oral" | "facial";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

// Spicy role copy, matching the Activity Time and partner-role wording.
export function versatilityRoleText(
  category: VersatilityCategory,
  role: "top" | "bottom",
  partners: number
) {
  const vatos = plural(partners, "vato", "vatos");
  switch (category) {
    case "sex":
      return role === "top" ? `Fucked ${vatos}` : `Got fucked by ${vatos}`;
    case "oral":
      return role === "top"
        ? `Got his pito sucked by ${vatos}`
        : `Sucked ${plural(partners, "pito", "pitos")}`;
    default:
      return role === "top"
        ? `Put mecos on ${plural(partners, "face", "faces")}`
        : `Took mecos from ${vatos}`;
  }
}
