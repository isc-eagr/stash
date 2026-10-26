import { useConfirmActionCustom } from "./useConfirmAction_custom";
import { gql, useQuery } from "@apollo/client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { ModalComponent } from "src/components/Shared/Modal";
import { RatingNumber } from "src/components/Shared/Rating/RatingNumber";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useToast } from "src/hooks/Toast";
import {
  getRatingCardThresholdsForEntity,
  isRoyalSapphireSceneBonus,
} from "src/utils/ratingCardStyles_custom";
import {
  calculateRatingAdvisorOrgasmBonusCustom,
  calculateRatingAdvisorRating100Custom,
  getRatingAdvisorAdjustmentTooltipLabelCustom,
  getRatingAdvisorOrgasmBonusDescriptionCustom,
  formatRatingAdvisorContributionCustom,
  getRatingAdvisorCompletionCustom,
  getRatingAdvisorChoiceHeatLevelCustom,
  getRatingAdvisorChoiceScoreCustom,
  getRatingAdvisorTierCustom,
  getRatingAdvisorTierLadderCustom,
  normalizeRatingAdvisorPersistedScoreValueCustom,
  ratingAdvisorSixLevelChoicesCustom,
  resolveRatingAdvisorScoresCustom,
  type RatingAdvisorTierCustom,
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
    description: "Nel. He ain't why you're here.",
  },
  {
    label: "Some appeal",
    description: "He has a little something going on, but it's barely there.",
  },
  {
    label: "Decent",
    description: "Cute enough, but he ain't the reason you clicked.",
  },
  {
    label: "Attractive",
    description:
      "This vato is definitely attractive and makes the scene better.",
  },
  {
    label: "Very attractive",
    description: "Firme as hell. Something about him strongly pulls you in.",
  },
  {
    label: "Perfect",
    description:
      "Everything you've ever wanted in a vato. The face, the body, the verga, the way he moves, the way he talks. Vatos like him are the reason you're into vatos.",
  },
]);

