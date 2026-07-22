package api

import (
	"context"
	"testing"

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

func TestTaskProgressTrackerCreateCalculatesFixedGoalCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	tag := &models.Tag{ID: 3, Name: "Inbox"}

	db.Tag.On("Find", mock.Anything, 3).Return(tag, nil).Once()
	db.TaskProgressTracker.On("CountDirectlyTaggedItems", mock.Anything, 3).Return(17, nil).Once()
	db.TaskProgressTracker.On("Create", mock.Anything, mock.AnythingOfType("*models.TaskProgressTracker")).
		Run(func(args mock.Arguments) {
			tracker := args.Get(1).(*models.TaskProgressTracker)
			tracker.ID = 8
			tracker.TagName = tag.Name
		}).
		Return(nil).
		Once()

	tracker, err := resolver.Mutation().TaskProgressTrackerCreate(
		context.Background(),
		TaskProgressTrackerCreateInput{
			Title:       "  Database cleanup  ",
			Description: "  Work through the inbox  ",
			TagID:       "3",
		},
	)
	require.NoError(t, err)
	require.Equal(t, 8, tracker.ID)
	require.Equal(t, "Database cleanup", tracker.Title)
	require.Equal(t, "Work through the inbox", tracker.Description)
	require.Equal(t, 17, tracker.Goal)
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
	existing := &models.TaskProgressTracker{ID: 8, Title: "Cleanup", Goal: 17, TagID: 3, StartedOn: "2026-07-01"}
	updatedTitle := "Cleanup now"
	resetGoal := true
	updatedStartedOn := "20/07/2026"

	db.TaskProgressTracker.On("Find", mock.Anything, 8).Return(existing, nil).Once()
	db.TaskProgressTracker.On("CountDirectlyTaggedItems", mock.Anything, 3).Return(9, nil).Once()
	db.TaskProgressTracker.On("Update", mock.Anything, existing).Return(nil).Once()
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
	require.Equal(t, "2026-07-20", tracker.StartedOn)
	db.AssertExpectations(t)
}
