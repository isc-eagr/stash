import { gql, useLazyQuery, useQuery } from "@apollo/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, OverlayTrigger, Popover } from "react-bootstrap";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { ModalComponent } from "src/components/Shared/Modal";
import { RatingNumber } from "src/components/Shared/Rating/RatingNumber";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useToast } from "src/hooks/Toast";
import {
  getRatingCardClass,
  getRatingCardThresholdsForEntity,
  normalizeRatingCardThresholds,
} from "src/utils/ratingCardStyles_custom";
import {
  calculateRatingAdvisorRating100Custom,
  getRatingAdvisorAdjustmentTooltipLabelCustom,
  getRatingAdvisorBarSummaryCustom,
  getRatingAdvisorCompletionCustom,
  getRatingAdvisorChoiceHeatLevelCustom,
  getRatingAdvisorChoiceScoreCustom,
  normalizeRatingAdvisorScoreValueCustom,
  ratingAdvisorSixLevelChoicesCustom,
  SCENE_ENERGY_WEIGHT_CUSTOM,
  SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
  SCENE_NO_ORGASM_PENALTY_CUSTOM,
  SCENE_USABLE_FACTOR_MAX_CUSTOM,
  SCENE_USABLE_FACTOR_WEIGHT_CUSTOM,
} from "./ratingAdvisorScales_custom";
import {
  GROUP_SCENE_BONUSES_CUSTOM,
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
    description: "He ain't the draw; you're here for somebody else.",
  },
  {
    label: "Some appeal",
    description: "He's got a little something, but the pull is light.",
  },
  {
    label: "Decent",
    description: "Cute enough, but you're not clicking just for him.",
  },
  {
    label: "Attractive",
    description: "Hot vato. He definitely helps the scene.",
  },
  {
    label: "Very attractive",
    description: "Fine as hell and an instant reason to watch.",
  },
  {
    label: "Perfect",
    description: "Dead-on your type. Damn near no notes.",
  },
]);

