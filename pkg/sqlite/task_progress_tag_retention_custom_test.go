package sqlite

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTaskProgressTagRetentionMigrationCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, true)
	legacy := strings.ReplaceAll(taskProgressTrackerTableSchemaCustom, "tag_id INTEGER,", "tag_id INTEGER NOT NULL,")
	legacy = strings.ReplaceAll(legacy, "  tag_name TEXT NOT NULL DEFAULT '',\n", "")
	legacy = strings.ReplaceAll(legacy, "ON DELETE SET NULL", "ON DELETE CASCADE")
	_, err := db.Exec(legacy + taskProgressEventTableSchemaCustom + taskProgressGoalHistoryTableSchemaCustom + taskProgressMilestoneSchemaCustom + `
INSERT INTO tags(id,name) VALUES (1,'Original tag');
INSERT INTO task_progress_trackers(id,title,goal,tag_id,status,mode,started_on,version) VALUES (1,'Finished',2,1,'COMPLETED','FIXED','2026-10-07',7);
INSERT INTO task_progress_tracker_events(tracker_id,event_type,item_type,item_id,occurred_on,baseline_count,tag_id) VALUES
 (1,'BASELINE','',0,'2026-10-07',2,1), (1,'COMPLETED','scene',10,'2026-10-07',0,1), (1,'COMPLETED','scene',11,'2026-10-07',0,1);
INSERT INTO task_progress_tracker_members VALUES (1,'scene',10,'COMPLETED'),(1,'scene',11,'COMPLETED');
INSERT INTO task_progress_goal_history(tracker_id,effective_on,goal_per_day) VALUES (1,'2026-10-07',2);
INSERT INTO task_progress_milestones(id,name) VALUES (1,'Keep history');
INSERT INTO task_progress_milestone_members VALUES (1,1);
UPDATE sqlite_sequence SET seq=99 WHERE name='task_progress_trackers';
`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	// Upgrade the legacy parent without changing historical records or versions.
	_, err = tx.Exec("ALTER TABLE task_progress_trackers ADD COLUMN tag_name TEXT NOT NULL DEFAULT ''")
	require.NoError(t, err)
	require.NoError(t, ensureTaskProgressTagRetentionCustom(context.Background(), tx))
	require.NoError(t, ensureTaskProgressTagRetentionCustom(context.Background(), tx))
	require.NoError(t, tx.Commit())
	var sequence, version int
	require.NoError(t, db.Get(&sequence, "SELECT seq FROM sqlite_sequence WHERE name='task_progress_trackers'"))
	require.Equal(t, 99, sequence)
	require.NoError(t, db.Get(&version, "SELECT version FROM task_progress_trackers WHERE id=1"))
	require.Equal(t, 7, version)
	_, err = db.Exec("UPDATE tags SET name='Renamed tag' WHERE id=1; DELETE FROM tags WHERE id=1")
	require.NoError(t, err)
	for table, expected := range map[string]int{"task_progress_tracker_events": 3, "task_progress_tracker_members": 2, "task_progress_goal_history": 1, "task_progress_milestone_members": 1} {
		var count int
		require.NoError(t, db.Get(&count, "SELECT COUNT(*) FROM "+table+" WHERE tracker_id=1"))
		require.Equal(t, expected, count, table)
	}
	tx, err = db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := NewTaskProgressTrackerStore()
	tracker, err := store.Find(ctx, 1)
	require.NoError(t, err)
	require.NotNil(t, tracker)
	require.Zero(t, tracker.TagID)
	require.Equal(t, "Renamed tag", tracker.TagName)
	require.Equal(t, "COMPLETED", tracker.Status)
	require.Equal(t, 2, tracker.CompletedCount)
	require.Zero(t, tracker.CurrentCount)
	require.Len(t, tracker.History, 1)
	all, err := store.FindAll(ctx)
	require.NoError(t, err)
	require.Len(t, all, 1)
	// Reusing a tag ID must never reconnect retained history to a different tag.
	_, err = tx.Exec("INSERT INTO tags(id,name) VALUES (1,'Different tag')")
	require.NoError(t, err)
	tracker.Title = "Historical project"
	require.NoError(t, store.Update(ctx, tracker))
	tracker, err = store.Find(ctx, 1)
	require.NoError(t, err)
	require.Zero(t, tracker.TagID)
	require.Equal(t, "Renamed tag", tracker.TagName)
	require.NoError(t, store.Delete(ctx, 1))
	var count int
	require.NoError(t, tx.Get(&count, "SELECT COUNT(*) FROM task_progress_goal_history WHERE tracker_id=1"))
	require.Zero(t, count, "explicit tracker deletion still cleans up its goal history")
}

func TestTaskProgressDeletedTagArchivesUnfinishedCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, true)
	require.NoError(t, (&Database{writeDB: db}).ensureTaskProgressSchemaCustom(context.Background()))
	_, err := db.Exec(`INSERT INTO tags(id,name) VALUES (1,'Pending');
 INSERT INTO task_progress_trackers(id,title,goal,tag_id,started_on,status,mode) VALUES (1,'Unfinished',2,1,'2026-10-07','PAUSED','BACKLOG');
 INSERT INTO task_progress_tracker_events(tracker_id,event_type,occurred_on,baseline_count,tag_id) VALUES
 (1,'BASELINE','2026-10-07',2,1),(1,'COMPLETED','2026-10-07',0,1);
 DELETE FROM tags WHERE id=1;`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback()
	tracker, err := NewTaskProgressTrackerStore().Find(context.WithValue(context.Background(), txnKey, tx), 1)
	require.NoError(t, err)
	require.Equal(t, "ARCHIVED", tracker.Status)
	require.Equal(t, "Pending", tracker.TagName)
	require.Equal(t, 1, tracker.CurrentCount, "unfinished history retains its last remaining total")
	require.Equal(t, 1, tracker.CompletedCount, "deleting a tag does not invent completions")
}

func TestTaskProgressTagRetentionRollbackCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, true)
	legacy := strings.ReplaceAll(taskProgressTrackerTableSchemaCustom, "ON DELETE SET NULL", "ON DELETE CASCADE")
	_, err := db.Exec(legacy + taskProgressEventTableSchemaCustom + taskProgressGoalHistoryTableSchemaCustom + taskProgressMilestoneSchemaCustom + `
 INSERT INTO tags(id,name) VALUES (1,'Keep');
 INSERT INTO task_progress_trackers(id,title,goal,tag_id,started_on) VALUES (1,'Keep',1,1,'2026-10-07');
 INSERT INTO task_progress_tracker_events(tracker_id,event_type,occurred_on,tag_id) VALUES (1,'BASELINE','2026-10-07',1);
 CREATE TRIGGER reject_retention_fixture BEFORE INSERT ON task_progress_tracker_events BEGIN SELECT RAISE(ABORT,'reject recovery'); END;`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	require.ErrorContains(t, ensureTaskProgressTagRetentionCustom(context.Background(), tx), "reject recovery")
	require.NoError(t, tx.Rollback())
	var count int
	require.NoError(t, db.Get(&count, "SELECT COUNT(*) FROM task_progress_tracker_events"))
	require.Equal(t, 1, count)
	var deletion string
	require.NoError(t, db.Get(&deletion, `SELECT on_delete FROM pragma_foreign_key_list('task_progress_trackers') WHERE "from"='tag_id'`))
	require.Equal(t, "CASCADE", deletion)
}
