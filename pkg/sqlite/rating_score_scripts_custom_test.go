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

func TestGroupSceneRatingWeightMigrationRecalculatesAndIsIdempotent(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		INSERT INTO scenes (id, rating) VALUES (1, 54), (2, 0), (3, 75);
		INSERT INTO performers_scenes (performer_id, scene_id) VALUES
			(1, 1), (2, 1), (3, 1), (4, 1),
			(1, 2), (2, 2), (3, 2), (4, 2),
			(1, 3), (2, 3), (3, 3);
		INSERT INTO rating_criteria_scores (entity_type, entity_id, key, raw_value, weighted_value) VALUES
			('scene', 1, 'groupTopAttractiveness', 5, 2),
			('scene', 1, 'groupEnergy', 1, 0.8),
			('scene', 1, 'groupPayoff', 4, 2),
			('scene', 1, 'groupUsability', 2, 1),
			('scene', 2, 'groupTopAttractiveness', 5, 2),
			('scene', 2, 'groupEnergy', 0, 0),
			('scene', 3, 'groupTopAttractiveness', 5, 2);
		INSERT INTO rating_bonus_scores (entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('scene', 1, 'theme', 0.5, 0.5);
		INSERT INTO rating_penalty_scores (entity_type, entity_id, key, raw_value, weighted_value)
			VALUES ('scene', 1, 'production', -1, -1), ('scene', 2, 'noOrgasm', -2, -2);
		INSERT INTO scenes_o_dates (scene_id) VALUES (1), (1), (1);
	`)
	require.NoError(t, err)

	migration, err := os.ReadFile(filepath.Join("..", "..", "group_scene_rating_30_30.up.sql"))
	require.NoError(t, err)
	for run := 0; run < 2; run++ {
		_, err = db.Exec(string(migration))
		require.NoError(t, err)
		var affectedCount int
		require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM group_scene_rating_weight_changes_custom").Scan(&affectedCount))
		if run == 0 {
			assert.Equal(t, 2, affectedCount)
		} else {
			assert.Zero(t, affectedCount, "a rerun must not report migrated scenes again")
		}

		var rating int
		require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = 1").Scan(&rating))
		assert.Equal(t, 62, rating)
		require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = 2").Scan(&rating))
		assert.Equal(t, 10, rating, "a previously clamped rating must be recomputed from raw answers")
		require.NoError(t, db.QueryRow("SELECT rating FROM scenes WHERE id = 3").Scan(&rating))
		assert.Equal(t, 75, rating, "three-performer scenes must be untouched")

		var top, energy float64
		require.NoError(t, db.QueryRow("SELECT weighted_value FROM rating_criteria_scores WHERE entity_id = 1 AND key = 'groupTopAttractiveness'").Scan(&top))
		require.NoError(t, db.QueryRow("SELECT weighted_value FROM rating_criteria_scores WHERE entity_id = 1 AND key = 'groupEnergy'").Scan(&energy))
		assert.InDelta(t, 3, top, 0.000001)
		assert.InDelta(t, 0.6, energy, 0.000001)
	}
}

func TestGoatTierReviewMigrationTagsOnlyLegacyActiveBonuses(t *testing.T) {
	db := openRatingScriptDatabaseCustom(t)
	_, err := db.Exec(`
		CREATE TABLE tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			ignore_auto_tag BOOLEAN NOT NULL DEFAULT 0,
			description TEXT
		);
		CREATE TABLE scenes_tags (
			scene_id INTEGER,
			tag_id INTEGER,
			PRIMARY KEY(scene_id, tag_id)
		);
		INSERT INTO scenes (id, rating) VALUES (1, 90), (2, 80), (3, 70);
		INSERT INTO rating_bonus_scores
			(entity_type, entity_id, key, raw_value, weighted_value, label)
		VALUES
			('scene', 1, 'goatElement', 2, 2, 'GOAT element'),
			('scene', 2, 'goatElement', 0, 0, 'No GOAT element'),
			('scene', 3, 'goatElement', 1.5, 1.5, 'GOAT +15');
	`)
	require.NoError(t, err)

	migration, err := os.ReadFile(filepath.Join("..", "..", "rating_goat_tiers_review.up.sql"))
	require.NoError(t, err)
	_, err = db.Exec(string(migration))
	require.NoError(t, err)
	_, err = db.Exec(string(migration))
	require.NoError(t, err, "the migration must be safe to rerun")

	var tagCount int
	require.NoError(t, db.QueryRow("SELECT COUNT(*) FROM tags WHERE name = 'reviewGOAT'").Scan(&tagCount))
	assert.Equal(t, 1, tagCount)

	var taggedSceneCount int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*)
		FROM scenes_tags st
		JOIN tags t ON t.id = st.tag_id
		WHERE t.name = 'reviewGOAT'
	`).Scan(&taggedSceneCount))
	assert.Equal(t, 1, taggedSceneCount)
	var taggedSceneID int
	require.NoError(t, db.QueryRow(`
		SELECT st.scene_id
		FROM scenes_tags st
		JOIN tags t ON t.id = st.tag_id
		WHERE t.name = 'reviewGOAT'
	`).Scan(&taggedSceneID))
	assert.Equal(t, 1, taggedSceneID)

	var rawValue, weightedValue float64
	var label string
	require.NoError(t, db.QueryRow(`
		SELECT raw_value, weighted_value, label
		FROM rating_bonus_scores
		WHERE entity_type = 'scene' AND entity_id = 1 AND key = 'goatElement'
	`).Scan(&rawValue, &weightedValue, &label))
	assert.Equal(t, 2.0, rawValue)
	assert.Equal(t, 2.0, weightedValue)
	assert.Equal(t, "GOAT +20", label)
}