const sceneMetrics: IAdvisorMetric[] = [
  {
    key: "topAttractiveness",
    title: "Top(s) Attractiveness",
    max: 5,
    weight: 0.6,
    hint: "How hot the top vato or lineup looks to you.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: "bottomAttractiveness",
    title: "Bottom(s) Attractiveness",
    max: 5,
    weight: 0.2,
    hint: "How hot the bottom vato or lineup looks to you.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: "chemistry",
    title: "Energy / sex quality",
    max: 5,
    weight: SCENE_ENERGY_WEIGHT_CUSTOM,
    hint: "How hot the actual sex feels: rhythm, reactions, chemistry, all that.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "No energy",
        description: "Dead and awkward. These vatos look clocked out.",
      },
      {
        label: "Serviceable",
        description: "Gets the job done, but there ain't much spark.",
      },
      {
        label: "Decent",
        description: "Some hot stretches, nothing too crazy.",
      },
      {
        label: "Strong",
        description: "Good rhythm and reactions. The sex really lands.",
      },
      {
        label: "Excellent",
        description: "Hot as hell and exactly the right vibe.",
      },
      {
        label: "Perfect quality",
        description: "The sex alone carries the whole damn scene.",
      },
    ]),
  },
  {
    key: "payoff",
    title: "Orgasm quality",
    max: 4,
    weight: 0.5,
    hint: "How good the orgasms, facials, and final payoff are.",
    choices: [
      {
        value: 0,
        label: "Unremarkable orgasms",
        description: "He came, but it was weak, hidden, or easy to forget.",
      },
      {
        value: 2,
        label: "Standard orgasms",
        description: "A solid orgasm. Hot, just not legendary.",
      },
      {
        value: 3,
        label: "Above average",
        description: "A hot nut or facial that gives the scene a real bump.",
      },
      {
        value: 4,
        label: "Outstanding orgasms",
        description: "That orgasm or facial is the damn highlight.",
      },
    ],
  },
  {
    key: "theme",
    title: "Uniform/setting factor",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when the fantasy, setting, or uniform makes it hotter.",
    choices: [
      {
        value: 0,
        label: "No theme bonus",
        description: "The theme ain't doing anything extra for you.",
      },
      {
        value: 0.5,
        label: "Theme present",
        description: "The uniform, fantasy, or setup makes this way hotter.",
      },
    ],
  },
  {
    key: "oralOnly",
    title: "Oral-only scene",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when the scene is entirely sucking pito.",
    choices: [
      {
        value: 0,
        label: "Not oral-only",
        description: "There is more than sucking pito going on.",
      },
      {
        value: 0.5,
        label: "Oral-only bonus",
        description: "Sucking pito and nothing else.",
      },
    ],
  },
  {
    key: "godTierOrgasm",
    title: "God-tier orgasm bonus",
    max: SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
    section: "bonus",
    hint: "For an orgasm or facial so wild it takes the scene up a whole level.",
    choices: [
      {
        value: 0,
        label: "Not god-tier",
        description: "Good maybe, but not god-tier crazy.",
      },
      {
        value: SCENE_GOD_TIER_ORGASM_BONUS_CUSTOM,
        label: "God-tier orgasms",
        description: "The orgasm or facial is straight-up legendary.",
      },
    ],
  },
  {
    key: "goatElement",
    title: "GOAT element",
    max: 2,
    section: "bonus",
    hint: "For one GOAT-level act, angle, blowjob, or other killer moment.",
    choices: [
      {
        value: 0,
        label: "No GOAT element",
        description: "Nothing here reaches GOAT territory.",
      },
      {
        value: 2,
        label: "GOAT element",
        description: "One part is so damn good it lifts the whole scene.",
      },
    ],
  },
  {
    key: "unlikelyTop",
    title: "Unlikely top",
    max: 0.5,
    section: "bonus",
    hint: "For a bottom-looking vato who flips the script and tops.",
    choices: [
      {
        value: 0,
        label: "No bonus",
        description: "No surprise-top heat here.",
      },
      {
        value: 0.5,
        label: "Unlikely top bonus",
        description:
          "He looks like a bottom, then pulls out that top energy. Hot.",
      },
    ],
  },
  {
    key: "standout",
    title: "Usable factor",
    max: SCENE_USABLE_FACTOR_MAX_CUSTOM,
    weight: SCENE_USABLE_FACTOR_WEIGHT_CUSTOM,
    hint: "How much of the whole scene works without needing to skip around.",
    choices: [
      {
        value: 0,
        label: "Mostly unusable",
        description:
          "Long setup, bad positions, negative stretches, or other dead weight makes most of this a skip.",
      },
      {
        value: 1,
        label: "Limited use",
        description:
          "A few workable moments land, but you're skipping a lot to get to them.",
      },
      {
        value: 2,
        label: "Mixed / standard",
        description:
          "A standard usable range, or a messy scene with a few outstanding stretches worth keeping.",
      },
      {
        value: 3,
        label: "Highly usable",
        description:
          "Most of it works: good angles, positions, and intensity with very little dragging.",
      },
      {
        value: 4,
        label: "Nearly unskippable",
        description:
          "Almost every stretch delivers. No wasted setup, no dead air, damn near all usable.",
      },
    ],
  },
  {
    key: "noOrgasm",
    title: "No orgasm",
    max: 0,
    section: "penalty",
    hint: "Flip it on if nobody finishes or the scene cuts off early.",
    choices: [
      {
        value: 0,
        label: "Orgasm present",
        description: "Somebody delivers a real payoff.",
      },
      {
        value: SCENE_NO_ORGASM_PENALTY_CUSTOM,
        label: "No orgasm penalty",
        description: "No orgasm, no payoff, or they cut away. Lame.",
      },
    ],
  },
  {
    key: "production",
    title: "Production / visual quality",
    max: 0,
    section: "penalty",
    hint: "Flip it on when bad camera work or quality kills the heat.",
    choices: [
      {
        value: 0,
        label: "No penalty",
        description: "Looks fine enough and stays out of the way.",
      },
      {
        value: -1,
        label: "Quality works against it",
        description:
          "Bad angles, lighting, editing, or quality ruin the good stuff.",
      },
    ],
  },
];

