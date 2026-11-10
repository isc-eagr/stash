package api

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestTaskProgressMilestoneMembersCustom(t *testing.T) {
	db := mocks.NewDatabase()
	ctx := context.Background()
	_, err := taskProgressMilestoneMembersCustom(ctx, db.TaskProgressTracker, []string{"0"}, nil)
	require.Error(t, err, "Overall cannot be a member")
	db.TaskProgressTracker.On("Find", mock.Anything, 3).Return(&models.TaskProgressTracker{ID: 3, Status: models.TaskProgressTrackerStatusActive}, nil).Once()
	_, err = taskProgressMilestoneMembersCustom(ctx, db.TaskProgressTracker, []string{"3", "3"}, nil)
	require.Error(t, err, "duplicate membership is rejected")
	deleted := &models.TaskProgressTracker{ID: 4, Status: models.TaskProgressTrackerStatusDeleted}
	db.TaskProgressTracker.On("Find", mock.Anything, 4).Return(deleted, nil).Twice()
	_, err = taskProgressMilestoneMembersCustom(ctx, db.TaskProgressTracker, []string{"4"}, nil)
	require.Error(t, err, "new membership cannot target a deleted tracker")
	ids, err := taskProgressMilestoneMembersCustom(ctx, db.TaskProgressTracker, []string{"4"}, []int{4})
	require.NoError(t, err)
	require.Equal(t, []int{4}, ids, "existing hidden membership survives edits")
	db.AssertExpectations(t)
}

func TestTaskProgressMilestoneCreateNameOnlyCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	created := &models.TaskProgressMilestone{ID: 9, Name: "Cleanup"}
	db.TaskProgressTracker.On("CreateMilestone", mock.Anything, mock.AnythingOfType("*models.TaskProgressMilestone")).
		Run(func(args mock.Arguments) {
			m := args.Get(1).(*models.TaskProgressMilestone)
			require.Equal(t, "Cleanup", m.Name)
			require.Empty(t, m.TrackerIDs)
			require.Nil(t, m.TargetDate)
			require.Nil(t, m.GoalPerDay)
			m.ID = 9
		}).Return(nil).Once()
	db.TaskProgressTracker.On("FindMilestone", mock.Anything, 9).Return(created, nil).Once()
	result, err := resolver.Mutation().TaskProgressMilestoneCreate(context.Background(), TaskProgressMilestoneCreateInput{Name: " Cleanup "})
	require.NoError(t, err)
	require.Same(t, created, result)
	db.AssertExpectations(t)
}

func TestTaskProgressMilestoneStaleEditCustom(t *testing.T) {
	db := mocks.NewDatabase()
	resolver := newResolver(db)
	db.TaskProgressTracker.On("FindMilestone", mock.Anything, 5).
		Return(&models.TaskProgressMilestone{ID: 5, Name: "Work", Version: 3}, nil).Once()
	_, err := resolver.Mutation().TaskProgressMilestoneUpdate(context.Background(), TaskProgressMilestoneUpdateInput{
		ID: "5", ExpectedVersion: 2,
	})
	require.Error(t, err)
	db.TaskProgressTracker.AssertNotCalled(t, "UpdateMilestone", mock.Anything, mock.Anything, mock.Anything)
	db.AssertExpectations(t)
}
