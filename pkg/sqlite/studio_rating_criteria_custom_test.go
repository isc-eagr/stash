package sqlite

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStudioRatingCriteriaAverageClauseCustomUsesRelatedSceneAverage(t *testing.T) {
	clause, err, ok := studioRatingCriteriaAveragesClauseCustom(
		studioRatingCriteriaScenesCustom,
		ratingCriteriaScoresTable,
		[]*models.RatingScoreCriterionFilterInput{{
			Key: "soloPerformance",
			Value: &models.FloatCriterionInput{
				Modifier: models.CriterionModifierGreaterThanEquals,
				Value:    3,
			},
		}},
	)
	require.NoError(t, err)
	require.True(t, ok)

	assert.Contains(t, clause.sql, "AVG(CASE WHEN studio_rating_score.key = ? THEN studio_rating_score.raw_value END) >= ?")
	assert.Contains(t, clause.sql, "studio_rating_scene.studio_id = studios.id")
	assert.Equal(t, []interface{}{"soloPerformance", float64(3)}, clause.args)
}

func TestStudioRatingCriteriaSortKeysCustomIncludesEverySceneRubricDimension(t *testing.T) {
	assert.Equal(t, map[string]string{
		"rating_criteria_solo_performer_appeal":    "soloPerformerAppeal",
		"rating_criteria_solo_performance":         "soloPerformance",
		"rating_criteria_solo_usability":           "soloUsability",
		"rating_criteria_top_attractiveness":       "topAttractiveness",
		"rating_criteria_bottom_attractiveness":    "bottomAttractiveness",
		"rating_criteria_chemistry":                "chemistry",
		"rating_criteria_payoff":                   "payoff",
		"rating_criteria_standout":                 "standout",
		"rating_criteria_group_top_attractiveness": "groupTopAttractiveness",
		"rating_criteria_group_energy":             "groupEnergy",
		"rating_criteria_group_payoff":             "groupPayoff",
		"rating_criteria_group_usability":          "groupUsability",
	}, studioRatingCriteriaSortKeysCustom)
}

func TestStudioRatingAdvisorAverageSortKeysCustomMatchStatsSections(t *testing.T) {
	assert.Equal(t, map[string]studioRatingAdvisorAverageSortCustom{
		"average_solo_scene_rating":     studioRatingAdvisorSoloAverageCustom,
		"average_standard_scene_rating": studioRatingAdvisorStandardAverageCustom,
		"average_group_scene_rating":    studioRatingAdvisorGroupAverageCustom,
		"average_performer_rating":      studioRatingAdvisorPerformerAverageCustom,
	}, studioRatingAdvisorAverageSortKeysCustom)

	solo := studioRatingAdvisorAverageExprCustom(studioRatingAdvisorSoloAverageCustom)
	assert.Contains(t, solo, "AVG(studio_rating_scene.rating)")
	assert.Contains(t, solo, "'soloPerformerAppeal'")

	standard := studioRatingAdvisorAverageExprCustom(studioRatingAdvisorStandardAverageCustom)
	assert.Contains(t, standard, "BETWEEN 2 AND 3")
	assert.Contains(t, standard, "'topAttractiveness'")
	assert.Contains(t, standard, "NOT EXISTS")

	group := studioRatingAdvisorAverageExprCustom(studioRatingAdvisorGroupAverageCustom)
	assert.Contains(t, group, ">= 4")
	assert.Contains(t, group, "'groupTopAttractiveness'")

	performer := studioRatingAdvisorAverageExprCustom(studioRatingAdvisorPerformerAverageCustom)
	assert.Contains(t, performer, "AVG(studio_rating_performer.rating)")
	assert.Contains(t, performer, "SELECT DISTINCT studio_rating_ps.performer_id")
	assert.Contains(t, performer, "'face'")
}

func TestStudioRatingAdvisorAverageSortExpressionsOrderByDisplayedAverages(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE studios (id INTEGER PRIMARY KEY);
CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER, rating INTEGER);
CREATE TABLE performers (id INTEGER PRIMARY KEY, rating INTEGER);
CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
CREATE TABLE rating_criteria_scores (entity_type TEXT, entity_id INTEGER, key TEXT);
INSERT INTO studios(id) VALUES (1), (2);
INSERT INTO scenes(id, studio_id, rating) VALUES
  (10, 1, 90), (11, 2, 50),
  (20, 1, 60), (21, 2, 80),
  (30, 1, 70), (31, 2, 100);
INSERT INTO performers(id, rating) VALUES
  (1, 90), (2, 80), (3, 40), (4, 50),
  (5, 70), (6, 60), (7, 60), (8, 70);
INSERT INTO performers_scenes(performer_id, scene_id) VALUES
  (1, 10), (3, 11),
  (1, 20), (2, 20), (3, 21), (4, 21),
  (1, 30), (2, 30), (5, 30), (6, 30),
  (3, 31), (4, 31), (7, 31), (8, 31);
INSERT INTO rating_criteria_scores(entity_type, entity_id, key) VALUES
  ('scene', 10, 'soloPerformance'), ('scene', 11, 'soloPerformance'),
  ('scene', 20, 'chemistry'), ('scene', 21, 'chemistry'),
  ('scene', 30, 'groupEnergy'), ('scene', 31, 'groupEnergy'),
  ('performer', 1, 'face'), ('performer', 2, 'face'),
  ('performer', 3, 'face'), ('performer', 4, 'face'),
  ('performer', 5, 'face'), ('performer', 6, 'face'),
  ('performer', 7, 'face'), ('performer', 8, 'face');