const soloSceneMetrics: IAdvisorMetric[] = [
  {
    key: SOLO_SCENE_RATING_KEYS_CUSTOM.attractiveness,
    title: "Vato Attractiveness",
    max: 5,
    weight: SOLO_SCENE_WEIGHTS_CUSTOM.attractiveness,
    hint: "How hot the solo vato is, face to body to rifle.",
    choices: sceneVatoAttractivenessChoices,
  },
  {
    key: SOLO_SCENE_RATING_KEYS_CUSTOM.performance,
    title: "Performance",
    max: 4,
    weight: SOLO_SCENE_WEIGHTS_CUSTOM.performance,
    hint: "How genuinely excited and into the solo action the vato looks.",
    choices: [
      {
        value: 0,
        label: "Clocked out",
        description:
          "Bored, detached, and waiting to finish so he can collect the check.",
      },
      {
        value: 1,
        label: "Going through it",
        description:
          "He does the job, but the energy says he just wants it over with.",
      },
      {
        value: 2,
        label: "Into it",
        description: "He looks engaged and is clearly enjoying himself.",
      },
      {
        value: 3,
        label: "Excited",
        description:
          "Strong reactions and real enthusiasm. He wants to be right there.",
      },
      {
        value: 4,
        label: "Loving it",
        description:
          "Fully turned on, completely committed, and loving every second of it.",
      },
    ],
  },
  {
    ...sceneMetrics.find((metric) => metric.key === "standout")!,
    key: SOLO_SCENE_RATING_KEYS_CUSTOM.usability,
    title: "Usability",
    weight: SOLO_SCENE_WEIGHTS_CUSTOM.usability,
    hint: "How much works without skipping, including the angles and pacing.",
  },
  {
    key: "orgasmBonus",
    title: "Orgasm",
    max: 1,
    section: "bonus",
    hint: "Flip it on when the solo orgasm makes the scene better.",
    choices: [
      {
        value: 0,
        label: "No orgasm bonus",
        description: "No worthwhile orgasm to boost the scene.",
      },
      {
        value: 1,
        label: "Orgasm bonus",
        description: "He delivers a hot nut that makes the solo worth it.",
        scoreValue: 1,
      },
    ],
  },
  {
    key: "feetBonus",
    title: "Feet",
    max: 1,
    section: "bonus",
    hint: "Flip it on when the feet are actually part of the fun.",
    choices: [
      {
        value: 0,
        label: "No feet bonus",
        description: "No feet, or they ain't doing anything for you.",
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
];

const groupSceneMetrics: IAdvisorMetric[] = [
  {
    ...sceneMetrics.find((metric) => metric.key === "topAttractiveness")!,
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.topAttractiveness,
    title: "Top Lineup Attractiveness",
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.topAttractiveness,
    hint: "How hot the vatos doing the topping look as a lineup.",
  },
  {
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.energyCoordination,
    title: "Energy / coordination",
    max: 5,
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.energyCoordination,
    hint: "How hot the action feels and how well the whole lineup works together.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "Disconnected",
        description:
          "Dead energy, messy flow, and most of these vatos are basically furniture.",
      },
      {
        label: "Weak",
        description:
          "A little action lands, but the energy and coordination stay rough.",
      },
      {
        label: "Uneven",
        description:
          "Some hot stretches, some waiting around, and an inconsistent group flow.",
      },
      {
        label: "Strong",
        description:
          "Good energy, most vatos get involved, and the group action works.",
      },
      {
        label: "Excellent",
        description:
          "Everybody gets used well and the intensity stays hot throughout.",
      },
      {
        label: "Perfect execution",
        description:
          "Seamless, intense, and fully coordinated. Every vato matters the whole time.",
      },
    ]),
  },
  {
    ...sceneMetrics.find((metric) => metric.key === "payoff")!,
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.payoff,
    title: "Orgasm Quality",
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.payoff,
  },
  {
    ...sceneMetrics.find((metric) => metric.key === "standout")!,
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.usability,
    title: "Usability",
    weight: GROUP_SCENE_WEIGHTS_CUSTOM.usability,
    hint: "How much of the group scene works without needing to skip around.",
  },
  {
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.bottomAttractiveness,
    title: "Attractive Bottom",
    max: GROUP_SCENE_BONUSES_CUSTOM.bottomAttractiveness,
    section: "bonus",
    hint: "Flip it on when the bottom lineup is fine enough to add extra heat.",
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
          "The bottom lineup is hot and gives the scene a nice bump.",
      },
    ],
  },
  {
    key: GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.oralOnly,
    title: "Group Oral-Only Scene",
    max: GROUP_SCENE_BONUSES_CUSTOM.oralOnly,
    section: "bonus",
    hint: "The big bonus for four-plus vatos sucking pito and nothing else.",
    choices: [
      {
        value: 0,
        label: "Not group oral-only",
        description: "There is more than oral going on.",
      },
      {
        value: GROUP_SCENE_BONUSES_CUSTOM.oralOnly,
        label: "Group oral-only bonus",
        description: "Four-plus vatos sucking pito and nothing else.",
      },
    ],
  },
  { ...sceneMetrics.find((metric) => metric.key === "theme")! },
  { ...sceneMetrics.find((metric) => metric.key === "godTierOrgasm")! },
  { ...sceneMetrics.find((metric) => metric.key === "goatElement")! },
  sceneMetrics.find((metric) => metric.key === "noOrgasm")!,
  sceneMetrics.find((metric) => metric.key === "production")!,
];

