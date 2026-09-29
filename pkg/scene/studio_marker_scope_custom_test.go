package scene

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	modelmocks "github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestStudioMarkerScopeCustom(t *testing.T) {
	require.Equal(t, []string{"-1"}, studioMarkerSceneCriterionCustom(nil).Value)
	require.Equal(t, []string{"1", "2"}, studioMarkerSceneCriterionCustom(map[int]bool{2: true, 1: true, 3: false}).Value)
	reader := &modelmocks.SceneMarkerReaderWriter{}
	performer := 7
	reader.On("Query", mock.Anything, mock.MatchedBy(func(filter *models.SceneMarkerFilterType) bool {
		return filter.Scenes != nil && filter.Scenes.Modifier == models.CriterionModifierIncludes &&
			len(filter.Scenes.Value) == 1 && filter.Scenes.Value[0] == "42" &&
			filter.Tags.Value[0] == "10" && *filter.Tags.Depth == -1 &&
			filter.SceneMarkerTags.GroupsExtended[0].TopPerformerIDs[0] == "7"
	}), mock.Anything).Return([]*models.SceneMarker{{SceneID: 42}, {SceneID: 42}}, 2, nil).Once()
	got, err := getStudioScenesWithMarkerTag(context.Background(), reader, map[int]bool{42: true}, 10, "top", &performer)
	require.NoError(t, err)
	require.Equal(t, map[int]bool{42: true}, got)
	reader.AssertExpectations(t)
}

func TestStudioSceneIDsCustomDoesNotHydrateScenes(t *testing.T) {
	reader := &modelmocks.SceneReaderWriter{}
	depth, performer := -1, 7
	reader.On("Query", mock.Anything, mock.MatchedBy(func(options models.SceneQueryOptions) bool {
		return !options.Count && *options.FindFilter.PerPage == -1 &&
			options.SceneFilter.Studios.Value[0] == "10" && options.SceneFilter.Studios.Depth == &depth &&
			options.SceneFilter.Performers.Value[0] == "7"
	})).Return(&models.SceneQueryResult{QueryResult: models.QueryResult[int]{IDs: []int{42, 43}}}, nil).Once()
	got, err := getStudioSceneIDs(context.Background(), reader, 10, &depth, &performer)
	require.NoError(t, err)
	require.Equal(t, map[int]bool{42: true, 43: true}, got)
	reader.AssertExpectations(t)
}