const sceneMetrics: IAdvisorMetric[] = [
  {
    key: "topAttractiveness",
    title: "Top(s) Attractiveness",
    shortTitle: "Top",
    max: 5,
    weight: 0.6,
    hint: "Is the activo here hot or nah? Rate his look in this scene, not his overall face and body ratings.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: "bottomAttractiveness",
    title: "Bottom(s) Attractiveness",
    shortTitle: "Bottom",
    max: 5,
    weight: 0.2,
    hint: "Is the pasivo hot or nah? Rate his look in this scene, not his overall face and body ratings.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: "chemistry",
    title: "Energy / sex quality",
    shortTitle: "Energy",
    max: 5,
    weight: SCENE_ENERGY_WEIGHT_CUSTOM,
    hint: "How hot the actual action feels: rhythm, reactions, chemistry, todo.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "No energy",
        description:
          "These vatos are clocked out, uncomfortable, or look like they don't wanna be there.",
      },
      {
        label: "Serviceable",
        description: "They're fucking, but sin chispa.",
      },
      {
        label: "Decent",
        description: "Some firme stretches, nothing too crazy.",
      },
      {
        label: "Strong",
        description: "Good rhythm and reactions. The action really lands.",
      },
      {
        label: "Excellent",
        description: "Hot as hell, these ñeros know what they're doing.",
      },
      {
        label: "Perfect quality",
        description:
          "The action is so perfect and hot you'd watch this even if you didn't like the vatos.",
      },
    ]),
  },
  {
    key: "theme",
    title: "Uniform/setting factor",
    max: 0.5,
    section: "bonus",
    hint: "Cop, soldado, mechanic, albañil... flip it on when the fantasy makes it hotter.",
    choices: [
      {
        value: 0,
        label: "No theme bonus",
        description:
          "No specific theme, or it's there but in a very minor way, or there is a theme but doesn't do anything for you.",
      },
      {
        value: 0.5,
        label: "Theme present",
        description:
          "These papis are dressed up as cop, soldado, mechanic, albañil, or any other really firme uniform.",
      },
    ],
  },
  {
    key: "oralOnly",
    title: "Oral-only scene",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when it's puro mamar rifle, start to finish.",
    choices: [
      {
        value: 0,
        label: "Not oral-only",
        description: "There's more than mamar rifle going on.",
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
    title: "God-tier nut bonus",
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
        label: "God-tier nuts",
        description:
          "Legendary. More mecos, with more force, than you knew was real. The verga pulsing, the vato shaking through all of it, the whole screen dripping. No mames.",
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
        description:
          "The top and bottom are exactly who you'd have expected before clicking.",
      },
      {
        value: 0.5,
        label: "Unlikely top bonus",
        description:
          "Looked like a vato would be taking verga, but he ended up providing it.",
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
          "Puro relleno. Long setup, bad positions, tragic angles, and dead stretches. Most of it's a skip.",
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
          "Normalito. Usable enough, or a few chingón stretches worth it.",
      },
      {
        value: 3,
        label: "Highly usable",
        description:
          "Most of it is worth it. Good angles, positions, camera work, and intensity.",
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
    title: "Nut quality",
    shortTitle: "Nut",
    max: 4,
    weight: 0.5,
    hint: "How good the nuts and facials are.",
    choices: SCENE_ORGASM_QUALITY_CHOICES_CUSTOM,
  },
  {
    key: "noOrgasm",
    title: "No nut",
    max: 0,
    section: "penalty",
    hint: "Flip it on if nobody nuts or the scene cuts off early.",
    choices: [
      {
        value: 0,
        label: "Nut present",
        description: "Somebody delivers a real nut.",
      },
      {
        value: SCENE_NO_ORGASM_PENALTY_CUSTOM,
        label: "No nut penalty",
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
        description: "Mostly looks fine.",
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
        description: "Still feels human and real.",
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
        description: "He's enjoying stroking his verga, no doubt.",
      },
      {
        value: 3,
        label: "Excited",
        description: "This ñero anda caliente and it shows.",
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
    title: "Nut",
    max: 1,
    section: "bonus",
    hint: "Flip it on when his nut makes the solo better.",
    choices: [
      {
        value: 0,
        label: "No nut bonus",
        description: "No nut worth bumping the scene for.",
      },
      {
        value: 1,
        label: "Nut bonus",
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
    hint: "Flip it on when the patotas get real screen time and you're into it.",
    choices: [
      {
        value: 0,
        label: "No feet bonus",
        description: "No patas, or they ain't doing nada for you.",
      },
      {
        value: 1,
        label: "Feet bonus",
        description:
          "The patotas are delicious and masculine, and they get real screen time.",
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
    hint: "Are the activos hot or nah? Rate the lineup in this scene, not their overall face and body ratings.",
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
    hint: "How much of the action works without skipping around.",
  },
  // Orgasm is always the last criterion.
  {
    ...sceneMetrics.find((metric) => metric.key === "payoff")!,
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.payoff,
    title: "Nut Quality",
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.payoff,
  },
  {
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.bottomAttractiveness,
    title: "Attractive Bottom",
    max: GROUP_SCENE_BONUSES_CUSTOM.bottomAttractiveness,
    section: "bonus",
    hint: "Flip it on when the pasivos are fine enough to add extra heat.",
    choices: [
      {
        value: 0,
        label: "No bottom bonus",
        description: "The pasivos ain't why this scene works.",
      },
      {
        value: GROUP_SCENE_BONUSES_CUSTOM.bottomAttractiveness,
        label: "Attractive bottom bonus",
        description: "The pasivos are firme and give the scene a nice bump.",
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
        description: "There's more than mamar rifle going on.",
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
    hint: "How much that face pulls you in.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "Not Attractive",
        description: "Nel. That face does nada for you.",
      },
      {
        label: "Some Appeal",
        description: "Ahí la lleva, but not a strong pull.",
      },
      {
        label: "Decent",
        description: "Normalito. Cute face.",
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
        description: "No mames. This ñero was born for fucking.",
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
        description:
          "Masculine appeal. Something about the way this ñero moves. Confident, in charge, deep voice.",
      },
      {
        value: 3,
        label: "Core ideal",
        description:
          "Peak masculine appeal. Looking like a chaka straight out of Ecatepec. He's the peak embodiment of why you're into vatos.",
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
        description: "You see his name, you know it's gonna be firme.",
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
        description: "Qué rifle tan perfecto. You'd watch just for that verga.",
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
        description:
          "The ink makes him look hotter, or like a malandro straight out of Ecatepec.",
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

// Ledger swatches reuse the semantic palette, one color per core criterion.
const CRITERION_COLORS = ["top", "bottom", "sex", "oral", "solo", "regular"];

function getCriterionColor(index: number) {
  return `var(--semantic-${CRITERION_COLORS[index % CRITERION_COLORS.length]})`;
}

function getTierColor(tier: RatingAdvisorTierCustom) {
  return `var(--semantic-${tier === "plain" ? "no-tier" : tier})`;
}

function formatRatingDelta(delta: number) {
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

interface IAdvisorPreview {
  key: string;
  // undefined previews clearing the answer.
  value?: number;
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
  const { confirm: confirmAction, confirmModal } = useConfirmActionCustom();
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
  const [preview, setPreview] = useState<IAdvisorPreview>();
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

  function calculateRating100(candidate: Record<string, number | undefined>) {
    return calculateRatingAdvisorRating100Custom(
      metrics.reduce(
        (sum, metric) => sum + getChoiceScore(metric, candidate[metric.key]),
        0
      ),
      orgasmBonus
    );
  }

  function hasRoyalSapphireBonus(
    candidate: Record<string, number | undefined>
  ) {
    return (
      entityType === "scene" &&
      (isRoyalSapphireSceneBonus("goatElement", candidate.goatElement) ||
        isRoyalSapphireSceneBonus("godTierOrgasm", candidate.godTierOrgasm))
    );
  }

  const calculatedRating100 = calculateRating100(scores);
  const displayRating100 =
    savingMetricKeys.size === 0 && confirmedRating100 !== undefined
      ? confirmedRating100
      : calculatedRating100;
  const ratingUnavailable =
    confirmedRating100 === undefined &&
    !advisorScoresData &&
    (advisorScoresLoading || !!advisorScoresError);
  const royalSapphireBonus = hasRoyalSapphireBonus(scores);
  const tier = getRatingAdvisorTierCustom(
    displayRating100,
    thresholds,
    royalSapphireBonus
  );
  const nextTierHint = tier.next
    ? `${tier.next.remaining} to ${tier.next.label}`
    : royalSapphireBonus && displayRating100 < thresholds.royalSapphire
    ? "Locked by a GOAT bonus"
    : "Top tier";

  // Hovering a choice projects the rating it would give.
  const previewScores = preview
    ? { ...scores, [preview.key]: preview.value }
    : undefined;
  const previewRating100 = previewScores
    ? displayRating100 + calculateRating100(previewScores) - calculatedRating100
    : undefined;
  const previewTier =
    previewScores && previewRating100 !== undefined
      ? getRatingAdvisorTierCustom(
          previewRating100,
          thresholds,
          hasRoyalSapphireBonus(previewScores)
        )
      : undefined;
  const previewDelta =
    previewRating100 !== undefined
      ? previewRating100 - displayRating100
      : undefined;
  const ladder = getRatingAdvisorTierLadderCustom(thresholds);
  const markerPercent = Math.max(
    0,
    Math.min(100, previewRating100 ?? displayRating100)
  );

  const ledgerRows = [
    ...coreMetrics.map((metric, index) => {
      const score = scores[metric.key];
      return {
        key: metric.key,
        kind: score === undefined ? "unrated" : "criterion",
        color: score === undefined ? "transparent" : getCriterionColor(index),
        name: metric.shortTitle ?? metric.title,
        detail:
          metric.choices.find((choice) => choice.value === score)?.label ??
          "Not rated",
        value:
          score === undefined
            ? "—"
            : formatRatingAdvisorContributionCustom(
                getChoiceScore(metric, score)
              ),
      };
    }),
    ...(orgasmCount
      ? [
          {
            key: "orgasm-count-bonus",
            kind: "bonus",
            color: "var(--rating-advisor-bonus)",
            name: "O count",
            detail: `${orgasmCount} recorded`,
            value: formatRatingAdvisorContributionCustom(orgasmBonus / 10),
          },
        ]
      : []),
    ...[...bonusMetrics, ...penaltyMetrics].flatMap((metric) => {
      const score = scores[metric.key];
      const contribution = getChoiceScore(metric, score);
      if (contribution === 0) return [];
      return [
        {
          key: metric.key,
          kind: contribution > 0 ? "bonus" : "penalty",
          color:
            contribution > 0
              ? "var(--rating-advisor-bonus)"
              : "var(--rating-advisor-penalty)",
          name: getRatingAdvisorAdjustmentTooltipLabelCustom(
            metric.key,
            metric.title
          ),
          detail:
            metric.choices.find((choice) => choice.value === score)?.label ??
            "",
          value: formatRatingAdvisorContributionCustom(contribution),
        },
      ];
    }),
  ];
  const bonusPoints =
    orgasmBonus +
    bonusMetrics.reduce(
      (sum, metric) =>
        sum + Math.max(0, getChoiceScore(metric, scores[metric.key]) * 10),
      0
    );
  const stack = [
    ...coreMetrics.map((metric, index) => ({
      key: metric.key,
      color: getCriterionColor(index),
      width: getChoiceScore(metric, scores[metric.key]) * 10,
    })),
    {
      key: "bonuses",
      color: "var(--rating-advisor-bonus)",
      width: bonusPoints,
    },
  ].filter((segment) => segment.width > 0);

  const advisorTitle =
    entityType === "performer"
      ? "Vato rating"
      : sceneRatingMode === "group"
      ? "Group scene rating"
      : sceneRatingMode === "solo"
      ? "Solo scene rating"
      : "Scene rating";

  const showPreview = (key: string, value?: number) =>
    setPreview({ key, value });
  const clearPreview = () => setPreview(undefined);

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

  // Clicking the selected answer again clears it.
  function toggleScore(metric: IAdvisorMetric, value: number) {
    clearPreview();
    void (scores[metric.key] === value
      ? deleteScore(metric)
      : setScore(metric, value));
  }

  async function resetAdvisor() {
    if (
      !(await confirmAction({
        header: "Reset Rating Advisor",
        message:
          entityType === "scene"
            ? "Wipe every answer and remove this scene's rating?"
            : "Wipe every answer? His overall rating stays put.",
        confirmText: "Reset",
      }))
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
      setPreview(undefined);
      setAuthoritativeScores(update?.scores ?? []);
      setConfirmedRating100(update?.rating100 ?? rating100 ?? 0);
      await onRatingSaved?.();
    } catch (e) {
      Toast.error(e);
    } finally {
      setResetting(false);
    }
  }

  function renderCriterion(metric: IAdvisorMetric, index: number) {
    const score = scores[metric.key];
    const saving = savingMetricKeys.has(metric.key);
    const previewed =
      preview?.key === metric.key && preview.value !== undefined
        ? metric.choices.find((choice) => choice.value === preview.value)
        : undefined;
    const displayedChoice =
      previewed ?? metric.choices.find((choice) => choice.value === score);
    const titleID = `rating-advisor-${metric.key}-title`;
    const hintID = `rating-advisor-${metric.key}-hint`;

    return (
      <section className="rating-advisor-criterion" key={metric.key}>
        <div className="rating-advisor-criterion-info">
          <h5 id={titleID}>
            <span
              aria-hidden="true"
              className="rating-advisor-swatch"
              style={{ backgroundColor: getCriterionColor(index) }}
            />
            {metric.title}
          </h5>
          <p id={hintID}>{metric.hint}</p>
          <span className="rating-advisor-criterion-points" aria-live="polite">
            {saving
              ? "Saving…"
              : score === undefined
              ? "Not rated"
              : `${formatMetricContribution(metric, score)} pts`}
          </span>
        </div>
        <div className="rating-advisor-criterion-input">
          <div
            aria-describedby={hintID}
            aria-labelledby={titleID}
            className="rating-advisor-pills"
            onMouseLeave={clearPreview}
            role="group"
          >
            {metric.choices.map((choice, choiceIndex) => (
              <button
                aria-label={`${choice.value}: ${choice.label}`}
                aria-pressed={choice.value === score}
                className="rating-advisor-pill"
                data-rating-level={getRatingAdvisorChoiceHeatLevelCustom(
                  choiceIndex,
                  metric.choices.length
                )}
                disabled={saving}
                key={choice.value}
                onBlur={clearPreview}
                onClick={() => toggleScore(metric, choice.value)}
                onFocus={() => showPreview(metric.key, choice.value)}
                onMouseEnter={() => showPreview(metric.key, choice.value)}
                type="button"
              >
                {choice.value}
              </button>
            ))}
          </div>
          <p className="rating-advisor-choice-text" aria-live="polite">
            {displayedChoice ? (
              <>
                <strong
                  className="rating-advisor-choice-label"
                  data-rating-level={getRatingAdvisorChoiceHeatLevelCustom(
                    metric.choices.indexOf(displayedChoice),
                    metric.choices.length
                  )}
                >
                  {displayedChoice.label}
                </strong>{" "}
                <span>{displayedChoice.description}</span>
              </>
            ) : (
              <span>Pick whichever fits, wey.</span>
            )}
          </p>
        </div>
      </section>
    );
  }

  function renderAdjustment(metric: IAdvisorMetric) {
    const score = scores[metric.key];
    const saving = savingMetricKeys.has(metric.key);
    const effectiveChoices = metric.choices.filter(
      (choice) => getChoiceScore(metric, choice.value) !== 0
    );
    const hasOffChoice = metric.choices.some(
      (choice) => getChoiceScore(metric, choice.value) === 0
    );
    const active = score !== undefined && getChoiceScore(metric, score) !== 0;
    const tone = metric.section === "penalty" ? "penalty" : "bonus";

    if (effectiveChoices.length === 1 && hasOffChoice) {
      const activeChoice = effectiveChoices[0];

      return (
        <button
          aria-checked={active}
          className="rating-advisor-switch"
          data-tone={tone}
          disabled={saving}
          key={metric.key}
          onBlur={clearPreview}
          onClick={() =>
            toggleScore(metric, active ? score! : activeChoice.value)
          }
          onFocus={() =>
            showPreview(metric.key, active ? undefined : activeChoice.value)
          }
          onMouseEnter={() =>
            showPreview(metric.key, active ? undefined : activeChoice.value)
          }
          onMouseLeave={clearPreview}
          role="switch"
          type="button"
        >
          <span aria-hidden="true" className="rating-advisor-switch-track" />
          <span className="rating-advisor-switch-text">
            <strong>{metric.title}</strong>
            <span>{active ? activeChoice.description : metric.hint}</span>
          </span>
          <span className="rating-advisor-switch-value">
            {saving
              ? "Saving…"
              : formatRatingAdvisorContributionCustom(
                  getChoiceScore(metric, activeChoice.value)
                )}
          </span>
        </button>
      );
    }

    const previewed =
      preview?.key === metric.key && preview.value !== undefined
        ? metric.choices.find((choice) => choice.value === preview.value)
        : undefined;
    const displayedChoice =
      previewed ??
      (active
        ? metric.choices.find((choice) => choice.value === score)
        : undefined);
    const titleID = `rating-advisor-${metric.key}-title`;

    return (
      <div
        className="rating-advisor-switch rating-advisor-levels"
        data-active={active}
        data-tone={tone}
        key={metric.key}
      >
        <span className="rating-advisor-switch-text">
          <strong id={titleID}>{metric.title}</strong>
          <span>{displayedChoice?.description ?? metric.hint}</span>
        </span>
        <div
          aria-labelledby={titleID}
          className="rating-advisor-level-group"
          onMouseLeave={clearPreview}
          role="group"
        >
          {effectiveChoices.map((choice) => {
            const selected = choice.value === score;
            return (
              <button
                aria-label={choice.label}
                aria-pressed={selected}
                disabled={saving}
                key={choice.value}
                onBlur={clearPreview}
                onClick={() => toggleScore(metric, choice.value)}
                onFocus={() =>
                  showPreview(metric.key, selected ? undefined : choice.value)
                }
                onMouseEnter={() =>
                  showPreview(metric.key, selected ? undefined : choice.value)
                }
                type="button"
              >
                {formatRatingAdvisorContributionCustom(
                  getChoiceScore(metric, choice.value)
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderOrgasmBonus() {
    return (
      <div
        className="rating-advisor-switch rating-advisor-switch-readonly"
        data-active={orgasmBonus !== 0}
        data-tone="bonus"
        key="orgasm-count-bonus"
      >
        <span className="rating-advisor-switch-text">
          <strong>O Count bonus</strong>
          <span>
            {getRatingAdvisorOrgasmBonusDescriptionCustom(entityType)}
          </span>
        </span>
        <span className="rating-advisor-switch-value">
          {orgasmCount === undefined
            ? "—"
            : formatRatingAdvisorContributionCustom(orgasmBonus / 10)}
          <small>
            {advisorScoresLoading && orgasmCount === undefined
              ? "Loading…"
              : advisorScoresError && orgasmCount === undefined
              ? "Unavailable"
              : `${orgasmCount ?? 0} recorded`}
          </small>
        </span>
      </div>
    );
  }

  return (
    <>
      {confirmModal}
      <ModalComponent
        show
        onHide={onClose}
        header={advisorTitle}
        icon={faWandMagicSparkles}
        closeButton
        accept={{ onClick: onClose, text: "Close" }}
        leftFooterButtons={
          <Button
            disabled={resetting || savingMetricKeys.size > 0}
            onClick={() => void resetAdvisor()}
            size="sm"
            variant="outline-danger"
          >
            {resetting ? "Resetting…" : "Reset advisor"}
          </Button>
        }
        modalProps={{ size: "xl", keyboard: true }}
        dialogClassName="rating-advisor-dialog"
      >
        <div
          className="rating-advisor-ledger"
          style={
            {
              "--rating-advisor-tier-color": getTierColor(tier.tier),
            } as React.CSSProperties
          }
        >
          <aside aria-label="Rating breakdown" className="rating-advisor-score">
            <div className="rating-advisor-score-total">
              <strong>{ratingUnavailable ? "—" : displayRating100}</strong>
              <div>
                <span className="rating-advisor-tier">
                  <span aria-hidden="true" />
                  {tier.label}
                </span>
                <span>{nextTierHint}</span>
              </div>
            </div>
            <div
              aria-live="polite"
              className="rating-advisor-preview"
              data-direction={
                previewDelta === undefined
                  ? undefined
                  : previewDelta < 0
                  ? "down"
                  : "up"
              }
            >
              {previewRating100 === undefined || previewDelta === undefined
                ? "Hover any choice to see its impact"
                : `${formatRatingDelta(previewDelta)} → ${previewRating100} · ${
                    previewTier?.label
                  }`}
            </div>
            <div aria-hidden="true" className="rating-advisor-ladder">
              <div className="rating-advisor-ladder-track">
                {ladder.map((zone) => (
                  <span
                    data-reached={displayRating100 >= zone.start}
                    key={zone.tier}
                    style={{
                      backgroundColor: getTierColor(zone.tier),
                      left: `${zone.start}%`,
                      width: `${zone.width}%`,
                    }}
                  />
                ))}
                <i style={{ left: `${markerPercent}%` }} />
              </div>
              <div className="rating-advisor-ladder-ticks">
                {ladder.slice(1).map((zone) => (
                  <span key={zone.tier} style={{ left: `${zone.start}%` }}>
                    {zone.start}
                  </span>
                ))}
              </div>
            </div>
            <section
              aria-labelledby="rating-advisor-breakdown-title"
              className="rating-advisor-breakdown"
            >
              <h6 id="rating-advisor-breakdown-title">Where it comes from</h6>
              <div aria-hidden="true" className="rating-advisor-stack">
                {stack.map((segment) => (
                  <span
                    data-kind={segment.key === "bonuses" ? "bonus" : undefined}
                    key={segment.key}
                    style={{
                      backgroundColor: segment.color,
                      width: `${segment.width}%`,
                    }}
                  />
                ))}
              </div>
              <ul>
                {ledgerRows.map((row) => (
                  <li data-kind={row.kind} key={row.key}>
                    <span
                      aria-hidden="true"
                      className="rating-advisor-swatch"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="rating-advisor-ledger-name">
                      <strong>{row.name}</strong> <span>{row.detail}</span>
                    </span>
                    <span className="rating-advisor-ledger-value">
                      {row.value}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="rating-advisor-ledger-total">
                <span>Total</span>
                <strong>{ratingUnavailable ? "—" : displayRating100}</strong>
              </div>
            </section>
            {savingMetricKeys.size > 0 && (
              <div className="rating-advisor-save-status" aria-live="polite">
                {`Saving ${savingMetricKeys.size} change${
                  savingMetricKeys.size === 1 ? "" : "s"
                }…`}
              </div>
            )}
            {advisorScoresError && (
              <div className="rating-advisor-save-status" role="alert">
                Couldn&apos;t load the auto bonus data. Your saved answers are
                fine.
              </div>
            )}
          </aside>
          <div className="rating-advisor-main">
            <p className="rating-advisor-progress-note">
              {coreCompletion.complete
                ? "Core rating done, ese. Bonuses and penalties are optional."
                : `${coreCompletion.rated} of ${coreCompletion.total} rated · hover a number to preview, click it again to clear`}
            </p>
            <section aria-label="Rating criteria">
              {coreMetrics.map(renderCriterion)}
            </section>
            <div className="rating-advisor-adjustments">
              <section
                aria-labelledby="rating-advisor-bonus-title"
                data-tone="bonus"
              >
                <h6 id="rating-advisor-bonus-title">Bonuses</h6>
                {renderOrgasmBonus()}
                {bonusMetrics.map(renderAdjustment)}
              </section>
              {penaltyMetrics.length > 0 && (
                <section
                  aria-labelledby="rating-advisor-penalty-title"
                  data-tone="penalty"
                >
                  <h6 id="rating-advisor-penalty-title">Penalties</h6>
                  {penaltyMetrics.map(renderAdjustment)}
                </section>
              )}
            </div>
          </div>
        </div>
      </ModalComponent>
    </>
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
