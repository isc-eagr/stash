import React from "react";
import cx from "classnames";
import { getRatingAdvisorAdjustmentTooltipLabelCustom } from "src/components/Shared/ratingAdvisorScales_custom";
import { RatingStrip } from "src/components/Shared/RatingStrip_custom";
import * as GQL from "src/core/generated-graphql";
import {
  PerformerRatingCriteriaCriterionOption,
  SceneRatingCriteriaCriterionOption,
} from "src/models/list-filter/criteria/rating-criteria_custom";

import "./StudioRatingAdvisorStats.scss";

type RatingAdvisorSection = GQL.StudioRatingAdvisorSectionDataFragment;

export type StudioRatingAdvisorSectionKey =
  | "solo_scenes"
  | "sex_scenes"
  | "threesome_scenes"
  | "group_scenes"
  | "performers";

interface ISectionDefinition {
  key: StudioRatingAdvisorSectionKey;
  title: string;
  singular: string;
  plural: string;
  ratingLabel: string;
  // Rubric order; `short` labels the inline strip.
  criteria: Record<string, { label: string; short: string; max: number }>;
}

// Standard (2 vatos) and Threesome (3 vatos) share one rubric.
const sexSceneCriteria: ISectionDefinition["criteria"] = {
  topAttractiveness: { label: "Top(s) Attractiveness", short: "Top", max: 30 },
  bottomAttractiveness: {
    label: "Bottom(s) Attractiveness",
    short: "Bottom",
    max: 10,
  },
  chemistry: { label: "Energy / sex quality", short: "Energy", max: 20 },
  standout: { label: "Usable factor", short: "Usable", max: 20 },
  payoff: { label: "Orgasm quality", short: "Orgasm", max: 20 },
};

export const studioRatingAdvisorSectionDefinitions: ISectionDefinition[] = [
  {
    key: "solo_scenes",
    title: "Solo Criteria",
    singular: "scene",
    plural: "scenes",
    ratingLabel: "Average scene rating",
    criteria: {
      soloPerformerAppeal: {
        label: "Vato Attractiveness",
        short: "Vato",
        max: 50,
      },
      soloPerformance: { label: "Performance", short: "Performance", max: 30 },
      soloUsability: { label: "Usability", short: "Usable", max: 20 },
    },
  },
  {
    key: "sex_scenes",
    title: "Standard Criteria",
    singular: "scene",
    plural: "scenes",
    ratingLabel: "Average scene rating",
    criteria: sexSceneCriteria,
  },
  {
    key: "threesome_scenes",
    title: "Threesome Criteria",
    singular: "scene",
    plural: "scenes",
    ratingLabel: "Average scene rating",
    criteria: sexSceneCriteria,
  },
  {
    key: "group_scenes",
    title: "Group Criteria",
    singular: "scene",
    plural: "scenes",
    ratingLabel: "Average scene rating",
    criteria: {
      groupTopAttractiveness: {
        label: "Top Lineup Attractiveness",
        short: "Tops",
        max: 30,
      },
      groupEnergy: { label: "Energy / coordination", short: "Energy", max: 30 },
      groupUsability: { label: "Usability", short: "Usable", max: 20 },
      groupPayoff: { label: "Orgasm Quality", short: "Orgasm", max: 20 },
    },
  },
  {
    key: "performers",
    title: "Performers",
    singular: "performer",
    plural: "performers",
    ratingLabel: "Average performer rating",
    criteria: {
      face: { label: "Face", short: "Face", max: 30 },
      body: { label: "Body", short: "Body", max: 30 },
      performance: { label: "Sexual performance", short: "Sex", max: 20 },
      ethnicity: { label: "Ethnicity / racial appeal", short: "Race", max: 10 },
      masculinity: { label: "Masculinity", short: "Masc", max: 10 },
    },
  },
];

