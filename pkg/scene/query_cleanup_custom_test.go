package scene

import (
	"context"
	"errors"
	"strconv"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	modelmocks "github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestPerformerSceneExclusionCountsCustom(t *testing.T) {
	for _, excludeTagID := range []int{0, 20} {
		t.Run("exclude="+strconv.Itoa(excludeTagID), func(t *testing.T) {
			reader := &modelmocks.SceneMarkerReaderWriter{}
			reader.On("Query", mock.Anything, mock.MatchedBy(func(filter *models.SceneMarkerFilterType) bool {
				group := filter.SceneMarkerTags.GroupsExtended[0]
				return filter.Tags.Value[0] == "10" && *filter.Tags.Depth == -1 &&
					len(group.TopPerformerIDs) == 1 && group.TopPerformerIDs[0] == "7" && len(group.BottomPerformerIDs) == 0
			}), mock.Anything).Return([]*models.SceneMarker{{SceneID: 1}, {SceneID: 1}, {SceneID: 2}}, 3, nil).Once()
			want := 2
			if excludeTagID != 0 {
				want = 1
				reader.On("Query", mock.Anything, mock.MatchedBy(func(filter *models.SceneMarkerFilterType) bool {
					group := filter.SceneMarkerTags.GroupsExtended[0]
					return filter.Tags.Value[0] == "20" && group.TopPerformerIDs[0] == "7" && group.BottomPerformerIDs[0] == "7"
				}), mock.Anything).Return([]*models.SceneMarker{{SceneID: 2}, {SceneID: 3}}, 2, nil).Once()
			}
			got, err := CountScenesByPerformerMarkerRoleExcluding(context.Background(), reader, 7, 10, "top", excludeTagID)
			require.NoError(t, err)
			require.Equal(t, want, got)
			reader.AssertExpectations(t)
		})
	}
}

func TestStudioSceneCountsDeduplicateAndRespectScopeCustom(t *testing.T) {
	for _, role := range []string{"", "top", "bottom"} {
		t.Run("role="+role, func(t *testing.T) {
			markers := &modelmocks.SceneMarkerReaderWriter{}
			scenes := &modelmocks.SceneReaderWriter{}
			performerID, depth := 7, -1
			scenes.On("Query", mock.Anything, mock.MatchedBy(func(options models.SceneQueryOptions) bool {
				filter := options.SceneFilter
				return filter.Studios.Value[0] == "9" && *filter.Studios.Depth == depth && filter.Performers.Value[0] == "7"
			})).Return(modelmocks.SceneQueryResult([]*models.Scene{{ID: 1}, {ID: 2}}, 2), nil).Once()
			markers.On("Query", mock.Anything, mock.MatchedBy(func(filter *models.SceneMarkerFilterType) bool {
				group := filter.SceneMarkerTags.GroupsExtended[0]
				return filter.Tags.Value[0] == "10" && *filter.Tags.Depth == -1 &&
					(len(group.TopPerformerIDs) > 0) == (role != "bottom") &&
					(len(group.BottomPerformerIDs) > 0) == (role != "top")
			}), mock.Anything).Return([]*models.SceneMarker{{SceneID: 1}, {SceneID: 1}, {SceneID: 2}, {SceneID: 3}}, 4, nil).Once()
			got, err := CountByStudioMarkerRole(context.Background(), markers, scenes, 9, &depth, 10, role, &performerID)
			require.NoError(t, err)
			require.Equal(t, 2, got)
			markers.AssertExpectations(t)
			scenes.AssertExpectations(t)
		})
	}
}

func TestSceneCountGuardsAndErrorsCustom(t *testing.T) {
	ctx := context.Background()
	got, err := CountScenesByPerformerMarkerRoleExcluding(ctx, nil, 7, 0, "top", 20)
	require.NoError(t, err)
	require.Zero(t, got)
	got, err = CountByStudioMarkerRole(ctx, nil, nil, 9, nil, 0, "", nil)
	require.NoError(t, err)
	require.Zero(t, got)

	queryErr := errors.New("query failed")
	markers := &modelmocks.SceneMarkerReaderWriter{}
	markers.On("Query", mock.Anything, mock.Anything, mock.Anything).Return(nil, 0, queryErr).Once()
	_, err = CountScenesByPerformerMarkerRoleExcluding(ctx, markers, 7, 10, "top", 20)
	require.ErrorIs(t, err, queryErr)
	markers.AssertExpectations(t)
}
