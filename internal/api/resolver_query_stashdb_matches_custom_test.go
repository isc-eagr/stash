package api

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestStashDBMatchesReportCustom(t *testing.T) {
	db := mocks.NewDatabase()
	endpoint := "https://stashdb.org/graphql"
	previous := 2
	report := &models.StashDBMatchesReportCustom{
		Endpoint: &endpoint,
		Changes: []models.StashDBMatchesChangeCustom{
			{SceneID: 1, Previous: &previous, Current: 4},
		},
		Unsubmitted: []models.StashDBUnsubmittedSceneCustom{
			{SceneID: 1, StashID: "changed", Matches: 4},
			{SceneID: 2, StashID: "unchanged", Matches: 0},
			{SceneID: 3, StashID: "deleted", Matches: 8},
		},
	}
	db.Scene.On("GetStashDBMatchesReportCustom", mock.Anything).Return(report, nil).Once()
	db.Scene.On("FindByIDs", mock.Anything, []int{1, 1, 2, 3}).
		Return([]*models.Scene{{ID: 1}, {ID: 2}}, nil).Once()

	got, err := newResolver(db).Query().StashDBMatchesReport(context.Background())
	require.NoError(t, err)
	require.Equal(t, &endpoint, got.Endpoint)
	require.Len(t, got.Changes, 1, "main report only contains changed counts")
	require.Equal(t, 1, got.Changes[0].Scene.ID)
	require.Len(t, got.Unsubmitted, 2, "submission section includes unchanged scenes and omits deleted scenes")
	require.Equal(t, "unchanged", got.Unsubmitted[1].StashID)
	require.Equal(t, 0, got.Unsubmitted[1].Matches)
	db.AssertExpectations(t)
}