function formatRatingValue(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function formatAverageContribution(value: number, max: number) {
  const points = value * 10;
  return `${formatRatingValue(points)}/${formatRatingValue(max)}`;
}

function formatEntityCount(count: number, singular: string, plural: string) {
  return `${count} rated ${count === 1 ? singular : plural}`;
}

function averageHeatLevel(fillPercent: number) {
  return Math.max(0, Math.min(5, Math.round(fillPercent / 20)));
}

// Meter steps per criterion: one per choice above the lowest.
const criterionSteps = new Map(
  [
    ...SceneRatingCriteriaCriterionOption.criteria,
    ...PerformerRatingCriteriaCriterionOption.criteria,
  ].map((criterion) => [criterion.key, criterion.choices.length - 1])
);

// CUSTOM: one rubric's averages as an inline strip; each criterion fills
// part of a step, and bonuses/penalties show how many items have them.
export const StudioRatingAdvisorSection: React.FC<{
  definition: ISectionDefinition;
  stats: RatingAdvisorSection;
  className?: string;
  title?: React.ReactNode;
}> = ({ definition, stats, className, title = definition.title }) => {
  const { singular, plural } = definition;
  const countLabel = (count: number) =>
    `${count} ${count === 1 ? singular : plural}`;
  // Rubric order, so Orgasm stays last whatever order the server returns.
  const criterionOrder = Object.keys(definition.criteria);
  const orderIndex = (key: string) => {
    const index = criterionOrder.indexOf(key);
    return index < 0 ? criterionOrder.length : index;
  };
  const criteria = [...stats.criteria]
    .sort((a, b) => orderIndex(a.key) - orderIndex(b.key))
    .map((criterion) => {
      const criterionDefinition = definition.criteria[criterion.key];
      const steps = criterionSteps.get(criterion.key) ?? 5;
      const label = criterionDefinition?.label ?? criterion.key;
      return {
        key: criterion.key,
        label: criterionDefinition?.short ?? label,
        detail: `${label}: ${formatAverageContribution(
          criterion.average_weighted_value,
          criterionDefinition?.max ?? 0
        )}, averaged from ${countLabel(criterion.entity_count)}`,
        steps,
        value: (criterion.average_fill_percent / 100) * steps,
        heatLevel: averageHeatLevel(criterion.average_fill_percent),
        rated: criterion.entity_count > 0,
      };
    });
  const adjustments = stats.adjustments.map((adjustment) => {
    const label = getRatingAdvisorAdjustmentTooltipLabelCustom(
      adjustment.key,
      adjustment.key
    );
    return {
      key: adjustment.key,
      label,
      section: adjustment.section === "penalty" ? "penalty" : "bonus",
      value: `×${adjustment.entity_count}`,
      detail: `${label}: ${countLabel(adjustment.entity_count)}`,
    } as const;
  });

  return (
    <section className={cx("studio-rating-advisor-section", className)}>
      <header className="studio-rating-advisor-section-header">
        <h3>{title}</h3>
        <span>{formatEntityCount(stats.entity_count, singular, plural)}</span>
        <strong aria-label={definition.ratingLabel}>
          {stats.average_rating100 === null ||
          stats.average_rating100 === undefined
            ? "—"
            : `${formatRatingValue(stats.average_rating100)}/100`}
        </strong>
      </header>
      {stats.entity_count === 0 ? (
        <div className="studio-rating-advisor-empty">
          No advisor criteria yet.
        </div>
      ) : (
        <RatingStrip
          adjustments={adjustments}
          className="rating-criteria-strip--average"
          criteria={criteria}
          idPrefix={`rating-average-${definition.key}`}
        />
      )}
    </section>
  );
};

interface IRatingAdvisorStatsContentProps {
  stats: {
    overall_scene_average_rating100?: number | null;
    solo_scenes?: RatingAdvisorSection;
    sex_scenes?: RatingAdvisorSection;
    threesome_scenes?: RatingAdvisorSection;
    group_scenes?: RatingAdvisorSection;
    performers?: RatingAdvisorSection;
  };
  sectionKeys?: StudioRatingAdvisorSectionKey[];
  title?: string;
  description?: string;
  showOverallSceneAverage?: boolean;
  hideEmptySceneSections?: boolean;
}

export const RatingAdvisorStatsContent: React.FC<
  IRatingAdvisorStatsContentProps
> = ({
  stats,
  sectionKeys = studioRatingAdvisorSectionDefinitions.map(
    (definition) => definition.key
  ),
  title = "Rating Advisor Averages",
  description = "Each strip only counts scenes or vatos rated on that criterion.",
  showOverallSceneAverage = true,
  hideEmptySceneSections = false,
}) => {
  const definitions = studioRatingAdvisorSectionDefinitions.filter(
    (definition) => {
      const section = stats[definition.key];
      const isEmptySceneSection =
        definition.key !== "performers" && section?.entity_count === 0;
      return (
        sectionKeys.includes(definition.key) &&
        !!section &&
        (!hideEmptySceneSections || !isEmptySceneSection)
      );
    }
  );

  return (
    <section className="studio-rating-advisor-stats">
      <div className="studio-rating-advisor-title">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {showOverallSceneAverage && (
          <div className="studio-rating-advisor-overall-average">
            <span>Overall scene rating</span>
            <strong>
              {stats.overall_scene_average_rating100 === null ||
              stats.overall_scene_average_rating100 === undefined
                ? "\u2014"
                : `${formatRatingValue(
                    stats.overall_scene_average_rating100
                  )}/100`}
            </strong>
          </div>
        )}
      </div>
      <div
        className="studio-rating-advisor-grid"
        data-section-count={definitions.length}
      >
        {definitions.map((definition) => (
          <StudioRatingAdvisorSection
            definition={definition}
            key={definition.key}
            stats={stats[definition.key]!}
          />
        ))}
      </div>
    </section>
  );
};
