package api

import (
	"context"
	"testing"
	"time"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestLegacyTaskProgressTrackersCustom(t *testing.T) {
	uiConfig := map[string]interface{}{
		taskProgressTrackersUIConfigKey: []interface{}{
			map[string]interface{}{
				"name":        "Legacy",
				"description": "Imported from UI config",
				"goal":        "14",
				"tagId":       "3",
				"tagName":     "Inbox",
				"isWorkingOn": true,
			},
		},
	}

	trackers, err := legacyTaskProgressTrackersCustom(uiConfig)
	require.NoError(t, err)
	require.Len(t, trackers, 1)
	require.Equal(t, "Legacy", trackers[0].Name)
	require.Equal(t, 14, legacyTaskProgressGoalCustom(trackers[0]))
	require.True(t, trackers[0].IsWorkingOn)
}

func TestTaskProgressOverallCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	expected := &models.TaskProgressOverall{TotalCount: 12, OrganizedCount: 7}
	db.TaskProgressTracker.On("Overall", mock.Anything).Return(expected, nil).Once()

	actual, err := (&queryResolver{resolver}).TaskProgressOverall(context.Background())
	require.NoError(t, err)
	require.Same(t, expected, actual)
}

func TestTaskProgressOverallGoalUpdateCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	goal := 12
	expected := &models.TaskProgressOverall{GoalPerDay: &goal}
	db.TaskProgressTracker.On("SetOverallGoalPerDay", mock.Anything, &goal).Return(nil).Once()
	db.TaskProgressTracker.On("Overall", mock.Anything).Return(expected, nil).Once()

	actual, err := resolver.Mutation().TaskProgressOverallGoalUpdate(context.Background(), &goal)
	require.NoError(t, err)
	require.Same(t, expected, actual)
	db.AssertExpectations(t)
}

func TestTaskProgressTrackerCreateCalculatesFixedGoalCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	tag := &models.Tag{ID: 3, Name: "Inbox"}
	created := &models.TaskProgressTracker{}
	dailyGoal := 4

	db.Tag.On("Find", mock.Anything, 3).Return(tag, nil).Once()
	db.TaskProgressTracker.On("CountDirectlyTaggedItems", mock.Anything, 3, models.TaskProgressItemTypes).Return(17, nil).Once()
	db.TaskProgressTracker.On("Create", mock.Anything, mock.AnythingOfType("*models.TaskProgressTracker")).
		Run(func(args mock.Arguments) {
			tracker := args.Get(1).(*models.TaskProgressTracker)
			tracker.ID = 8
			tracker.TagName = tag.Name
			*created = *tracker
		}).
		Return(nil).
		Once()
	db.TaskProgressTracker.On("CreateBaseline", mock.Anything, mock.AnythingOfType("*models.TaskProgressTracker")).Return(nil).Once()
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(created, nil).Once()

	tracker, err := resolver.Mutation().TaskProgressTrackerCreate(
		context.Background(),
		TaskProgressTrackerCreateInput{
			Title:       "  Database cleanup  ",
			Description: "  Work through the inbox  ",
			TagID:       "3",
			GoalPerDay:  &dailyGoal,
		},
	)
	require.NoError(t, err)
	require.Equal(t, 8, tracker.ID)
	require.Equal(t, "Database cleanup", tracker.Title)
	require.Equal(t, "Work through the inbox", tracker.Description)
	require.Equal(t, 17, tracker.Goal)
	require.Equal(t, 4, *tracker.GoalPerDay)
	db.AssertExpectations(t)
}

func TestTaskProgressTrackerDailyGoalCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	dailyGoal := 4
	existing := &models.TaskProgressTracker{ID: 8, GoalPerDay: &dailyGoal}
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Twice()
	db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()

	clearGoal := 0
	tracker, err := resolver.Mutation().TaskProgressTrackerUpdate(
		context.Background(),
		TaskProgressTrackerUpdateInput{ID: "8", GoalPerDay: &clearGoal},
	)
	require.NoError(t, err)
	require.Nil(t, tracker.GoalPerDay)
	db.AssertExpectations(t)
}

