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
