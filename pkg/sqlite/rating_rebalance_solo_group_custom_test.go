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

func TestSoloGroupRatingRebalanceMigration(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
		CREATE TABLE scenes (
			id INTEGER PRIMARY KEY,
			rating INTEGER,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE performers_scenes (performer_id INTEGER, scene_id INTEGER);
		CREATE TABLE rating_criteria_scores (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			entity_type TEXT NOT NULL,
			entity_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			raw_value REAL NOT NULL DEFAULT 0,
			weighted_value REAL NOT NULL DEFAULT 0,
			label TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(entity_type, entity_id, key)
		);
		CREATE TABLE rating_bonus_scores (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			entity_type TEXT NOT NULL,
			entity_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			raw_value REAL NOT NULL DEFAULT 0,
			weighted_value REAL NOT NULL DEFAULT 0,
			label TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(entity_type, entity_id, key)
		);

		INSERT INTO scenes (id, rating) VALUES (1, 110), (2, 100), (3, 50);
		INSERT INTO performers_scenes (performer_id, scene_id) VALUES
			(1, 1),
			(1, 2), (2, 2), (3, 2), (4, 2),
			(1, 3), (2, 3);

		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
		VALUES
			('scene', 1, 'soloPerformerAppeal', 10, 7),
			('scene', 1, 'cameraWork', 5, 3),
			('scene', 2, 'groupTopAttractiveness', 5, 1.5),
			('scene', 2, 'groupEnergy', 4, 2.8),
			('scene', 2, 'groupParticipation', 2, 0.8),
			('scene', 2, 'groupPayoff', 2, 1),
			('scene', 2, 'groupStandout', 2, 1);

		INSERT INTO rating_bonus_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
		VALUES
			('scene', 1, 'outstandingPerformance', 1, 1),
			('scene', 2, 'unlikelyTop', 0.5, 0.5),
			('scene', 3, 'unlikelyTop', 0.5, 0.5);
	`)
	require.NoError(t, err)

	migrationPath := filepath.Join("..", "..", "rating_rebalance_solo_group_rubrics_custom.sql")
	migration, err := os.ReadFile(migrationPath)
	require.NoError(t, err)
	_, err = db.Exec(string(migration))
	require.NoError(t, err)

	assert.Equal(t, 100, ratingForSceneCustom(t, db, 1))
	assertRatingScoreCustom(t, db, 1, "soloPerformerAppeal", 5, 5)
	assertRatingScoreCustom(t, db, 1, "soloPerformance", 4, 3)
	assertRatingScoreCustom(t, db, 1, "soloUsability", 4, 2)
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_criteria_scores", 1, "cameraWork"))
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_bonus_scores", 1, "outstandingPerformance"))

	assert.Equal(t, 78, ratingForSceneCustom(t, db, 2))
	assertRatingScoreCustom(t, db, 2, "groupTopAttractiveness", 5, 2)
	assertRatingScoreCustom(t, db, 2, "groupEnergy", 3, 2.4)
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_criteria_scores", 2, "groupParticipation"))
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_criteria_scores", 2, "groupStandout"))
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_bonus_scores", 2, "unlikelyTop"))

	assert.Equal(t, 50, ratingForSceneCustom(t, db, 3))
	assert.Equal(t, 1, ratingScoreCountCustom(t, db, "rating_bonus_scores", 3, "unlikelyTop"))

	// The conversion is safe to run again: already migrated values do not drift.
	_, err = db.Exec(string(migration))
	require.NoError(t, err)
	assert.Equal(t, 100, ratingForSceneCustom(t, db, 1))
	assert.Equal(t, 78, ratingForSceneCustom(t, db, 2))
}

func ratingForSceneCustom(t *testing.T, db *sql.DB, sceneID int) int {
	t.Helper()
	var rating int
	require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = ?", sceneID).Scan(&rating))
	return rating
}

func assertRatingScoreCustom(t *testing.T, db *sql.DB, sceneID int, key string, raw, weighted float64) {
	t.Helper()
	var actualRaw, actualWeighted float64
	require.NoError(t, db.QueryRow(`
		SELECT raw_value, weighted_value
		FROM rating_criteria_scores
		WHERE entity_type = 'scene' AND entity_id = ? AND key = ?
	`, sceneID, key).Scan(&actualRaw, &actualWeighted))
	assert.InDelta(t, raw, actualRaw, 0.0001)
	assert.InDelta(t, weighted, actualWeighted, 0.0001)
}

func ratingScoreCountCustom(t *testing.T, db *sql.DB, table string, sceneID int, key string) int {
	t.Helper()
	var count int
	require.NoError(t, db.QueryRow(
		"SELECT COUNT(*) FROM "+table+" WHERE entity_type = 'scene' AND entity_id = ? AND key = ?",
		sceneID,
		key,
	).Scan(&count))
	return count
}
