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

func TestRetiredSceneScoreCleanupMigration(t *testing.T) {
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
		CREATE TABLE scenes_o_dates (scene_id INTEGER);
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
		CREATE TABLE rating_penalty_scores (
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

		INSERT INTO scenes (id, rating) VALUES (3571, 92), (951, 86), (2085, 70), (4, 75);
		INSERT INTO performers_scenes (performer_id, scene_id) VALUES
			(1, 3571), (2, 3571),
			(1, 951), (2, 951), (3, 951), (4, 951),
			(1, 2085),
			(1, 4), (2, 4);
		INSERT INTO scenes_o_dates (scene_id) VALUES (3571);

		INSERT INTO rating_criteria_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
		VALUES
			('scene', 3571, 'bottomAttractiveness', 1, 0.2),
			('scene', 3571, 'chemistry', 9, 3.6),
			('scene', 3571, 'payoff', 2, 1),
			('scene', 3571, 'performerAppeal', 7, 2.8),
			('scene', 3571, 'standout', 4, 2),
			('scene', 3571, 'topAttractiveness', 4, 2.4),
			('scene', 951, 'performerAppeal', 6, 2.4),
			('scene', 951, 'chemistry', 9, 3.6),
			('scene', 951, 'groupTopAttractiveness', 4, 1.6),
			('scene', 951, 'groupEnergy', 3, 2.4),
			('scene', 951, 'groupPayoff', 2, 1),
			('scene', 2085, 'performerAppeal', 0, 0),
			('scene', 2085, 'soloPerformerAppeal', 5, 5),
			('scene', 2085, 'soloUsability', 4, 2);

		INSERT INTO rating_bonus_scores
			(entity_type, entity_id, key, raw_value, weighted_value)
		VALUES
			('scene', 3571, 'oralOnly', 0, 0),
			('scene', 951, 'largeGroup', 0.5, 0.5),
			('scene', 2085, 'standoutAct', 0.5, 0.5),
			('scene', 4, 'unlikelyTop', 0.5, 0.5);
	`)
	require.NoError(t, err)

	migrationPath := filepath.Join("..", "..", "rating_cleanup_retired_scene_scores_custom.sql")
	migration, err := os.ReadFile(migrationPath)
	require.NoError(t, err)
	_, err = db.Exec(string(migration))
	require.NoError(t, err)

	assert.Equal(t, 76, ratingForSceneCustom(t, db, 3571))
	assertRatingScoreCustom(t, db, 3571, "chemistry", 5, 2)
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_criteria_scores", 3571, "performerAppeal"))

	assert.Equal(t, 50, ratingForSceneCustom(t, db, 951))
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_bonus_scores", 951, "largeGroup"))

	assert.Equal(t, 70, ratingForSceneCustom(t, db, 2085))
	assert.Equal(t, 0, ratingScoreCountCustom(t, db, "rating_bonus_scores", 2085, "standoutAct"))

	assert.Equal(t, 75, ratingForSceneCustom(t, db, 4))
	assert.Equal(t, 1, ratingScoreCountCustom(t, db, "rating_bonus_scores", 4, "unlikelyTop"))

	// A second run finds no stale values and leaves the recalculated ratings stable.
	_, err = db.Exec(string(migration))
	require.NoError(t, err)
	assert.Equal(t, 76, ratingForSceneCustom(t, db, 3571))
	assert.Equal(t, 50, ratingForSceneCustom(t, db, 951))
	assert.Equal(t, 70, ratingForSceneCustom(t, db, 2085))
}
