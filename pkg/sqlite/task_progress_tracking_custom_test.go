package sqlite

import (
	"context"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/stashapp/stash/pkg/models"
)

func newTaskProgressTrackingTestDBCustom(t *testing.T) (*sqlx.DB, context.Context) {
	t.Helper()

	db, err := sqlx.Open(sqlite3Driver, ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`
CREATE TABLE task_progress_trackers (
  id INTEGER PRIMARY KEY,
  tag_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  item_types TEXT NOT NULL,
  mode TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE task_progress_tracker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT '',
  item_id INTEGER NOT NULL DEFAULT 0,
  item_label TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  occurred_at DATETIME NOT NULL,
  baseline_count INTEGER NOT NULL DEFAULT 0,
  tag_id INTEGER NOT NULL
);
CREATE TABLE task_progress_tracker_members (
  tracker_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (tracker_id, item_type, item_id)
);

CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL, sort_name TEXT);
INSERT INTO tags(id,name) VALUES (10,'Ten'), (20,'Twenty');
CREATE TABLE scenes (id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '', organized BOOLEAN NOT NULL DEFAULT 0);
CREATE TABLE scenes_tags (scene_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(scene_id, tag_id));
CREATE TABLE scene_markers (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  seconds REAL NOT NULL DEFAULT 0,
  primary_tag_id INTEGER NOT NULL,
  scene_id INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_seconds REAL
);
CREATE TABLE scene_markers_tags (scene_marker_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(scene_marker_id, tag_id));
CREATE TABLE images (id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '');
CREATE TABLE images_tags (image_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(image_id, tag_id));
CREATE TABLE galleries (id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '');
CREATE TABLE galleries_tags (gallery_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(gallery_id, tag_id));
CREATE TABLE performers (id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '');
CREATE TABLE performers_tags (performer_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(performer_id, tag_id));
CREATE TABLE studios (id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '');
CREATE TABLE studios_tags (studio_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(studio_id, tag_id));
CREATE TABLE groups (id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '');
CREATE TABLE groups_tags (group_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(group_id, tag_id));
CREATE TABLE task_progress_overall_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  scene_id INTEGER NOT NULL DEFAULT 0,
  occurred_on TEXT NOT NULL,
  occurred_at DATETIME NOT NULL,
  total_count INTEGER NOT NULL,
  organized_count INTEGER NOT NULL,
  remaining_count INTEGER NOT NULL
);
`)
	require.NoError(t, err)

	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	ctx := context.WithValue(context.Background(), txnKey, tx)
	t.Cleanup(func() { _ = tx.Rollback() })
	return db, ctx
}

func taskProgressEventCountCustom(t *testing.T, ctx context.Context) int {
	t.Helper()
	var count int
	require.NoError(t, dbWrapper.Get(ctx, &count, "SELECT COUNT(*) FROM task_progress_tracker_events"))
	return count
}

func TestTaskProgressTrackingDiffCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_trackers(id,tag_id,status,item_types,mode) VALUES
  (1,10,'ACTIVE','scene','BACKLOG'),
  (2,20,'ACTIVE','scene','BACKLOG'),
  (3,10,'ARCHIVED','scene','BACKLOG');
