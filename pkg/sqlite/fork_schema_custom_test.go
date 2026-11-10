package sqlite

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func openForkSchemaFileCustom(t *testing.T, dbPath string) *sqlx.DB {
	t.Helper()
	conn, err := sqlx.Open(sqlite3Driver, "file:"+dbPath+"?_fk=true")
	require.NoError(t, err)
	conn.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func forkSchemaSnapshotCustom(t *testing.T, conn *sqlx.DB) []string {
	t.Helper()
	var schema []string
	require.NoError(t, conn.Select(&schema, `SELECT type || ' ' || name || ' ' || COALESCE(sql, '') FROM sqlite_master ORDER BY type, name`))
	return schema
}

// A plain upstream database gets every fork table at startup, its upstream
// rows survive the rebuilds, and a second startup changes nothing.
func TestForkSchemaUpgradesUpstreamDatabaseCustom(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "stash.sqlite")
	database := NewDatabase()
	database.dbPath = dbPath
	require.NoError(t, database.RunAllMigrations())

	conn := openForkSchemaFileCustom(t, dbPath)
	_, err := conn.Exec(`
CREATE TABLE scene_release_activity_upgrade_guard (applied_at DATETIME);
CREATE TABLE scene_release_rating_upgrade_guard (applied_at DATETIME);
INSERT INTO tags(id, name, created_at, updated_at) VALUES (5, 'Sex', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO scenes(id, created_at, updated_at) VALUES (1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO scene_markers(id, title, seconds, primary_tag_id, scene_id, created_at, updated_at)
VALUES (9, 'start', 0, 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES (9, 5);
INSERT INTO scenes_o_dates(rowid, scene_id, o_date) VALUES (40, 1, '2026-01-01T10:00:00Z');`)
	require.NoError(t, err)
	require.NoError(t, conn.Close())

	require.NoError(t, database.initialise())
	require.NoError(t, database.Close())

	conn = openForkSchemaFileCustom(t, dbPath)
	var count int
	require.NoError(t, conn.Get(&count, `SELECT COUNT(*) FROM scene_markers_tags WHERE scene_marker_id = 9`))
	assert.Equal(t, 1, count, "rebuilding markers must not cascade into their tags")
	require.NoError(t, conn.Get(&count, `SELECT rowid FROM scenes_o_dates WHERE scene_id = 1`))
	assert.Equal(t, 40, count, "O screenshots keep their rowid")
	_, err = conn.Exec(`INSERT INTO scenes_o_dates(scene_id) VALUES (1)`)
	assert.NoError(t, err, "retroactive O's have no date")
	_, err = conn.Exec(`INSERT INTO rating_criteria_scores(entity_type, entity_id, key) VALUES ('scene_release', 99, 'x')`)
	assert.Error(t, err, "scores need an existing entity")
	for _, table := range []string{"performer_images", "marker_playlists", "scene_marker_performers", "scene_release_metadata"} {
		require.NoError(t, conn.Get(&count, `SELECT COUNT(*) FROM sqlite_master WHERE name = ?`, table))
		assert.Equal(t, 1, count, table)
	}
	columns, err := tableColumnsCustom(context.Background(), conn, "scene_markers")
	require.NoError(t, err)
	assert.Contains(t, columns, "release_id")
	require.NoError(t, conn.Get(&count, `SELECT COUNT(*) FROM sqlite_master WHERE name LIKE '%upgrade_guard'`))
	assert.Zero(t, count, "the old upgrade markers are dropped")
	require.NoError(t, conn.Get(&count, `SELECT COUNT(*) FROM pragma_foreign_key_check`))
	assert.Zero(t, count)

	before := forkSchemaSnapshotCustom(t, conn)
	require.NoError(t, conn.Close())
	require.NoError(t, database.initialise())
	require.NoError(t, database.Close())
	conn = openForkSchemaFileCustom(t, dbPath)
	assert.Equal(t, before, forkSchemaSnapshotCustom(t, conn))
}

// Score tables from before release support keep their rows and IDs.
func TestForkSchemaRebuildsLegacyRatingTablesCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.Exec(`
CREATE TABLE scenes(id INTEGER PRIMARY KEY);
CREATE TABLE performers(id INTEGER PRIMARY KEY);
CREATE TABLE scene_releases(id INTEGER PRIMARY KEY);
INSERT INTO scenes VALUES (1);
INSERT INTO scene_releases VALUES (4);`)
	require.NoError(t, err)
	for _, table := range []string{ratingCriteriaScoresTable, ratingBonusScoresTable, ratingPenaltyScoresTable} {
		_, err = db.Exec(`CREATE TABLE ` + table + ` (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('scene', 'performer')),
  entity_id INTEGER NOT NULL, key TEXT NOT NULL,
  raw_value REAL NOT NULL DEFAULT 0, weighted_value REAL NOT NULL DEFAULT 0, label TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, key));
CREATE TRIGGER rating_scores_scene_delete_custom_` + table + ` AFTER DELETE ON scenes BEGIN DELETE FROM ` + table + ` WHERE entity_id = OLD.id; END;
INSERT INTO ` + table + `(id, entity_type, entity_id, key, raw_value) VALUES (7, 'scene', 1, 'payoff', 2);`)
		require.NoError(t, err)
	}
	_, err = db.Exec(`CREATE TRIGGER rating_scores_scene_delete_custom AFTER DELETE ON scenes BEGIN DELETE FROM rating_criteria_scores WHERE entity_id = OLD.id; END`)
	require.NoError(t, err)

	rebuilt, err := ensureRatingScoreSchemaCustom(context.Background(), db)
	require.NoError(t, err)
	assert.Len(t, rebuilt, 3)

	var id int
	require.NoError(t, db.Get(&id, `SELECT id FROM rating_bonus_scores WHERE key = 'payoff'`))
	assert.Equal(t, 7, id)
	_, err = db.Exec(`INSERT INTO rating_penalty_scores(entity_type, entity_id, key) VALUES ('scene_release', 4, 'x')`)
	assert.NoError(t, err)
	_, err = db.Exec(`DELETE FROM scenes WHERE id = 1`)
	require.NoError(t, err)
	var count int
	require.NoError(t, db.Get(&count, `SELECT COUNT(*) FROM rating_criteria_scores WHERE entity_type = 'scene'`))
	assert.Zero(t, count, "deleting a scene removes its scores")

	rebuilt, err = ensureRatingScoreSchemaCustom(context.Background(), db)
	require.NoError(t, err)
	assert.Empty(t, rebuilt)
}
