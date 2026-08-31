package sqlite

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/pkg/models"
)

// CUSTOM: begin - rating criteria filters
func ratingCriteriaCriterionHandler(
	criterion *models.RatingCriteriaFilterInput,
	entityType string,
	primaryTable string,
) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion == nil {
			return
		}

		for _, c := range criterion.Criteria {
			if c == nil || c.Value == nil || c.Key == "" {
				continue
			}
			if !c.Value.ValidModifier() {
				f.setError(fmt.Errorf("invalid modifier %s for rating criterion %s", c.Value.Modifier, c.Key))
				return
			}

			f.whereClauses = append(
				f.whereClauses,
				ratingScoreNumericClause(
					ratingCriteriaScoresTable,
					entityType,
					primaryTable,
					c.Key,
					*c.Value,
				),
			)
		}

		for _, c := range criterion.BonusValues {
			if c == nil || c.Value == nil || c.Key == "" {
				continue
			}
			if !c.Value.ValidModifier() {
				f.setError(fmt.Errorf("invalid modifier %s for rating bonus %s", c.Value.Modifier, c.Key))
				return
			}

			f.whereClauses = append(
				f.whereClauses,
				ratingScoreNumericClause(
					ratingBonusScoresTable,
					entityType,
					primaryTable,
					c.Key,
					*c.Value,
				),
			)
		}

		for _, c := range criterion.Bonuses {
			if c == nil || c.Key == "" {
				continue
			}
			f.whereClauses = append(
				f.whereClauses,
				ratingScorePresenceClause(
					ratingBonusScoresTable,
					entityType,
					primaryTable,
					c.Key,
					c.Value,
				),
			)
		}

		for _, c := range criterion.Penalties {
			if c == nil || c.Key == "" {
				continue
			}
			f.whereClauses = append(
				f.whereClauses,
				ratingScorePresenceClause(
					ratingPenaltyScoresTable,
					entityType,
					primaryTable,
					c.Key,
					c.Value,
				),
			)
		}
	}
}

func ratingScoreNumericClause(
	table string,
	entityType string,
	primaryTable string,
	key string,
	criterion models.FloatCriterionInput,
) sqlClause {
	clause, args := getFloatCriterionWhereClause("rs.raw_value", criterion)
	allArgs := []interface{}{entityType, key}
	allArgs = append(allArgs, args...)

	return makeClause(
		fmt.Sprintf(
			"EXISTS (SELECT 1 FROM %s rs WHERE rs.entity_type = ? AND rs.entity_id = %s.id AND rs.key = ? AND %s)",
			table,
			primaryTable,
			clause,
		),
		allArgs...,
	)
}

func ratingScorePresenceClause(
	table string,
	entityType string,
	primaryTable string,
	key string,
	present bool,
) sqlClause {
	clause := makeClause(
		fmt.Sprintf(
			"EXISTS (SELECT 1 FROM %s rs WHERE rs.entity_type = ? AND rs.entity_id = %s.id AND rs.key = ? AND (rs.raw_value != 0 OR rs.weighted_value != 0))",
			table,
			primaryTable,
		),
		entityType,
		key,
	)

	if present {
		return clause
	}

	return clause.not()
}

// CUSTOM: end
