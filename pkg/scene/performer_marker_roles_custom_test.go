package scene

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/stashapp/stash/pkg/models"
	modelmocks "github.com/stashapp/stash/pkg/models/mocks"
)

func TestGetPerformerMarkerRolesForSceneBatchLoadsSceneDataOnce(t *testing.T) {
	ctx := context.Background()
	markerReader := &modelmocks.SceneMarkerReaderWriter{}
	tagFinder := &modelmocks.TagReaderWriter{}

	markers := []*models.SceneMarker{
		{ID: 10, SceneID: 1, PrimaryTagID: 101},
		{ID: 11, SceneID: 1, PrimaryTagID: 200},
	}
	performers := map[int][]*models.MarkerPerformer{
		10: {{PerformerID: 1, Role: "top"}, {PerformerID: 2, Role: "bottom"}},
		11: {{PerformerID: 2, Role: "top"}},
	}
	tags := map[int][]int{10: {300}, 11: {400}}

	markerReader.On("FindBySceneID", mock.Anything, 1).Return(markers, nil).Once()
	markerReader.On("GetPerformersForMarkers", mock.Anything, []int{10, 11}).Return(performers, nil).Once()
	markerReader.On("GetTagIDsForMarkers", mock.Anything, []int{10, 11}).Return(tags, nil).Once()
	tagFinder.On("FindAllDescendants", mock.Anything, 100, mock.Anything).Return([]*models.TagPath{{Tag: models.Tag{ID: 101}}}, nil).Once()
	tagFinder.On("FindAllDescendants", mock.Anything, 200, mock.Anything).Return([]*models.TagPath{}, nil).Once()
	tagFinder.On("FindAllDescendants", mock.Anything, 300, mock.Anything).Return([]*models.TagPath{}, nil).Once()
	tagFinder.On("FindAllDescendants", mock.Anything, 400, mock.Anything).Return([]*models.TagPath{}, nil).Once()

	roles, err := GetPerformerMarkerRolesForSceneBatch(ctx, markerReader, tagFinder, 1, 100, 200, 0, 300, 400, 0, 0)

	require.NoError(t, err)
	require.Equal(t, []string{"sex_top", "facial_top_1", "facial_unique_1", "sex_top_partners_1", "sex_all_partners_1", "facial_top_partners_1", "facial_all_partners_1", "sex_top_pids:2", "facial_top_pids:2"}, roles[1])
	require.Equal(t, []string{"sex_bottom", "oral_top", "facial_bottom_1", "facial_unique_1", "sex_bottom_partners_1", "sex_all_partners_1", "facial_bottom_partners_1", "facial_all_partners_1", "sex_bottom_pids:1", "facial_bottom_pids:1", "orgasm_top_1"}, roles[2])
	markerReader.AssertExpectations(t)
	tagFinder.AssertExpectations(t)
}

func TestGetPerformerMarkerRolesForSceneReturnsEmptyForNonParticipant(t *testing.T) {
	ctx := context.Background()
	markerReader := &modelmocks.SceneMarkerReaderWriter{}
	tagFinder := &modelmocks.TagReaderWriter{}

	markerReader.On("FindBySceneID", mock.Anything, 1).Return([]*models.SceneMarker{}, nil).Once()

	roles, err := GetPerformerMarkerRolesForScene(ctx, markerReader, tagFinder, 99, 1, 0, 0, 0, 0, 0, 0, 0)

	require.NoError(t, err)
	require.Empty(t, roles)
	markerReader.AssertExpectations(t)
}
