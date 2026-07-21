package sqlite

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func openRatingScriptDatabaseCustom(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
		CREATE TABLE scenes (id INTEGER PRIMARY KEY, rating INTEGER, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
		CREATE TABLE performers (id INTEGER PRIMARY KEY, rating INTEGER, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
		CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
		CREATE TABLE scenes_o_dates (scene_id INTEGER);
	`)
	require.NoError(t, err)

	schema, err := os.ReadFile(filepath.Join("..", "..", "rating_scores.up.sql"))
	require.NoError(t, err)
	_, err = db.Exec(string(schema))
	require.NoError(t, err)
	return db
}

func executeRatingScriptCustom(t *testing.T, db *sql.DB, name string) {
	t.Helper()
	contents, err := os.ReadFile(filepath.Join("..", "..", name))
	require.NoError(t, err)
	_, err = db.Exec(string(contents))
	require.NoError(t, err)
}

func TestRatingScoreSchemaEnforcesEntityLifecycle(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec("INSERT INTO scenes (id, rating) VALUES (1, 50)")
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO rating_criteria_scores
		(entity_type, entity_id, key, raw_value, weighted_value)
		VALUES ('scene', 1, 'payoff', 2, 1)`)
	require.NoError(t, err)

	_, err = db.Exec(`INSERT INTO rating_criteria_scores
		(entity_type, entity_id, key, raw_value, weighted_value)
		VALUES ('scene', 999, 'payoff', 2, 1)`)
	require.Error(t, err)
	_, err = db.Exec("UPDATE rating_criteria_scores SET entity_id = 999 WHERE entity_id = 1")
	require.Error(t, err)

	_, err = db.Exec("DELETE FROM scenes WHERE id = 1")
	require.NoError(t, err)
	var count int
	require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM rating_criteria_scores").Scan(&count))
	assert.Zero(t, count)
}

func TestOrgasmBonusRecalculateScriptUsesCanonicalClampOrder(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		INSERT INTO scenes (id, rating) VALUES (1, 99), (3, 99), (5, 77);
		INSERT INTO performers (id, rating) VALUES (2, 99), (4, 99);
		INSERT INTO performers_scenes (performer_id, scene_id) VALUES (2, 1), (4, 3);
		INSERT INTO scenes_o_dates (scene_id) VALUES (1), (1), (1);
		WITH RECURSIVE o_count(value) AS (
			VALUES (1)
			UNION ALL
			SELECT value + 1 FROM o_count WHERE value < 12
		)
		INSERT INTO scenes_o_dates (scene_id) SELECT 3 FROM o_count;
		WITH RECURSIVE o_count(value) AS (
			VALUES (1)
			UNION ALL
			SELECT value + 1 FROM o_count WHERE value < 24
		)
		INSERT INTO scenes_o_dates (scene_id) SELECT 5 FROM o_count;
		INSERT INTO rating_penalty_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('scene', 1, 'noOrgasm', -2, -999);
		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES
				('performer', 2, 'face', 5, 999),
				('scene', 3, 'topAttractiveness', 5, 999),
				('performer', 4, 'face', 5, 999);
	`)
	require.NoError(t, err)

	executeRatingScriptCustom(t, db, "rating_orgasm_bonus_recalculate_custom.sql")
	executeRatingScriptCustom(t, db, "rating_orgasm_bonus_recalculate_custom.sql")

	var sceneRating, performerRating, progressiveSceneRating, progressivePerformerRating, manualRating int
	require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = 1").Scan(&sceneRating))
	require.NoError(t, db.QueryRow("SELECT rating FROM performers WHERE id = 2").Scan(&performerRating))
	require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = 3").Scan(&progressiveSceneRating))
	require.NoError(t, db.QueryRow("SELECT rating FROM performers WHERE id = 4").Scan(&progressivePerformerRating))
	require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = 5").Scan(&manualRating))
	assert.Equal(t, 1, sceneRating)
	assert.Equal(t, 31, performerRating)
	assert.Equal(t, 48, progressiveSceneRating)
	assert.Equal(t, 38, progressivePerformerRating)
	assert.Equal(t, 77, manualRating)
}

func TestRemovePerformerUnlikelyTopScript(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		INSERT INTO performers (id, rating) VALUES (3, 35);
		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('performer', 3, 'face', 5, 3);
		INSERT INTO rating_bonus_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('performer', 3, 'unlikelyTop', 0.5, 0.5);
	`)
	require.NoError(t, err)

	executeRatingScriptCustom(t, db, "rating_remove_performer_unlikely_top_bonus_custom.sql")

	var rating, count int
	require.NoError(t, db.QueryRow("SELECT rating FROM performers WHERE id = 3").Scan(&rating))
	require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM rating_bonus_scores WHERE entity_id = 3").Scan(&count))
	assert.Equal(t, 30, rating)
	assert.Zero(t, count)
}
