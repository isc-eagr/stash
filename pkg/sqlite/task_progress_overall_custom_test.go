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

	_, err = dbWrapper.Exec(ctx, "INSERT INTO scenes(id,title,organized) VALUES (3,'New',0)")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneCreatedCustom, 3, false, false))

	_, err = dbWrapper.Exec(ctx, "UPDATE scenes SET organized=1 WHERE id=3")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneUpdatedCustom, 3, false, true))

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
	require.Equal(t, 1, overall.CompletedCount)
	require.Equal(t, 2, overall.IncomingCount, "scene creation and reopening are incoming work")
	require.Equal(t, 1, overall.History[len(overall.History)-1].Remaining, "deletion recalculates remaining without completing work")

	_, err = dbWrapper.Exec(ctx, "DELETE FROM scenes WHERE id=2")
	require.NoError(t, err)
	require.NoError(t, recordTaskProgressOverallSceneChangeCustom(ctx, taskProgressOverallSceneDestroyedCustom, 2, true, false))
	overall, err = store.Overall(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, overall.TotalCount)
	require.Zero(t, overall.OrganizedCount)
	require.Equal(t, 1, overall.History[len(overall.History)-1].Remaining)
	require.Equal(t, 1, overall.CompletedCount, "deleting an organized scene is not completed work")

	var deletedCompletions int
	require.NoError(t, dbWrapper.Get(ctx, &deletedCompletions, `
SELECT COUNT(*) FROM task_progress_overall_events
 WHERE event_type='COMPLETED' AND scene_id IN (2,3)`))
	require.Equal(t, 1, deletedCompletions, "only the explicit organize transition is completed")
	require.Equal(t, time.Now().In(taskProgressTimezoneCustom).Format("2006-01-02"), overall.History[len(overall.History)-1].Date)
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
