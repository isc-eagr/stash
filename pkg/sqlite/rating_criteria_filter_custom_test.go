package sqlite

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRatingScoreNumericClause(t *testing.T) {
	clause := ratingScoreNumericClause(
		ratingCriteriaScoresTable,
		"scene",
		"scenes",
		"face",
		models.FloatCriterionInput{
			Value:    4.5,
			Modifier: models.CriterionModifierGreaterThanEquals,
		},
	)

	assert.Equal(t, "EXISTS (SELECT 1 FROM rating_criteria_scores rs WHERE rs.entity_type = ? AND rs.entity_id = scenes.id AND rs.key = ? AND rs.raw_value >= ?)", clause.sql)
	assert.Equal(t, []interface{}{"scene", "face", 4.5}, clause.args)
}

func TestRatingScorePresenceClause(t *testing.T) {
	presentClause := ratingScorePresenceClause(
		ratingBonusScoresTable,
		"performer",
		"performers",
		"goat",
		true,
	)

	assert.Equal(t, "EXISTS (SELECT 1 FROM rating_bonus_scores rs WHERE rs.entity_type = ? AND rs.entity_id = performers.id AND rs.key = ? AND (rs.raw_value != 0 OR rs.weighted_value != 0))", presentClause.sql)
	assert.Equal(t, []interface{}{"performer", "goat"}, presentClause.args)

	missingClause := ratingScorePresenceClause(
		ratingPenaltyScoresTable,
		"scene",
		"scenes",
		"bad-lighting",
		false,
	)

	assert.Equal(t, "NOT (EXISTS (SELECT 1 FROM rating_penalty_scores rs WHERE rs.entity_type = ? AND rs.entity_id = scenes.id AND rs.key = ? AND (rs.raw_value != 0 OR rs.weighted_value != 0)))", missingClause.sql)
	assert.Equal(t, []interface{}{"scene", "bad-lighting"}, missingClause.args)
}

func TestRatingCriteriaCriterionHandler(t *testing.T) {
	criterion := &models.RatingCriteriaFilterInput{
		Criteria: []*models.RatingScoreCriterionFilterInput{
			nil,
			{Key: ""},
			{
				Key: "face",
				Value: &models.FloatCriterionInput{
					Value:    4.5,
					Modifier: models.CriterionModifierGreaterThanEquals,
				},
			},
		},
		Bonuses: []*models.RatingScorePresenceFilterInput{
			nil,
			{Key: ""},
			{Key: "goat", Value: true},
		},
		Penalties: []*models.RatingScorePresenceFilterInput{
			{Key: "bad-lighting", Value: false},
		},
	}

	builder := &filterBuilder{}
	ratingCriteriaCriterionHandler(criterion, "scene", "scenes").handle(testCtx, builder)

	require.NoError(t, builder.getError())
	require.Len(t, builder.whereClauses, 3)
	assert.Contains(t, builder.whereClauses[0].sql, "rating_criteria_scores")
	assert.Contains(t, builder.whereClauses[1].sql, "rating_bonus_scores")
	assert.Contains(t, builder.whereClauses[2].sql, "rating_penalty_scores")
}

func TestRatingCriteriaCriterionHandlerInvalidModifier(t *testing.T) {
	criterion := &models.RatingCriteriaFilterInput{
		Criteria: []*models.RatingScoreCriterionFilterInput{
			{
				Key: "face",
				Value: &models.FloatCriterionInput{
					Value:    4.5,
					Modifier: models.CriterionModifierIncludes,
				},
			},
		},
	}

	builder := &filterBuilder{}
	ratingCriteriaCriterionHandler(criterion, "scene", "scenes").handle(testCtx, builder)

	require.Error(t, builder.getError())
	assert.Contains(t, builder.getError().Error(), "invalid modifier")
}

func TestDefaultSceneRatingScoreKeysUseSplitAttractiveness(t *testing.T) {
	keys := defaultSceneRatingScoreKeys[models.RatingScoreSectionCriterion]

	assert.Contains(t, keys, "topAttractiveness")
	assert.Contains(t, keys, "bottomAttractiveness")
	assert.NotContains(t, keys, "performerAppeal")
}

func TestDefaultSceneRatingScoreKeysExcludeRetiredStandoutActBonus(t *testing.T) {
	keys := defaultSceneRatingScoreKeys[models.RatingScoreSectionBonus]

	assert.NotContains(t, keys, "standoutAct")
}
