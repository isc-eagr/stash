import { gql, useQuery } from "@apollo/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button } from "react-bootstrap";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { ModalComponent } from "src/components/Shared/Modal";
import { RatingNumber } from "src/components/Shared/Rating/RatingNumber";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useToast } from "src/hooks/Toast";
import {
  getRatingCardClass,
  getRatingCardThresholdsForEntity,
  isRoyalSapphireSceneBonus,
  normalizeRatingCardThresholds,
} from "src/utils/ratingCardStyles_custom";
import {
  calculateRatingAdvisorOrgasmBonusCustom,
  calculateRatingAdvisorRating100Custom,
  getRatingAdvisorOrgasmBonusDescriptionCustom,
  formatRatingAdvisorContributionCustom,
  getRatingAdvisorCompletionCustom,
  getRatingAdvisorChoiceHeatLevelCustom,
  getRatingAdvisorChoiceScoreCustom,
  normalizeRatingAdvisorPersistedScoreValueCustom,
  ratingAdvisorSixLevelChoicesCustom,
  resolveRatingAdvisorScoresCustom,
  SCENE_ENERGY_WEIGHT_CUSTOM,
  SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
  SCENE_GOAT_ELEMENT_BONUS_CHOICES_CUSTOM,
  SCENE_NO_ORGASM_PENALTY_CUSTOM,
  SCENE_ORGASM_QUALITY_CHOICES_CUSTOM,
  SCENE_USABLE_FACTOR_MAX_CUSTOM,
  SCENE_USABLE_FACTOR_WEIGHT_CUSTOM,
} from "./ratingAdvisorScales_custom";
import {
  GROUP_SCENE_BONUSES_CUSTOM,
  GROUP_SCENE_ENERGY_COORDINATION_CHOICES_CUSTOM,
  GROUP_SCENE_RATING_KEYS_CUSTOM,
  GROUP_SCENE_WEIGHTS_CUSTOM,
  type SceneRatingModeCustom,
} from "./groupSceneRating_custom";
import {
  SOLO_SCENE_RATING_KEYS_CUSTOM,
  SOLO_SCENE_WEIGHTS_CUSTOM,
} from "./soloSceneRating_custom";

type AdvisorEntity = "scene" | "performer";

interface IAdvisorChoice {
  value: number;
  label: string;
  description: string;
  scoreValue?: number;
}

interface IAdvisorMetric {
  key: string;
  title: string;
  // Scene card criteria label.
  shortTitle?: string;
  max: number;
  hint: string;
  section?: "bonus" | "penalty";
  weight?: number;
  choices: IAdvisorChoice[];
}

interface IRatingSuggestion {
  rating100: number;
  tier: string;
  tierClassName: string;
}

interface IAdvisorPersistedScore {
  section?: string | null;
  key?: string | null;
  raw_value?: number | null;
}

interface IRatingAdvisorButtonProps {
  entityType: AdvisorEntity;
  entityId: string;
  sceneRatingMode?: SceneRatingModeCustom;
  rating100?: number | null;
  ratingScores?: readonly IAdvisorPersistedScore[] | null;
  onRatingSaved?: () => void | Promise<unknown>;
}

const RatingAdvisorScoresQuery = gql`
  query RatingAdvisorScores($entity_type: String!, $entity_id: ID!) {
    ratingScores(entity_type: $entity_type, entity_id: $entity_id) {
      section
      key
      raw_value
    }
    ratingOrgasmCount(entity_type: $entity_type, entity_id: $entity_id)
  }
`;

const sceneVatoAttractivenessChoices = ratingAdvisorSixLevelChoicesCustom([
  {
    label: "Not attractive",
    description: "Nel. He ain't why you're here, ni modo.",
  },
  {
    label: "Some appeal",
    description: "Not bad, pero no te prende.",
  },
  {
    label: "Decent",
    description:
      "Ahí la lleva. Cute enough, but he ain't the reason you clicked.",
  },
  {
    label: "Attractive",
    description: "Está rico. This vato makes the scene better, a huevo.",
  },
  {
    label: "Very attractive",
    description: "Qué rico, wey. Fine as hell and the reason you're watching.",
  },
  {
    label: "Perfect",
    description: "He's seriously one of the reasons you're into vatos.",
  },
]);

