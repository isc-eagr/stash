package sqlite

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepairOnePerformerAdvisorsCustom(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		INSERT INTO scenes (id, rating) VALUES (1, 10), (2, 65), (3, 70), (4, 80);
		INSERT INTO performers_scenes (performer_id, scene_id) VALUES
			(11, 1),
			(12, 2),
			(13, 3),
			(14, 4), (15, 4);
		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES
			('scene', 2, 'chemistry', 4, 1.6),
			('scene', 3, 'soloPerformerAppeal', 5, 5),
			('scene', 4, 'chemistry', 5, 2);
		INSERT INTO rating_bonus_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES
			('scene', 2, 'oralOnly', 0.5, 0.5),
			('scene', 3, 'orgasmBonus', 1, 1);
		INSERT INTO rating_penalty_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('scene', 2, 'production', -1, -1);
	`)
	require.NoError(t, err)

	executeRatingScriptCustom(t, db, "rating_repair_one_performer_advisors_custom.sql")

	assert.Equal(t, sql.NullInt64{}, sceneRatingAfterOnePerformerRepairCustom(t, db, 1))
	assert.Equal(t, sql.NullInt64{}, sceneRatingAfterOnePerformerRepairCustom(t, db, 2))
	assert.Equal(t, sql.NullInt64{Int64: 70, Valid: true}, sceneRatingAfterOnePerformerRepairCustom(t, db, 3))
	assert.Equal(t, sql.NullInt64{Int64: 80, Valid: true}, sceneRatingAfterOnePerformerRepairCustom(t, db, 4))
	assert.Zero(t, sceneScoreCountAfterOnePerformerRepairCustom(t, db, 2))
	assert.Equal(t, 2, sceneScoreCountAfterOnePerformerRepairCustom(t, db, 3))
	assert.Equal(t, 1, sceneScoreCountAfterOnePerformerRepairCustom(t, db, 4))

	// The repair is safe to run again and does not disturb valid solo/default rows.
	executeRatingScriptCustom(t, db, "rating_repair_one_performer_advisors_custom.sql")
	assert.Equal(t, sql.NullInt64{Int64: 70, Valid: true}, sceneRatingAfterOnePerformerRepairCustom(t, db, 3))
	assert.Equal(t, sql.NullInt64{Int64: 80, Valid: true}, sceneRatingAfterOnePerformerRepairCustom(t, db, 4))
}

func sceneRatingAfterOnePerformerRepairCustom(t *testing.T, db *sql.DB, sceneID int) sql.NullInt64 {
	t.Helper()
	var rating sql.NullInt64
	require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = ?", sceneID).Scan(&rating))
	return rating
}

func sceneScoreCountAfterOnePerformerRepairCustom(t *testing.T, db *sql.DB, sceneID int) int {
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
