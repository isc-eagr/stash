import React, { useMemo, useState } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { ModalComponent } from "src/components/Shared/Modal";

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
  stars?: number;
  rating10?: number;
  rating100: number;
  tier: string;
  tierClassName: string;
}

interface IRatingAdvisorButtonProps {
  entityType: AdvisorEntity;
}

const sceneMetrics: IAdvisorMetric[] = [
  {
    key: "performerAppeal",
    title: "Performer attractiveness",
    max: 10,
    weight: 0.4,
    hint:
      "Overall physical appeal: face, body impression, styling, sex appeal, visual magnetism, and immediate appeal.",
    choices: [
      {
        value: 0,
        label: "Not attractive",
        description:
          "Pick this when he is only relevant because of the scene, the theme, or another performer.",
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
          "Decent-looking, but you would not watch a scene just because he is in it.",
      },
      {
        value: 5,
        label: "Attractive enough",
        description:
          "Attractive enough that his presence improves a scene, especially if the scene is already good.",
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
        label: "Elite attractiveness",
        description:
          "Rare visual appeal, like he hits your type in a way most performers do not.",
      },
      {
        value: 10,
        label: "Near-perfect",
        description:
          "Near-perfect for your taste, the kind of look that makes him a favorite-type performer.",
      },
    ],
  },
  {
    key: "chemistry",
    title: "Energy / sex quality",
    max: 10,
    weight: 0.3,
    hint:
      "How much the sex, pacing, interaction, reactions, rhythm, and overall scene energy make the scene feel alive and satisfying.",
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
        label: "Elite",
        description:
          "The sex quality is one of the first things you would mention when explaining why the scene is hot.",
      },
      {
        value: 10,
        label: "All-time sex quality",
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
    hint:
      "How much the orgasm adds heat; and whether the scene has facials.",
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
    hint:
      "Optional bonus for a theme, fantasy, setting, or uniform concept that clearly increases appeal.",
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
    hint:
      "Optional bonus when the scene is oral-only and that format improves its appeal. If absent, it does not hurt the score.",
    choices: [
      {
        value: 0,
        label: "Not oral-only",
        description:
          "No bonus here; either it is not oral-only, or being oral-only does not make it hotter for you.",
      },
      {
        value: 0.5,
        label: "Oral-only bonus",
        description:
          "Use this when the oral-only focus is part of the appeal, like the scene works because it stays on that lane.",
      },
    ],
  },
  {
    key: "standoutAct",
    title: "Standout act / position / dynamic",
    max: 0.5,
    section: "bonus",
    hint:
      "Optional bonus when a specific act, position, role dynamic, or sexual setup makes the scene more distinctive.",
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
          "Pick this when a position, act, power dynamic, role setup, or specific sex beat makes the scene hotter.",
      },
    ],
  },
  {
    key: "largeGroup",
    title: "Group scene with 4+ performers",
    max: 0.5,
    section: "bonus",
    hint:
      "Optional bonus when a group scene has more than 3 performers and the larger lineup improves the appeal.",
    choices: [
      {
        value: 0,
        label: "No group bonus",
        description:
          "No bonus: the scene has 3 or fewer performers, or the group size does not make it hotter.",
      },
      {
        value: 0.5,
        label: "Large group bonus",
        description:
          "Use this when 4+ performers make the scene feel bigger, busier, hotter, or more memorable.",
      },
    ],
  },
  {
    key: "godTierOrgasm",
    title: "God-tier orgasm bonus",
    max: 2,
    section: "bonus",
    hint:
      "Optional bonus for a payoff so memorable that it pushes the whole scene into special territory.",
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
          "This is payoff-you-remember territory: the orgasm or facial is central to why the scene is special.",
      },
    ],
  },
  {
    key: "standout",
    title: "Standout moment",
    max: 2,
    weight: 0.5,
    hint:
      "Whether the scene has a specific memorable moment that sticks beyond the general setup.",
    choices: [
      {
        value: 0,
        label: "No standout moment",
        description:
          "Nothing specific sticks in your head; you may like the scene overall, but no moment jumps out.",
      },
      {
        value: 1,
        label: "One noticeable moment",
        description:
          "There is one nice moment, angle, reaction, line, pose, or beat that makes you go, okay, that was hot.",
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
    hint:
      "Penalty when there is no orgasm payoff, or the scene cuts away before anything useful happens.",
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
    hint:
      "Negative adjustment for distracting production problems. Select it only when the scene's visual or technical quality actively works against it.",
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

const performerMetrics: IAdvisorMetric[] = [
  {
    key: "attractiveness",
    title: "Attractiveness",
    max: 10,
    weight: 0.3,
    hint:
      "Overall physical appeal: face, body impression, styling, sex appeal, visual magnetism, and immediate appeal.",
    choices: [
      {
        value: 0,
        label: "Not attractive",
        description:
          "Pick this when he is only relevant because of the scene, the theme, or another performer.",
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
          "Decent-looking, but you would not watch a scene just because he is in it.",
      },
      {
        value: 5,
        label: "Attractive enough",
        description:
          "Attractive enough that his presence improves a scene, especially if the scene is already good.",
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
        label: "Elite attractiveness",
        description:
          "Rare visual appeal, like he hits your type in a way most performers do not.",
      },
      {
        value: 10,
        label: "Near-perfect",
        description:
          "Near-perfect for your taste, the kind of look that makes him a favorite-type performer.",
      },
    ],
  },
  {
    key: "performance",
    title: "Sexual performance",
    max: 10,
    weight: 0.2,
    hint:
      "On-screen presence, charisma, confidence, chemistry, reactions, intensity, rhythm, and scene energy.",
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
        label: "Elite",
        description:
          "He has that magnetic, highly rewatchable quality where you trust him to elevate a scene.",
      },
      {
        value: 10,
        label: "Scene-selling",
        description:
          "His presence alone can sell a scene; if his name is attached, you are already interested.",
      },
    ],
  },
  {
    key: "ethnicity",
    title: "Ethnicity / racial appeal",
    max: 3,
    weight: 0.5,
    hint:
      "Personal ethnic appeal based on known metadata, skin tone, self-presentation, or how you catalog the performer.",
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
    key: "bodyType",
    title: "Body type",
    max: 3,
    weight: 0.5,
    hint:
      "Preference order: athletic, average, lean, muscular, chubby, twink, fat/bearish.",
    choices: [
      {
        value: 0,
        label: "Works against preference",
        description:
          "His body type works against your taste, like it makes him less appealing even if other traits are okay.",
      },
      {
        value: 1,
        label: "Not aligned",
        description:
          "Not really aligned with your taste, like too twink, too chubby, or just not the build you usually want.",
      },
      {
        value: 2,
        label: "Some appeal",
        description:
          "His body has appeal, but is not ideal. Muscular or lean/slim body types fall here.",
      },
      {
        value: 3,
        label: "Strong preference match",
        description:
          "Strong match: athletic, attractive average/everyday, or another build that really works for you.",
      },
    ],
  },
  {
    key: "masculinity",
    title: "Masculinity",
    max: 3,
    weight: 0.5,
    hint:
      "Ruggedness, confidence, dominance, roughness, voice, styling, body language, working-class energy, bro energy, uniform compatibility, or traditionally masculine presentation.",
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
    hint:
      "Optional bonus when he maintains a strong pull across scenes instead of being a one-scene flash in the pan.",
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
    hint:
      "Optional bonus when dick size, shape, look, hardness, or presentation improves performer appeal.",
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
    hint:
      "Optional bonus when tattoos add edge, recognizability, identity, or visual appeal. If absent, it does not hurt the score.",
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
];

function getInitialScores(metrics: IAdvisorMetric[]) {
  return metrics.reduce<Record<string, number>>((ret, metric) => {
    ret[metric.key] = 0;
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

function formatAdvisorScore(value: number, forceDecimal = false) {
  if (forceDecimal) {
    return value.toFixed(1);
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function getSceneSuggestion(total: number): IRatingSuggestion {
  const rating10 = Math.round(total * 10) / 10;
  const rating100 = Math.round(rating10 * 10);

  if (rating10 >= 9) {
    return {
      rating10,
      rating100,
      tier: "Elite / Prismatic",
      tierClassName: "prismatic",
    };
  }
  if (rating10 >= 8.4) {
    return { rating10, rating100, tier: "Gold", tierClassName: "gold" };
  }
  if (rating10 >= 7.3) {
    return { rating10, rating100, tier: "Silver", tierClassName: "silver" };
  }
  if (rating10 >= 6) {
    return { rating10, rating100, tier: "Bronze", tierClassName: "bronze" };
  }

  return { rating10, rating100, tier: "Plain", tierClassName: "plain" };
}

function getPerformerSuggestion(total: number): IRatingSuggestion {
  return getSceneSuggestion(total);
}

const RatingAdvisorModal: React.FC<{
  entityType: AdvisorEntity;
  onClose: () => void;
}> = ({ entityType, onClose }) => {
  const metrics = entityType === "scene" ? sceneMetrics : performerMetrics;
  const [scores, setScores] = useState(() => getInitialScores(metrics));
  const [hoverScores, setHoverScores] = useState<Record<string, number | undefined>>({});
  const total = useMemo(
    () =>
      metrics.reduce(
        (sum, metric) => sum + getChoiceScore(metric, scores[metric.key]),
        0
      ),
    [metrics, scores]
  );
  const scoreCap = 10;
  const scoringTotal = Math.max(0, Math.min(total, scoreCap));
  const maxTotal = scoreCap;
  const suggestion =
    entityType === "scene"
      ? getSceneSuggestion(scoringTotal)
      : getPerformerSuggestion(scoringTotal);

  function setScore(metric: IAdvisorMetric, value: string) {
    const numericValue = Number(value);
    setScores((current) => ({
      ...current,
      [metric.key]: Number.isNaN(numericValue) ? 0 : numericValue,
    }));
  }

  function renderMetric(metric: IAdvisorMetric) {
    const score = scores[metric.key];
    const forceDecimal = true;
    const selected = metric.choices.find((choice) => choice.value === score);
    const hoverScore = hoverScores[metric.key];
    const preview =
      metric.choices.find((choice) => choice.value === hoverScore) ?? selected;
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
            {formatAdvisorScore(getChoiceScore(metric, score), forceDecimal)}/
            {formatAdvisorScore(getMetricMaxScore(metric), forceDecimal)}
          </Badge>
        </div>
        {showRange && (
          <Form.Control
            type="range"
            min={0}
            max={metric.max}
            step={1}
            value={score}
            onChange={(event) => setScore(metric, event.currentTarget.value)}
          />
        )}
        <div className="rating-advisor-selected">
          <strong>
            {preview?.value} - {preview?.label}
          </strong>
          <span>{preview?.description}</span>
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
              onClick={() => setScore(metric, choice.value.toString())}
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

  return (
    <ModalComponent
      show
      onHide={onClose}
      header={`${entityType === "scene" ? "Scene" : "Performer"} rating advisor`}
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
          <span>Total</span>
          <strong>
            {formatAdvisorScore(scoringTotal, true)}/
            {formatAdvisorScore(maxTotal, true)}
          </strong>
        </div>
        <div>
          <span>Suggested tier</span>
          <strong>{suggestion.tier}</strong>
        </div>
        <div>
          <span>Suggested rating</span>
          <strong>
            {formatAdvisorScore(suggestion.rating10 ?? 0, true)}/10 (
            {suggestion.rating100}/100)
          </strong>
        </div>
      </div>
      <p className="rating-advisor-note">
        This is only a suggestion. Set the actual rating manually when it feels
        right.
      </p>
      <div className="rating-advisor-metrics">
        {metrics
          .filter((metric) => metric.section === undefined)
          .map(renderMetric)}
        {metrics.some((metric) => metric.section === "bonus") && (
          <div className="rating-advisor-section-heading">Bonus</div>
        )}
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
}) => {
  const [showAdvisor, setShowAdvisor] = useState(false);

  return (
    <>
      <Button
        className="rating-advisor-button"
        onClick={() => setShowAdvisor(true)}
        title="Open rating advisor"
        variant="secondary"
      >
        <Icon icon={faWandMagicSparkles} />
      </Button>
      {showAdvisor && (
        <RatingAdvisorModal
          entityType={entityType}
          onClose={() => setShowAdvisor(false)}
        />
      )}
    </>
  );
};
