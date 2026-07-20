package sqlite

import (
	"context"
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

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	ctx := context.WithValue(context.Background(), txnKey, tx)
	t.Cleanup(func() { _ = tx.Rollback() })

	store := NewTaskProgressTrackerStore()
	goal, err := store.CountDirectlyTaggedItems(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, 9, goal)

	first := &models.TaskProgressTracker{
		Title:       "First",
		Description: "Database-backed",
		Goal:        goal,
		TagID:       1,
		IsWorkingOn: true,
	}
	require.NoError(t, store.Create(ctx, first))
	require.NotZero(t, first.ID)
	require.Equal(t, "Inbox", first.TagName)
	require.Equal(t, 0, first.Position)

	second := &models.TaskProgressTracker{Title: "Second", Goal: goal, TagID: 1}
	require.NoError(t, store.Create(ctx, second))
	require.Equal(t, 1, second.Position)

	first.Description = "Updated"
	first.IsWorkingOn = false
	require.NoError(t, store.Update(ctx, first))
	updated, err := store.Find(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, "Updated", updated.Description)
	require.False(t, updated.IsWorkingOn)

	require.NoError(t, store.Reorder(ctx, []int{second.ID, first.ID}))
	trackers, err := store.FindAll(ctx)
	require.NoError(t, err)
	require.Equal(t, []int{second.ID, first.ID}, []int{trackers[0].ID, trackers[1].ID})

	require.NoError(t, store.Delete(ctx, first.ID))
	deleted, err := store.Find(ctx, first.ID)
	require.NoError(t, err)
	require.Nil(t, deleted)
}
