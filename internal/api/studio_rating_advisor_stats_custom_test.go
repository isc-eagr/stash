package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func studioRatingAdvisorTestStatsCustom(t *testing.T, db *sql.DB, depth int) *StudioRatingAdvisorStats {
	t.Helper()

	queryRows, err := db.Query(studioRatingAdvisorStatsQueryCustom, 1, depth, depth)
	require.NoError(t, err)
	defer queryRows.Close()

	var rows []studioRatingAdvisorScoreRowCustom
	for queryRows.Next() {
		var row studioRatingAdvisorScoreRowCustom
		var rating sql.NullFloat64
		require.NoError(t, queryRows.Scan(
			&row.category,
			&row.entityID,
			&row.section,
			&row.key,
			&row.rawValue,
			&row.weightedValue,
			&rating,
		))
		if rating.Valid {
			row.rating100 = &rating.Float64
		}
		rows = append(rows, row)
	}
	require.NoError(t, queryRows.Err())

	return aggregateStudioRatingAdvisorRowsCustom(rows)
}

func studioRatingAdvisorCriterionCustom(t *testing.T, section *StudioRatingAdvisorSectionStats, key string) *StudioRatingAdvisorCriterionAverage {
	t.Helper()
	for _, criterion := range section.Criteria {
		if criterion.Key == key {
			return criterion
		}
	}
	t.Fatalf("criterion %q not found", key)
	return nil
}

func studioRatingAdvisorAdjustmentCustom(t *testing.T, section *StudioRatingAdvisorSectionStats, scoreSection, key string) *StudioRatingAdvisorAdjustmentCount {
	t.Helper()
	for _, adjustment := range section.Adjustments {
		if adjustment.Section == scoreSection && adjustment.Key == key {
			return adjustment
		}
	}
	t.Fatalf("adjustment %s/%s not found", scoreSection, key)
	return nil
}

