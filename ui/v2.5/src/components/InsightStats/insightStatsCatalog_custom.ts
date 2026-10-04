import type {
  SceneCardInsightCandidate,
  SceneCardInsightCandidateKind,
  SceneCardInsightThresholdKey,
  SceneCardInsightTone,
} from "../Scenes/sceneCardInsightTypes_custom";

const insightStatsTones: Record<
  SceneCardInsightCandidateKind,
  SceneCardInsightTone
> = {
  goat: "goat",
  "event-report": "event",
  "orgasm-event": "event",
  "outstanding-activity": "tag",
  "outstanding-activity-presence": "tag",
  "activity-quality": "activity",
  leaning: "activity",
  "no-orgasm": "negative",
  interaction: "interaction",
  "only-scene": "rare",
  "rare-role": "rare",
  "negative-rating": "negative",
  "short-outstanding": "negative",
  "favorite-lineup": "lineup",
  "country-lineup": "lineup",
};

export function insightStatsTone(kind: SceneCardInsightCandidateKind) {
  return insightStatsTones[kind];
}

export const insightThresholdLabels: Record<
  SceneCardInsightThresholdKey,
  string
> = {
  visibleInsightLimit: "Visible chips per card",
  rareRoleMaximumPercent: "Rare role: maximum % of role history",
  tagGoodAmountMinPercent: "Good amount of tags: minimum % of scene",
  tagLotsMinPercent: "Lots of tags: minimum % of scene",
  tagEyeCanSeeMinPercent: "As far as the eye can see: minimum % of scene",
  shortOutstandingMaxSeconds: "Short Outstanding: maximum marker seconds",
  shortOutstandingMinPercent: "Short Outstanding: minimum % of markers",
  shortOutstandingMinMarkers: "Short Outstanding: minimum markers",
};

type InsightKindInfo = {
  label: string;
  note: string;
  thresholds: SceneCardInsightThresholdKey[];
};

// Exhaustive by engine kind: new kinds must be described here at compile time.
const kindInfo: Record<SceneCardInsightCandidateKind, InsightKindInfo> = {
  goat: {
    label: "GOAT combinations",
    note: "A non-2nd-Camera GOAT marker with a tag or performer moment; combinations group across performers.",
    thresholds: [],
  },
  "event-report": {
    label: "Event reports",
    note: "Configured Orgasm or Facial markers, excluding 2nd Camera; top assignments count as events.",
    thresholds: [],
  },
  "orgasm-event": {
    label: "Orgasm patterns",
    note: "Configured Orgasm markers, excluding 2nd Camera; detects simultaneous tops (one marker, or markers that overlap or start within 5s) and repeated top assignments.",
    thresholds: [],
  },
  "outstanding-activity": {
    label: "Common tag combinations",
    note: "Some / Good amount / Lots / As far as the eye can see. Reports up to two common tags; tags marked only without an end time report their marker count.",
    thresholds: [
      "tagGoodAmountMinPercent",
      "tagLotsMinPercent",
      "tagEyeCanSeeMinPercent",
    ],
  },
  "outstanding-activity-presence": {
    label: "Scene contains…",
    note: "Shows configured uncommon tags present on a non-2nd-Camera marker; common tags use the amount chip.",
    thresholds: [],
  },
  "activity-quality": {
    label: "Activity quality combinations",
    note: "Outstanding sex and oral shares grouped into 20-point percentage ranges.",
    thresholds: [],
  },
  leaning: {
    label: "Fucking / eating pito split",
    note: "Fucking and eating pito shares grouped into 10-point percentage ranges, with the existing minimum evidence rule.",
    thresholds: [],
  },
  "no-orgasm": {
    label: "No Orgasm",
    note: "No non-2nd-Camera marker has a configured Orgasm or Facial tag.",
    thresholds: [],
  },
  interaction: {
    label: "Interaction patterns",
    note: "Non-2nd-Camera role assignments create the interaction graph. Each direction needs at least 5% of the runtime (untimed markers count by presence), and patterns describe only the vatos in the sex/oral action.",
    thresholds: [],
  },
  "only-scene": {
    label: "Only scene",
    note: "A cast member appears in exactly one scene in your library, including scenes without markers. One chip per qualifying performer; coverage counts each eligible scene once.",
    thresholds: [],
  },
  "rare-role": {
    label: "Rare roles",
    note: "Library-wide performer history; requires at least five role scenes. Sex/Oral subtags count in the current scene, and a role seen in only one scene is reported as Only time at any threshold.",
    thresholds: ["rareRoleMaximumPercent"],
  },
  "negative-rating": {
    label: "Rating Advisor warnings",
    note: "Saved scene Rating Advisor values trigger the matching warning.",
    thresholds: [],
  },
  "short-outstanding": {
    label: "Short Outstanding",
    note: "Enough timed Outstanding markers (excluding Orgasm, Facial, and 2nd Camera) and a high share of them last no more than the maximum seconds.",
    thresholds: [
      "shortOutstandingMaxSeconds",
      "shortOutstandingMinPercent",
      "shortOutstandingMinMarkers",
    ],
  },
  "favorite-lineup": {
    label: "Favorite Vatos",
    note: "At least one cast member qualifies for the Royal Sapphire performer card under current tiers or overrides.",
    thresholds: [],
  },
  "country-lineup": {
    label: "Mexican lineup",
    note: "At least one performer has country MX, MEX, or Mexico; All-Mexican requires at least two and no others.",
    thresholds: [],
  },
};

