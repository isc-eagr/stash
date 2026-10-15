package sqlite

import (
	"context"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestTaskProgressMilestoneAggregateCustom(t *testing.T) {
	goal := 5
	m := &models.TaskProgressMilestone{
		Trackers: []*models.TaskProgressTracker{
			{
				ID: 1, Mode: "FIXED", Goal: 100, CurrentCount: 60,
				ItemCounts:          []*models.TaskProgressItemCount{{ItemType: "scene", Count: 60}},
				CompletedItemCounts: []*models.TaskProgressItemCount{{ItemType: "scene", Count: 40}},
				History: []*models.TaskProgressDay{
					{Date: "2026-09-20", Remaining: 100, BaselineCount: intPointerMilestoneCustom(100)},
					{Date: "2026-09-21", Remaining: 60, Completed: 40},
				},
			},
			{
				ID: 2, Mode: "BACKLOG", CurrentCount: 3, CompletedCount: 7, IncomingCount: 2,
				ItemCounts:          []*models.TaskProgressItemCount{{ItemType: "scene", Count: 3}},
				CompletedItemCounts: []*models.TaskProgressItemCount{{ItemType: "scene", Count: 5}, {ItemType: "image", Count: 2}},
				History: []*models.TaskProgressDay{
					{Date: "2026-09-22", Remaining: 5, BaselineCount: intPointerMilestoneCustom(5)},
					{Date: "2026-09-23", Remaining: 3, Completed: 4, Incoming: 2},
				},
			},
		},
		ItemCounts: []*models.TaskProgressItemCount{},
		History:    []*models.TaskProgressDay{},
	}
	aggregateTaskProgressMilestoneCustom(m, nil, map[string]*int{"2026-09-23": &goal}, "2026-09-23")
	require.Equal(t, 47, m.CompletedCount)
	require.Equal(t, 63, m.CurrentCount)
	require.Equal(t, 110, m.TotalCount)
	require.Equal(t, 2, m.IncomingCount)
	require.Equal(t, 63, m.ItemCounts[0].Count, "overlapping scenes count in each tracker")
	require.Equal(t, []*models.TaskProgressItemCount{
		{ItemType: "scene", Count: 45},
		{ItemType: "image", Count: 2},
	}, m.CompletedItemCounts, "completed types are summed and empty types omitted")
	require.Len(t, m.History, 4)
	require.Equal(t, 100, m.History[0].Remaining)
	require.Equal(t, 60, m.History[1].Remaining)
	require.Equal(t, 65, m.History[2].Remaining)
	require.Equal(t, 63, m.History[3].Remaining)
	require.Nil(t, m.History[2].GoalPerDay, "new milestone goals do not backdate")
	require.Equal(t, 5, *m.History[3].GoalPerDay)
}

func TestTaskProgressMilestoneMembershipSpansCustom(t *testing.T) {
	stays := &models.TaskProgressTracker{
		ID: 1, Mode: "BACKLOG", CurrentCount: 8, CompletedCount: 2,
		ItemCounts:          []*models.TaskProgressItemCount{{ItemType: "scene", Count: 8}},
		CompletedItemCounts: []*models.TaskProgressItemCount{{ItemType: "scene", Count: 2}},
		History: []*models.TaskProgressDay{
			{Date: "2026-10-01", Remaining: 10, BaselineCount: intPointerMilestoneCustom(10)},
			{Date: "2026-10-03", Remaining: 8, Completed: 2},
		},
	}
	leaves := &models.TaskProgressTracker{
		ID: 2, Mode: "BACKLOG", CurrentCount: 15, CompletedCount: 5,
		History: []*models.TaskProgressDay{
			{Date: "2026-10-01", Remaining: 20, BaselineCount: intPointerMilestoneCustom(20)},
			{Date: "2026-10-02", Remaining: 17, Completed: 3},
			{Date: "2026-10-03", Remaining: 16, Completed: 1},
			{Date: "2026-10-04", Remaining: 15, Completed: 1},
		},
	}
	joins := &models.TaskProgressTracker{
		ID: 3, Mode: "BACKLOG", CurrentCount: 4, CompletedCount: 2,
		ItemCounts: []*models.TaskProgressItemCount{{ItemType: "image", Count: 4}},
		History: []*models.TaskProgressDay{
			{Date: "2026-09-30", Remaining: 6, BaselineCount: intPointerMilestoneCustom(6)},
			{Date: "2026-10-01", Remaining: 5, Completed: 1},
			{Date: "2026-10-03", Remaining: 4, Completed: 1},
		},
	}
	m := &models.TaskProgressMilestone{Trackers: []*models.TaskProgressTracker{stays, joins}}
	spans := []*taskProgressMilestoneSpanCustom{
		{Tracker: stays},
		{Tracker: leaves, RemovedOn: "2026-10-03", CompletedItemCounts: map[string]int{"scene": 4}},
		{Tracker: joins, AddedOn: "2026-10-03", CompletedItemCounts: map[string]int{"image": 1}},
	}
	aggregateTaskProgressMilestoneCustom(m, spans, nil, "2026-10-04")

	require.Equal(t, 7, m.CompletedCount, "completions while a member stay; none before joining")
	require.Equal(t, 12, m.CurrentCount, "only current members have remaining work")
	require.Equal(t, 19, m.TotalCount)
	require.Equal(t, []*models.TaskProgressItemCount{
		{ItemType: "scene", Count: 6},
		{ItemType: "image", Count: 1},
	}, m.CompletedItemCounts)
	require.Len(t, m.History, 4, "history starts at the first member day")
	require.Equal(t, "2026-10-01", m.History[0].Date)
	require.Equal(t, 30, m.History[0].Remaining)
	require.Equal(t, 27, m.History[1].Remaining)

	removal := m.History[2]
	require.Equal(t, 16, removal.Removed, "a departing tracker's remaining work is removed")
	require.Equal(t, 5, removal.Added, "a joining tracker brings its carried remaining work")
	require.Equal(t, 4, removal.Completed, "same-day completions count for both")
	require.Equal(t, 12, removal.Remaining)
	require.Nil(t, removal.BaselineCount, "joining is not a baseline reset")

	after := m.History[3]
	require.Zero(t, after.Completed, "completions after leaving do not count")
	require.Zero(t, after.Removed)
	require.Equal(t, 12, after.Remaining)
}

func TestTaskProgressMilestoneJoinBeforeHistoryCustom(t *testing.T) {
	tracker := &models.TaskProgressTracker{
		ID: 1, Mode: "BACKLOG", CurrentCount: 61,
		History: []*models.TaskProgressDay{
			{Date: "2026-10-12", Remaining: 61, BaselineCount: intPointerMilestoneCustom(61)},
		},
	}
	m := &models.TaskProgressMilestone{Trackers: []*models.TaskProgressTracker{tracker}}
	aggregateTaskProgressMilestoneCustom(m, []*taskProgressMilestoneSpanCustom{{Tracker: tracker, AddedOn: "2026-10-12"}}, nil, "2026-10-12")
	require.Len(t, m.History, 1)
	require.Equal(t, 61, m.History[0].Added, "a new tracker's baseline joins as added work")
	require.Equal(t, 61, m.History[0].Remaining)
	require.Nil(t, m.History[0].BaselineCount)
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

func TestTaskProgressMilestoneMembershipLogCustom(t *testing.T) {
	db := newTaskProgressBootstrapDBCustom(t)
	createTaskProgressSourceTablesCustom(t, db, true)
	require.NoError(t, (&Database{writeDB: db}).ensureTaskProgressSchemaCustom(context.Background()))
	_, err := db.Exec(`INSERT INTO tags(id,name) VALUES (1,'One'),(2,'Two')`)
	require.NoError(t, err)
	tx, err := db.BeginTxx(context.Background(), nil)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()
	ctx := context.WithValue(context.Background(), txnKey, tx)
	store := NewTaskProgressTrackerStore()
	one := &models.TaskProgressTracker{Title: "One", TagID: 1}
	two := &models.TaskProgressTracker{Title: "Two", TagID: 2}
	require.NoError(t, store.Create(ctx, one))
	require.NoError(t, store.Create(ctx, two))
	m := &models.TaskProgressMilestone{Name: "Scope", TrackerIDs: []int{one.ID}}
	require.NoError(t, store.CreateMilestone(ctx, m))

	type span struct {
		TrackerID int     `db:"tracker_id"`
		AddedOn   *string `db:"added_on"`
		RemovedOn *string `db:"removed_on"`
	}
	spans := func() []span {
		rows := []span{}
		require.NoError(t, dbWrapper.Select(ctx, &rows, `SELECT tracker_id,added_on,removed_on
FROM task_progress_milestone_member_history WHERE milestone_id=? ORDER BY id`, m.ID))
		return rows
	}
	today := models.TaskProgressReportingDate(time.Now())
	require.Equal(t, []span{{TrackerID: one.ID}}, spans(), "creation counts full history")

	m.TrackerIDs = []int{two.ID}
	require.NoError(t, store.UpdateMilestone(ctx, m, true))
	require.Equal(t, []span{{TrackerID: one.ID, RemovedOn: &today}, {TrackerID: two.ID, AddedOn: &today}}, spans())

	m.TrackerIDs = []int{one.ID, two.ID}
	require.NoError(t, store.UpdateMilestone(ctx, m, true))
	require.Equal(t, []span{{TrackerID: one.ID}, {TrackerID: two.ID, AddedOn: &today}}, spans(), "same-day re-add restores the span")

	m.TrackerIDs = []int{one.ID}
	require.NoError(t, store.UpdateMilestone(ctx, m, true))
	require.Equal(t, []span{{TrackerID: one.ID}}, spans(), "same-day join and leave leaves no trace")

	require.NoError(t, store.Delete(ctx, one.ID))
	require.Empty(t, spans(), "physical tracker deletion removes its spans")
}

func intPointerMilestoneCustom(value int) *int { return &value }