func TestTaskProgressStartedOnCustom(t *testing.T) {
	startedOn, err := taskProgressStartedOnCustom("20/07/2026")
	require.NoError(t, err)
	require.Equal(t, "2026-07-20", startedOn)

	_, err = taskProgressStartedOnCustom("31/02/2026")
	require.Error(t, err)
}

func TestTaskProgressTrackerUpdateResetsGoalFromTagCountCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	existing := &models.TaskProgressTracker{ID: 8, Title: "Cleanup", Goal: 17, TagID: 3, StartedOn: "2026-07-01", ItemTypes: models.TaskProgressItemTypes}
	updatedTitle := "Cleanup now"
	resetGoal := true
	updatedStartedOn := "20/07/2026"

	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Once()
	db.TaskProgressTracker.On("CountDirectlyTaggedItems", mock.Anything, 3, models.TaskProgressItemTypes).Return(9, nil).Once()
	db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()
	db.TaskProgressTracker.On("CreateBaseline", mock.Anything, existing).Return(nil).Once()
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Once()

	tracker, err := resolver.Mutation().TaskProgressTrackerUpdate(
		context.Background(),
		TaskProgressTrackerUpdateInput{
			ID:        "8",
			Title:     &updatedTitle,
			ResetGoal: &resetGoal,
			StartedOn: &updatedStartedOn,
		},
	)
	require.NoError(t, err)
	require.Equal(t, "Cleanup now", tracker.Title)
	require.Equal(t, 9, tracker.Goal)
	require.Equal(t, models.TaskProgressReportingDate(time.Now()), tracker.StartedOn)
	db.AssertExpectations(t)
}

func TestTaskProgressTrackerRejectsStaleVersionCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	existing := &models.TaskProgressTracker{ID: 8, Version: 3}
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Once()
	stale := 2
	_, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), TaskProgressTrackerUpdateInput{ID: "8", ExpectedVersion: &stale})
	require.ErrorContains(t, err, "changed in another window")
	db.TaskProgressTracker.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
	db.AssertExpectations(t)
}

func TestTaskProgressTrackerUndoPreservesBaselineCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	existing := &models.TaskProgressTracker{ID: 8, TagID: 3, Version: 3, Status: "DELETED", Mode: "FIXED", Goal: 17, StartedOn: "2026-09-07", CurrentCount: 9}
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Twice()
	db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()
	status := "ACTIVE"
	tracker, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), TaskProgressTrackerUpdateInput{ID: "8", Status: &status})
	require.NoError(t, err)
	require.Equal(t, 17, tracker.Goal)
	require.Equal(t, "2026-09-07", tracker.StartedOn)
	db.TaskProgressTracker.AssertNotCalled(t, "CreateBaseline", mock.Anything, mock.Anything)
	db.AssertExpectations(t)
}

func TestTaskProgressTrackerCompletedSettingsLockedCustom(t *testing.T) {
	goal := 5
	tracker := &models.TaskProgressTracker{ID: 8, TagID: 3, GoalPerDay: &goal, Status: "COMPLETED", Mode: "FIXED", ItemTypes: []string{"scene"}}
	reset := true
	tag := "4"
	mode := "BACKLOG"
	otherGoal := 6
	for name, input := range map[string]TaskProgressTrackerUpdateInput{
		"baseline": {ID: "8", ResetGoal: &reset},
		"tag":      {ID: "8", TagID: &tag},
		"mode":     {ID: "8", Mode: &mode},
		"goal":     {ID: "8", GoalPerDay: &otherGoal},
		"types":    {ID: "8", ItemTypes: []string{"image"}},
	} {
		t.Run(name, func(t *testing.T) {
			db := mocks.NewDatabase()
			resolver := newResolver(db)
			db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(tracker, nil).Once()
			_, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), input)
			require.ErrorContains(t, err, "completed tracker settings are read-only")
			db.TaskProgressTracker.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
			db.AssertExpectations(t)
		})
	}
	title := "Renamed"
	originalTag := "3"
	require.NoError(t, validateCompletedTaskProgressUpdateCustom(tracker, TaskProgressTrackerUpdateInput{Title: &title, TagID: &originalTag, Mode: &tracker.Mode, GoalPerDay: &goal, ItemTypes: []string{"scene"}}))
}

