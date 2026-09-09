package sqlite

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestTaskProgressMetricsBaselineAndDailyHistoryCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_trackers(id,tag_id,status,item_types,mode) VALUES (1,10,'ACTIVE','scene','BACKLOG');
INSERT INTO scenes_tags(scene_id,tag_id) VALUES (1,10),(2,10);
INSERT INTO task_progress_tracker_events(tracker_id,event_type,occurred_on,occurred_at,baseline_count,tag_id) VALUES
 (1,'BASELINE','2026-09-07','2026-09-07 06:00:00',5,10),
 (1,'COMPLETED','2026-09-07','2026-09-07 07:00:00',0,10),
 (1,'INCOMING','2026-09-08','2026-09-08 07:00:00',0,10),
 (1,'COMPLETED','2026-09-09','2026-09-09 07:00:00',0,10),
 (1,'BASELINE','2026-09-09','2026-09-09 08:00:00',3,10),
 (1,'COMPLETED','2026-09-09','2026-09-09 09:00:00',0,10);`)
	require.NoError(t, err)
	tracker := &models.TaskProgressTracker{ID: 1, TagID: 10, Mode: "BACKLOG", ItemTypes: []string{"scene"}}
	require.NoError(t, loadTaskProgressMetricsCustom(ctx, []*models.TaskProgressTracker{tracker}))
	require.Equal(t, 2, tracker.CurrentCount)
	require.Equal(t, 3, tracker.CompletedCount)
	require.Equal(t, 1, tracker.IncomingCount)
	require.Len(t, tracker.History, 3)
	require.Equal(t, 4, tracker.History[0].Remaining)
	require.Nil(t, tracker.History[1].BaselineCount)
	require.Equal(t, 5, tracker.History[1].Remaining)
	require.Equal(t, 3, *tracker.History[2].BaselineCount)
	require.Equal(t, 2, tracker.History[2].Remaining, "only events after the latest baseline affect remaining")
}

func TestTaskProgressFixedBaselineAndDeletedHistoryCustom(t *testing.T) {
	_, ctx := newTaskProgressTrackingTestDBCustom(t)
	_, err := dbWrapper.Exec(ctx, `
INSERT INTO task_progress_trackers(id,tag_id,status,item_types,mode) VALUES (1,10,'DELETED','scene','FIXED');
INSERT INTO scenes(id,title) VALUES (1,'Original'),(2,'New');
INSERT INTO scenes_tags(scene_id,tag_id) VALUES (1,10);`)
	require.NoError(t, err)
	tracker := &models.TaskProgressTracker{ID: 1, TagID: 10, Mode: "FIXED", Goal: 1, ItemTypes: []string{"scene"}, HistoryStartedOn: "2026-09-07"}
	store := NewTaskProgressTrackerStore()
	require.NoError(t, store.CreateBaseline(ctx, tracker))
	_, err = dbWrapper.Exec(ctx, "INSERT INTO scenes_tags(scene_id,tag_id) VALUES (2,10)")
	require.NoError(t, err)
	tagged := taskProgressTagSetCustom{10: {}}
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 2, nil, tagged))
	require.Equal(t, 1, taskProgressEventCountCustom(t, ctx), "new work stays outside the original cohort")
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, tagged, nil))
	require.NoError(t, loadTaskProgressMetricsCustom(ctx, []*models.TaskProgressTracker{tracker}))
	require.Zero(t, tracker.CurrentCount)
	require.Equal(t, 1, tracker.CompletedCount, "soft deletion preserves activity for undo")
	require.Equal(t, "2026-09-07", tracker.History[0].Date)
	require.NoError(t, recordTaskProgressTagDiffCustom(ctx, "scene", 1, nil, tagged))
	require.NoError(t, loadTaskProgressMetricsCustom(ctx, []*models.TaskProgressTracker{tracker}))
	require.Equal(t, 1, tracker.CurrentCount)
	require.Equal(t, 1, tracker.IncomingCount)
}
