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

export type StudioRatingAdvisorSectionKey =
  | "solo_scenes"
  | "sex_scenes"
  | "group_scenes"
  | "performers";

interface ISectionDefinition {
  key: StudioRatingAdvisorSectionKey;
  title: string;
  singular: string;
  plural: string;
  ratingLabel: string;
  criteria: Record<string, { label: string; max: number }>;
}

export const studioRatingAdvisorSectionDefinitions: ISectionDefinition[] = [
  {
    key: "solo_scenes",
    title: "Solo Criteria",
    singular: "scene",
    plural: "scenes",
    ratingLabel: "Average scene rating",
    criteria: {
      soloPerformerAppeal: { label: "Vato Attractiveness", max: 50 },
      soloPerformance: { label: "Performance", max: 30 },
      soloUsability: { label: "Usability", max: 20 },
    },
  },
  {
    key: "sex_scenes",
    title: "Standard Criteria",
    singular: "scene",
    plural: "scenes",
    ratingLabel: "Average scene rating",
    criteria: {
      topAttractiveness: { label: "Top(s) Attractiveness", max: 30 },
      bottomAttractiveness: { label: "Bottom(s) Attractiveness", max: 10 },
      chemistry: { label: "Energy / sex quality", max: 20 },
      payoff: { label: "Orgasm quality", max: 20 },
      standout: { label: "Usable factor", max: 20 },
    },
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
        max: 20,
      },
      groupEnergy: { label: "Energy / coordination", max: 40 },
      groupPayoff: { label: "Orgasm Quality", max: 20 },
      groupUsability: { label: "Usability", max: 20 },
    },
  },
  {
    key: "performers",
    title: "Performers",
    singular: "performer",
    plural: "performers",
    ratingLabel: "Average performer rating",
    criteria: {
      face: { label: "Face", max: 30 },
      body: { label: "Body", max: 30 },
      performance: { label: "Sexual performance", max: 20 },
      ethnicity: { label: "Ethnicity / racial appeal", max: 10 },
      masculinity: { label: "Masculinity", max: 10 },
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

const CriterionRow: React.FC<{
  criterion: RatingAdvisorSection["criteria"][number];
  label: string;
  max: number;
  singular: string;
  plural: string;
}> = ({ criterion, label, max, singular, plural }) => {
  const contribution = formatAverageContribution(
    criterion.average_weighted_value,
    max
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

export const StudioRatingAdvisorSection: React.FC<{
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
      <div className="studio-rating-advisor-section-average">
        <span>{definition.ratingLabel}</span>
        <strong>
          {stats.average_rating100 === null ||
          stats.average_rating100 === undefined
            ? "—"
            : `${formatRatingValue(stats.average_rating100)}/100`}
        </strong>
      </div>
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
                  definition.criteria[criterion.key]?.label ?? criterion.key
                }
                max={definition.criteria[criterion.key]?.max ?? 0}
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

interface IRatingAdvisorStatsContentProps {
  stats: {
    overall_scene_average_rating100?: number | null;
    solo_scenes?: RatingAdvisorSection;
    sex_scenes?: RatingAdvisorSection;
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
  description = "Each bar averages only the scenes or performers where that criterion is set.",
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

  return <RatingAdvisorStatsContent hideEmptySceneSections stats={stats} />;
};
