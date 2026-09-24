package sqlite

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestTaskProgressMilestoneAggregateCustom(t *testing.T) {
	goal := 5
	m := &models.TaskProgressMilestone{
		Trackers: []*models.TaskProgressTracker{
			{
				ID: 1, Mode: "FIXED", Goal: 100, CurrentCount: 60,
				ItemCounts: []*models.TaskProgressItemCount{{ItemType: "scene", Count: 60}},
				History: []*models.TaskProgressDay{
					{Date: "2026-09-20", Remaining: 100, BaselineCount: intPointerMilestoneCustom(100)},
					{Date: "2026-09-21", Remaining: 60, Completed: 40},
				},
			},
			{
				ID: 2, Mode: "BACKLOG", CurrentCount: 3, CompletedCount: 7, IncomingCount: 2,
				ItemCounts: []*models.TaskProgressItemCount{{ItemType: "scene", Count: 3}},
				History: []*models.TaskProgressDay{
					{Date: "2026-09-22", Remaining: 5, BaselineCount: intPointerMilestoneCustom(5)},
					{Date: "2026-09-23", Remaining: 3, Completed: 4, Incoming: 2},
				},
			},
		},
		ItemCounts: []*models.TaskProgressItemCount{},
		History:    []*models.TaskProgressDay{},
	}
	aggregateTaskProgressMilestoneCustom(m, map[string]*int{"2026-09-23": &goal}, "2026-09-23")
	require.Equal(t, 47, m.CompletedCount)
	require.Equal(t, 63, m.CurrentCount)
	require.Equal(t, 110, m.TotalCount)
	require.Equal(t, 2, m.IncomingCount)
	require.Equal(t, 63, m.ItemCounts[0].Count, "overlapping scenes count in each tracker")
	require.Len(t, m.History, 4)
	require.Equal(t, 100, m.History[0].Remaining)
	require.Equal(t, 60, m.History[1].Remaining)
	require.Equal(t, 65, m.History[2].Remaining)
	require.Equal(t, 63, m.History[3].Remaining)
	require.Nil(t, m.History[2].GoalPerDay, "new milestone goals do not backdate")
	require.Equal(t, 5, *m.History[3].GoalPerDay)
}

func TestTaskProgressMilestoneStoreCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, true)
	require.NoError(t, (&Database{writeDB: db}).ensureTaskProgressSchemaCustom(context.Background()))
	_, err := db.Exec(`INSERT INTO tags(id,name) VALUES (1,'Work')`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := NewTaskProgressTrackerStore()
	tracker := &models.TaskProgressTracker{Title: "Tracker", TagID: 1, Goal: 0}
	require.NoError(t, store.Create(ctx, tracker))
	require.NoError(t, store.CreateBaseline(ctx, tracker))
	goal := 3
	target := "2026-10-31"
	first := &models.TaskProgressMilestone{Name: "First", TrackerIDs: []int{tracker.ID}, GoalPerDay: &goal, TargetDate: &target}
	require.NoError(t, store.CreateMilestone(ctx, first))
	second := &models.TaskProgressMilestone{Name: "Second", TrackerIDs: []int{tracker.ID}}
	require.NoError(t, store.CreateMilestone(ctx, second))
	loaded, err := store.FindMilestones(ctx)
	require.NoError(t, err)
	require.Len(t, loaded, 2)
	require.Equal(t, []int{tracker.ID}, loaded[0].TrackerIDs)
	require.Equal(t, []int{tracker.ID}, loaded[1].TrackerIDs, "tracker can join multiple milestones")
	require.Equal(t, target, *loaded[0].TargetDate)
	require.Equal(t, goal, *loaded[0].GoalPerDay)
	tracker.Status = models.TaskProgressTrackerStatusDeleted
	require.NoError(t, store.Update(ctx, tracker))
	hidden, err := store.FindMilestone(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, []int{tracker.ID}, hidden.TrackerIDs)
	require.Empty(t, hidden.Trackers, "soft-deleted trackers do not contribute")
	tracker.Status = models.TaskProgressTrackerStatusActive
	require.NoError(t, store.Update(ctx, tracker))
	restored, err := store.FindMilestone(ctx, first.ID)
	require.NoError(t, err)
	require.Len(t, restored.Trackers, 1, "undo restores the existing membership")

	first.Name = "Renamed"
	first.GoalPerDay = nil
	require.NoError(t, store.UpdateMilestone(ctx, first, false))
	updated, err := store.FindMilestone(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, 2, updated.Version)
	require.Nil(t, updated.GoalPerDay)
	require.Equal(t, []int{tracker.ID}, updated.TrackerIDs)
	var goalHistoryRows int
	require.NoError(t, dbWrapper.Get(ctx, &goalHistoryRows, `SELECT COUNT(*) FROM task_progress_milestone_goal_history WHERE milestone_id=?`, first.ID))
	require.Equal(t, 1, goalHistoryRows, "same-day goal change updates the effective record")

	require.NoError(t, store.DeleteMilestone(ctx, first.ID))
	deleted, err := store.FindMilestone(ctx, first.ID)
	require.NoError(t, err)
	require.Nil(t, deleted)
	remaining, err := store.FindMilestone(ctx, second.ID)
	require.NoError(t, err)
	require.NotNil(t, remaining)
	require.NoError(t, tx.Commit())
	reopenedTx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	reopenedCtx := context.WithValue(context.Background(), txnKey, reopenedTx)
	reopened, err := store.FindMilestone(reopenedCtx, second.ID)
	require.NoError(t, err)
	require.Equal(t, second.Name, reopened.Name, "milestone persists after commit")
	require.NoError(t, store.Delete(reopenedCtx, tracker.ID))
	withoutTracker, err := store.FindMilestone(reopenedCtx, second.ID)
	require.NoError(t, err)
	require.Empty(t, withoutTracker.TrackerIDs, "physical tracker deletion cleans up membership")
	require.NoError(t, reopenedTx.Rollback())
}

func intPointerMilestoneCustom(value int) *int { return &value }
