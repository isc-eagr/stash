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

func TestGroupSceneRatingCriteriaFilterOperators(t *testing.T) {
	betweenEnd := 5.0
	criterion := &models.RatingCriteriaFilterInput{
		Criteria: []*models.RatingScoreCriterionFilterInput{
			{Key: "groupTopAttractiveness", Value: &models.FloatCriterionInput{Value: 3, Modifier: models.CriterionModifierEquals}},
			{Key: "groupEnergy", Value: &models.FloatCriterionInput{Value: 4, Modifier: models.CriterionModifierGreaterThanEquals}},
			{Key: "groupParticipation", Value: &models.FloatCriterionInput{Value: 2, Modifier: models.CriterionModifierLessThanEquals}},
			{Key: "groupPayoff", Value: &models.FloatCriterionInput{Value: 2, Value2: &betweenEnd, Modifier: models.CriterionModifierBetween}},
			{Key: "groupStandout", Value: &models.FloatCriterionInput{Value: 1, Modifier: models.CriterionModifierEquals}},
		},
		Bonuses: []*models.RatingScorePresenceFilterInput{
			{Key: "groupBottomAttractiveness", Value: true},
			{Key: "groupOralOnly", Value: false},
		},
	}

	builder := &filterBuilder{}
	ratingCriteriaCriterionHandler(criterion, "scene", "scenes").handle(testCtx, builder)

	require.NoError(t, builder.getError())
	require.Len(t, builder.whereClauses, 7)
	assert.Contains(t, builder.whereClauses[0].sql, "rs.raw_value = ?")
	assert.Contains(t, builder.whereClauses[1].sql, "rs.raw_value >= ?")
	assert.Contains(t, builder.whereClauses[2].sql, "rs.raw_value <= ?")
	assert.Contains(t, builder.whereClauses[3].sql, "rs.raw_value BETWEEN ? AND ?")
	assert.Contains(t, builder.whereClauses[5].sql, "rating_bonus_scores")
	assert.Contains(t, builder.whereClauses[6].sql, "NOT (EXISTS")
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

func TestGroupSceneRatingScoreKeysAreIsolated(t *testing.T) {
	criteria := groupSceneRatingScoreKeys[models.RatingScoreSectionCriterion]
	bonuses := groupSceneRatingScoreKeys[models.RatingScoreSectionBonus]

	assert.ElementsMatch(t, []string{
		"groupTopAttractiveness",
		"groupEnergy",
		"groupParticipation",
		"groupPayoff",
		"groupStandout",
	}, mapKeysCustom(criteria))
	assert.Contains(t, bonuses, "groupBottomAttractiveness")
	assert.Contains(t, bonuses, "groupOralOnly")
	assert.NotContains(t, criteria, "topAttractiveness")
	assert.NotContains(t, bonuses, "oralOnly")
	assert.NotContains(t, bonuses, "largeGroup")
}

func TestSceneUsesGroupRatingAtFourPerformers(t *testing.T) {
	assert.False(t, sceneUsesGroupRating(3))
	assert.True(t, sceneUsesGroupRating(4))
}

func mapKeysCustom(values map[string]struct{}) []string {
	ret := make([]string, 0, len(values))
	for key := range values {
		ret = append(ret, key)
	}
	return ret
}