export type InsightStatsDefinition = InsightKindInfo & {
  id: string;
  kind: SceneCardInsightCandidateKind;
  matches: (candidate: SceneCardInsightCandidate) => boolean;
};

function definition(
  kind: SceneCardInsightCandidateKind,
  id = kind as string,
  label?: string,
  matches?: InsightStatsDefinition["matches"],
  note = kindInfo[kind].note
): InsightStatsDefinition {
  return {
    ...kindInfo[kind],
    id,
    kind,
    label: label ?? kindInfo[kind].label,
    note,
    matches: matches ?? ((candidate) => candidate.kind === kind),
  };
}

function keyed(
  kind: SceneCardInsightCandidateKind,
  id: string,
  label: string,
  note = kindInfo[kind].note
) {
  return {
    ...definition(kind, id, label, (candidate) => candidate.key === id),
    note,
  };
}

const interactions = [
  ["fully-versatile", "Fully Versatile Scene"],
  ["sexually-versatile", "Sexually Versatile"],
  ["orally-versatile", "Orally Versatile"],
  ["round-robin", "Round-Robin Scene"],
  ["oral-circle", "Oral Circle"],
  ["versatile-group", "Versatile Group"],
  ["balanced-orgy", "Balanced Orgy"],
  ["balanced-threesome", "Balanced Threesome"],
  ["traditional", "Traditional Scene"],
  ["center-stage", "One Vato Center Stage"],
];

const interactionDescriptions: Record<string, string> = {
  "fully-versatile":
    "Two participating vatos top and bottom each other in sex and oral.",
  "sexually-versatile":
    "Two participating vatos top and bottom each other in sex, but not oral.",
  "orally-versatile":
    "Two participating vatos top and bottom each other in oral, but not sex.",
  "round-robin": "Four or more vatos, with every pair interacting.",
  "oral-circle":
    "Three or more vatos, with every vato giving and receiving oral.",
  "versatile-group":
    "Three or more vatos, with every vato topping and bottoming.",
  "balanced-orgy":
    "Four or more vatos, each interacting with at least half of the possible partners.",
  "balanced-threesome": "Three vatos, each interacting with both partners.",
  traditional:
    "One sex-only bottom; every other vato tops sex with him, with no oral role reversal.",
  "center-stage":
    "One vato interacts with every other vato; the others interact only with him.",
};

export const insightStatsCatalog: InsightStatsDefinition[] = [
  definition("interaction"),
  definition("goat"),
  definition("outstanding-activity"),
  definition("outstanding-activity-presence"),
  definition("activity-quality"),
  definition(
    "event-report",
    "orgasm-facial-report",
    "Orgasm and Facial reports",
    (candidate) => candidate.key === "orgasm-facial-report",
    "Each variant counts top-performer events (or one when unassigned): total orgasms, regular orgasms, facials, and GOAT / Really Hot totals and subtypes. GOAT takes precedence when a marker has both quality tags; markers with the 2nd Camera tag are excluded."
  ),
  keyed(
    "orgasm-event",
    "orgasm-simultaneous",
    "Vatos nut at the same time",
    "Two or more top vatos on one non-2nd-Camera Orgasm marker, or on Orgasm markers that overlap or start within 5s."
  ),
  definition(
    "orgasm-event",
    "orgasm-repeat",
    "Repeated orgasms",
    (candidate) => candidate.key.startsWith("orgasm-repeat-"),
    "At least one vato is top on two or more non-2nd-Camera Orgasm markers."
  ),
  definition("no-orgasm"),
  definition("leaning"),
  definition("only-scene"),
  ...interactions.map(([key, label]) =>
    keyed(
      "interaction",
      `interaction-${key}`,
      label,
      interactionDescriptions[key]
    )
  ),
  ...["sex", "oral"].flatMap((activity) =>
    ["top", "bottom"].map((role) =>
      definition(
        "rare-role",
        `rare-${activity}-${role}`,
        `Rare ${activity} ${role}`,
        (candidate) => candidate.key.startsWith(`rare-${activity}-${role}-`)
      )
    )
  ),
  keyed(
    "negative-rating",
    "ugly-top",
    "Ugly Top",
    "A scene with 2–3 vatos whose Top Attractiveness Rating Advisor value is exactly 0."
  ),
  keyed(
    "negative-rating",
    "ugly-bottom",
    "Ugly Bottom",
    "A scene with 2–3 vatos whose Bottom Attractiveness Rating Advisor value is exactly 0."
  ),
  keyed(
    "negative-rating",
    "ugly-tops",
    "Ugly Tops",
    "A scene with 4+ vatos whose Group Top Attractiveness Rating Advisor value is 0 or 1."
  ),
  definition("short-outstanding"),
  definition("favorite-lineup"),
  definition("country-lineup"),
];

export const insightStatsMainCatalog = insightStatsCatalog.filter(
  (row) => !row.id.startsWith("interaction-")
);
