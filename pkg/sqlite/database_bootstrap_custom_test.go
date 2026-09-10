package sqlite

import (
	"context"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func newTaskProgressBootstrapDBCustom(t *testing.T) *sqlx.DB {
	t.Helper()
	db, err := sqlx.Open("sqlite3", ":memory:?_foreign_keys=on")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	return db
}

func createTaskProgressSourceTablesCustom(t *testing.T, db *sqlx.DB, includeGroups bool) {
	t.Helper()
	_, err := db.Exec(`
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE scenes (id INTEGER PRIMARY KEY, organized BOOLEAN NOT NULL DEFAULT 0);
CREATE TABLE scenes_tags (scene_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE images_tags (image_id INTEGER, tag_id INTEGER);
CREATE TABLE galleries_tags (gallery_id INTEGER, tag_id INTEGER);
CREATE TABLE performers_tags (performer_id INTEGER, tag_id INTEGER);
CREATE TABLE studios_tags (studio_id INTEGER, tag_id INTEGER);
`)
	require.NoError(t, err)
	if includeGroups {
		_, err = db.Exec("CREATE TABLE groups_tags (group_id INTEGER, tag_id INTEGER)")
		require.NoError(t, err)
	}
}

func TestTaskProgressSchemaBootstrapFreshDatabaseCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, true)

	database := &Database{writeDB: db}
	require.NoError(t, database.ensureTaskProgressSchemaCustom(context.Background()))

	var tableCount int
	require.NoError(t, db.Get(&tableCount, `
SELECT COUNT(*)
  FROM sqlite_master
 WHERE type = 'table'
   AND name IN (
     'task_progress_trackers',
     'task_progress_tracker_events',
     'task_progress_tracker_members',
     'task_progress_overall_events',
     'custom_schema_migrations'
   )`))
	require.Equal(t, 5, tableCount)

	var columns []string
	require.NoError(t, db.Select(&columns, "SELECT name FROM pragma_table_info('task_progress_trackers')"))
	require.Subset(t, columns, []string{
		"status", "item_types", "history_started_on", "mode", "version",
	})

	var markerCount int
	require.NoError(t, db.Get(&markerCount,
		"SELECT COUNT(*) FROM custom_schema_migrations WHERE name = ?",
		taskProgressHistoryMigrationCustom,
	))
	require.Equal(t, 1, markerCount)
	require.NoError(t, db.Get(&markerCount,
		"SELECT COUNT(*) FROM custom_schema_migrations WHERE name = ?",
		taskProgressOverallHistoryMigrationCustom,
	))
	require.Equal(t, 1, markerCount)

	var baselineCount int
	require.NoError(t, db.Get(&baselineCount, "SELECT COUNT(*) FROM task_progress_overall_events WHERE event_type = 'BASELINE'"))
	require.Equal(t, 1, baselineCount)
}

