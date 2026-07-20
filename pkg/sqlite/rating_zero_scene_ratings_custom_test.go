package sqlite

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClearZeroSceneRatingsCustom(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		INSERT INTO scenes (id, rating) VALUES (1, 0), (2, NULL), (3, 50);
		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('scene', 1, 'payoff', 0, 0);
	`)
	require.NoError(t, err)

	executeRatingScriptCustom(t, db, "rating_clear_zero_scene_ratings_custom.sql")

	assert.Equal(t, sql.NullInt64{}, zeroRatingCleanupSceneRatingCustom(t, db, 1))
	assert.Equal(t, sql.NullInt64{}, zeroRatingCleanupSceneRatingCustom(t, db, 2))
	assert.Equal(t, sql.NullInt64{Int64: 50, Valid: true}, zeroRatingCleanupSceneRatingCustom(t, db, 3))
	assert.Equal(t, 1, zeroRatingCleanupSceneScoreCountCustom(t, db, 1))

	// A second run is a no-op and keeps the same no-rating state.
	executeRatingScriptCustom(t, db, "rating_clear_zero_scene_ratings_custom.sql")
	assert.Equal(t, sql.NullInt64{}, zeroRatingCleanupSceneRatingCustom(t, db, 1))
}

func TestGroupSceneResetUsesNoRatingCustom(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		INSERT INTO scenes (id, rating) VALUES (4, 80);
		INSERT INTO performers_scenes (performer_id, scene_id) VALUES
			(1, 4), (2, 4), (3, 4), (4, 4);
		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('scene', 4, 'groupEnergy', 5, 4);
	`)
	require.NoError(t, err)

	executeRatingScriptCustom(t, db, "rating_reset_group_scene_scores_custom.sql")

	assert.Equal(t, sql.NullInt64{}, zeroRatingCleanupSceneRatingCustom(t, db, 4))
	assert.Zero(t, zeroRatingCleanupSceneScoreCountCustom(t, db, 4))
}

func zeroRatingCleanupSceneRatingCustom(t *testing.T, db *sql.DB, sceneID int) sql.NullInt64 {
	t.Helper()
	var rating sql.NullInt64
	require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = ?", sceneID).Scan(&rating))
	return rating
}

func zeroRatingCleanupSceneScoreCountCustom(t *testing.T, db *sql.DB, sceneID int) int {
	t.Helper()
	var count int
	require.NoError(t, db.QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'scene' AND entity_id = ?) +
			(SELECT COUNT(*) FROM rating_bonus_scores WHERE entity_type = 'scene' AND entity_id = ?) +
			(SELECT COUNT(*) FROM rating_penalty_scores WHERE entity_type = 'scene' AND entity_id = ?)
	`, sceneID, sceneID, sceneID).Scan(&count))
	return count
}