const sceneMetrics: IAdvisorMetric[] = [
  {
    key: "topAttractiveness",
    title: "Top(s) Attractiveness",
    shortTitle: "Top",
    max: 5,
    weight: 0.6,
    hint: "Is the activo here a papacito or nah? Rate his look in this scene, not his overall face and body ratings.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: "bottomAttractiveness",
    title: "Bottom(s) Attractiveness",
    shortTitle: "Bottom",
    max: 5,
    weight: 0.2,
    hint: "Is the pasivo a papacito or nah? Rate his look in this scene, not his overall face and body ratings.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: "chemistry",
    title: "Energy / sex quality",
    shortTitle: "Energy",
    max: 5,
    weight: SCENE_ENERGY_WEIGHT_CUSTOM,
    hint: "How hot the actual cogida feels: rhythm, reactions, chemistry, todo.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "No energy",
        description: "Pura hueva. These vatos are clocked out, wey.",
      },
      {
        label: "Serviceable",
        description: "Ahí van. They're fucking, but sin chispa.",
      },
      {
        label: "Decent",
        description: "Ahí la lleva. Some rico stretches, nada too crazy.",
      },
      {
        label: "Strong",
        description: "Good rhythm and reactions. The fucking really lands.",
      },
      {
        label: "Excellent",
        description:
          "Bien cachondos. Hot as hell, and they can't keep their hands off each other.",
      },
      {
        label: "Perfect quality",
        description:
          "Pinche perfecto. You'd watch this even if you didn't like the vatos.",
      },
    ]),
  },
  {
    key: "theme",
    title: "Uniform/setting factor",
    max: 0.5,
    section: "bonus",
    hint: "Cop, mechanic, albañil... flip it on when the fantasy makes it hotter.",
    choices: [
      {
        value: 0,
        label: "No theme bonus",
        description: "The theme ain't doing nada extra for you.",
      },
      {
        value: 0.5,
        label: "Theme present",
        description:
          "The uniform, fantasy, or setup makes this way hotter. Qué rico.",
      },
    ],
  },
  {
    key: "oralOnly",
    title: "Oral-only scene",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when it's puro eating verga, start to finish.",
    choices: [
      {
        value: 0,
        label: "Not oral-only",
        description: "There's more than mamando pito going on.",
      },
      {
        value: 0.5,
        label: "Oral-only bonus",
        description: "Mamando rifle the entire time, nothing else.",
      },
    ],
  },
  {
    key: "godTierOrgasm",
    title: "God-tier orgasm bonus",
    max: SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
    section: "bonus",
    hint: "For a nut or facial so wild it takes the scene up a whole level.",
    choices: [
      {
        value: 0,
        label: "Not god-tier",
        description: "Rico maybe, but not god-tier crazy.",
      },
      {
        value: SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
        label: "God-tier orgasms",
        description: "That nut or facial is straight-up legendary. No mames.",
      },
    ],
  },
  {
    key: "goatElement",
    title: "GOAT element",
    max: 2,
    section: "bonus",
    hint: "Pick how much one GOAT act, angle, mamada, or killer moment adds.",
    choices: SCENE_GOAT_ELEMENT_BONUS_CHOICES_CUSTOM,
  },
  {
    key: "unlikelyTop",
    title: "Unlikely top",
    max: 0.5,
    section: "bonus",
    hint: "For a vato with bottom energy who flips the script and tops.",
    choices: [
      {
        value: 0,
        label: "No bonus",
        description: "No sorpresa activo here.",
      },
      {
        value: 0.5,
        label: "Unlikely top bonus",
        description:
          "Looked like he'd be taking verga, but ended up providing it.",
      },
    ],
  },
  {
    key: "standout",
    title: "Usable factor",
    shortTitle: "Usable",
    max: SCENE_USABLE_FACTOR_MAX_CUSTOM,
    weight: SCENE_USABLE_FACTOR_WEIGHT_CUSTOM,
    hint: "How much of the scene works without skipping around.",
    choices: [
      {
        value: 0,
        label: "Mostly unusable",
        description:
          "Puro relleno. Long setup, bad positions, and dead stretches; most of it's a skip.",
      },
      {
        value: 1,
        label: "Limited use",
        description: "Algo hay. You just gotta dig for it.",
      },
      {
        value: 2,
        label: "Standard or mixed",
        description:
          "Normalito. Usable enough, or a desmadre with a few chingón stretches worth it.",
      },
      {
        value: 3,
        label: "Highly usable",
        description:
          "Most of it's jalable. Good angles, positions, and intensity.",
      },
      {
        value: 4,
        label: "Nearly unskippable",
        description:
          "You never touch the skip button. Puro usable, start to finish.",
      },
    ],
  },
  // Orgasm is always the last criterion.
  {
    key: "payoff",
    title: "Orgasm quality",
    shortTitle: "Orgasm",
    max: 4,
    weight: 0.5,
    hint: "How good the nuts and facials are.",
    choices: SCENE_ORGASM_QUALITY_CHOICES_CUSTOM,
  },
  {
    key: "noOrgasm",
    title: "No orgasm",
    max: 0,
    section: "penalty",
    hint: "Flip it on if nobody nuts or the scene cuts off early.",
    choices: [
      {
        value: 0,
        label: "Orgasm present",
        description: "Somebody delivers a real nut.",
      },
      {
        value: SCENE_NO_ORGASM_PENALTY_CUSTOM,
        label: "No orgasm penalty",
        description: "They cut away before the nut. Qué gacho.",
      },
    ],
  },
  {
    key: "production",
    title: "Production / visual quality",
    max: 0,
    section: "penalty",
    hint: "Flip it on when the camera guy or the ancient encoding ruin it.",
    choices: [
      {
        value: 0,
        label: "No penalty",
        description: "Looks fine and stays out of the way.",
      },
      {
        value: -1,
        label: "Quality works against it",
        description: "The camera guy and the ancient encoding ruined it.",
      },
    ],
  },
  {
    key: "extremelyPolished",
    title: "Extremely polished",
    max: 0,
    section: "penalty",
    hint: "Flip it on when it's so produced it feels plastic.",
    choices: [
      {
        value: 0,
        label: "No penalty",
        description: "Still feels human, spontaneous, and real.",
      },
      {
        value: -1,
        label: "Extremely polished penalty",
        description:
          "Overproduced everything: plastic vatos, fake moaning, and a manufactured look kill the realness.",
      },
    ],
  },
];

