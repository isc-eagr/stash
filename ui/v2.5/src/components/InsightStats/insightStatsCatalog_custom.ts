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
  "rare-role": "rare",
  "negative-rating": "negative",
  "favorite-lineup": "lineup",
  "country-lineup": "lineup",
  filler: "negative",
  lackluster: "negative",
  "few-highlights": "negative",
  "everybody-nuts": "event",
  feet: "tag",
  tag: "tag",
};

export function insightStatsTone(kind: SceneCardInsightCandidateKind) {
  return insightStatsTones[kind];
}

export const insightThresholdLabels: Record<
  SceneCardInsightThresholdKey,
  string
> = {
  visibleInsightLimit: "Visible chips per card",
  goodOutstandingPercent: "Good: minimum Outstanding % of activity",
  greatOutstandingPercent: "Great: minimum Outstanding % of activity",
  amazingOutstandingPercent: "Amazing: minimum Outstanding % of activity",
  nearPerfectOutstandingPercent:
    "Near-perfect: minimum Outstanding % of activity",
  rareRoleMaximumPercent: "Rare role: maximum % of role history",
  fewHighlightsMaxEpisodes: "Few highlights: maximum episodes",
  fewHighlightsMaxPercent: "Few highlights: maximum % of scene",
  fillerTotalPercent: "Lots of filler: above % of scene",
  lacklusterNegativePercent: "Lackluster: above negative % of activity",
  lacklusterOutstandingSuppressPercent: "Lackluster: suppress at Outstanding %",
  lacklusterNonOutstandingPercent: "Lackluster: minimum non-Outstanding %",
  tagGoodAmountMinPercent: "Good amount of tags: minimum % of scene",
  tagLotsMinPercent: "Lots of tags: minimum % of scene",
  tagEyeCanSeeMinPercent: "As far as the eye can see: minimum % of scene",
  leaningBalanceTolerancePercent: "Balanced: maximum sex/oral difference (pp)",
  leaningMinoritySomePercent: "Some minority activity: minimum % of sex + oral",
  leaningMinorityGoodAmountPercent:
    "Good amount of minority: minimum % of sex + oral",
  leaningMinorityALotPercent: "A lot of minority: minimum % of sex + oral",
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
    note: "Configured Orgasm markers, excluding 2nd Camera; detects shared and repeated top assignments.",
    thresholds: [],
  },
  "outstanding-activity": {
    label: "Common tag combinations",
    note: "Some / Good amount / Lots / As far as the eye can see. Reports up to two common tags.",
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
    note: "Outstanding share of each activity. Combined chips also count in their individual quality rows.",
    thresholds: [
      "goodOutstandingPercent",
      "greatOutstandingPercent",
      "amazingOutstandingPercent",
      "nearPerfectOutstandingPercent",
    ],
  },
  leaning: {
    label: "Activity balance",
    note: "Sex versus oral duration, with the engine’s minimum evidence rules.",
    thresholds: [
      "leaningBalanceTolerancePercent",
      "leaningMinoritySomePercent",
      "leaningMinorityGoodAmountPercent",
      "leaningMinorityALotPercent",
    ],
  },
  "no-orgasm": {
    label: "No Orgasm",
    note: "No non-2nd-Camera marker has a configured Orgasm or Facial tag.",
    thresholds: [],
  },
  interaction: {
    label: "Interaction patterns",
    note: "Role assignments create the interaction graph; each chip uses its named pattern.",
    thresholds: [],
  },
  "rare-role": {
    label: "Rare roles",
    note: "Library-wide performer history; requires at least five role scenes.",
    thresholds: ["rareRoleMaximumPercent"],
  },
  "negative-rating": {
    label: "Rating Advisor warnings",
    note: "Saved scene Rating Advisor values trigger the matching warning.",
    thresholds: [],
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
  filler: {
    label: "Lots of filler",
    note: "Unmarked plus negative duration. Suppressed when a Lackluster chip applies.",
    thresholds: [
      "fillerTotalPercent",
      "lacklusterNegativePercent",
      "lacklusterOutstandingSuppressPercent",
      "lacklusterNonOutstandingPercent",
    ],
  },
  lackluster: {
    label: "Lackluster activity",
    note: "Negative / non-Outstanding share of activity, with Outstanding suppression.",
    thresholds: [
      "lacklusterNegativePercent",
      "lacklusterOutstandingSuppressPercent",
      "lacklusterNonOutstandingPercent",
    ],
  },
  "few-highlights": {
    label: "Few highlights",
    note: "Both the episode and scene-percentage limits must be met.",
    thresholds: ["fewHighlightsMaxEpisodes", "fewHighlightsMaxPercent"],
  },
  "everybody-nuts": {
    label: "Everybody Nuts",
    note: "Disabled in the current engine.",
    thresholds: [],
  },
  feet: {
    label: "Feet",
    note: "At least one non-2nd-Camera marker has the configured Feet tag.",
    thresholds: [],
  },
  tag: {
    label: "Legacy tag chip",
    note: "Reserved kind; the current engine uses common / uncommon tag reports.",
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
  "fully-versatile": "Two vatos top and bottom each other in sex and oral.",
  "sexually-versatile":
    "Two vatos top and bottom each other in sex, but not oral.",
  "orally-versatile":
    "Two vatos top and bottom each other in oral, but not sex.",
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
  ...["sex", "oral", "solo"].flatMap((activity) =>
    ["Good", "Great", "Amazing", "Near-perfect"].map((level) => {
      const label = `${level} ${activity}`;
      return definition(
        "activity-quality",
        `quality-${label}`,
        label,
        (candidate) =>
          candidate.kind === "activity-quality" &&
          candidate.label.split(" and ").includes(label)
      );
    })
  ),
  keyed(
    "event-report",
    "orgasm-report",
    "Orgasm reports",
    "Non-Facial Orgasm markers, excluding 2nd Camera; each top performer counts once, and unassigned markers count once. GOAT and Really Hot markers are highlighted."
  ),
  keyed(
    "event-report",
    "facial-report",
    "Facial reports",
    "Facial markers, excluding 2nd Camera; each top performer counts once, and unassigned markers count once. GOAT and Really Hot markers are highlighted."
  ),
  keyed(
    "orgasm-event",
    "orgasm-simultaneous",
    "Vatos nut at the same time",
    "At least one non-2nd-Camera Orgasm marker has two or more top performers."
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
  definition(
    "leaning",
    "balanced",
    "Balanced Scene",
    (candidate) => candidate.label === "Balanced Scene"
  ),
  ...["Sex", "Oral"].flatMap((activity) =>
    ["minimal", "some", "a good amount of", "a lot of"].map((amount) => {
      const label = `${activity} Leaning Scene with ${amount} ${
        activity === "Sex" ? "oral" : "sex"
      }`;
      return definition(
        "leaning",
        `leaning-${activity}-${amount}`,
        label,
        (candidate) => candidate.kind === "leaning" && candidate.label === label
      );
    })
  ),
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
  definition("favorite-lineup"),
  definition("country-lineup"),
  ...["sex", "oral"].map((activity) =>
    keyed("lackluster", `lackluster-${activity}`, `Lackluster ${activity}`)
  ),
  definition("filler"),
  definition("few-highlights"),
  definition("feet"),
  definition("everybody-nuts"),
  definition("tag"),
];

export const insightStatsMainCatalog = insightStatsCatalog.filter(
  (row) =>
    !row.id.startsWith("quality-") &&
    !row.id.startsWith("leaning-") &&
    row.id !== "balanced" &&
    !row.id.startsWith("interaction-")
);
