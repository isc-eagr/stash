package sqlite

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTaskProgressOverallSceneHistoryCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO scenes(id,title,organized) VALUES (1,'Pending',0),(2,'Ready',1);
INSERT INTO task_progress_overall_events(
  event_type,occurred_on,occurred_at,total_count,organized_count,remaining_count
) VALUES ('BASELINE','2026-09-07','2026-09-07 00:00:00',2,1,1);`)
	require.NoError(t, err)

	store := NewTaskProgressTrackerStore()
	overall, err := store.Overall(ctx)
	require.NoError(t, err)
	require.Equal(t, 2, overall.TotalCount)
	require.Equal(t, 1, overall.OrganizedCount)
	require.Len(t, overall.History, 1)
	require.Equal(t, 1, overall.History[0].Remaining)
	require.Equal(t, 1, *overall.History[0].BaselineCount)
	require.Equal(t, 1, *overall.History[0].CompletedTotal, "scenes organized before tracking count toward the total")

	_, err = dbWrapper.Exec(ctx, "INSERT INTO scenes(id,title,organized) VALUES (3,'New',0)")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneCreatedCustom, 3, false, false))

	_, err = dbWrapper.Exec(ctx, "UPDATE scenes SET organized=1 WHERE id=3")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneUpdatedCustom, 3, false, true))
	_, err = dbWrapper.Exec(ctx, `
UPDATE task_progress_overall_events
   SET occurred_at = ?
 WHERE scene_id = 3 AND event_type = 'COMPLETED'`,
		time.Now().UTC().Add(-taskProgressOverallQuickUndoWindowCustom-time.Second))
	require.NoError(t, err)

	_, err = dbWrapper.Exec(ctx, "UPDATE scenes SET organized=0 WHERE id=3")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneUpdatedCustom, 3, true, false))

	_, err = dbWrapper.Exec(ctx, "DELETE FROM scenes WHERE id=3")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneDestroyedCustom, 3, false, false))

	overall, err = store.Overall(ctx)
	require.NoError(t, err)
	require.Equal(t, 2, overall.TotalCount)
	require.Equal(t, 1, overall.OrganizedCount)
	require.Equal(t, 2, overall.CompletedCount)
	require.Equal(t, 2, overall.IncomingCount, "scene creation and reopening are incoming work")
	require.Equal(t, 1, overall.History[len(overall.History)-1].Remaining, "deletion completes pending work")
	require.Equal(t, 2, overall.History[len(overall.History)-1].Completed)
	require.Zero(t, overall.History[len(overall.History)-1].Removed, "deletion earns completion rather than a scope adjustment")
	require.Equal(t, overall.OrganizedCount, *overall.History[len(overall.History)-1].CompletedTotal, "the day's total matches the organized card")

	_, err = dbWrapper.Exec(ctx, "DELETE FROM scenes WHERE id=2")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneDestroyedCustom, 2, true, false))
	overall, err = store.Overall(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, overall.TotalCount)
	require.Zero(t, overall.OrganizedCount)
	require.Equal(t, 1, overall.History[len(overall.History)-1].Remaining)
	require.Equal(t, 2, overall.CompletedCount, "deleting an organized scene earns no duplicate completion")
	require.Zero(t, *overall.History[len(overall.History)-1].CompletedTotal)
	require.Zero(t, overall.History[len(overall.History)-1].Removed)

	var deletedCompletions int
	require.NoError(t, dbWrapper.Get(ctx, &deletedCompletions, `
