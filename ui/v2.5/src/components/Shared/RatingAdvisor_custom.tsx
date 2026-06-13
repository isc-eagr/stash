import { gql, useQuery } from "@apollo/client";
import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { ModalComponent } from "src/components/Shared/Modal";
import { RatingNumber } from "src/components/Shared/Rating/RatingNumber";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useToast } from "src/hooks/Toast";
import {
  getRatingCardThresholdsForEntity,
  normalizeRatingCardThresholds,
} from "src/utils/ratingCardStyles_custom";

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
  sceneRatingMode?: "default" | "solo";
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

const sceneMetrics: IAdvisorMetric[] = [
  {
    key: "performerAppeal",
    title: "Performer Attractiveness",
    max: 10,
    weight: 0.4,
    hint: "Overall physical appeal: face, body impression, styling, sex appeal, visual magnetism, and immediate appeal.",
    choices: [
      {
        value: 0,
        label: "Not attractive",
        description:
          "Pick this when he is only relevant because of another performer, the scene, or the theme.",
      },
      {
        value: 1,
        label: "Very low",
        description:
          "Very low personal attraction; there is little or nothing visually pulling you in.",
      },
      {
        value: 2,
        label: "Low",
        description:
          "Mostly not your type, though there may be one small thing that works.",
      },
      {
        value: 3,
        label: "Some appeal",
        description:
          "Some appeal, like a decent face or body detail, but weak overall.",
      },
      {
        value: 4,
        label: "Decent",
        description:
          "Decent-looking, but you would not watch a scene just because he is in it.",
      },
      {
        value: 5,
        label: "Good",
        description:
          "Good face; his presence improves a scene, especially if the scene is already good.",
      },
      {
        value: 6,
        label: "Clearly attractive",
        description:
          "Clearly attractive; he is a noticeable visual plus even before performance enters the picture.",
      },
      {
        value: 7,
        label: "Very attractive",
        description:
          "Very attractive, the kind of performer who gives a scene an immediate visual draw.",
      },
      {
        value: 8,
        label: "Extremely attractive",
        description:
          "Extremely attractive; his look is one of the main reasons you would click.",
      },
      {
        value: 9,
        label: "Near-perfect",
        description:
          "Near-perfect for your taste, he fits your type in pretty much every way.",
      },
      {
        value: 10,
        label: "Perfect",
        description:
          "Perfect for your taste, like he hits your type in a way most performers do not.",
      },
    ],
  },
  {
    key: "chemistry",
    title: "Energy / sex quality",
    max: 10,
    weight: 0.3,
    hint: "How much the sex, pacing, interaction, reactions, rhythm, and overall scene energy make the scene feel alive and satisfying.",
    choices: [
      {
        value: 0,
        label: "No energy",
        description:
          "Disconnected, mechanical, passive, awkward, or actively weak sex quality. This is for scenes where performers look like they don't want to be there.",
      },
      {
        value: 1,
        label: "Very low quality",
        description:
          "There may be one or two okay moments, but most of it feels flat, bored, or badly paced.",
      },
      {
        value: 2,
        label: "Low quality",
        description:
          "The scene is watchable, but you keep waiting for it to get better and it mostly does not.",
      },
      {
        value: 3,
        label: "Serviceable",
        description:
          "The sex is acceptable, like a routine scene that gets the job done without much spark.",
      },
      {
        value: 4,
        label: "Decent",
        description:
          "The pacing and reactions are decent enough that the scene feels alive in spots.",
      },
      {
        value: 5,
        label: "Good",
        description:
          "The sex quality clearly helps; you are engaged because the performers are actually working the scene.",
      },
      {
        value: 6,
        label: "Strong",
        description:
          "Use this when the rhythm, reactions, or intensity make the scene meaningfully hotter than the setup alone.",
      },
      {
        value: 7,
        label: "Very strong",
        description:
          "The sex itself is a major reason to come back, not just the cast, theme, or payoff.",
      },
      {
        value: 8,
        label: "Excellent",
        description:
          "The scene has the exact vibe you want: intense, playful, rough, romantic, dominant, natural, or whatever fits it.",
      },
      {
        value: 9,
        label: "Near-perfect quality",
        description:
          "The sex quality is one of the first things you would mention when explaining why the scene is hot.",
      },
      {
        value: 10,
        label: "Perfect quality",
        description:
          "This is the rare scene where the sex quality alone can carry it, even without extra bonuses.",
      },
    ],
  },
  {
    key: "payoff",
    title: "Orgasm quality",
    max: 4,
    weight: 0.5,
    hint: "How much the orgasm adds heat; and whether the scene has facials.",
    choices: [
      {
        value: 0,
        label: "Unremarkable orgasms",
        description:
          "There is an orgasm, but it is blink-and-you-miss-it, badly framed, or just not memorable.",
      },
      {
        value: 2,
        label: "Standard orgasms",
        description:
          "A normal solid orgasm: hot because orgasms are hot, but not something you would describe later.",
      },
      {
        value: 3,
        label: "Above average",
        description:
          "Use this for above-average orgasms, or a standard facial that gives the scene a real bump.",
      },
      {
        value: 4,
        label: "Outstanding orgasms",
        description:
          "The orgasm/facial is a real highlight, like good framing, strong intensity, or a payoff you would seek out again.",
      },
    ],
  },
  {
    key: "theme",
    title: "Theme / fantasy / uniform factor",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus for a theme, fantasy, setting, or uniform concept that clearly increases appeal.",
    choices: [
      {
        value: 0,
        label: "No theme bonus",
        description:
          "No extra theme help here; removing the setting, outfit, or fantasy would not really change your rating.",
      },
      {
        value: 0.5,
        label: "Theme present",
        description:
          "Military, cop, office, firefighter, mechanic, blue collar, uniform, or another strong theme that makes the scene hotter.",
      },
    ],
  },
  {
    key: "oralOnly",
    title: "Oral-only scene",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus when the scene is oral-only and that format improves its appeal. If absent, it does not hurt the score.",
    choices: [
      {
        value: 0,
        label: "Not oral-only",
        description: "Not an oral-only scene.",
      },
      {
        value: 0.5,
        label: "Oral-only bonus",
        description: "Oral-only scene.",
      },
    ],
  },
  {
    key: "standoutAct",
    title: "Standout act / position / dynamic",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus when a specific act, position, role dynamic, or sexual setup makes the scene more distinctive.",
    choices: [
      {
        value: 0,
        label: "No bonus",
        description:
          "No specific act or dynamic stands out; the scene may still be good, just not because of a particular move.",
      },
      {
        value: 0.5,
        label: "Standout dynamic",
        description:
          "For sex and oral scenes, this means the scene has stomping, feet sucking, dirty talk, sperm eating, or another specific act or dynamic that makes the scene more memorable. For solo scenes, select this if the scene has feet, sperm on camera, or another specific act or dynamic that makes it more memorable.",
      },
    ],
  },
  {
    key: "largeGroup",
    title: "Group scene with 4+ performers",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus when a group scene has more than 3 performers and the larger lineup improves the appeal.",
    choices: [
      {
        value: 0,
        label: "No group bonus",
        description: "No bonus: the scene has 3 or fewer performers.",
      },
      {
        value: 0.5,
        label: "Large group bonus",
        description: "Group scene with 4 or more performers.",
      },
    ],
  },
  {
    key: "godTierOrgasm",
    title: "God-tier orgasm bonus",
    max: 2,
    section: "bonus",
    hint: "Optional bonus for a payoff so memorable that it pushes the whole scene into special territory.",
    choices: [
      {
        value: 0,
        label: "Not god-tier",
        description:
          "No extra bonus here; the orgasm may still be good, but it is covered by the main orgasm quality score.",
      },
      {
        value: 2,
        label: "God-tier orgasms",
        description:
          "The orgasm or facial is central to why the scene is special.",
      },
    ],
  },
  {
    key: "goatElement",
    title: "GOAT element",
    max: 2,
    section: "bonus",
    hint: "Optional bonus when any scene content has the GOAT tag or a GOAT-level element, even if the rest of the scene is not as strong.",
    choices: [
      {
        value: 0,
        label: "No GOAT element",
        description:
          "No extra bonus here; the scene does not have a GOAT-tagged or GOAT-level content element.",
      },
      {
        value: 2,
        label: "GOAT element",
        description:
          "Use this for GOAT-tagged content, like a GOAT blowjob or another standout GOAT element that elevates the scene.",
      },
    ],
  },
  {
    key: "unlikelyTop",
    title: "Unlikely top",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus when a performer visually reads like a bottom but tops in this scene, and that contrast makes the scene hotter.",
    choices: [
      {
        value: 0,
        label: "No bonus",
        description:
          "No bonus: the scene does not have that unlikely-top contrast, or it does not affect its appeal.",
      },
      {
        value: 0.5,
        label: "Unlikely top bonus",
        description:
          "Use this when the contrast between bottom-coded visuals and actual top energy makes the scene more interesting or hot.",
      },
    ],
  },
  {
    key: "standout",
    title: "Standout moment",
    max: 2,
    weight: 0.5,
    hint: "Whether the scene has a specific memorable moment that sticks beyond the general setup.",
    choices: [
      {
        value: 0,
        label: "No standout moment",
        description:
          "Nothing specific sticks in your head; you may like the scene overall, but no moment jumps out.",
      },
      {
        value: 1,
        label: "One or two noticeable moments",
        description:
          "There is one or two nice moments, angles, reactions, lines, poses, or beats that make you go, okay, that was hot.",
      },
      {
        value: 2,
        label: "Multiple defining moments",
        description:
          "There are multiple moments in the scene that are memorable and really hot.",
      },
    ],
  },
  {
    key: "noOrgasm",
    title: "No orgasm",
    max: 0,
    section: "penalty",
    hint: "Penalty when there is no orgasm payoff, or the scene cuts away before anything useful happens.",
    choices: [
      {
        value: 0,
        label: "Orgasm present",
        description:
          "No penalty here; the scene has some kind of orgasm payoff.",
      },
      {
        value: -1,
        label: "No orgasm penalty",
        description:
          "Use this when there is no orgasm payoff, or the scene cuts away before anything useful happens.",
      },
    ],
  },
  {
    key: "production",
    title: "Production / visual quality",
    max: 0,
    section: "penalty",
    hint: "Negative adjustment for distracting production problems. Select it only when the scene's visual or technical quality actively works against it.",
    choices: [
      {
        value: 0,
        label: "No penalty",
        description:
          "Production is fine enough; even if it is not beautiful, it does not get in the way.",
      },
      {
        value: -1,
        label: "Quality works against it",
        description:
          "Use this when the camera, lighting, edit, audio, resolution, or framing makes you think, damn, this would be hotter if it were shot better.",
      },
    ],
  },
];