const soloSceneMetrics: IAdvisorMetric[] = [
  {
    key: SOLO_SCENE_RATING_KEYS_CUSTOM.attractiveness,
    title: "Vato Attractiveness",
    shortTitle: "Vato",
    max: 5,
    weight: SOLO_SCENE_WEIGHTS_CUSTOM.attractiveness,
    hint: "How hot the solo vato looks in this scene, from face to body to rifle. Can differ from his overall face and body ratings.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: SOLO_SCENE_RATING_KEYS_CUSTOM.performance,
    title: "Performance",
    max: 4,
    weight: SOLO_SCENE_WEIGHTS_CUSTOM.performance,
    hint: "How into it the vato really is while he's stroking it.",
    choices: [
      {
        value: 0,
        label: "Clocked out",
        description:
          "Pura hueva. He's just waiting to nut so he can cash the check.",
      },
      {
        value: 1,
        label: "Going through it",
        description: "Ahí va. Gets it done, but he wants it over with.",
      },
      {
        value: 2,
        label: "Into it",
        description: "He's enjoying that verga, no doubt.",
      },
      {
        value: 3,
        label: "Excited",
        description:
          "Bien prendido. Real reactions, and he wants to be right there.",
      },
      {
        value: 4,
        label: "Loving it",
        description: "Bien caliente and all in. He'd do this for free.",
      },
    ],
  },
  {
    ...sceneMetrics.find((metric) => metric.key === "standout")!,
    key: SOLO_SCENE_RATING_KEYS_CUSTOM.usability,
    title: "Usability",
    weight: SOLO_SCENE_WEIGHTS_CUSTOM.usability,
    hint: "How much works without skipping, angles and pacing included.",
  },
  {
    key: "orgasmBonus",
    title: "Orgasm",
    max: 1,
    section: "bonus",
    hint: "Flip it on when his nut makes the solo better.",
    choices: [
      {
        value: 0,
        label: "No orgasm bonus",
        description: "No nut worth bumping the scene for.",
      },
      {
        value: 1,
        label: "Orgasm bonus",
        description: "He drops a hot nut that makes the solo worth it.",
        scoreValue: 1,
      },
    ],
  },
  {
    key: "feetBonus",
    title: "Feet",
    max: 1,
    section: "bonus",
    hint: "Flip it on when the feet get real screen time and you're into it.",
    choices: [
      {
        value: 0,
        label: "No feet bonus",
        description: "No feet, or they ain't doing nada for you.",
      },
      {
        value: 1,
        label: "Feet bonus",
        description: "The feet get real screen time and make it hotter.",
        scoreValue: 1,
      },
    ],
  },
  {
    ...sceneMetrics.find((metric) => metric.key === "theme")!,
  },
  {
    ...sceneMetrics.find((metric) => metric.key === "goatElement")!,
  },
  sceneMetrics.find((metric) => metric.key === "noOrgasm")!,
  sceneMetrics.find((metric) => metric.key === "production")!,
  sceneMetrics.find((metric) => metric.key === "extremelyPolished")!,
];

const groupSceneMetrics: IAdvisorMetric[] = [
  {
    ...sceneMetrics.find((metric) => metric.key === "topAttractiveness")!,
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.topAttractiveness,
    title: "Top Lineup Attractiveness",
    shortTitle: "Tops",
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.topAttractiveness,
    hint: "Are the activos papacitos or nah? Rate the lineup in this scene, not their overall face and body ratings.",
  },
  {
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.energyCoordination,
    title: "Energy / coordination",
    shortTitle: "Energy",
    max: 5,
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.energyCoordination,
    hint: "How caliente it gets and whether every vato's in on it.",
    choices: ratingAdvisorSixLevelChoicesCustom(
      GROUP_SCENE_ENERGY_COORDINATION_CHOICES_CUSTOM
    ),
  },
  {
    ...sceneMetrics.find((metric) => metric.key === "standout")!,
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.usability,
    title: "Usability",
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.usability,
    hint: "How much of the orgy works without skipping around.",
  },
  // Orgasm is always the last criterion.
  {
    ...sceneMetrics.find((metric) => metric.key === "payoff")!,
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.payoff,
    title: "Orgasm Quality",
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.payoff,
  },
  {
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.bottomAttractiveness,
    title: "Attractive Bottom",
    max: GROUP_SCENE_BONUSES_CUSTOM.bottomAttractiveness,
    section: "bonus",
    hint: "Flip it on when the bottoms are fine enough to add extra heat.",
    choices: [
      {
        value: 0,
        label: "No bottom bonus",
        description: "The bottoms ain't why this scene works.",
      },
      {
        value: GROUP_SCENE_BONUSES_CUSTOM.bottomAttractiveness,
        label: "Attractive bottom bonus",
        description:
          "The bottoms are bien buenos and give the scene a nice bump.",
      },
    ],
  },
  {
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.oralOnly,
    title: "Group Oral-Only Scene",
    max: GROUP_SCENE_BONUSES_CUSTOM.oralOnly,
    section: "bonus",
    hint: "The big bonus: an entire crew, puro mamar rifle, nothing else.",
    choices: [
      {
        value: 0,
        label: "Not group oral-only",
        description: "There's more than mamadas going on.",
      },
      {
        value: GROUP_SCENE_BONUSES_CUSTOM.oralOnly,
        label: "Group oral-only bonus",
        description:
          "An entire crew of vatos mamando rifle and nothing else. Qué rico.",
      },
    ],
  },
  { ...sceneMetrics.find((metric) => metric.key === "theme")! },
  { ...sceneMetrics.find((metric) => metric.key === "godTierOrgasm")! },
  { ...sceneMetrics.find((metric) => metric.key === "goatElement")! },
  sceneMetrics.find((metric) => metric.key === "noOrgasm")!,
  sceneMetrics.find((metric) => metric.key === "production")!,
  sceneMetrics.find((metric) => metric.key === "extremelyPolished")!,
];