`)
	require.NoError(t, err)

	tests := []struct {
		category studioRatingAdvisorAverageSortCustom
		wantIDs  []int
	}{
		{studioRatingAdvisorSoloAverageCustom, []int{1, 2}},
		{studioRatingAdvisorStandardAverageCustom, []int{2, 1}},
		{studioRatingAdvisorGroupAverageCustom, []int{2, 1}},
		{studioRatingAdvisorPerformerAverageCustom, []int{1, 2}},
	}
	for _, test := range tests {
		expr := studioRatingAdvisorAverageExprCustom(test.category)
		rows, queryErr := db.Query(
			"SELECT studios.id FROM studios ORDER BY " + expr + " DESC",
		)
		require.NoError(t, queryErr)

		var ids []int
		for rows.Next() {
			var id int
			require.NoError(t, rows.Scan(&id))
			ids = append(ids, id)
		}
		require.NoError(t, rows.Err())
		require.NoError(t, rows.Close())
		assert.Equal(t, test.wantIDs, ids, test.category)
	}
}

func TestStudioPerformerRatingCriteriaAverageClauseCustomDeduplicatesPerformers(t *testing.T) {
	clause, err, ok := studioRatingCriteriaAveragesClauseCustom(
		studioRatingCriteriaPerformersCustom,
		ratingCriteriaScoresTable,
		[]*models.RatingScoreCriterionFilterInput{{
			Key: "face",
			Value: &models.FloatCriterionInput{
				Modifier: models.CriterionModifierLessThanEquals,
				Value:    4,
			},
		}},
	)
	require.NoError(t, err)
	require.True(t, ok)

	assert.Contains(t, clause.sql, "studio_rating_score.entity_type = 'performer'")
	assert.Contains(t, clause.sql, "SELECT DISTINCT studio_rating_ps.performer_id")
	assert.Contains(t, clause.sql, "studio_rating_score.entity_id = studio_rating_performer.performer_id")
	assert.Equal(t, []interface{}{"face", float64(4)}, clause.args)
}

func TestStudioRatingCriteriaCriterionHandlerCustomCombinesAverageAndPresence(t *testing.T) {
	criterion := &models.RatingCriteriaFilterInput{
		Criteria: []*models.RatingScoreCriterionFilterInput{{
			Key: "groupEnergy",
			Value: &models.FloatCriterionInput{
				Modifier: models.CriterionModifierBetween,
				Value:    2,
				Value2:   floatPointerCustom(4),
			},
		}, {
			Key: "groupUsability",
			Value: &models.FloatCriterionInput{
				Modifier: models.CriterionModifierGreaterThanEquals,
				Value:    3,
			},
		}},
		BonusValues: []*models.RatingScoreCriterionFilterInput{{
			Key: "goatElement",
			Value: &models.FloatCriterionInput{
				Modifier: models.CriterionModifierGreaterThanEquals,
				Value:    1.5,
			},
		}},
		Bonuses:   []*models.RatingScorePresenceFilterInput{{Key: "theme", Value: true}},
		Penalties: []*models.RatingScorePresenceFilterInput{{Key: "production", Value: false}},
	}
	builder := &filterBuilder{}

	studioRatingCriteriaCriterionHandlerCustom(criterion, studioRatingCriteriaScenesCustom).handle(context.Background(), builder)

	require.NoError(t, builder.err)
	require.Len(t, builder.whereClauses, 4)
	assert.Contains(t, builder.whereClauses[0].sql, "AVG(CASE WHEN studio_rating_score.key = ? THEN studio_rating_score.raw_value END) BETWEEN ? AND ?")
	assert.Equal(t, 1, strings.Count(builder.whereClauses[0].sql, "FROM scenes studio_rating_scene"))
	assert.Contains(t, builder.whereClauses[1].sql, ratingBonusScoresTable)
	assert.Equal(t, []interface{}{"goatElement", float64(1.5)}, builder.whereClauses[1].args)
	assert.Contains(t, builder.whereClauses[2].sql, ratingBonusScoresTable)
	assert.Contains(t, builder.whereClauses[3].sql, "NOT (EXISTS")
}

func TestStudioPerformerRatingCriteriaAverageClauseCustomUsesDistinctStudioPerformers(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE studios (id INTEGER PRIMARY KEY);
CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER);
CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
CREATE TABLE rating_criteria_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL);
INSERT INTO studios(id) VALUES (1), (2);
INSERT INTO scenes(id, studio_id) VALUES (10, 1), (11, 1), (20, 2);
INSERT INTO performers_scenes(performer_id, scene_id) VALUES
  (100, 10), (100, 11), (101, 10), (200, 20);
INSERT INTO rating_criteria_scores(entity_type, entity_id, key, raw_value) VALUES
  ('performer', 100, 'face', 5),
  ('performer', 101, 'face', 1),
  ('performer', 200, 'face', 4);
`)
	require.NoError(t, err)

	clause, clauseErr, ok := studioRatingCriteriaAveragesClauseCustom(
		studioRatingCriteriaPerformersCustom,
		ratingCriteriaScoresTable,
		[]*models.RatingScoreCriterionFilterInput{{
			Key: "face",
			Value: &models.FloatCriterionInput{
				Modifier: models.CriterionModifierGreaterThan,
				Value:    3.5,
			},
		}},
	)
	require.NoError(t, clauseErr)
	require.True(t, ok)
	rows, err := db.Query("SELECT studios.id FROM studios WHERE "+clause.sql+" ORDER BY studios.id", clause.args...)
	require.NoError(t, err)
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		require.NoError(t, rows.Scan(&id))
		ids = append(ids, id)
	}
	require.NoError(t, rows.Err())
	assert.Equal(t, []int{2}, ids)
}

func floatPointerCustom(value float64) *float64 {
	return &value
}