func TestTaskProgressTrackerStatusDrivesWorkingCustom(t *testing.T) {
	for _, status := range []string{"ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"} {
		t.Run(status, func(t *testing.T) {
			db := mocks.NewDatabase()
			resolver := newResolver(db)
			existing := &models.TaskProgressTracker{ID: 8, TagID: 3, Status: "ACTIVE", CurrentCount: 1, IsWorkingOn: true}
			if status == "COMPLETED" {
				existing.CurrentCount = 0
			}
			db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Twice()
			db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()
			tracker, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), TaskProgressTrackerUpdateInput{ID: "8", Status: &status})
			require.NoError(t, err)
			require.Equal(t, status == "ACTIVE", tracker.IsWorkingOn)
			db.AssertExpectations(t)
		})
	}
}

func TestTaskProgressTrackerUndoCompletedWithIncomingReactivatesCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	existing := &models.TaskProgressTracker{ID: 8, Status: "DELETED", CurrentCount: 1, Goal: 5, StartedOn: "2026-09-07"}
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Twice()
	db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()
	status := "COMPLETED"
	tracker, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), TaskProgressTrackerUpdateInput{ID: "8", Status: &status})
	require.NoError(t, err)
	require.Equal(t, "ACTIVE", tracker.Status)
	require.Equal(t, "2026-09-07", tracker.StartedOn)
	db.TaskProgressTracker.AssertNotCalled(t, "CreateBaseline", mock.Anything, mock.Anything)
	db.AssertExpectations(t)
}

func TestTaskProgressCompletedTrackerMetadataCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	existing := &models.TaskProgressTracker{ID: 8, Status: "COMPLETED", Title: "Finished", CurrentCount: 0, Version: 2}
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Twice()
	db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()
	title, description := "Finished cleanup", "All items completed"
	tracker, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), TaskProgressTrackerUpdateInput{ID: "8", Title: &title, Description: &description})
	require.NoError(t, err)
	require.Equal(t, title, tracker.Title)
	require.Equal(t, description, tracker.Description)
	require.Equal(t, "COMPLETED", tracker.Status)
	db.AssertExpectations(t)
}

func TestTaskProgressDetachedTrackerMetadataCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	existing := &models.TaskProgressTracker{ID: 8, TagID: 0, TagName: "Deleted project", Status: "COMPLETED", Mode: "BACKLOG", ItemTypes: []string{"scene"}}
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Twice()
	db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()
	tag, title := "0", "Kept history"
	tracker, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), TaskProgressTrackerUpdateInput{ID: "8", TagID: &tag, Title: &title})
	require.NoError(t, err)
	require.Equal(t, title, tracker.Title)
	db.Tag.AssertNotCalled(t, "Find", mock.Anything, mock.Anything)
	db.AssertExpectations(t)
}

func TestTaskProgressDetachedTrackerNeedsReplacementTagCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	existing := &models.TaskProgressTracker{ID: 8, TagID: 0, Status: "ARCHIVED", CurrentCount: 5}
	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Once()
	status := "ACTIVE"
	_, err := resolver.Mutation().TaskProgressTrackerUpdate(context.Background(), TaskProgressTrackerUpdateInput{ID: "8", Status: &status})
	require.ErrorContains(t, err, "choose a replacement tag")
	db.TaskProgressTracker.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
	db.AssertExpectations(t)
}