const performerMetrics: IAdvisorMetric[] = [
  {
    key: "face",
    title: "Face",
    max: 5,
    weight: 0.6,
    hint: "How much that face pulls you in. Just the face, nothing else.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "Not Attractive",
        description: "Nel. That face does nada for you.",
      },
      {
        label: "Some Appeal",
        description: "Tiene su chiste, but not a strong pull.",
      },
      {
        label: "Decent",
        description: "Normalito. Cute face, nothing that stops you.",
      },
      {
        label: "Attractive",
        description: "Bien guapo. That face definitely helps.",
      },
      {
        label: "Very Attractive",
        description: "Bien pinche guapo. Instant pull.",
      },
      {
        label: "Perfect",
        description:
          "That face is seriously one of the reasons you're into vatos.",
      },
    ]),
  },
  {
    key: "body",
    title: "Body",
    max: 5,
    weight: 0.6,
    hint: "How much his build, muscle, thickness, and movement hit for you.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "Not Appealing",
        description: "Nel. That body does nada for you.",
      },
      {
        label: "Some Appeal",
        description: "One nice feature, but the whole package ain't there.",
      },
      {
        label: "Decent",
        description: "Normalito. Decent build, nothing that stops you.",
      },
      {
        label: "Attractive",
        description: "Bien bueno. He looks good moving around encuerado.",
      },
      {
        label: "Very Attractive",
        description: "Bien pinche bueno. Hard to look away.",
      },
      {
        label: "Perfect",
        description:
          "That body is seriously one of the reasons you're into vatos.",
      },
    ]),
  },
  {
    key: "performance",
    title: "Sexual performance",
    shortTitle: "Sex",
    max: 5,
    weight: 0.4,
    hint: "Does he know how to fuck or nah? Reactions, moves, screen presence.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "Weak",
        description:
          "Pura hueva. Awkward, passive, or lost; he drags scenes down.",
      },
      {
        label: "Serviceable",
        description: "Ahí va. Gets it done, but you ain't looking for him.",
      },
      {
        label: "Good",
        description:
          "He knows what he's doing. Good reactions, good confidence.",
      },
      {
        label: "Strong",
        description: "Está rico. Even basic scenes hit harder with him.",
      },
      {
        label: "Excellent",
        description: "This cabrón fucks like he's getting paid double.",
      },
      {
        label: "Perfect",
        description: "No mames. If he's in it, you're watching. Period.",
      },
    ]),
  },
  {
    key: "ethnicity",
    title: "Ethnicity / racial appeal",
    shortTitle: "Race",
    max: 3,
    weight: 1 / 3,
    hint: "How much his background and skin tone hit your type. Moreno or nah?",
    choices: [
      {
        value: 0,
        label: "Negative ethnic appeal",
        description: "Asian or güero güero. Not your thing.",
      },
      {
        value: 1,
        label: "Neutral background",
        description: "White or other backgrounds. Doesn't hurt, doesn't help.",
      },
      {
        value: 2,
        label: "Partial ethnic appeal",
        description: "Ahí la lleva. Güero latino or black-white mixed.",
      },
      {
        value: 3,
        label: "Full ethnic appeal",
        description: "Latino, black, afrolatino. Moreno and exactly your type.",
      },
    ],
  },
  {
    key: "masculinity",
    title: "Masculinity",
    shortTitle: "Masc",
    max: 3,
    weight: 1 / 3,
    hint: "How much rugged, dominant, compa, blue-collar energy he gives off.",
    choices: [
      {
        value: 0,
        label: "No masculine appeal",
        description: "No masc energy for your taste, ni modo.",
      },
      {
        value: 1,
        label: "Some masculine appeal",
        description: "Algo hay. A little masc in the voice, look, or attitude.",
      },
      {
        value: 2,
        label: "Strong",
        description: "Bien macho. Albañil energy, confident and in charge.",
      },
      {
        value: 3,
        label: "Core ideal",
        description:
          "Peak vato. He's seriously one of the reasons you're into vatos.",
      },
    ],
  },
  {
    key: "consistency",
    title: "Consistency",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when he stays hot scene after scene.",
    choices: [
      {
        value: 0,
        label: "No consistency bonus",
        description: "Too hit-or-miss, or only hot that one time.",
      },
      {
        value: 0.5,
        label: "Consistent draw",
        description: "You see his name, you know it's gonna be rico.",
      },
    ],
  },
  {
    key: "dick",
    title: "Pito",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when that rifle is something special.",
    choices: [
      {
        value: 0,
        label: "No pito bonus",
        description:
          "Standard rifle. Hot because pitos are hot, but that's it.",
      },
      {
        value: 0.5,
        label: "Pito bonus",
        description: "Qué rifle. You'd watch just for that verga.",
      },
    ],
  },
  {
    key: "tattoosBonus",
    title: "Tattoos",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when the ink gives him that malandro look you like.",
    choices: [
      {
        value: 0,
        label: "Not present",
        description: "No ink, or the tattoos ain't adding nada.",
      },
      {
        value: 0.5,
        label: "Present",
        description: "The ink makes him look hotter and más malandro.",
      },
    ],
  },
  {
    key: "feminine",
    title: "Feminine",
    max: 0,
    section: "penalty",
    hint: "Flip it on when femme energy kills the appeal for you.",
    choices: [
      {
        value: 0,
        label: "No penalty",
        description: "His vibe ain't hurting the attraction.",
      },
      {
        value: -1,
        label: "Feminine penalty",
        description: "Nel. Too femme for you.",
      },
    ],
  },
];

function getMetricSection(metric: IAdvisorMetric) {
  return metric.section ?? "criterion";
}

function normalizePersistedScoreSection(section?: string | null) {
  return (section ?? "criterion").trim().toLowerCase();
}