INSERT INTO scenes(id,title) VALUES (1,'Inbox Scene'), (2,'Deleted Scene');
INSERT INTO scenes_tags(scene_id,tag_id) VALUES (1,10), (2,10);`)
	require.NoError(t, err)

	before, err := taskProgressTagSnapshotCustom(ctx, "scene", 1)
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, before, before))
	require.Equal(t, 0, taskProgressEventCountCustom(t, ctx), "a logical no-op must not record replace churn")

	_, err = dbWrapper.Exec(ctx, "INSERT INTO scenes_tags(scene_id,tag_id) VALUES (?,?)", 1, 20)
	require.NoError(t, err)
	afterAdd, err := taskProgressTagSnapshotCustom(ctx, "scene", 1)
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, before, afterAdd))

	_, err = dbWrapper.Exec(ctx, "DELETE FROM scenes_tags WHERE scene_id = ? AND tag_id = ?", 1, 10)
	require.NoError(t, err)
	afterRemove, err := taskProgressTagSnapshotCustom(ctx, "scene", 1)
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, afterAdd, afterRemove))

	var events []struct {
		EventType  string `db:"event_type"`
		TagID      int    `db:"tag_id"`
		ItemLabel  string `db:"item_label"`
		OccurredOn string `db:"occurred_on"`
	}
	require.NoError(t, dbWrapper.Select(ctx, &events, "SELECT event_type,tag_id,item_label,occurred_on FROM task_progress_tracker_events ORDER BY id"))
	require.Len(t, events, 2)
	require.Equal(t, "INCOMING", events[0].EventType)
	require.Equal(t, 20, events[0].TagID)
	require.Equal(t, "COMPLETED", events[1].EventType)
	require.Equal(t, 10, events[1].TagID)
	require.Equal(t, "Inbox Scene", events[1].ItemLabel)
	require.Equal(t, time.Now().In(taskProgressTimezoneCustom).Format("2006-01-02"), events[1].OccurredOn)

	deleteBefore, err := taskProgressTagSnapshotCustom(ctx, "scene", 2)
	require.NoError(t, err)
	deleteLabel, err := taskProgressItemLabelCustom(ctx, "scene", 2)
	require.NoError(t, err)
	_, err = dbWrapper.Exec(ctx, "DELETE FROM scenes_tags WHERE scene_id = ?", 2)
	require.NoError(t, err)
	_, err = dbWrapper.Exec(ctx, "DELETE FROM scenes WHERE id = ?", 2)
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 2, deleteBefore, nil, deleteLabel))

	var deletedLabel string
	require.NoError(t, dbWrapper.Get(ctx, &deletedLabel, "SELECT item_label FROM task_progress_tracker_events WHERE item_id = 2"))
	require.Equal(t, "Deleted Scene", deletedLabel)

	equal := taskProgressTagSetCustom{10: struct{}{}}
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "unsupported", 99, equal, equal), "no-op diffs must skip label and database work")
}

func TestTaskProgressTrackingFixedCohortCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_trackers(id,tag_id,status,item_types,mode) VALUES
  (1,10,'ACTIVE','scene','FIXED'),
  (2,10,'ACTIVE','image','FIXED');
INSERT INTO task_progress_tracker_members(tracker_id,item_type,item_id,state) VALUES
  (1,'scene',1,'PENDING');
INSERT INTO scenes(id,title) VALUES (1,'Cohort Scene'), (2,'Outside Cohort');`)
	require.NoError(t, err)

	tagged := taskProgressTagSetCustom{10: struct{}{}}
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, tagged, nil))

	var state string
	require.NoError(t, dbWrapper.Get(ctx, &state, "SELECT state FROM task_progress_tracker_members WHERE tracker_id=1 AND item_id=1"))
	require.Equal(t, "COMPLETED", state)
	require.Equal(t, 1, taskProgressEventCountCustom(t, ctx))

	_, err = dbWrapper.Exec(ctx, "UPDATE task_progress_trackers SET status='COMPLETED' WHERE id=1")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, nil, tagged))
	require.NoError(t, dbWrapper.Get(ctx, &state, "SELECT state FROM task_progress_tracker_members WHERE tracker_id=1 AND item_id=1"))
	require.Equal(t, "PENDING", state)
	var status string
	require.NoError(t, dbWrapper.Get(ctx, &status, "SELECT status FROM task_progress_trackers WHERE id=1"))
	require.Equal(t, "ACTIVE", status)
	require.Equal(t, 2, taskProgressEventCountCustom(t, ctx))

	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 2, nil, tagged))
	require.Equal(t, 2, taskProgressEventCountCustom(t, ctx), "new work outside a fixed cohort is excluded")
}

func TestTaskProgressTrackingMarkerUnionCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_trackers(id,tag_id,status,item_types,mode) VALUES
  (1,10,'ACTIVE','scene_marker','BACKLOG'),
  (2,20,'ACTIVE','scene_marker','BACKLOG');
INSERT INTO scene_markers(id,title,primary_tag_id) VALUES (1,'Marker One',10);
INSERT INTO scene_markers_tags(scene_marker_id,tag_id) VALUES (1,20);`)
	require.NoError(t, err)

	store := NewSceneMarkerStore()
	require.NoError(t, store.UpdateTags(ctx, 1, []int{20}))
	require.Equal(t, 0, taskProgressEventCountCustom(t, ctx), "physical replace with the same secondary tags is a no-op")

	partial := models.NewSceneMarkerPartial()
	partial.PrimaryTagID = models.NewOptionalInt(20)
	partial.TagIDs = &models.UpdateIDs{IDs: []int{10}, Mode: models.RelationshipUpdateModeSet}
	_, err = store.UpdatePartial(ctx, 1, partial)
	require.NoError(t, err)
	require.Equal(t, 0, taskProgressEventCountCustom(t, ctx), "swapping primary and secondary representation preserves logical membership")

	require.NoError(t, store.UpdateTags(ctx, 1, nil))
	var event struct {
		EventType string `db:"event_type"`
		TagID     int    `db:"tag_id"`
	}
	require.NoError(t, dbWrapper.Get(ctx, &event, "SELECT event_type,tag_id FROM task_progress_tracker_events"))
	require.Equal(t, "COMPLETED", event.EventType)
	require.Equal(t, 10, event.TagID)
}

func TestTaskProgressTrackingRollbackCustom(t *testing.T) {
	db, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_trackers(id,tag_id,status,item_types,mode) VALUES (1,10,'ACTIVE','scene','BACKLOG');
INSERT INTO scenes(id,title) VALUES (1,'Rollback Scene');`)
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, nil, taskProgressTagSetCustom{10: struct{}{}}))
	require.Equal(t, 1, taskProgressEventCountCustom(t, ctx))

	tx, err := getTx(ctx)
	require.NoError(t, err)
	require.NoError(t, tx.Rollback())

	var count int
	require.NoError(t, db.Get(&count, "SELECT COUNT(*) FROM task_progress_tracker_events"))
	require.Equal(t, 0, count)
}
