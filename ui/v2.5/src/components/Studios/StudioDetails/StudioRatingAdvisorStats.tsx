import React from "react";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { getRatingAdvisorAdjustmentTooltipLabelCustom } from "src/components/Shared/ratingAdvisorScales_custom";
import * as GQL from "src/core/generated-graphql";

import "./StudioRatingAdvisorStats.scss";

type RatingAdvisorSection = GQL.StudioRatingAdvisorSectionDataFragment;

interface IProps {
  studioId: string;
  depth: number;
}

interface ISectionDefinition {
  key: "solo_scenes" | "sex_scenes" | "group_scenes" | "performers";
  title: string;
  singular: string;
  plural: string;
  criterionLabels: Record<string, string>;
}

const sectionDefinitions: ISectionDefinition[] = [
  {
    key: "solo_scenes",
    title: "Solo Scenes",
    singular: "scene",
    plural: "scenes",
    criterionLabels: {
      soloPerformerAppeal: "Vato Attractiveness",
      soloPerformance: "Performance",
      soloUsability: "Usability",
    },
  },
  {
    key: "sex_scenes",
    title: "Sex Scenes",
    singular: "scene",
    plural: "scenes",
    criterionLabels: {
      topAttractiveness: "Top(s) Attractiveness",
      bottomAttractiveness: "Bottom(s) Attractiveness",
      chemistry: "Energy / sex quality",
      payoff: "Orgasm quality",
      standout: "Usable factor",
    },
  },
  {
    key: "group_scenes",
    title: "Group Scenes",
    singular: "scene",
    plural: "scenes",
    criterionLabels: {
      groupTopAttractiveness: "Top Lineup Attractiveness",
      groupEnergy: "Energy / coordination",
      groupPayoff: "Orgasm Quality",
      groupUsability: "Usability",
    },
  },
  {
    key: "performers",
    title: "Performers",
    singular: "performer",
    plural: "performers",
    criterionLabels: {
      face: "Face",
      body: "Body",
      performance: "Sexual performance",
      ethnicity: "Ethnicity / racial appeal",
      masculinity: "Masculinity",
    },
  },
];

function formatAverageContribution(value: number) {
  const points = value * 10;
  const formatted = Number.isInteger(points)
    ? points.toFixed(0)
    : points.toFixed(1);
  return `${points > 0 ? "+" : ""}${formatted} avg`;
}

function formatEntityCount(count: number, singular: string, plural: string) {
  return `${count} rated ${count === 1 ? singular : plural}`;
}

function averageHeatLevel(fillPercent: number) {
  return Math.max(0, Math.min(5, Math.round(fillPercent / 20)));
}

const CriterionRow: React.FC<{
  criterion: RatingAdvisorSection["criteria"][number];
  label: string;
  singular: string;
  plural: string;
}> = ({ criterion, label, singular, plural }) => {
  const contribution = formatAverageContribution(
    criterion.average_weighted_value
  );
  const sample = `${criterion.entity_count} ${
    criterion.entity_count === 1 ? singular : plural
  }`;

  return (
    <div
      aria-label={`${label}: ${contribution}, averaged from ${sample}`}
      className="rating-criteria-tooltip-row"
      role="img"
    >
      <span aria-hidden="true" className="rating-criteria-tooltip-row-heading">
        <span className="rating-criteria-tooltip-label">{label}</span>
        <span className="rating-criteria-tooltip-value">
          {contribution} · {criterion.entity_count}
        </span>
      </span>
      <span className="rating-criteria-tooltip-track" aria-hidden="true">
        <span
          className="rating-criteria-tooltip-fill"
          data-rating-level={averageHeatLevel(criterion.average_fill_percent)}
          style={{ width: `${criterion.average_fill_percent}%` }}
        />
      </span>
    </div>
  );
};

const AdjustmentGroup: React.FC<{
  title: string;
  kind: "bonus" | "penalty";
  adjustments: RatingAdvisorSection["adjustments"];
  singular: string;
  plural: string;
}> = ({ title, kind, adjustments, singular, plural }) => {
  if (adjustments.length === 0) return null;

  return (
    <section className="rating-criteria-tooltip-section">
      <span className="rating-criteria-tooltip-section-title">{title}</span>
      <div className="rating-criteria-tooltip-adjustment-grid">
        {adjustments.map((adjustment) => {
          const label = getRatingAdvisorAdjustmentTooltipLabelCustom(
            adjustment.key,
            adjustment.key
          );
          const countLabel = `${adjustment.entity_count} ${
            adjustment.entity_count === 1 ? singular : plural
          }`;
          return (
            <div
              aria-label={`${label}: ${countLabel}`}
              className="rating-criteria-tooltip-adjustment-row"
              key={`${adjustment.section}-${adjustment.key}`}
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
                {label}
              </span>
              <span
                aria-hidden="true"
                className="rating-criteria-tooltip-value"
              >
                {adjustment.entity_count}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const AdvisorSection: React.FC<{
  definition: ISectionDefinition;
  stats: RatingAdvisorSection;
}> = ({ definition, stats }) => {
  const bonuses = stats.adjustments.filter(
    (adjustment) => adjustment.section === "bonus"
  );
  const penalties = stats.adjustments.filter(
    (adjustment) => adjustment.section === "penalty"
  );

  return (
    <section className="studio-rating-advisor-section">
      <header className="studio-rating-advisor-section-header">
        <h3>{definition.title}</h3>
        <span>
          {formatEntityCount(
            stats.entity_count,
            definition.singular,
            definition.plural
          )}
        </span>
      </header>
      {stats.entity_count === 0 ? (
        <div className="studio-rating-advisor-empty">
          No advisor criteria yet.
        </div>
      ) : (
        <div className="rating-criteria-tooltip-groups">
          <div className="rating-criteria-tooltip-rows">
            {stats.criteria.map((criterion) => (
              <CriterionRow
                criterion={criterion}
                key={criterion.key}
                label={
                  definition.criterionLabels[criterion.key] ?? criterion.key
                }
                singular={definition.singular}
                plural={definition.plural}
              />
            ))}
          </div>
          <AdjustmentGroup
            adjustments={bonuses}
            kind="bonus"
            plural={definition.plural}
            singular={definition.singular}
            title="Bonuses"
          />
          <AdjustmentGroup
            adjustments={penalties}
            kind="penalty"
            plural={definition.plural}
            singular={definition.singular}
            title="Penalties"
          />
        </div>
      )}
    </section>
  );
};

export const StudioRatingAdvisorStats: React.FC<IProps> = ({
  studioId,
  depth,
}) => {
  const { data, loading, error } = GQL.useFindStudioRatingAdvisorStatsQuery({
    variables: { id: studioId, depth },
  });

  if (loading && !data) {
    return <LoadingIndicator message="Loading rating averages…" inline small />;
  }
  if (error) {
    return <ErrorMessage error={error.message} />;
  }

  const stats = data?.findStudio?.studio_rating_advisor_stats;
  if (!stats) return null;

  return (
    <section className="studio-rating-advisor-stats">
      <div className="studio-rating-advisor-title">
        <h2>Rating Advisor Averages</h2>
        <p>
          Each bar averages only the scenes or performers where that criterion
          is set.
        </p>
      </div>
      <div className="studio-rating-advisor-grid">
        {sectionDefinitions.map((definition) => (
          <AdvisorSection
            definition={definition}
            key={definition.key}
            stats={stats[definition.key]}
          />
        ))}
      </div>
    </section>
  );
};