function getTooltipMetrics(
  entityType: AdvisorEntity,
  sceneRatingMode: SceneRatingModeCustom | undefined,
  persistedScores?: readonly IAdvisorPersistedScore[] | null
) {
  if (entityType === "performer") {
    return performerMetrics;
  }

  if (sceneRatingMode === "group") {
    return groupSceneMetrics;
  }

  if (sceneRatingMode === "solo") {
    return soloSceneMetrics;
  }

  if (sceneRatingMode === "default") {
    return sceneMetrics;
  }

  const persistedKeys = new Set(
    persistedScores
      ?.filter(
        (score) => normalizePersistedScoreSection(score.section) === "criterion"
      )
      .map((score) => score.key)
  );

  if (groupSceneMetrics.some((metric) => persistedKeys.has(metric.key))) {
    return groupSceneMetrics;
  }

  if (soloSceneMetrics.some((metric) => persistedKeys.has(metric.key))) {
    return soloSceneMetrics;
  }

  return sceneMetrics;
}

// CUSTOM: scene cards draw the rubric the stored scores belong to.
export function getRatingSummaryMetricsCustom(
  entityType: AdvisorEntity,
  persistedScores?: readonly IAdvisorPersistedScore[] | null,
  sceneRatingMode?: SceneRatingModeCustom
) {
  return getTooltipMetrics(entityType, sceneRatingMode, persistedScores);
}

function getInitialScores(
  metrics: IAdvisorMetric[],
  persistedScores?: readonly IAdvisorPersistedScore[] | null
) {
  return metrics.reduce<Record<string, number | undefined>>((ret, metric) => {
    const persistedScore = persistedScores?.find(
      (score) =>
        score.key === metric.key &&
        normalizePersistedScoreSection(score.section) ===
          getMetricSection(metric)
    );
    ret[metric.key] = persistedScore
      ? normalizeRatingAdvisorPersistedScoreValueCustom(
          metric,
          persistedScore.raw_value
        )
      : undefined;
    return ret;
  }, {});
}

function getChoiceScore(metric: IAdvisorMetric, score?: number) {
  if (score === undefined) {
    return 0;
  }

  return getRatingAdvisorChoiceScoreCustom(metric, score);
}

function getMetricMaxScore(metric: IAdvisorMetric) {
  return metric.max * (metric.weight ?? 1);
}

function formatRatingPointNumber(value: number) {
  return Math.round(value * 10).toString();
}

function formatMetricContribution(metric: IAdvisorMetric, score?: number) {
  if (score === undefined) {
    return "Not rated";
  }

  const value = getChoiceScore(metric, score);

  if (metric.section === "bonus" || metric.section === "penalty") {
    return formatRatingAdvisorContributionCustom(value);
  }

  const maxValue = getMetricMaxScore(metric);
  return `${formatRatingPointNumber(value)} / ${formatRatingPointNumber(
    maxValue
  )}`;
}

function getSceneSuggestion(
  total: number,
  thresholds: ReturnType<typeof normalizeRatingCardThresholds>,
  royalSapphireOverride = false
): IRatingSuggestion {
  const rating100 = Math.round(total * 10);

  if (royalSapphireOverride || rating100 >= thresholds.royalSapphire) {
    return {
      rating100,
      tier: "Elite / Royal Sapphire",
      tierClassName: "royal-sapphire",
    };
  }
  if (rating100 >= thresholds.gold) {
    return { rating100, tier: "Gold", tierClassName: "gold" };
  }
  if (rating100 >= thresholds.silver) {
    return { rating100, tier: "Silver", tierClassName: "silver" };
  }
  if (rating100 >= thresholds.bronze) {
    return { rating100, tier: "Bronze", tierClassName: "bronze" };
  }

  return { rating100, tier: "Plain", tierClassName: "plain" };
}