func TestTaskProgressSchemaBootstrapRetrofitsOnceCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, true)
	_, err := db.Exec(`
CREATE TABLE task_progress_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_working_on BOOLEAN NOT NULL DEFAULT 0,
  items_per_day INTEGER NOT NULL DEFAULT 0,
  started_on TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
INSERT INTO tags(id, name) VALUES (1, 'Inbox');
INSERT INTO task_progress_trackers(title, goal, tag_id, started_on)
VALUES ('Cleanup', 99, 1, '2026-01-15');
INSERT INTO scenes_tags(scene_id, tag_id) VALUES (10, 1);
INSERT INTO scene_markers(id, primary_tag_id) VALUES (20, 1), (21, 2);
INSERT INTO scene_markers_tags(scene_marker_id, tag_id) VALUES (20, 1), (21, 1);
INSERT INTO images_tags(image_id, tag_id) VALUES (30, 1);
INSERT INTO galleries_tags(gallery_id, tag_id) VALUES (40, 1);
INSERT INTO performers_tags(performer_id, tag_id) VALUES (50, 1);
INSERT INTO studios_tags(studio_id, tag_id) VALUES (60, 1);
INSERT INTO groups_tags(group_id, tag_id) VALUES (70, 1);
`)
	require.NoError(t, err)

	database := &Database{writeDB: db}
	require.NoError(t, database.ensureTaskProgressSchemaCustom(context.Background()))

	var tracker struct {
		StartedOn        string `db:"started_on"`
		HistoryStartedOn string `db:"history_started_on"`
		Status           string `db:"status"`
		ItemTypes        string `db:"item_types"`
		Goal             int    `db:"goal"`
	}
	require.NoError(t, db.Get(&tracker, `
SELECT started_on, history_started_on, status, item_types, goal
  FROM task_progress_trackers
 WHERE id = 1`))
	require.Equal(t, taskProgressHistoryEpochCustom, tracker.StartedOn)
	require.Equal(t, taskProgressHistoryEpochCustom, tracker.HistoryStartedOn)
	require.Equal(t, "ACTIVE", tracker.Status)
	require.Equal(t, "scene,scene_marker,image,gallery,performer,studio,group", tracker.ItemTypes)
	require.Equal(t, 8, tracker.Goal)

	var obsoleteColumnCount int
	require.NoError(t, db.Get(&obsoleteColumnCount, `
SELECT COUNT(*)
  FROM pragma_table_info('task_progress_trackers')
 WHERE name = 'items_per_day'`))
	require.Zero(t, obsoleteColumnCount)

	var baseline struct {
		EventType     string `db:"event_type"`
		OccurredOn    string `db:"occurred_on"`
		BaselineCount int    `db:"baseline_count"`
		TagID         int    `db:"tag_id"`
	}
	require.NoError(t, db.Get(&baseline, `
SELECT event_type, occurred_on, baseline_count, tag_id
  FROM task_progress_tracker_events
 WHERE tracker_id = 1`))
	require.Equal(t, "BASELINE", baseline.EventType)
	require.Equal(t, taskProgressHistoryEpochCustom, baseline.OccurredOn)
	require.Equal(t, 8, baseline.BaselineCount)
	require.Equal(t, 1, baseline.TagID)

	_, err = db.Exec(`
UPDATE task_progress_trackers
   SET started_on = '2026-10-01', status = 'PAUSED', goal = 3
 WHERE id = 1;
INSERT INTO task_progress_tracker_events(
  tracker_id, event_type, item_type, item_id, occurred_on, tag_id
) VALUES (1, 'COMPLETED', 'scene', 10, '2026-10-01', 1);
`)
	require.NoError(t, err)
	require.NoError(t, database.ensureTaskProgressSchemaCustom(context.Background()))

	var secondPass struct {
		StartedOn string `db:"started_on"`
		Status    string `db:"status"`
		Goal      int    `db:"goal"`
	}
	require.NoError(t, db.Get(&secondPass,
		"SELECT started_on, status, goal FROM task_progress_trackers WHERE id = 1"))
	require.Equal(t, "2026-10-01", secondPass.StartedOn)
	require.Equal(t, "PAUSED", secondPass.Status)
	require.Equal(t, 3, secondPass.Goal)

	var eventCount int
	require.NoError(t, db.Get(&eventCount,
		"SELECT COUNT(*) FROM task_progress_tracker_events WHERE tracker_id = 1"))
	require.Equal(t, 2, eventCount)
}

func TestTaskProgressSchemaBootstrapRollsBackCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, false)
	_, err := db.Exec(`
CREATE TABLE task_progress_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_working_on BOOLEAN NOT NULL DEFAULT 0,
  started_on TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO task_progress_trackers(title, goal, tag_id, started_on)
VALUES ('Cleanup', 1, 1, '2026-01-15');
`)
	require.NoError(t, err)

	database := &Database{writeDB: db}
	err = database.ensureTaskProgressSchemaCustom(context.Background())
	require.ErrorContains(t, err, "no such table: groups_tags")

	var markerTableCount int
	require.NoError(t, db.Get(&markerTableCount, `
SELECT COUNT(*) FROM sqlite_master
 WHERE type = 'table' AND name = 'custom_schema_migrations'`))
	require.Zero(t, markerTableCount)

	var historyColumnCount int
	require.NoError(t, db.Get(&historyColumnCount, `
SELECT COUNT(*) FROM pragma_table_info('task_progress_trackers')
 WHERE name = 'history_started_on'`))
	require.Zero(t, historyColumnCount)
}