SELECT COUNT(*) FROM task_progress_overall_events
 WHERE event_type='COMPLETED' AND scene_id IN (2,3)`))
	require.Equal(t, 1, deletedCompletions, "only the explicit organize transition is completed")
	require.Equal(t, time.Now().In(taskProgressTimezoneCustom).Format("2006-01-02"), overall.History[len(overall.History)-1].Date)
}

func TestTaskProgressOverallQuickOrganizedUndoDoesNotCountActivityCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, "INSERT INTO scenes(id,title,organized) VALUES (1,'Mistake',0)")
	require.NoError(t, err)

	_, err = dbWrapper.Exec(ctx, "UPDATE scenes SET organized=1 WHERE id=1")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneUpdatedCustom, 1, false, true))

	_, err = dbWrapper.Exec(ctx, "UPDATE scenes SET organized=0 WHERE id=1")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneUpdatedCustom, 1, true, false))

	store := NewTaskProgressTrackerStore()
	overall, err := store.Overall(ctx)
	require.NoError(t, err)
	require.Zero(t, overall.CompletedCount)
	require.Zero(t, overall.IncomingCount)
	require.Empty(t, overall.History)

	var eventCount int
	require.NoError(t, dbWrapper.Get(ctx, &eventCount, "SELECT COUNT(*) FROM task_progress_overall_events WHERE scene_id = 1"))
	require.Zero(t, eventCount)
}

func TestTaskProgressOverallNoOpOrganizedUpdateCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, "INSERT INTO scenes(id,title,organized) VALUES (1,'Same',0)")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneUpdatedCustom, 1, false, false))

	var count int
	require.NoError(t, dbWrapper.Get(ctx, &count, "SELECT COUNT(*) FROM task_progress_overall_events"))
	require.Zero(t, count)
}

func TestTaskProgressOverallGoalPersistsCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_overall_events(
  event_type,occurred_on,occurred_at,total_count,organized_count,remaining_count
) VALUES ('BASELINE','2026-09-07','2026-09-07 00:00:00',0,0,0);`)
	require.NoError(t, err)

	store := NewTaskProgressTrackerStore()
	goal := 9
	require.NoError(t, store.SetOverallGoalPerDay(ctx, &goal))
	overall, err := store.Overall(ctx)
	require.NoError(t, err)
	require.Equal(t, 9, *overall.GoalPerDay)
	require.Equal(t, 9, *overall.History[len(overall.History)-1].GoalPerDay)

	require.NoError(t, store.SetOverallGoalPerDay(ctx, nil))
	overall, err = store.Overall(ctx)
	require.NoError(t, err)
	require.Nil(t, overall.GoalPerDay)
	require.Nil(t, overall.History[len(overall.History)-1].GoalPerDay)
}

func TestTaskProgressOverallHistoricalDeletionsCompletePendingWorkCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_overall_events(
 event_type,scene_id,occurred_on,occurred_at,total_count,organized_count,remaining_count
) VALUES
 ('BASELINE',0,'2026-09-07','2026-09-07 06:00:00',5,1,4),
 ('ADJUSTMENT',1,'2026-09-08','2026-09-08 06:00:00',4,1,3),
 ('INCOMING',6,'2026-09-08','2026-09-08 07:00:00',5,1,4),
 ('COMPLETED',2,'2026-09-08','2026-09-08 08:00:00',5,2,3),
 ('ADJUSTMENT',2,'2026-09-08','2026-09-08 09:00:00',4,1,3),
 ('ADJUSTMENT',3,'2026-10-01','2026-10-01 06:00:00',3,1,2),
 ('BASELINE',0,'2026-10-02','2026-10-02 06:00:00',3,1,2),
 ('ADJUSTMENT',4,'2026-10-03','2026-10-03 06:00:00',2,1,1);
INSERT INTO task_progress_goal_history(tracker_id,effective_on,goal_per_day) VALUES
 (0,'2026-09-07',2), (0,'2026-09-09',3);`)
	require.NoError(t, err)

	store := NewTaskProgressTrackerStore()
	overall, err := store.Overall(ctx)
	require.NoError(t, err)
	require.Equal(t, 4, overall.CompletedCount)
	require.Equal(t, 1, overall.IncomingCount)
	require.Len(t, overall.History, 6)
	for i, expected := range []struct {
		date      string
		completed int
		remaining int
		goal      int
	}{
		{"2026-09-07", 0, 4, 2},
		{"2026-09-08", 2, 3, 2},
		{"2026-09-09", 0, 3, 3},
		{"2026-10-01", 1, 2, 3},
		{"2026-10-02", 0, 2, 3},
		{"2026-10-03", 1, 1, 3},
	} {
		day := overall.History[i]
		require.Equal(t, expected.date, day.Date)
		require.Equal(t, expected.completed, day.Completed, "credit each deletion on its original date, even amid incoming and organized work")
		require.Equal(t, expected.remaining, day.Remaining)
		require.Equal(t, expected.goal, *day.GoalPerDay)
		require.Zero(t, day.Removed, "completed deletions must not also count as removed scope")
	}
	reloaded, err := store.Overall(ctx)
	require.NoError(t, err)
	require.Equal(t, overall, reloaded, "reading historical deletions never adds duplicate credits")
}