const RatingAdvisorModal: React.FC<{
  entityType: AdvisorEntity;
  entityId: string;
  sceneRatingMode?: SceneRatingModeCustom;
  rating100?: number | null;
  ratingScores?: readonly IAdvisorPersistedScore[] | null;
  onRatingSaved?: () => void | Promise<unknown>;
  onClose: () => void;
}> = ({
  entityType,
  entityId,
  sceneRatingMode = "default",
  rating100,
  ratingScores,
  onRatingSaved,
  onClose,
}) => {
  const { configuration } = useConfigurationContext();
  const Toast = useToast();
  const [setRatingScore] = GQL.useRatingScoreSetMutation();
  const [deleteRatingScore] = GQL.useRatingScoreDeleteMutation();
  const [resetRatingScores] = GQL.useRatingScoreResetMutation();
  const metrics =
    entityType === "scene" && sceneRatingMode === "group"
      ? groupSceneMetrics
      : entityType === "scene" && sceneRatingMode === "solo"
      ? soloSceneMetrics
      : entityType === "scene"
      ? sceneMetrics
      : performerMetrics;
  const {
    data: advisorScoresData,
    loading: advisorScoresLoading,
    error: advisorScoresError,
  } = useQuery<{
    ratingScores: IAdvisorPersistedScore[];
    ratingOrgasmCount: number;
  }>(RatingAdvisorScoresQuery, {
    variables: { entity_type: entityType, entity_id: entityId },
    fetchPolicy: "cache-and-network",
  });
  const thresholds = getRatingCardThresholdsForEntity(
    configuration?.ui?.ratingCardThresholds,
    entityType
  );
  const [scores, setScores] = useState(() =>
    getInitialScores(metrics, ratingScores)
  );
  const [authoritativeScores, setAuthoritativeScores] = useState<
    readonly IAdvisorPersistedScore[] | undefined
  >();
  const [confirmedRating100, setConfirmedRating100] = useState<
    number | undefined
  >(rating100 ?? undefined);
  const [resetting, setResetting] = useState(false);
  const [savingMetricKeys, setSavingMetricKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [previewScores, setPreviewScores] = useState<
    Record<string, number | undefined>
  >({});
  const savingMetricKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (savingMetricKeysRef.current.size === 0) {
      setConfirmedRating100(rating100 ?? undefined);
    }
  }, [rating100]);

  useEffect(() => {
    const incomingScores = getInitialScores(
      metrics,
      resolveRatingAdvisorScoresCustom(
        authoritativeScores,
        advisorScoresData?.ratingScores,
        ratingScores
      )
    );
    setScores((current) => {
      for (const key of savingMetricKeysRef.current) {
        incomingScores[key] = current[key];
      }
      return incomingScores;
    });
  }, [
    advisorScoresData?.ratingScores,
    authoritativeScores,
    metrics,
    ratingScores,
  ]);

  const orgasmCount = advisorScoresData?.ratingOrgasmCount;
  const orgasmBonus = calculateRatingAdvisorOrgasmBonusCustom(
    entityType,
    orgasmCount ?? 0
  );
  const coreMetrics = metrics.filter((metric) => metric.section === undefined);
  const bonusMetrics = metrics.filter((metric) => metric.section === "bonus");
  const penaltyMetrics = metrics.filter(
    (metric) => metric.section === "penalty"
  );
  const coreCompletion = getRatingAdvisorCompletionCustom(
    coreMetrics.map((metric) => metric.key),
    scores
  );
  const ratedCoreCount = coreCompletion.rated;
  const allCoreRated = coreCompletion.complete;
  const completionPercent = coreCompletion.percent;
  const scoreSubtotal = useMemo(
    () =>
      metrics.reduce(
        (sum, metric) => sum + getChoiceScore(metric, scores[metric.key]),
        0
      ),
    [metrics, scores]
  );
  const calculatedRating100 = calculateRatingAdvisorRating100Custom(
    scoreSubtotal,
    orgasmBonus
  );
  const displayRating100 =
    savingMetricKeys.size === 0 && confirmedRating100 !== undefined
      ? confirmedRating100
      : calculatedRating100;
  const ratingUnavailable =
    confirmedRating100 === undefined &&
    !advisorScoresData &&
    (advisorScoresLoading || !!advisorScoresError);
  const sceneHasRoyalSapphireBonus =
    entityType === "scene" &&
    (isRoyalSapphireSceneBonus("goatElement", scores.goatElement) ||
      isRoyalSapphireSceneBonus("godTierOrgasm", scores.godTierOrgasm));
  const suggestion = getSceneSuggestion(
    displayRating100 / 10,
    thresholds,
    sceneHasRoyalSapphireBonus
  );
  const ratingTierClass = getRatingCardClass({
    rating: suggestion.rating100,
    theme: configuration?.ui?.ratingCardTheme,
    thresholds: configuration?.ui?.ratingCardThresholds,
    thresholdEntity: entityType,
    sceneHasRoyalSapphireBonus,
  });
  const advisorTitle =
    entityType === "performer"
      ? "Vato rating"
      : sceneRatingMode === "group"
      ? "Group scene rating"
      : sceneRatingMode === "solo"
      ? "Solo scene rating"
      : "Scene rating";

  async function setScore(metric: IAdvisorMetric, normalizedValue: number) {
    const previousValue = scores[metric.key];
    const previousConfirmedRating100 = confirmedRating100;
    const selectedChoice = metric.choices.find(
      (choice) => choice.value === normalizedValue
    );
    const weightedValue = getChoiceScore(metric, normalizedValue);

    setScores((current) => ({
      ...current,
      [metric.key]: normalizedValue,
    }));
    setConfirmedRating100(undefined);
    setSavingMetricKeys((current) => {
      const next = new Set(current);
      next.add(metric.key);
      savingMetricKeysRef.current = next;
      return next;
    });

    try {
      const result = await setRatingScore({
        variables: {
          input: {
            entity_type: entityType,
            entity_id: entityId,
            section: getMetricSection(metric),
            key: metric.key,
            raw_value: normalizedValue,
            weighted_value: weightedValue,
            label: selectedChoice?.label,
          },
        },
      });
      const update = result.data?.ratingScoreSet;
      if (update) {
        setConfirmedRating100(update.rating100);
        setAuthoritativeScores(update.scores);
      }
      await onRatingSaved?.();
    } catch (e) {
      setScores((current) => ({
        ...current,
        [metric.key]: previousValue,
      }));
      setConfirmedRating100(previousConfirmedRating100);
      Toast.error(e);
    } finally {
      setSavingMetricKeys((current) => {
        const next = new Set(current);
        next.delete(metric.key);
        savingMetricKeysRef.current = next;
        return next;
      });
    }
  }

  async function deleteScore(metric: IAdvisorMetric) {
    const previousValue = scores[metric.key];
    const previousConfirmedRating100 = confirmedRating100;
    setScores((current) => ({ ...current, [metric.key]: undefined }));
    setConfirmedRating100(undefined);
    setSavingMetricKeys((current) => {
      const next = new Set(current);
      next.add(metric.key);
      savingMetricKeysRef.current = next;
      return next;
    });

    try {
      const result = await deleteRatingScore({
        variables: {
          input: {
            entity_type: entityType,
            entity_id: entityId,
            section: getMetricSection(metric),
            key: metric.key,
          },
        },
      });
      const update = result.data?.ratingScoreDelete;
      if (update) {
        setConfirmedRating100(update.rating100);
        setAuthoritativeScores(update.scores);
      }
      await onRatingSaved?.();
    } catch (e) {
      setScores((current) => ({
        ...current,
        [metric.key]: previousValue,
      }));
      setConfirmedRating100(previousConfirmedRating100);
      Toast.error(e);
    } finally {
      setSavingMetricKeys((current) => {
        const next = new Set(current);
        next.delete(metric.key);
        savingMetricKeysRef.current = next;
        return next;
      });
    }
  }

  async function resetAdvisor() {
    if (
      !window.confirm(
        entityType === "scene"
          ? "Wipe every answer and remove this scene's rating?"
          : "Wipe every answer? His overall rating stays put."
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      const result = await resetRatingScores({
        variables: { entity_type: entityType, entity_id: entityId },
      });
      const update = result.data?.ratingScoreReset;
      setScores(getInitialScores(metrics));
      setPreviewScores({});
      setAuthoritativeScores(update?.scores ?? []);
      setConfirmedRating100(update?.rating100 ?? rating100 ?? 0);
      await onRatingSaved?.();
    } catch (e) {
      Toast.error(e);
    } finally {
      setResetting(false);
    }
  }

  function renderMetric(metric: IAdvisorMetric) {
    const score = scores[metric.key];
    const selected = metric.choices.find((choice) => choice.value === score);
    const previewScore = previewScores[metric.key];
    const previewed = metric.choices.find(
      (choice) => choice.value === previewScore
    );
    const displayedChoice = previewed ?? selected;
    const saving = savingMetricKeys.has(metric.key);
    const titleID = `rating-advisor-${metric.key}-title`;
    const hintID = `rating-advisor-${metric.key}-hint`;

    return (
      <section className="rating-advisor-metric" key={metric.key}>
        <div className="rating-advisor-metric-header">
          <div>
            <h5 id={titleID}>{metric.title}</h5>
            <p id={hintID}>{metric.hint}</p>
          </div>
          <div className="rating-advisor-metric-status" aria-live="polite">
            {(saving || score === undefined) && (
              <span>{saving ? "Saving…" : "Not rated"}</span>
            )}
            <Badge variant={score === undefined ? "secondary" : "primary"}>
              {formatMetricContribution(metric, score)}
            </Badge>
          </div>
        </div>
        <div
          aria-describedby={hintID}
          aria-labelledby={titleID}
          className="rating-advisor-choice-list"
          role="group"
        >
          {metric.choices.map((choice, choiceIndex) => (
            <Button
              aria-pressed={choice.value === score}
              className="rating-advisor-choice"
              data-rating-level={
                choice.value === score
                  ? getRatingAdvisorChoiceHeatLevelCustom(
                      choiceIndex,
                      metric.choices.length
                    )
                  : undefined
              }
              disabled={saving}
              key={choice.value}
              onBlur={() =>
                setPreviewScores((current) => ({
                  ...current,
                  [metric.key]: undefined,
                }))
              }
              onClick={() => void setScore(metric, choice.value)}
              onFocus={() =>
                setPreviewScores((current) => ({
                  ...current,
                  [metric.key]: choice.value,
                }))
              }
              onMouseEnter={() =>
                setPreviewScores((current) => ({
                  ...current,
                  [metric.key]: choice.value,
                }))
              }
              onMouseLeave={(event) => {
                if (event.currentTarget !== document.activeElement) {
                  setPreviewScores((current) => ({
                    ...current,
                    [metric.key]: undefined,
                  }));
                }
              }}
              size="sm"
              type="button"
              variant={choice.value === score ? "primary" : "outline-secondary"}
            >
              <strong>{choice.value}</strong>
              <span>{choice.label}</span>
            </Button>
          ))}
        </div>
        <div className="rating-advisor-selected" aria-live="polite">
          {displayedChoice ? (
            <>
              <strong>{displayedChoice.label}</strong>
              <div className="rating-advisor-selected-description">
                <span>{displayedChoice.description}</span>
                {selected && (
                  <Button
                    disabled={saving}
                    onClick={() => void deleteScore(metric)}
                    size="sm"
                    type="button"
                    variant="outline-secondary"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </>
          ) : (
            <span>Pick whichever fits, wey.</span>
          )}
        </div>
      </section>
    );
  }

  function renderAdjustmentMetric(metric: IAdvisorMetric) {
    const score = scores[metric.key];
    const saving = savingMetricKeys.has(metric.key);
    const activeChoice = metric.choices.find(
      (choice) => getChoiceScore(metric, choice.value) !== 0
    );
    const inactiveChoice = metric.choices.find(
      (choice) => getChoiceScore(metric, choice.value) === 0
    );
    const activeChoiceCount = metric.choices.filter(
      (choice) => getChoiceScore(metric, choice.value) !== 0
    ).length;
    const active = score !== undefined && getChoiceScore(metric, score) !== 0;
    const activeBonus = active && metric.section === "bonus";

    if (!activeChoice || !inactiveChoice || activeChoiceCount > 1) {
      return renderMetric(metric);
    }

    return (
      <section
        className={`rating-advisor-adjustment${
          activeBonus ? " rating-advisor-adjustment-bonus-active" : ""
        }`}
        key={metric.key}
      >
        <div>
          <div className="rating-advisor-adjustment-title">
            <strong>{metric.title}</strong>
            {active && (
              <Badge variant={activeBonus ? "danger" : "primary"}>
                {formatMetricContribution(metric, score)}
              </Badge>
            )}
          </div>
          <span>{active ? activeChoice.description : metric.hint}</span>
        </div>
        <div className="rating-advisor-adjustment-action">
          {saving && <span aria-live="polite">Saving…</span>}
          <Button
            aria-checked={active}
            aria-label={`${metric.title}: ${active ? "on" : "off"}`}
            disabled={saving}
            onClick={() =>
              void (active
                ? deleteScore(metric)
                : setScore(metric, activeChoice.value))
            }
            role="switch"
            size="sm"
            variant={
              activeBonus ? "danger" : active ? "primary" : "outline-secondary"
            }
          >
            {active ? "Enabled" : "Enable"}
          </Button>
        </div>
      </section>
    );
  }

  function renderOrgasmBonus() {
    const active = orgasmBonus !== 0;

    return (
      <section
        className={`rating-advisor-adjustment rating-advisor-adjustment-readonly${
          active ? " rating-advisor-adjustment-bonus-active" : ""
        }`}
        key="orgasm-count-bonus"
      >
        <div>
          <div className="rating-advisor-adjustment-title">
            <strong>O Count bonus</strong>
            <Badge variant={active ? "danger" : "secondary"}>
              {orgasmCount === undefined
                ? "—"
                : formatRatingAdvisorContributionCustom(orgasmBonus / 10)}
            </Badge>
          </div>
          <span>
            {getRatingAdvisorOrgasmBonusDescriptionCustom(entityType)}
          </span>
        </div>
        {advisorScoresLoading && orgasmCount === undefined ? (
          <Badge variant="secondary">Loading…</Badge>
        ) : advisorScoresError && orgasmCount === undefined ? (
          <Badge variant="secondary">Unavailable</Badge>
        ) : (
          <Badge variant={active ? "danger" : "secondary"}>
            {orgasmCount ?? 0} recorded
          </Badge>
        )}
      </section>
    );
  }

  return (
    <ModalComponent
      show
      onHide={onClose}
      header={advisorTitle}
      icon={faWandMagicSparkles}
      closeButton
      accept={{ onClick: onClose, text: "Close" }}
      modalProps={{ size: "xl", keyboard: true }}
      dialogClassName="rating-advisor-dialog"
    >
      <div className={`rating-advisor-summary ${ratingTierClass}`}>
        <div className="rating-advisor-score-summary">
          <span>Rating</span>
          <strong>{ratingUnavailable ? "—" : suggestion.rating100}</strong>
          {suggestion.tier !== "Plain" && (
            <Badge variant="secondary">{suggestion.tier}</Badge>
          )}
        </div>
        <div className="rating-advisor-completion">
          <div>
            <span>
              {ratedCoreCount} of {coreMetrics.length} rated
            </span>
          </div>
          <div
            aria-label={`${ratedCoreCount} of ${coreMetrics.length} criteria rated`}
            aria-valuemax={coreMetrics.length}
            aria-valuemin={0}
            aria-valuenow={ratedCoreCount}
            className="rating-advisor-progress"
            role="progressbar"
          >
            <span style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
        {savingMetricKeys.size > 0 && (
          <div className="rating-advisor-save-status" aria-live="polite">
            {`Saving ${savingMetricKeys.size} change${
              savingMetricKeys.size === 1 ? "" : "s"
            }…`}
          </div>
        )}
        {advisorScoresError && (
          <div className="rating-advisor-save-status" role="alert">
            Couldn&apos;t load the auto bonus data. Your saved answers are fine.
          </div>
        )}
      </div>
      <div
        className={`rating-advisor-note-row${
          allCoreRated ? "" : " rating-advisor-note-row-reset-only"
        }`}
      >
        {allCoreRated && (
          <p className="rating-advisor-note">
            Core rating done, ese. Bonuses and penalties are optional.
          </p>
        )}
        <Button
          disabled={resetting || savingMetricKeys.size > 0}
          onClick={() => void resetAdvisor()}
          size="sm"
          variant="outline-danger"
        >
          {resetting ? "Resetting…" : "Reset advisor"}
        </Button>
      </div>
      <section
        aria-label="Rating criteria"
        className="rating-advisor-section rating-advisor-section-core"
      >
        <div className="rating-advisor-core-grid">
          {coreMetrics.map(renderMetric)}
        </div>
      </section>
      <section
        aria-labelledby="rating-advisor-bonus-title"
        className="rating-advisor-section rating-advisor-section-bonuses"
      >
        <div className="rating-advisor-section-heading">
          <div>
            <h4 id="rating-advisor-bonus-title">Bonuses</h4>
            <span>Only flip on what really makes it hotter.</span>
          </div>
        </div>
        <div className="rating-advisor-adjustment-grid">
          {renderOrgasmBonus()}
          {bonusMetrics.map(renderAdjustmentMetric)}
        </div>
      </section>
      {penaltyMetrics.length > 0 && (
        <section
          aria-labelledby="rating-advisor-penalty-title"
          className="rating-advisor-section rating-advisor-section-penalties"
        >
          <div className="rating-advisor-section-heading">
            <div>
              <h4 id="rating-advisor-penalty-title">Penalties</h4>
              <span>
                {entityType === "performer"
                  ? "Flip on whatever's dragging the vato down."
                  : "Flip on whatever's dragging the scene down."}
              </span>
            </div>
          </div>
          <div className="rating-advisor-adjustment-grid">
            {penaltyMetrics.map(renderAdjustmentMetric)}
          </div>
        </section>
      )}
    </ModalComponent>
  );
};

export const RatingAdvisorButton: React.FC<IRatingAdvisorButtonProps> = ({
  entityType,
  entityId,
  sceneRatingMode,
  rating100,
  ratingScores,
  onRatingSaved,
}) => {
  const [showAdvisor, setShowAdvisor] = useState(false);

  // CUSTOM: rating criteria strips replace the old hover summary.
  return (
    <>
      <Button
        aria-label="Open rating system"
        className="rating-advisor-button"
        onClick={() => setShowAdvisor(true)}
        variant="secondary"
      >
        <RatingNumber value={rating100 ?? null} disabled withoutContext />
      </Button>
      {showAdvisor && (
        <RatingAdvisorModal
          entityType={entityType}
          entityId={entityId}
          sceneRatingMode={sceneRatingMode}
          rating100={rating100}
          ratingScores={ratingScores}
          onRatingSaved={onRatingSaved}
          onClose={() => setShowAdvisor(false)}
        />
      )}
    </>
  );
};