const soloSceneMetrics: IAdvisorMetric[] = [
  {
    key: "soloPerformerAppeal",
    title: "Performer Attractiveness",
    max: 10,
    weight: 0.7,
    hint: "Overall solo performer appeal: face, body, styling, sex appeal, visual magnetism, and immediate draw.",
    choices: sceneMetrics[0].choices,
  },
  {
    key: "cameraWork",
    title: "Angles and camera work",
    max: 5,
    weight: 0.6,
    hint: "How much the framing, angles, movement, focus, lighting, and shot choices make the solo scene hotter.",
    choices: [
      {
        value: 0,
        label: "Works against it",
        description:
          "The camera actively hurts the scene: bad framing, weak angles, distracting focus, or missed action.",
      },
      {
        value: 1,
        label: "Weak",
        description:
          "A few usable shots, but the camera mostly fails to show the scene in a satisfying way.",
      },
      {
        value: 2,
        label: "Serviceable",
        description:
          "The camera gets the basics, but the angles do not add much heat.",
      },
      {
        value: 3,
        label: "Good",
        description:
          "Solid angles and framing that help the solo performance land.",
      },
      {
        value: 4,
        label: "Excellent",
        description:
          "Strong camera work with hot framing, clear payoff, and angles that meaningfully improve the scene.",
      },
      {
        value: 5,
        label: "Perfect",
        description:
          "Exactly the angles and camera work you want from a solo scene; the shooting style is a major reason it works.",
      },
    ],
  },
  {
    key: "orgasmBonus",
    title: "Orgasm",
    max: 1,
    section: "bonus",
    hint: "Solo-only bonus when the orgasm payoff is present and helps the scene.",
    choices: [
      {
        value: 0,
        label: "No orgasm bonus",
        description:
          "No extra bonus here; either there is no useful payoff or it does not improve the scene.",
      },
      {
        value: 1,
        label: "Orgasm bonus",
        description:
          "The scene has an orgasm payoff that meaningfully improves the solo scene.",
        scoreValue: 1,
      },
    ],
  },
  {
    key: "feetBonus",
    title: "Feet",
    max: 1,
    section: "bonus",
    hint: "Solo-only bonus when feet meaningfully improve the scene.",
    choices: [
      {
        value: 0,
        label: "No feet bonus",
        description:
          "No extra bonus here; feet are absent, incidental, or not part of why the scene works.",
      },
      {
        value: 1,
        label: "Feet bonus",
        description:
          "Feet are present in a way that meaningfully improves the solo scene.",
        scoreValue: 1,
      },
    ],
  },
  {
    key: "outstandingPerformance",
    title: "Outstanding performance",
    max: 1,
    section: "bonus",
    hint: "Solo-only bonus when the performer brings unusually strong energy, charisma, intensity, or presence.",
    choices: [
      {
        value: 0,
        label: "No performance bonus",
        description:
          "No extra bonus here; the solo performance may be fine, but it is not the reason the scene stands out.",
      },
      {
        value: 1,
        label: "Outstanding performance",
        description:
          "Use this when the solo performer brings exceptional energy, reactions, confidence, intensity, or presence.",
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

const performerMetrics: IAdvisorMetric[] = [
  {
    key: "face",
    title: "Face",
    max: 10,
    weight: 0.3,
    hint: "Facial attractiveness: features, expression, gaze, smile, grooming, styling, and how strongly his face pulls your attention.",
    choices: [
      {
        value: 0,
        label: "Not facially attractive",
        description:
          "Pick this when his face works against your attraction even if other parts of him may still work.",
      },
      {
        value: 1,
        label: "Very low",
        description:
          "Very low personal attraction; there is little or nothing visually pulling you in.",
      },
      {
        value: 2,
        label: "Mostly not your type",
        description:
          "Mostly not your type, though there may be one small thing that works.",
      },
      {
        value: 3,
        label: "Some appeal",
        description:
          "Some appeal, like a decent face or body detail, but weak overall.",
      },
      {
        value: 4,
        label: "Decent",
        description:
          "Decent face, but you would not watch a scene just because of his look.",
      },
      {
        value: 5,
        label: "Good",
        description:
          "Good face; his presence improves a scene, especially if the scene is already good.",
      },
      {
        value: 6,
        label: "Clearly attractive",
        description:
          "Clearly attractive; he is a noticeable visual plus even before performance enters the picture.",
      },
      {
        value: 7,
        label: "Very attractive",
        description:
          "Very attractive, the kind of performer who gives a scene an immediate visual draw.",
      },
      {
        value: 8,
        label: "Extremely attractive",
        description:
          "Extremely attractive; his look is one of the main reasons you would click.",
      },
      {
        value: 9,
        label: "Near-perfect",
        description:
          "Near-perfect for your taste, his face fits your type in pretty much every way.",
      },
      {
        value: 10,
        label: "Perfect",
        description:
          "Perfect for your taste, like his face hits your type in a way most performers do not.",
      },
    ],
  },
  {
    key: "body",
    title: "Body",
    max: 10,
    weight: 0.3,
    hint: "Body appeal: build, proportions, musculature, thickness, posture, movement, and how strongly his body matches your taste.",
    choices: [
      {
        value: 0,
        label: "Works against preference",
        description:
          "His body works against your attraction even if other traits are okay.",
      },
      {
        value: 1,
        label: "Very low",
        description:
          "Very little body appeal for your taste; the build is actively not what you want.",
      },
      {
        value: 2,
        label: "Mostly not your type",
        description:
          "Mostly not your body type, though there may be one small detail that works.",
      },
      {
        value: 3,
        label: "Some appeal",
        description:
          "Some body appeal, but the overall build is still weak for your taste.",
      },
      {
        value: 4,
        label: "Decent",
        description:
          "Decent body, but not a build that would pull you into a scene by itself.",
      },
      {
        value: 5,
        label: "Good",
        description:
          "Good body; his presence improves a scene when the rest is working.",
      },
      {
        value: 6,
        label: "Clearly attractive",
        description:
          "Clearly attractive body; he is a noticeable visual plus before performance enters the picture.",
      },
      {
        value: 7,
        label: "Very attractive",
        description:
          "Very attractive body, the kind of build that gives him immediate visual draw.",
      },
      {
        value: 8,
        label: "Extremely attractive",
        description:
          "Extremely attractive body; his build is one of the main reasons you would click.",
      },
      {
        value: 9,
        label: "Near-perfect",
        description:
          "Near-perfect for your taste, his body fits your type in pretty much every way.",
      },
      {
        value: 10,
        label: "Perfect",
        description:
          "Perfect for your taste, like his body hits your type in a way most performers do not.",
      },
    ],
  },
  {
    key: "performance",
    title: "Sexual performance",
    max: 10,
    weight: 0.2,
    hint: "On-screen presence, charisma, confidence, chemistry, reactions, intensity, rhythm, and scene energy.",
    choices: [
      {
        value: 0,
        label: "Weak",
        description:
          "Pick this when he makes scenes worse: awkward, passive, disconnected, or like he does not know what to do.",
      },
      {
        value: 1,
        label: "Very low",
        description:
          "He might look good, but on screen he is mostly just there and easy to forget.",
      },
      {
        value: 2,
        label: "Below average",
        description:
          "He does not ruin the scene, but he is not adding much energy, reaction, or presence.",
      },
      {
        value: 3,
        label: "Serviceable",
        description:
          "He gets through the scene fine, like a competent performer, but you are not seeking him out.",
      },
      {
        value: 4,
        label: "Decent",
        description:
          "He contributes enough that you notice him, but he is still not one of the main attractions.",
      },
      {
        value: 5,
        label: "Good",
        description:
          "He clearly helps scenes feel better, like his reactions or confidence make things click.",
      },
      {
        value: 6,
        label: "Strong",
        description:
          "He noticeably improves most scenes he is in, even when the setup is basic.",
      },
      {
        value: 7,
        label: "Very strong",
        description:
          "He brings confidence, chemistry, reactions, and energy often enough that he feels like a real draw.",
      },
      {
        value: 8,
        label: "Excellent",
        description:
          "He is often one of the main reasons a scene works, not just a good-looking body in frame.",
      },
      {
        value: 9,
        label: "Near-Perfect",
        description:
          "He has that magnetic, highly rewatchable quality where you trust him to elevate a scene.",
      },
      {
        value: 10,
        label: "Perfect",
        description:
          "His presence alone can sell a scene; if his name is attached, you are already interested.",
      },
    ],
  },
  {
    key: "ethnicity",
    title: "Ethnicity / racial appeal",
    max: 3,
    weight: 1 / 3,
    hint: "Personal ethnic appeal based on known metadata, skin tone, self-presentation, or how you catalog the performer.",
    choices: [
      {
        value: 0,
        label: "Negative ethnic appeal",
        description:
          "Use this when his ethnic background works against your personal attraction.",
      },
      {
        value: 1,
        label: "Neutral background",
        description:
          "No favorable or negative ethnic appeal; for example, a white guy where ethnicity is not part of the pull.",
      },
      {
        value: 2,
        label: "Partial ethnic appeal",
        description:
          "Black or Latino background is present, but the skin tone or presentation is not the most favorable version for your taste.",
      },
      {
        value: 3,
        label: "Full ethnic appeal",
        description:
          "Black or Latino with favorable skin tone and presentation; ethnicity is a real part of the attraction.",
      },
    ],
  },
  {
    key: "masculinity",
    title: "Masculinity",
    max: 3,
    weight: 1 / 3,
    hint: "Ruggedness, confidence, dominance, roughness, voice, styling, body language, working-class energy, bro energy, uniform compatibility, or traditionally masculine presentation.",
    choices: [
      {
        value: 0,
        label: "No masculine appeal",
        description:
          "No meaningful masculine appeal for your taste, or his presentation goes in a direction you do not care for.",
      },
      {
        value: 1,
        label: "Some masculine appeal",
        description:
          "Some masculine traits show up, like styling, voice, confidence, or body language, but they are not a major factor.",
      },
      {
        value: 2,
        label: "Strong",
        description:
          "Clearly masculine in a way that matters, like rugged, confident, dominant, rough, or working-class coded.",
      },
      {
        value: 3,
        label: "Core ideal",
        description:
          "Core ideal territory: his masculine presentation is one of the first things you would mention.",
      },
    ],
  },
  {
    key: "consistency",
    title: "Consistency",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus when he maintains a strong pull across scenes instead of being a one-scene flash in the pan.",
    choices: [
      {
        value: 0,
        label: "No consistency bonus",
        description:
          "No bonus: he is unproven, inconsistent, or the appeal is mostly tied to one scene.",
      },
      {
        value: 0.5,
        label: "Consistent draw",
        description:
          "He holds appeal across multiple scenes and still makes you think, yeah, I get the appeal.",
      },
    ],
  },
  {
    key: "dick",
    title: "Dick",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus when dick size, shape, look, hardness, or presentation improves performer appeal.",
    choices: [
      {
        value: 0,
        label: "No dick bonus",
        description:
          "No bonus: unknown, not noticeable, not your preference, or just not part of why he works.",
      },
      {
        value: 0.5,
        label: "Dick bonus",
        description:
          "The dick appeal is a meaningful extra plus when the scene shows it well.",
      },
    ],
  },
  {
    key: "tattoosBonus",
    title: "Tattoos",
    max: 0.5,
    section: "bonus",
    hint: "Optional bonus when tattoos add edge, recognizability, identity, or visual appeal. If absent, it does not hurt the score.",
    choices: [
      {
        value: 0,
        label: "Not present",
        description:
          "No bonus: no tattoos, unknown tattoos, or the tattoos do not really add anything for you.",
      },
      {
        value: 0.5,
        label: "Present",
        description:
          "The tattoos help, like they add edge, recognizability, roughness, or make his look more memorable.",
      },
    ],
  },
  {
    key: "feminine",
    title: "Feminine",
    max: 0,
    section: "penalty",
    hint: "Penalty when a performer's feminine presentation lowers his appeal for your rating.",
    choices: [
      {
        value: 0,
        label: "No penalty",
        description:
          "No penalty here; his presentation does not reduce your attraction.",
      },
      {
        value: -1,
        label: "Feminine penalty",
        description:
          "Use this when the performer reads too feminine for your taste and it meaningfully lowers the rating.",
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

function getInitialScores(
  metrics: IAdvisorMetric[],
  persistedScores?: readonly IAdvisorPersistedScore[] | null
) {
  return metrics.reduce<Record<string, number>>((ret, metric) => {
    const persistedScore = persistedScores?.find(
      (score) =>
        score.key === metric.key &&
        normalizePersistedScoreSection(score.section) ===
          getMetricSection(metric)
    );
    ret[metric.key] = persistedScore?.raw_value ?? 0;
    return ret;
  }, {});
}

function getChoiceScore(metric: IAdvisorMetric, score: number) {
  const choice = metric.choices.find((c) => c.value === score);

  if (choice?.scoreValue !== undefined) {
    return choice.scoreValue;
  }

  return score * (metric.weight ?? 1);
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

function formatMetricContribution(metric: IAdvisorMetric, score: number) {
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
    return "Permanent bonus from recorded orgasms: +1 rating point on the 3rd orgasm, then +1 for each orgasm after that.";
  }

  return "Permanent bonus from recorded orgasms: +1 rating point on the 3rd orgasm, then +1 for every 2 orgasms after that.";
}

function getLongestChoiceDescription(metric: IAdvisorMetric) {
  return metric.choices.reduce((longest, choice) =>
    choice.description.length > longest.description.length ? choice : longest
  );
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
  sceneRatingMode?: "default" | "solo";
  ratingScores?: readonly IAdvisorPersistedScore[] | null;
  onRatingSaved?: () => void | Promise<unknown>;
  onClose: () => void;
}> = ({
  entityType,
  entityId,
  sceneRatingMode = "default",
  ratingScores,
  onRatingSaved,
  onClose,
}) => {
  const { configuration } = useConfigurationContext();
  const Toast = useToast();
  const [setRatingScore, { loading: savingScore }] =
    GQL.useRatingScoreSetMutation();
  const metrics =
    entityType === "scene" && sceneRatingMode === "solo"
      ? soloSceneMetrics
      : entityType === "scene"
      ? sceneMetrics
      : performerMetrics;
  const { data: advisorScoresData } = useQuery<{
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
  const [persistedScores, setPersistedScores] = useState<
    readonly IAdvisorPersistedScore[] | null | undefined
  >(ratingScores);
  const [scores, setScores] = useState(() =>
    getInitialScores(metrics, ratingScores)
  );
  const [hoverScores, setHoverScores] = useState<
    Record<string, number | undefined>
  >({});

  useEffect(() => {
    if (advisorScoresData?.ratingScores) {
      setPersistedScores(advisorScoresData.ratingScores);
    }
  }, [advisorScoresData]);

  useEffect(() => {
    setScores(getInitialScores(metrics, persistedScores));
  }, [metrics, persistedScores]);

  const orgasmCount = advisorScoresData?.ratingOrgasmCount ?? 0;
  const orgasmBonus = calculateOrgasmBonus(entityType, orgasmCount);
  const total = useMemo(
    () =>
      metrics.reduce(
        (sum, metric) => sum + getChoiceScore(metric, scores[metric.key]),
        0
      ) +
      orgasmBonus / 10,
    [metrics, orgasmBonus, scores]
  );
  const scoringTotal = Math.max(0, total);
  const suggestion = getSceneSuggestion(scoringTotal, thresholds);

  async function setScore(metric: IAdvisorMetric, value: string) {
    const numericValue = Number(value);
    const normalizedValue = Number.isNaN(numericValue) ? 0 : numericValue;
    const previousValue = scores[metric.key];
    const selectedChoice = metric.choices.find(
      (choice) => choice.value === normalizedValue
    );
    const weightedValue = getChoiceScore(metric, normalizedValue);

    setScores((current) => ({
      ...current,
      [metric.key]: normalizedValue,
    }));

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
      if (result.data?.ratingScoreSet?.scores) {
        setPersistedScores(result.data.ratingScoreSet.scores);
      }
      await onRatingSaved?.();
    } catch (e) {
      setScores((current) => ({
        ...current,
        [metric.key]: previousValue,
      }));
      Toast.error(e);
    }
  }

  function renderMetric(metric: IAdvisorMetric) {
    const score = scores[metric.key];
    const selected = metric.choices.find((choice) => choice.value === score);
    const hoverScore = hoverScores[metric.key];
    const preview =
      metric.choices.find((choice) => choice.value === hoverScore) ?? selected;
    const previewSizer = getLongestChoiceDescription(metric);
    const showRange =
      metric.choices.length === metric.max + 1 &&
      metric.choices.every((choice, index) => choice.value === index);

    return (
      <section className="rating-advisor-metric" key={metric.key}>
        <div className="rating-advisor-metric-header">
          <div>
            <h5>{metric.title}</h5>
            <p>{metric.hint}</p>
          </div>
          <Badge variant="secondary">
            {formatMetricContribution(metric, score)}
          </Badge>
        </div>
        {showRange && (
          <Form.Control
            type="range"
            min={0}
            max={metric.max}
            step={1}
            value={score}
            disabled={savingScore}
            onChange={(event) =>
              void setScore(metric, event.currentTarget.value)
            }
          />
        )}
        <div className="rating-advisor-selected">
          <div className="rating-advisor-selected-preview">
            <strong>
              {preview?.value} - {preview?.label}
            </strong>
            <span>{preview?.description}</span>
          </div>
          <div className="rating-advisor-selected-sizer" aria-hidden="true">
            <strong>
              {previewSizer.value} - {previewSizer.label}
            </strong>
            <span>{previewSizer.description}</span>
          </div>
        </div>
        <div className="rating-advisor-choice-list">
          {metric.choices.map((choice) => (
            <button
              className={choice.value === score ? "selected" : ""}
              key={choice.value}
              onMouseEnter={() =>
                setHoverScores((current) => ({
                  ...current,
                  [metric.key]: choice.value,
                }))
              }
              onMouseLeave={() =>
                setHoverScores((current) => ({
                  ...current,
                  [metric.key]: undefined,
                }))
              }
              disabled={savingScore}
              onClick={() => void setScore(metric, choice.value.toString())}
              type="button"
            >
              <strong>{choice.value}</strong>
              <span>{choice.label}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderOrgasmBonus() {
    return (
      <section className="rating-advisor-metric" key="orgasm-count-bonus">
        <div className="rating-advisor-metric-header">
          <div>
            <h5>Orgasm count bonus</h5>
            <p>{getOrgasmBonusDescription(entityType)}</p>
          </div>
          <Badge variant="secondary">
            {formatRatingContribution(orgasmBonus / 10)}
          </Badge>
        </div>
        <div className="rating-advisor-selected">
          <strong>
            {orgasmCount} orgasms - {orgasmBonus} bonus points
          </strong>
          <span>
            This bonus is calculated automatically and cannot be edited.
          </span>
        </div>
      </section>
    );
  }

  return (
    <ModalComponent
      show
      onHide={onClose}
      header={`${entityType === "scene" ? "Scene" : "Performer"} rating system`}
      icon={faWandMagicSparkles}
      cancel={{ onClick: onClose, variant: "secondary" }}
      accept={{ onClick: onClose }}
      modalProps={{ size: "lg" }}
      dialogClassName="rating-advisor-dialog"
    >
      <div
        className={`rating-advisor-summary rating-advisor-summary-${suggestion.tierClassName}`}
      >
        <div>
          <span>Current tier</span>
          <strong>{suggestion.tier}</strong>
        </div>
        <div>
          <span>Rating</span>
          <strong>{suggestion.rating100}</strong>
        </div>
      </div>
      <p className="rating-advisor-note">
        Selections save immediately and recalculate the rating stored on this
        item.
      </p>
      <div className="rating-advisor-metrics">
        {metrics
          .filter((metric) => metric.section === undefined)
          .map(renderMetric)}
        <div className="rating-advisor-section-heading">Bonus</div>
        {renderOrgasmBonus()}
        {metrics
          .filter((metric) => metric.section === "bonus")
          .map(renderMetric)}
        {metrics.some((metric) => metric.section === "penalty") && (
          <div className="rating-advisor-section-heading">Penalties</div>
        )}
        {metrics
          .filter((metric) => metric.section === "penalty")
          .map(renderMetric)}
      </div>
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
      <Button
        className="rating-advisor-button"
        onClick={() => setShowAdvisor(true)}
        title="Open rating system"
        variant="secondary"
      >
        <RatingNumber value={rating100 ?? null} disabled withoutContext />
      </Button>
      {showAdvisor && (
        <RatingAdvisorModal
          entityType={entityType}
          entityId={entityId}
          sceneRatingMode={sceneRatingMode}
          ratingScores={ratingScores}
          onRatingSaved={onRatingSaved}
          onClose={() => setShowAdvisor(false)}
        />
      )}
    </>
  );
};