func TestStudioRatingAdvisorStatsCustomAveragesOnlySetCriteria(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()

	statements := []string{
		`CREATE TABLE studios (id INTEGER PRIMARY KEY, parent_id INTEGER)`,
		`CREATE TABLE scenes (id INTEGER PRIMARY KEY, studio_id INTEGER, rating INTEGER)`,
		`CREATE TABLE performers (id INTEGER PRIMARY KEY, rating INTEGER)`,
		`CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER)`,
		`CREATE TABLE scenes_o_dates (scene_id INTEGER)`,
		`CREATE TABLE rating_criteria_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL, weighted_value REAL)`,
		`CREATE TABLE rating_bonus_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL, weighted_value REAL)`,
		`CREATE TABLE rating_penalty_scores (entity_type TEXT, entity_id INTEGER, key TEXT, raw_value REAL, weighted_value REAL)`,
		`INSERT INTO studios(id, parent_id) VALUES (1, NULL), (2, 1)`,
		`INSERT INTO scenes(id, studio_id, rating) VALUES (10, 1, 90), (20, 1, 80), (21, 1, 60), (30, 1, 100), (40, 2, 70)`,
		`INSERT INTO performers(id, rating) VALUES (1, 95), (2, 75), (3, NULL), (4, NULL), (5, NULL), (6, NULL), (7, NULL), (8, 65), (9, NULL)`,
		`INSERT INTO performers_scenes(performer_id, scene_id) VALUES
      (1, 10),
      (2, 20), (3, 20),
      (2, 21), (3, 21),
      (4, 30), (5, 30), (6, 30), (7, 30),
      (8, 40), (9, 40)`,
		`INSERT INTO rating_criteria_scores(entity_type, entity_id, key, raw_value, weighted_value) VALUES
      ('scene', 10, 'soloPerformerAppeal', 5, 5),
      ('scene', 10, 'soloUsability', 4, 2),
      ('scene', 20, 'topAttractiveness', 5, 99),
      ('scene', 20, 'chemistry', 0, 0),
      ('scene', 21, 'topAttractiveness', 1, 0.6),
      ('scene', 30, 'groupEnergy', 4, 3.2),
      ('scene', 40, 'topAttractiveness', 3, 1.8),
      ('performer', 1, 'face', 5, 3),
      ('performer', 2, 'face', 1, 0.6),
      ('performer', 2, 'body', 3, 1.8),
      ('performer', 8, 'face', 4, 2.4)`,
		`INSERT INTO rating_bonus_scores(entity_type, entity_id, key, raw_value, weighted_value) VALUES
      ('scene', 20, 'theme', 0.5, 0.5),
      ('scene', 21, 'theme', 0.5, 0.5),
      ('scene', 30, 'groupOralOnly', 2, 2)`,
		`INSERT INTO rating_penalty_scores(entity_type, entity_id, key, raw_value, weighted_value) VALUES
      ('scene', 10, 'noOrgasm', -2, -2),
      ('performer', 2, 'feminine', -1, -1)`,
		`INSERT INTO scenes_o_dates(scene_id) VALUES (20), (20), (20)`,
	}
	for _, statement := range statements {
		_, err := db.Exec(statement)
		require.NoError(t, err, statement)
	}

	direct := studioRatingAdvisorTestStatsCustom(t, db, 0)
	require.Equal(t, 1, direct.SoloScenes.EntityCount)
	require.Equal(t, 2, direct.SexScenes.EntityCount)
	require.Equal(t, 1, direct.GroupScenes.EntityCount)
	require.Equal(t, 2, direct.Performers.EntityCount)
	require.InDelta(t, 82.5, *direct.OverallSceneAverageRating100, 0.0001)
	require.InDelta(t, 90, *direct.SoloScenes.AverageRating100, 0.0001)
	require.InDelta(t, 70, *direct.SexScenes.AverageRating100, 0.0001)
	require.InDelta(t, 100, *direct.GroupScenes.AverageRating100, 0.0001)
	require.InDelta(t, 85, *direct.Performers.AverageRating100, 0.0001)

	topAttractiveness := studioRatingAdvisorCriterionCustom(t, direct.SexScenes, "topAttractiveness")
	require.Equal(t, 2, topAttractiveness.EntityCount)
	require.InDelta(t, 3, topAttractiveness.AverageRawValue, 0.0001)
	require.InDelta(t, 1.8, topAttractiveness.AverageWeightedValue, 0.0001)
	require.InDelta(t, 60, topAttractiveness.AverageFillPercent, 0.0001)

	chemistry := studioRatingAdvisorCriterionCustom(t, direct.SexScenes, "chemistry")
	require.Equal(t, 1, chemistry.EntityCount)
	require.Zero(t, chemistry.AverageRawValue)
	require.Zero(t, chemistry.AverageFillPercent)

	require.Equal(t, 2, studioRatingAdvisorAdjustmentCustom(t, direct.SexScenes, models.RatingScoreSectionBonus, "theme").EntityCount)
	require.Equal(t, 1, studioRatingAdvisorAdjustmentCustom(t, direct.SexScenes, models.RatingScoreSectionBonus, "orgasm-count-bonus").EntityCount)
	require.Equal(t, 1, studioRatingAdvisorAdjustmentCustom(t, direct.SoloScenes, models.RatingScoreSectionPenalty, "noOrgasm").EntityCount)
	require.Equal(t, 1, studioRatingAdvisorAdjustmentCustom(t, direct.Performers, models.RatingScoreSectionPenalty, "feminine").EntityCount)

	withChildren := studioRatingAdvisorTestStatsCustom(t, db, -1)
	require.Equal(t, 3, withChildren.SexScenes.EntityCount)
	require.Equal(t, 3, withChildren.Performers.EntityCount)
	require.InDelta(t, 80, *withChildren.OverallSceneAverageRating100, 0.0001)
	require.InDelta(t, 70, *withChildren.SexScenes.AverageRating100, 0.0001)
	require.InDelta(t, 78.3333, *withChildren.Performers.AverageRating100, 0.0001)
	require.InDelta(t, 3, studioRatingAdvisorCriterionCustom(t, withChildren.SexScenes, "topAttractiveness").AverageRawValue, 0.0001)
}