const performerMetrics: IAdvisorMetric[] = [
  {
    key: "face",
    title: "Face",
    max: 5,
    weight: 0.6,
    hint: "How much that face makes you stop and look.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "Not Attractive",
        description: "That face just ain't doing it for you.",
      },
      {
        label: "Some Appeal",
        description: "He's got a little something, but not a strong pull.",
      },
      {
        label: "Decent",
        description: "Cute enough, but you ain't clicking just for his face.",
      },
      {
        label: "Attractive",
        description: "Handsome vato. That face definitely helps.",
      },
      {
        label: "Very Attractive",
        description: "Fine as hell. His face pulls you in right away.",
      },
      {
        label: "Perfect",
        description: "That face is dead-on your type. Damn.",
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
        description: "That body ain't doing anything for you.",
      },
      {
        label: "Some Appeal",
        description: "One nice feature, but the whole package ain't there.",
      },
      {
        label: "Decent",
        description: "Decent build, but not enough to make you click.",
      },
      {
        label: "Attractive",
        description: "Hot body. He looks good moving around naked.",
      },
      {
        label: "Very Attractive",
        description: "Built fine as hell and hard to look away from.",
      },
      {
        label: "Perfect",
        description: "Your ideal body, straight up.",
      },
    ]),
  },
  {
    key: "performance",
    title: "Sexual performance",
    max: 5,
    weight: 0.4,
    hint: "How well he fucks, reacts, moves, and owns the screen.",
    choices: ratingAdvisorSixLevelChoicesCustom([
      {
        label: "Weak",
        description: "Awkward, passive, or lost. He drags scenes down.",
      },
      {
        label: "Serviceable",
        description: "He gets through it fine, but you ain't seeking him out.",
      },
      {
        label: "Good",
        description: "Good reactions and confidence. He helps the scene click.",
      },
      {
        label: "Strong",
        description: "He makes even basic scenes hit harder.",
      },
      {
        label: "Excellent",
        description: "He knows how to fuck and is usually why the scene works.",
      },
      {
        label: "Perfect",
        description:
          "His name alone sells the scene. You know he's bringing it.",
      },
    ]),
  },
  {
    key: "ethnicity",
    title: "Ethnicity / racial appeal",
    max: 3,
    weight: 1 / 3,
    hint: "How much his background and skin tone hit your type.",
    choices: [
      {
        value: 0,
        label: "Negative ethnic appeal",
        description: "Asian or super white.",
      },
      {
        value: 1,
        label: "Neutral background",
        description: "White or other non-standard ethnicities",
      },
      {
        value: 2,
        label: "Partial ethnic appeal",
        description: "White latino, black-white mixed",
      },
      {
        value: 3,
        label: "Full ethnic appeal",
        description: "Latino, black, afrolatino",
      },
    ],
  },
  {
    key: "masculinity",
    title: "Masculinity",
    max: 3,
    weight: 1 / 3,
    hint: "How much rugged, dominant, bro, blue-collar energy he gives off.",
    choices: [
      {
        value: 0,
        label: "No masculine appeal",
        description: "No real masculine pull for your taste.",
      },
      {
        value: 1,
        label: "Some masculine appeal",
        description: "A little masc energy in the voice, look, or attitude.",
      },
      {
        value: 2,
        label: "Strong",
        description: "Rugged, confident, dominant—the masc energy is strong.",
      },
      {
        value: 3,
        label: "Core ideal",
        description: "Peak vato energy. Can't get more masculine than this.",
      },
    ],
  },
  {
    key: "consistency",
    title: "Consistency",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when he stays hot across a bunch of scenes.",
    choices: [
      {
        value: 0,
        label: "No consistency bonus",
        description: "Too inconsistent, or only hot that one time.",
      },
      {
        value: 0.5,
        label: "Consistent draw",
        description: "Scene after scene, the vato still brings it.",
      },
    ],
  },
  {
    key: "dick",
    title: "Pito",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when the verga is particularly good.",
    choices: [
      {
        value: 0,
        label: "No pito bonus",
        description:
          "The rifle is standard. Hot because pitos are hot but that's it.",
      },
      {
        value: 0.5,
        label: "Pito bonus",
        description: "That verga is truly outstanding.",
      },
    ],
  },
  {
    key: "tattoosBonus",
    title: "Tattoos",
    max: 0.5,
    section: "bonus",
    hint: "Flip it on when the ink makes him look hotter or rougher.",
    choices: [
      {
        value: 0,
        label: "Not present",
        description: "No ink, or the tattoos ain't adding anything.",
      },
      {
        value: 0.5,
        label: "Present",
        description: "The ink makes him look hotter or rougher.",
      },
    ],
  },
  {
    key: "feminine",
    title: "Feminine",
    max: 0,
    section: "penalty",
    hint: "Flip it on when feminine energy lowers the appeal for you.",
    choices: [
      {
        value: 0,
        label: "No penalty",
        description: "His presentation ain't hurting the attraction.",
      },
      {
        value: -1,
        label: "Feminine penalty",
        description:
          "Too feminine for your taste, and it pulls the rating down.",
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

interface IRatingCriteriaTooltipProps {
  entityType: AdvisorEntity;
  entityId: string;
  sceneRatingMode?: SceneRatingModeCustom;
  ratingScores?: readonly IAdvisorPersistedScore[] | null;
  triggerClassName?: string;
  dismissNextShowOnChildClick?: boolean;
  children: React.ReactElement;
}

export const RatingCriteriaTooltip: React.FC<IRatingCriteriaTooltipProps> = ({
  entityType,
  entityId,
  sceneRatingMode,
  ratingScores,
  triggerClassName,
  dismissNextShowOnChildClick = false,
  children,
}) => {
  const [loadScores, { data, loading, error }] = useLazyQuery<
    {
      ratingScores: IAdvisorPersistedScore[];
      ratingOrgasmCount: number;
    },
    { entity_type: string; entity_id: string }
  >(RatingAdvisorScoresQuery, {
    variables: { entity_type: entityType, entity_id: entityId },
    fetchPolicy: "cache-first",
  });
  const [showTooltip, setShowTooltip] = useState(false);
  const suppressNextShowRef = useRef(false);
  const effectiveScores = ratingScores ?? data?.ratingScores;
  const metrics = getTooltipMetrics(
    entityType,
    sceneRatingMode,
    effectiveScores
  );
  const criterionRows = metrics
    .filter((metric) => metric.section === undefined)
    .map((metric) => {
      const score = effectiveScores?.find(
        (candidate) =>
          candidate.key === metric.key &&
          normalizePersistedScoreSection(candidate.section) === "criterion"
      );
      const summary = getRatingAdvisorBarSummaryCustom(
        metric,
        score?.raw_value
      );
      const contribution = summary.choice
        ? getChoiceScore(metric, summary.choice.value)
        : undefined;
      const displayValue =
        contribution === undefined
          ? "—"
          : formatRatingContribution(contribution);

      return {
        key: metric.key,
        title: metric.title,
        ariaValue: summary.choice
          ? `${summary.choice.label}, ${displayValue} points`
          : undefined,
        displayValue,
        summary,
      };
    });
  const adjustmentRows = metrics
    .filter((metric) => metric.section !== undefined)
    .map((metric) => {
      const score = effectiveScores?.find(
        (candidate) =>
          candidate.key === metric.key &&
          normalizePersistedScoreSection(candidate.section) === metric.section
      );
      const rawValue = score?.raw_value;
      const normalizedValue =
        rawValue === undefined || rawValue === null
          ? undefined
          : normalizeRatingAdvisorScoreValueCustom(metric, rawValue);
      const contribution =
        normalizedValue === undefined
          ? 0
          : getChoiceScore(metric, normalizedValue);

      return {
        key: metric.key,
        title: getRatingAdvisorAdjustmentTooltipLabelCustom(
          metric.key,
          metric.title
        ),
        section: metric.section,
        contribution,
        ariaValue: formatRatingContribution(contribution),
        displayValue: formatRatingContribution(contribution),
      };
    })
    .filter((row) => row.contribution !== 0);
  const bonusRows = adjustmentRows.filter((row) => row.section === "bonus");
  const penaltyRows = adjustmentRows.filter((row) => row.section === "penalty");
  const orgasmBonus = calculateOrgasmBonus(
    entityType,
    data?.ratingOrgasmCount ?? 0
  );

  if (orgasmBonus !== 0) {
    const contribution = orgasmBonus / 10;
    bonusRows.unshift({
      key: "orgasm-count-bonus",
      title: getRatingAdvisorAdjustmentTooltipLabelCustom(
        "orgasm-count-bonus",
        "O Count bonus"
      ),
      section: "bonus",
      contribution,
      ariaValue: formatRatingContribution(contribution),
      displayValue: formatRatingContribution(contribution),
    });
  }

  const hasRatedCriteria = criterionRows.some(
    (row) => row.summary.choice !== undefined
  );
  const hasAnySummary =
    hasRatedCriteria || bonusRows.length > 0 || penaltyRows.length > 0;
  const popoverID = `rating-criteria-${entityType}-${entityId}`;

  function handleToggle(show: boolean) {
    if (show && suppressNextShowRef.current) {
      suppressNextShowRef.current = false;
      setShowTooltip(false);
      return;
    }

    setShowTooltip(show);
    if (show && !data && !loading && !error) {
      void loadScores();
    }
  }

  function handleChildClickCapture() {
    if (!dismissNextShowOnChildClick) {
      return;
    }

    // Clicking the rating opens a modal. Prevent focus restoration after the
    // modal closes from immediately reopening this hover summary.
    suppressNextShowRef.current = true;
    setShowTooltip(false);
  }

  function renderTooltipRow(row: {
    key: string;
    title: string;
    ariaValue?: string;
    displayValue: string;
    summary: { fillPercent: number; heatLevel?: number };
  }) {
    return (
      <div
        aria-label={`${row.title}: ${row.ariaValue ?? "Not rated"}`}
        className="rating-criteria-tooltip-row"
        key={row.key}
        role="img"
      >
        <span
          className="rating-criteria-tooltip-row-heading"
          aria-hidden="true"
        >
          <span className="rating-criteria-tooltip-label">{row.title}</span>
          <span className="rating-criteria-tooltip-value">
            {row.displayValue}
          </span>
        </span>
        <span className="rating-criteria-tooltip-track" aria-hidden="true">
          <span
            className="rating-criteria-tooltip-fill"
            data-rating-level={row.summary.heatLevel}
            style={{ width: `${row.summary.fillPercent}%` }}
          />
        </span>
      </div>
    );
  }

  function renderAdjustmentTooltipRow(
    row: {
      key: string;
      title: string;
      ariaValue: string;
      displayValue: string;
    },
    kind: "bonus" | "penalty"
  ) {
    return (
      <div
        aria-label={`${row.title}: ${row.ariaValue}`}
        className="rating-criteria-tooltip-adjustment-row"
        key={row.key}
        role="img"
      >
        <span
          aria-hidden="true"
          className={`rating-criteria-tooltip-adjustment-icon rating-criteria-tooltip-adjustment-icon-${kind}`}
        >
          {kind === "bonus" ? "\u2713" : "\u2212"}
        </span>
        <span
          aria-hidden="true"
          className="rating-criteria-tooltip-adjustment-label"
        >
          {row.title}
        </span>
        <span aria-hidden="true" className="rating-criteria-tooltip-value">
          {row.displayValue}
        </span>
      </div>
    );
  }

  const content =
    loading && !hasAnySummary ? (
      <div className="rating-criteria-tooltip-status">Loading summary…</div>
    ) : error && !effectiveScores ? (
      <div className="rating-criteria-tooltip-status">
        Rating summary could not be loaded.
      </div>
    ) : !hasAnySummary ? (
      <div className="rating-criteria-tooltip-status">
        No advisor scores yet.
      </div>
    ) : (
      <div className="rating-criteria-tooltip-groups">
        {hasRatedCriteria && (
          <div className="rating-criteria-tooltip-rows">
            {criterionRows.map(renderTooltipRow)}
          </div>
        )}
        {bonusRows.length > 0 && (
          <section className="rating-criteria-tooltip-section">
            <span className="rating-criteria-tooltip-section-title">
              Bonuses
            </span>
            <div className="rating-criteria-tooltip-adjustment-grid">
              {bonusRows.map((row) => renderAdjustmentTooltipRow(row, "bonus"))}
            </div>
          </section>
        )}
        {penaltyRows.length > 0 && (
          <section className="rating-criteria-tooltip-section">
            <span className="rating-criteria-tooltip-section-title">
              Penalties
            </span>
            <div className="rating-criteria-tooltip-adjustment-grid">
              {penaltyRows.map((row) =>
                renderAdjustmentTooltipRow(row, "penalty")
              )}
            </div>
          </section>
        )}
      </div>
    );

  return (
    <OverlayTrigger
      delay={{ show: 250, hide: 100 }}
      onToggle={handleToggle}
      overlay={
        <Popover className="rating-criteria-tooltip" id={popoverID}>
          <div className="rating-criteria-tooltip-content">{content}</div>
        </Popover>
      }
      placement="bottom"
      show={showTooltip}
      trigger={["hover", "focus"]}
    >
      <span
        className={`rating-criteria-tooltip-trigger ${triggerClassName ?? ""}`}
        onClickCapture={handleChildClickCapture}
      >
        {children}
      </span>
    </OverlayTrigger>
  );
};

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
      ? normalizeRatingAdvisorScoreValueCustom(metric, persistedScore.raw_value)
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

function formatRatingContribution(value: number) {
  const ratingPoints = Math.round(value * 10);
  return ratingPoints > 0 ? `+${ratingPoints}` : ratingPoints.toString();
}

function formatMetricContribution(metric: IAdvisorMetric, score?: number) {
  if (score === undefined) {
    return "Not rated";
  }

  const value = getChoiceScore(metric, score);

  if (metric.section === "bonus" || metric.section === "penalty") {
    return formatRatingContribution(value);
  }

  const maxValue = getMetricMaxScore(metric);
  return `${formatRatingPointNumber(value)} / ${formatRatingPointNumber(
    maxValue
  )}`;
}

function calculateOrgasmBonus(entityType: AdvisorEntity, count: number) {
  if (count < 3) {
    return 0;
  }

  if (entityType === "scene") {
    return count - 2;
  }

  return 1 + Math.floor((count - 3) / 2);
}

function getOrgasmBonusDescription(entityType: AdvisorEntity) {
  if (entityType === "scene") {
    return "Auto bonus: +1 on the 3rd recorded nut, then +1 for every one after.";
  }

  return "Auto bonus: +1 on the 3rd recorded nut, then +1 for every 2 after.";
}

function getSceneSuggestion(
  total: number,
  thresholds: ReturnType<typeof normalizeRatingCardThresholds>
): IRatingSuggestion {
  const rating100 = Math.round(total * 10);

  if (rating100 >= thresholds.royalSapphire) {
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
      authoritativeScores ?? ratingScores ?? advisorScoresData?.ratingScores
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
  const orgasmBonus = calculateOrgasmBonus(entityType, orgasmCount ?? 0);
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
  const suggestion = getSceneSuggestion(displayRating100 / 10, thresholds);
  const ratingTierClass = getRatingCardClass({
    rating: suggestion.rating100,
    theme: configuration?.ui?.ratingCardTheme,
    thresholds: configuration?.ui?.ratingCardThresholds,
    thresholdEntity: entityType,
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
          ? "Clear every advisor answer and remove this scene's rating?"
          : "Clear every advisor answer? The current overall rating will be preserved."
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
            <span>Pick the one that fits best.</span>
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
    const active = score !== undefined && getChoiceScore(metric, score) !== 0;
    const activeBonus = active && metric.section === "bonus";

    if (!activeChoice || !inactiveChoice) {
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
          <span aria-live="polite">
            {saving ? "Saving…" : active ? "On" : "Off"}
          </span>
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
                : formatRatingContribution(orgasmBonus / 10)}
            </Badge>
          </div>
          <span>{getOrgasmBonusDescription(entityType)}</span>
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
            Automatic bonus data could not be loaded. Saved values remain
            intact.
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
            Core rating complete. Bonuses and penalties are optional.
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
            <span>Flip on only what really adds heat.</span>
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
                  ? "Flip on what drags the vato down."
                  : "Flip on what drags the scene down."}
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

  return (
    <>
      <RatingCriteriaTooltip
        entityType={entityType}
        entityId={entityId}
        sceneRatingMode={sceneRatingMode}
        ratingScores={ratingScores}
        dismissNextShowOnChildClick
      >
        <Button
          aria-label="Open rating system"
          className="rating-advisor-button"
          onClick={() => setShowAdvisor(true)}
          variant="secondary"
        >
          <RatingNumber value={rating100 ?? null} disabled withoutContext />
        </Button>
      </RatingCriteriaTooltip>
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
