package sqlite

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"

	"github.com/stashapp/stash/pkg/models"
)

func TestTaskProgressTrackerStoreCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE task_progress_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_working_on BOOLEAN NOT NULL DEFAULT 0,
  started_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  item_types TEXT NOT NULL DEFAULT 'scene,scene_marker,image,gallery,performer,studio,group',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE TABLE scenes_tags (scene_id INTEGER, tag_id INTEGER);
CREATE TABLE scene_markers (id INTEGER PRIMARY KEY, primary_tag_id INTEGER);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER, tag_id INTEGER);
CREATE TABLE images_tags (image_id INTEGER, tag_id INTEGER);
CREATE TABLE galleries_tags (gallery_id INTEGER, tag_id INTEGER);
CREATE TABLE performers_tags (performer_id INTEGER, tag_id INTEGER);
CREATE TABLE studios_tags (studio_id INTEGER, tag_id INTEGER);
CREATE TABLE groups_tags (group_id INTEGER, tag_id INTEGER);
CREATE TABLE task_progress_tracker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT '',
  item_id INTEGER NOT NULL DEFAULT 0,
  item_label TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  baseline_count INTEGER NOT NULL DEFAULT 0,
  tag_id INTEGER NOT NULL
);

INSERT INTO tags (id, name) VALUES (1, 'Inbox');
INSERT INTO scenes_tags (scene_id, tag_id) VALUES (1, 1);
INSERT INTO scene_markers (id, primary_tag_id) VALUES (1, 1), (2, 2), (3, 1);
INSERT INTO scene_markers_tags (scene_marker_id, tag_id) VALUES (2, 1), (3, 1);
INSERT INTO images_tags (image_id, tag_id) VALUES (1, 1);
INSERT INTO galleries_tags (gallery_id, tag_id) VALUES (1, 1);
INSERT INTO performers_tags (performer_id, tag_id) VALUES (1, 1);
INSERT INTO studios_tags (studio_id, tag_id) VALUES (1, 1);
INSERT INTO groups_tags (group_id, tag_id) VALUES (1, 1);
`)
	require.NoError(t, err)

	require.NoError(t, (&Database{writeDB: db}).ensureTaskProgressSchemaCustom(context.Background()))
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	ctx := context.WithValue(context.Background(), txnKey, tx)
	t.Cleanup(func() { _ = tx.Rollback() })

	store := NewTaskProgressTrackerStore()
	goal, err := store.CountDirectlyTaggedItems(ctx, 1, models.TaskProgressItemTypes)
	require.NoError(t, err)
	require.Equal(t, 9, goal)

	first := &models.TaskProgressTracker{
		Title:       "First",
		Description: "Database-backed",
		Goal:        goal,
		TagID:       1,
	}
	require.NoError(t, store.Create(ctx, first))
	require.NoError(t, store.CreateBaseline(ctx, first))
	require.NotZero(t, first.ID)
	require.Equal(t, "Inbox", first.TagName)
	require.Equal(t, 0, first.Position)
	require.Equal(t, models.TaskProgressReportingDate(first.CreatedAt), first.StartedOn)
	require.Equal(t, models.TaskProgressTrackerStatusActive, first.Status)
	require.Len(t, first.ItemCounts, 7)

	second := &models.TaskProgressTracker{Title: "Second", Goal: goal, TagID: 1}
	require.NoError(t, store.Create(ctx, second))
	require.Equal(t, 1, second.Position)

	first.Description = "Updated"
	first.StartedOn = "2026-07-20"
	require.NoError(t, store.Update(ctx, first))
	updated, err := store.Find(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, "Updated", updated.Description)
	require.Equal(t, "2026-07-20", updated.StartedOn)

	require.NoError(t, store.Reorder(ctx, []int{second.ID, first.ID}))
	trackers, err := store.FindAll(ctx)
	require.NoError(t, err)
	require.Equal(t, []int{second.ID, first.ID}, []int{trackers[0].ID, trackers[1].ID})

	require.NoError(t, store.Delete(ctx, first.ID))
	deleted, err := store.Find(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, "DELETED", deleted.Status)
	remaining, err := store.FindAll(ctx)
	require.NoError(t, err)
	require.Len(t, remaining, 1)
	deleted.Status = "ACTIVE"
	require.NoError(t, store.Update(ctx, deleted))
	restored, err := store.Find(ctx, first.ID)
	require.NoError(t, err)
	require.NotEmpty(t, restored.History, "undo preserves history")
}

func TestTaskProgressTrackerStartedOnUpgradeCustom(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE task_progress_trackers (
  id INTEGER PRIMARY KEY,
  created_at DATETIME NOT NULL
);
INSERT INTO task_progress_trackers (id, created_at) VALUES (1, '2026-07-19 15:30:00');
`)
	require.NoError(t, err)

	migration, err := os.ReadFile(filepath.Join("..", "..", "task_progress_trackers_started_on.up.sql"))
	require.NoError(t, err)
	_, err = db.Exec(string(migration))
	require.NoError(t, err)

	var startedOn string
	require.NoError(t, db.Get(&startedOn, "SELECT started_on FROM task_progress_trackers WHERE id = 1"))
	require.Equal(t, "2026-07-19", startedOn)
}
