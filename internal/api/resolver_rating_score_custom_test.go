package api

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestUsesGroupSceneRatingCustom(t *testing.T) {
	require.False(t, usesGroupSceneRatingCustom(3))
	require.True(t, usesGroupSceneRatingCustom(4))
	require.True(t, usesGroupSceneRatingCustom(8))
}

func TestResetSceneAdvisorIfGroupBoundaryCrossedCustom(t *testing.T) {
	tests := []struct {
		name          string
		previousCount int
		updatedIDs    []int
		wantReset     bool
	}{
		{name: "default to group", previousCount: 3, updatedIDs: []int{1, 2, 3, 4}, wantReset: true},
		{name: "group to default", previousCount: 4, updatedIDs: []int{1, 2, 3}, wantReset: true},
		{name: "stays default", previousCount: 2, updatedIDs: []int{1, 2, 3}, wantReset: false},
		{name: "stays group", previousCount: 4, updatedIDs: []int{1, 2, 3, 4, 5}, wantReset: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := mocks.NewDatabase()
			resolver := newResolver(db)
			db.Scene.On("GetPerformerIDs", mock.Anything, 1).Return(tt.updatedIDs, nil).Once()
			if tt.wantReset {
				db.RatingScore.On("ResetSceneScores", mock.Anything, 1).Return(true, nil).Once()
			}

			err := resolver.resetSceneAdvisorIfGroupBoundaryCrossedCustom(context.Background(), 1, tt.previousCount)
			require.NoError(t, err)
			db.AssertExpectations(t)
		})
	}
}
